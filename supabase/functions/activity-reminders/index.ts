import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { sendTextMessage } from '../_shared/whatsappClient.ts';
import {
  ITINERARY_COLUMNS,
  localDateIso,
  resolveActiveTrip,
  youngestWithHeight,
  addDaysIso,
  type ParticipantRow,
} from '../_shared/tripContext.ts';
import {
  isWithinQuietHours,
  localMinutesOfDay,
  selectDueReminders,
  type ReminderCandidate,
} from '../_shared/reminderScheduler.ts';
import { formatActivityReminder } from '../_shared/formatter.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface ConfigRow {
  tenant_id: string;
  phone_number_id: string;
  timezone: string;
  reminder_lead_minutes: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

/**
 * Avisos de atividade por horário. Roda a cada 10 min via pg_cron e envia o
 * lembrete de cada item cujo início já entrou na janela de antecedência.
 *
 * A idempotência é do banco, não do agendamento: a chave única de
 * `activity_reminders` (item, participante, tipo) é o que garante um único
 * envio, então reexecuções e sobreposições de janela são seguras por
 * construção — e uma execução perdida é recuperada pela seguinte.
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
    .select('tenant_id, phone_number_id, timezone, reminder_lead_minutes, quiet_hours_start, quiet_hours_end')
    .eq('enabled', true)
    .eq('reminders_enabled', true);
  if (error) return json({ error: `Erro ao carregar configs: ${error.message}` }, 500);

  const now = new Date();
  const summary: Record<string, string> = {};

  for (const config of (configs ?? []) as ConfigRow[]) {
    try {
      summary[config.tenant_id] = await processTenant(supabase, config, now, metaToken);
    } catch (err) {
      console.error(`[activity-reminders] Falha no tenant ${config.tenant_id}:`, err);
      summary[config.tenant_id] = 'error';
    }
    console.log(`[activity-reminders] ${config.tenant_id}: ${summary[config.tenant_id]}`);
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

  // Silêncio adia, não cancela: o aviso represado sai na primeira rodada depois
  // da janela, desde que a atividade ainda não tenha começado.
  if (isWithinQuietHours(nowLocalMinutes, config.quiet_hours_start, config.quiet_hours_end)) {
    return 'skipped:janela-de-silencio';
  }

  const trip = await resolveActiveTrip(supabase, config.tenant_id, todayIso);
  if (!trip) return 'skipped:sem-viagem-ativa';
  if (todayIso < trip.start_date || todayIso > trip.end_date) return 'skipped:fora-da-viagem';

  const tomorrowIso = addDaysIso(todayIso, 1);
  const { data: rawItems, error: itemsErr } = await supabase
    .from('itinerary_items')
    .select(ITINERARY_COLUMNS)
    .eq('trip_id', trip.id)
    .in('date', [todayIso, tomorrowIso])
    .order('time_start', { ascending: true });
  if (itemsErr) throw new Error(`Erro ao consultar roteiro: ${itemsErr.message}`);

  const due = selectDueReminders({
    items: (rawItems ?? []) as unknown as ReminderCandidate[],
    nowLocalDateIso: todayIso,
    nowLocalMinutes,
    defaultLeadMinutes: config.reminder_lead_minutes,
  });
  if (due.length === 0) return 'skipped:nada-na-janela';

  const { data: participants, error: partErr } = await supabase
    .from('participants')
    .select('id, full_name, nickname, is_minor, height_cm, whatsapp_phone')
    .eq('trip_id', trip.id);
  if (partErr) throw new Error(`Erro ao consultar participantes: ${partErr.message}`);

  const roster = (participants ?? []) as ParticipantRow[];
  const recipients = roster.filter(p => p.whatsapp_phone);
  if (recipients.length === 0) return 'skipped:sem-telefones';

  const child = youngestWithHeight(roster);
  const childInfo = child ? { nickname: child.nickname ?? child.full_name, height_cm: child.height_cm } : null;

  // Pré-consulta do ledger: evita reprocessar (e refalhar no unique) os avisos
  // já enviados, que continuam "na janela" por várias execuções seguidas.
  const { data: alreadySent, error: ledgerErr } = await supabase
    .from('activity_reminders')
    .select('itinerary_item_id, participant_id')
    .eq('kind', 'lead')
    .in('itinerary_item_id', due.map(d => d.item.id));
  if (ledgerErr) throw new Error(`Erro ao consultar avisos enviados: ${ledgerErr.message}`);

  const sentKeys = new Set((alreadySent ?? []).map(r => `${r.itinerary_item_id}:${r.participant_id}`));

  let sentCount = 0;
  let skippedCount = 0;
  const failures: string[] = [];

  for (const reminder of due) {
    const text = formatActivityReminder({
      item: {
        time_start: reminder.item.time_start,
        title: reminder.item.title,
        category: reminder.item.category,
        park: reminder.item.park,
        city: reminder.item.city,
        notes: reminder.item.notes,
        min_height_cm: reminder.item.min_height_cm,
      },
      minutesUntil: reminder.minutesUntil,
      child: childInfo,
    });

    for (const recipient of recipients) {
      if (sentKeys.has(`${reminder.item.id}:${recipient.id}`)) {
        skippedCount++;
        continue;
      }

      // Reserva antes de enviar: se o processo morrer entre reserva e envio,
      // perde-se um aviso; a ordem inversa mandaria o mesmo aviso duas vezes,
      // que é o erro mais visível para a família.
      const { data: claim, error: claimErr } = await supabase
        .from('activity_reminders')
        .insert({
          tenant_id: config.tenant_id,
          trip_id: trip.id,
          itinerary_item_id: reminder.item.id,
          participant_id: recipient.id,
          kind: 'lead',
          lead_minutes: reminder.leadMinutes,
          scheduled_for: new Date(now.getTime() + reminder.minutesUntil * 60_000).toISOString(),
        })
        .select('id')
        .single();

      if (claimErr) {
        if (claimErr.code === '23505') {
          skippedCount++;
          continue;
        }
        throw new Error(`Erro ao registrar aviso: ${claimErr.message}`);
      }

      const phone = recipient.whatsapp_phone!.replace(/\D/g, '');
      try {
        const sent = await sendTextMessage({
          phoneNumberId: config.phone_number_id,
          accessToken: metaToken,
          to: phone,
          text,
        });
        await supabase.from('whatsapp_messages').insert({
          tenant_id: config.tenant_id,
          wa_message_id: sent.waMessageId,
          direction: 'outbound',
          sender_phone: phone,
          body: text,
          kind: 'reminder',
        });
        sentCount++;
      } catch (err) {
        // Libera a reserva para a próxima execução tentar de novo enquanto a
        // atividade não começar (janela de 24h fechada, erro pontual da Meta).
        console.error(`[activity-reminders] Falha ao enviar para ${phone}:`, err);
        await supabase.from('activity_reminders').delete().eq('id', claim.id);
        failures.push(phone);
      }
    }
  }

  return `sent:${sentCount} skipped:${skippedCount}${failures.length ? ` failed:${failures.join(',')}` : ''}`;
}
