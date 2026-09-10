import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { sendTextMessage } from '../_shared/whatsappClient.ts';
import {
  localDateIso,
  resolveActiveTrip,
  addDaysIso,
  type ParticipantRow,
} from '../_shared/tripContext.ts';
import { isWithinQuietHours, localMinutesOfDay } from '../_shared/reminderScheduler.ts';
import { selectOverdueItemsForCheckin, type CheckinCandidate } from '../_shared/checkinScheduler.ts';
import { formatItineraryCheckin } from '../_shared/formatter.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface ConfigRow {
  tenant_id: string;
  phone_number_id: string;
  timezone: string;
  checkin_grace_minutes: number;
  checkin_cooldown_minutes: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

/**
 * Reconciliação do roteiro com a realidade: itens que já passaram do horário
 * sem ninguém marcar como feito viram uma pergunta em lote ("isso rolou?").
 * A resposta é resolvida pelo chat normal do bot (whatsapp-webhook), via a
 * tool `confirm_itinerary_outcome` — esta function só detecta e pergunta.
 *
 * Sempre em lote, nunca item a item: ver checkinScheduler.ts.
 */
Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Método não suportado.' }, 405);

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'Não autorizado.' }, 401);
  }

  const metaToken = Deno.env.get('META_WA_TOKEN');
  if (!metaToken) return json({ error: 'META_WA_TOKEN não configurado.' }, 500);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return json({ error: 'Service role key ausente no servidor.' }, 500);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  const { data: configs, error } = await supabase
    .from('whatsapp_configs')
    .select('tenant_id, phone_number_id, timezone, checkin_grace_minutes, checkin_cooldown_minutes, quiet_hours_start, quiet_hours_end')
    .eq('enabled', true)
    .eq('checkins_enabled', true);
  if (error) return json({ error: `Erro ao carregar configs: ${error.message}` }, 500);

  const now = new Date();
  const summary: Record<string, string> = {};

  for (const config of (configs ?? []) as ConfigRow[]) {
    try {
      summary[config.tenant_id] = await processTenant(supabase, config, now, metaToken);
    } catch (err) {
      console.error(`[activity-checkins] Falha no tenant ${config.tenant_id}:`, err);
      summary[config.tenant_id] = 'error';
    }
    console.log(`[activity-checkins] ${config.tenant_id}: ${summary[config.tenant_id]}`);
  }

  return json({ summary });
});

