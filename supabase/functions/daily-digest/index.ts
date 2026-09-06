import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendTextMessage } from '../_shared/whatsappClient.ts';
import {
  fetchTripContext,
  localDateIso,
  youngestWithHeight,
  addDaysIso,
  resolveDigestTriggers,
  type DigestMode,
} from '../_shared/tripContext.ts';
import { formatDailyDigest } from '../_shared/formatter.ts';

const DIGEST_LEAD_DAYS = 1;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Digest diário: de manhã (digest_time) envia o resumo de HOJE, à noite
 * (evening_digest_time) a prévia de AMANHÃ — cada um com lembretes (tarefas ≤
 * 48h, voo ≤ 24h) no privado de cada participante com whatsapp_phone
 * cadastrado. Disparado por pg_cron (header x-cron-secret) ou manualmente via
 * curl; roda 1x/hora, resolveDigestTriggers decide o que (não) enviar.
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
    .select('tenant_id, phone_number_id, digest_time, evening_digest_time, timezone')
    .eq('enabled', true);
  if (error) return json({ error: `Erro ao carregar configs: ${error.message}` }, 500);

  // Disparo manual de teste: ignora a checagem de hora/janela (mesma auth do cron).
  // ?mode=tomorrow força a prévia noturna em vez do digest de hoje.
  const forceSend = request.headers.get('x-force-send') === cronSecret;
  const url = new URL(request.url);
  const dateOverride = forceSend ? url.searchParams.get('date') : null;
  const forceMode: DigestMode = forceSend && url.searchParams.get('mode') === 'tomorrow' ? 'tomorrow' : 'today';

  const now = new Date();
  const summary: Record<string, string> = {};

  for (const config of configs ?? []) {
    const todayIso = dateOverride ?? localDateIso(now, config.timezone);
    const localHour = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone,
      hour: '2-digit',
      hour12: false,
    }).format(now);

    const triggers = forceSend
      ? [{ mode: forceMode, dateIso: forceMode === 'tomorrow' ? addDaysIso(todayIso, 1) : todayIso }]
      : resolveDigestTriggers({
          localHour,
          todayIso,
          digestTime: String(config.digest_time),
          eveningDigestTime: String(config.evening_digest_time),
        });

    if (triggers.length === 0) {
      summary[config.tenant_id] = `skipped:hora-local ${localHour} não bate com digest_time nem evening_digest_time`;
      continue;
    }

    const results: string[] = [];
    for (const trigger of triggers) {
      results.push(await sendDigestForTrigger(supabase, config, trigger, metaToken));
    }
    summary[config.tenant_id] = results.join(' | ');
  }

  return json({ summary });
});

async function sendDigestForTrigger(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  config: { tenant_id: string; phone_number_id: string; timezone: string },
  trigger: { mode: DigestMode; dateIso: string },
  metaToken: string,
): Promise<string> {
  const { dateIso, mode } = trigger;
  try {
    const ctx = await fetchTripContext(supabase, config.tenant_id, dateIso);
    if (!ctx.trip) return `${mode}:skipped:sem-viagem-ativa`;

    // Só envia digest a partir de DIGEST_LEAD_DAYS antes do início da viagem até o fim.
    const windowStart = addDaysIso(ctx.trip.start_date, -DIGEST_LEAD_DAYS);
    if (dateIso < windowStart || dateIso > ctx.trip.end_date) {
      return `${mode}:skipped:fora-da-janela (${windowStart} a ${ctx.trip.end_date})`;
    }

    const child = youngestWithHeight(ctx.participants);
    const text = formatDailyDigest({
      tripTitle: ctx.trip.title,
      dateIso,
      mode,
      items: ctx.todayItems.map(i => ({
        date: String(i.date),
        time_start: String(i.time_start ?? '').slice(0, 5),
        time_end: i.time_end ? String(i.time_end).slice(0, 5) : null,
        title: String(i.title),
        category: String(i.category),
        city: String(i.city ?? ''),
        park: (i.park as string | null) ?? null,
        min_height_cm: (i.min_height_cm as number | null) ?? null,
        notes: (i.notes as string | null) ?? null,
      })),
      tasksDueSoon: ctx.tasksDueSoon.map(t => ({
        title: String(t.title),
        due_date: t.due_date ? String(t.due_date) : null,
        priority: String(t.priority),
      })),
      nextFlight: ctx.nextFlight
        ? {
            airline: String(ctx.nextFlight.airline),
            flight_number: String(ctx.nextFlight.flight_number),
            origin_airport: String(ctx.nextFlight.origin_airport),
            destination_airport: String(ctx.nextFlight.destination_airport),
            departure_time: String(ctx.nextFlight.departure_time),
            booking_code: String(ctx.nextFlight.booking_code),
          }
        : null,
      child: child ? { nickname: child.nickname ?? child.full_name, height_cm: child.height_cm } : null,
      timezone: config.timezone,
    });

    const recipients = ctx.participants.filter((p: { whatsapp_phone: string | null }) => p.whatsapp_phone);
    if (recipients.length === 0) return `${mode}:skipped:sem-telefones`;

    let sentCount = 0;
    const failures: string[] = [];
    for (const recipient of recipients) {
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
          kind: 'digest',
        });
        sentCount++;
      } catch (err) {
        // Um destinatário sem janela de 24h aberta (ou outro erro pontual) não
        // deve travar o envio pros demais.
        console.error(`[daily-digest] Falha ao enviar para ${phone}:`, err);
        failures.push(phone);
      }
    }
    return `${mode}:sent:${sentCount}${failures.length ? ` failed:${failures.join(',')}` : ''}`;
  } catch (err) {
    console.error(`[daily-digest] Falha no tenant ${config.tenant_id} (${mode}):`, err);
    return `${mode}:error`;
  }
}