async function processTenant(
  supabase: SupabaseClient,
  config: ConfigRow,
  now: Date,
  metaToken: string,
): Promise<string> {
  const todayIso = localDateIso(now, config.timezone);
  const nowLocalMinutes = localMinutesOfDay(now, config.timezone);

  // Silêncio adia: uma família não deve ser questionada sobre o roteiro
  // durante a janela de silêncio, mesmo que o backlog cresça um pouco mais.
  if (isWithinQuietHours(nowLocalMinutes, config.quiet_hours_start, config.quiet_hours_end)) {
    return 'skipped:janela-de-silencio';
  }

  const trip = await resolveActiveTrip(supabase, config.tenant_id, todayIso);
  if (!trip) return 'skipped:sem-viagem-ativa';
  if (todayIso < trip.start_date || todayIso > trip.end_date) return 'skipped:fora-da-viagem';

  const yesterdayIso = addDaysIso(todayIso, -1);
  const [itemsRes, lastCheckinRes] = await Promise.all([
    supabase
      .from('itinerary_items')
      .select('id, date, time_start, time_end, title, participant_status')
      .eq('trip_id', trip.id)
      .in('date', [yesterdayIso, todayIso])
      .order('time_start', { ascending: true }),
    supabase
      .from('itinerary_item_outcomes')
      .select('asked_at')
      .eq('trip_id', trip.id)
      .order('asked_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (itemsRes.error) throw new Error(`Erro ao consultar roteiro: ${itemsRes.error.message}`);
  if (lastCheckinRes.error) throw new Error(`Erro ao consultar último check-in: ${lastCheckinRes.error.message}`);

  const rawItems = (itemsRes.data ?? []) as (CheckinCandidate & { participant_status: Record<string, string> | null })[];
  const itemIds = rawItems.map(i => i.id);

  // Itens já com uma linha em itinerary_item_outcomes (perguntados, pulados ou
  // cancelados) não voltam a ser candidatos — essa tabela é o próprio estado
  // do que já foi tratado, não só um log.
  const { data: existingOutcomes, error: outcomesErr } = await supabase
    .from('itinerary_item_outcomes')
    .select('itinerary_item_id')
    .in('itinerary_item_id', itemIds.length > 0 ? itemIds : ['00000000-0000-0000-0000-000000000000']);
  if (outcomesErr) throw new Error(`Erro ao consultar pendências já tratadas: ${outcomesErr.message}`);
  const alreadyTracked = new Set((existingOutcomes ?? []).map(o => o.itinerary_item_id));

  const candidates: CheckinCandidate[] = rawItems
    .filter(i => !alreadyTracked.has(i.id))
    .filter(i => !i.participant_status || Object.keys(i.participant_status).length === 0)
    .map(({ id, date, time_start, time_end, title }) => ({ id, date, time_start, time_end, title }));

  const minutesSinceLastCheckin = lastCheckinRes.data
    ? Math.floor((now.getTime() - new Date(lastCheckinRes.data.asked_at).getTime()) / 60_000)
    : null;

  const due = selectOverdueItemsForCheckin({
    items: candidates,
    nowLocalDateIso: todayIso,
    nowLocalMinutes,
    graceMinutes: config.checkin_grace_minutes,
    minutesSinceLastCheckin,
    cooldownMinutes: config.checkin_cooldown_minutes,
  });
  if (due.length === 0) return 'skipped:nada-pendente-ou-cooldown';

  const { data: participants, error: partErr } = await supabase
    .from('participants')
    .select('id, full_name, nickname, is_minor, height_cm, whatsapp_phone')
    .eq('trip_id', trip.id);
  if (partErr) throw new Error(`Erro ao consultar participantes: ${partErr.message}`);

  const recipients = ((participants ?? []) as ParticipantRow[]).filter(p => p.whatsapp_phone);
  if (recipients.length === 0) return 'skipped:sem-telefones';

  // Reserva as linhas ANTES de enviar (mesma ordem do activity-reminders): se
  // o envio falhar a seguir, o backlog dessa reserva é liberado, não perdido.
  const askedAt = now.toISOString();
  const { error: insertErr } = await supabase.from('itinerary_item_outcomes').insert(
    due.map(item => ({
      tenant_id: config.tenant_id,
      trip_id: trip.id,
      itinerary_item_id: item.id,
      status: 'pending',
      asked_at: askedAt,
    })),
  );
  if (insertErr) throw new Error(`Erro ao registrar check-in: ${insertErr.message}`);

  const text = formatItineraryCheckin(due);
  let sentCount = 0;
  const failures: string[] = [];

  for (const recipient of recipients) {
    const phone = recipient.whatsapp_phone!.replace(/\D/g, '');
    try {
      const sent = await sendTextMessage({ phoneNumberId: config.phone_number_id, accessToken: metaToken, to: phone, text });
      await supabase.from('whatsapp_messages').insert({
        tenant_id: config.tenant_id,
        wa_message_id: sent.waMessageId,
        direction: 'outbound',
        sender_phone: phone,
        body: text,
        kind: 'checkin',
      });
      sentCount++;
    } catch (err) {
      console.error(`[activity-checkins] Falha ao enviar para ${phone}:`, err);
      failures.push(phone);
    }
  }

  // Falha em ENVIAR não desfaz a reserva: a pergunta ainda é válida (alguém
  // pode ter recebido), e a próxima execução não deve reperguntar os mesmos
  // itens — evitar duplicidade importa mais aqui que garantir reenvio.
  return `asked:${due.length} sent:${sentCount}${failures.length ? ` failed:${failures.join(',')}` : ''}`;
}
