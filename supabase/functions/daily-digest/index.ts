import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendTextMessage } from '../_shared/whatsappClient.ts';
import {
  fetchTripContext,
  localDateIso,
  youngestWithHeight,
  addDaysIso,
  resolveDigestTriggers,
  resolveExchangeRate,
  type DigestMode,
} from '../_shared/tripContext.ts';
import { formatDailyDigest, formatBudgetCheckinMessage } from '../_shared/formatter.ts';
import { fetchDailyWeather } from '../_shared/weather.ts';
import { fetchParkDayStatus } from '../_shared/parkStatus.ts';
import { formatConditionsAlertMessage, selectConditionAlerts } from '../_shared/conditionsAlert.ts';

const CONDITIONS_ALERT_COOLDOWN_HOURS = 12;

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
    .select('tenant_id, phone_number_id, digest_time, evening_digest_time, timezone, quiet_hours_start, quiet_hours_end')
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

    // Roda em TODA execução horária, independente de digest_time — é o que
    // permite avisar de chuva/parque fechado antes do organizador sair de
    // manhã, sem depender de um cron dedicado (ver conditionsAlert.ts).
    const conditionsResult = await checkConditionsAlert(supabase, config, todayIso, now, metaToken);
    if (conditionsResult) summary[`${config.tenant_id}:conditions`] = conditionsResult;

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
    const weather = await fetchDailyWeather({ destination: ctx.trip.destination_main, dateIso, timeZone: config.timezone });

    // Parque predominante do dia (mais itens) — best-effort, nunca bloqueia o digest.
    const parkCounts = new Map<string, number>();
    for (const i of ctx.todayItems) {
      const park = i.park as string | null;
      if (park) parkCounts.set(park, (parkCounts.get(park) ?? 0) + 1);
    }
    const predominantPark = [...parkCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const parkStatus = predominantPark
      ? await fetchParkDayStatus(supabase, {
          park: predominantPark,
          dateIso,
          items: ctx.todayItems.map(i => ({
            id: String(i.id),
            title: String(i.title),
            external_entity_id: (i.external_entity_id as string | null) ?? null,
          })),
        })
      : null;

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
      weather,
      parkStatus,
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
    let result = `${mode}:sent:${sentCount}${failures.length ? ` failed:${failures.join(',')}` : ''}`;

    // Só no digest de HOJE (não na prévia de amanhã) — o gasto de um dia só
    // faz sentido perguntar depois que ele começou.
    if (mode === 'today') {
      const budgetResult = await sendBudgetCheckin(supabase, config, ctx, dateIso, metaToken);
      if (budgetResult) result += ` | ${budgetResult}`;
    }

    return result;
  } catch (err) {
    console.error(`[daily-digest] Falha no tenant ${config.tenant_id} (${mode}):`, err);
    return `${mode}:error`;
  }
}

/**
 * Envia o checkin diário de orçamento (custo estimado do dia + pergunta de
 * gasto real) a quem tem can_manage_budget, como mensagem separada do
 * digest — mesmo racional de checkConditionsAlert: só quem pode agir no
 * assunto recebe. Reaproveita ctx (já carregado por sendDigestForTrigger),
 * sem round-trip extra ao banco além da cotação de câmbio.
 */
async function sendBudgetCheckin(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  config: { tenant_id: string; phone_number_id: string },
  ctx: Awaited<ReturnType<typeof fetchTripContext>>,
  dateIso: string,
  metaToken: string,
): Promise<string | null> {
  const organizers = ctx.participants.filter(p => p.whatsapp_phone && p.can_manage_budget);
  if (organizers.length === 0) return null;

  const exchangeRate = await resolveExchangeRate(supabase, dateIso);
  let estimatedUsd = 0;
  for (const item of ctx.todayItems) {
    const cost = Number(item.estimated_cost ?? 0);
    if (!cost) continue;
    estimatedUsd += item.currency === 'BRL' ? cost / exchangeRate : cost;
  }

  const text = formatBudgetCheckinMessage(dateIso, estimatedUsd);
  let sentCount = 0;
  for (const organizer of organizers) {
    const phone = organizer.whatsapp_phone!.replace(/\D/g, '');
    try {
      const sent = await sendTextMessage({ phoneNumberId: config.phone_number_id, accessToken: metaToken, to: phone, text });
      await supabase.from('whatsapp_messages').insert({
        tenant_id: config.tenant_id,
        wa_message_id: sent.waMessageId,
        direction: 'outbound',
        sender_phone: phone,
        body: text,
        kind: 'budget_checkin',
      });
      sentCount++;
    } catch (err) {
      console.error(`[daily-digest] Falha ao enviar checkin de orçamento para ${phone}:`, err);
    }
  }
  return `budget:sent:${sentCount}`;
}

/**
 * Verifica clima/status de parque contra o roteiro de hoje e, se algo pedir
 * atenção, manda UMA mensagem (nunca uma por condição) para quem tem
 * can_manage_itinerary — é a única mensagem não solicitada com chamada à
 * ação, então só para quem pode de fato agir nela. Cooldown de 12h + quiet
 * hours ficam em conditionsAlert.ts (puro, testado); aqui só o I/O: busca de
 * contexto, dedupe via whatsapp_messages e envio.
 */
async function checkConditionsAlert(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  config: { tenant_id: string; phone_number_id: string; timezone: string; quiet_hours_start: string | null; quiet_hours_end: string | null },
  todayIso: string,
  now: Date,
  metaToken: string,
): Promise<string | null> {
  try {
    const ctx = await fetchTripContext(supabase, config.tenant_id, todayIso);
    if (!ctx.trip) return null;
    if (todayIso < ctx.trip.start_date || todayIso > ctx.trip.end_date) return null;

    const organizers = ctx.participants.filter((p: { whatsapp_phone: string | null; can_manage_itinerary?: boolean }) => p.whatsapp_phone && p.can_manage_itinerary);
    if (organizers.length === 0) return 'skipped:sem-organizador-com-telefone';

    const { data: recentAlert } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('tenant_id', config.tenant_id)
      .eq('direction', 'outbound')
      .contains('payload', { alert: 'conditions' })
      .gte('created_at', new Date(now.getTime() - CONDITIONS_ALERT_COOLDOWN_HOURS * 60 * 60_000).toISOString())
      .limit(1);
    const alreadyAlertedToday = (recentAlert?.length ?? 0) > 0;

    const weather = await fetchDailyWeather({ destination: ctx.trip.destination_main, dateIso: todayIso, timeZone: config.timezone });

    const parkCounts = new Map<string, number>();
    for (const i of ctx.todayItems) {
      const park = i.park as string | null;
      if (park) parkCounts.set(park, (parkCounts.get(park) ?? 0) + 1);
    }
    const predominantPark = [...parkCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const parkStatus = predominantPark
      ? await fetchParkDayStatus(supabase, {
          park: predominantPark,
          dateIso: todayIso,
          items: ctx.todayItems.map(i => ({ id: String(i.id), title: String(i.title), external_entity_id: (i.external_entity_id as string | null) ?? null })),
        })
      : null;

    const localMinutesStr = new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const [lh, lm] = localMinutesStr.split(':').map(Number);
    const localMinutes = lh * 60 + lm;

    const alerts = selectConditionAlerts({
      items: ctx.todayItems.map(i => ({ park: (i.park as string | null) ?? null })),
      weather,
      parkStatus,
      localMinutes,
      quietHoursStart: config.quiet_hours_start ?? '22:00',
      quietHoursEnd: config.quiet_hours_end ?? '07:00',
      alreadyAlertedToday,
    });

    if (alerts.length === 0) return null;

    const text = formatConditionsAlertMessage(alerts);
    let sentCount = 0;
    for (const organizer of organizers) {
      const phone = organizer.whatsapp_phone!.replace(/\D/g, '');
      try {
        const sent = await sendTextMessage({ phoneNumberId: config.phone_number_id, accessToken: metaToken, to: phone, text });
        await supabase.from('whatsapp_messages').insert({
          tenant_id: config.tenant_id,
          wa_message_id: sent.waMessageId,
          direction: 'outbound',
          sender_phone: phone,
          body: text,
          kind: 'alert',
          payload: { alert: 'conditions', date: todayIso },
        });
        sentCount++;
      } catch (err) {
        console.error(`[daily-digest] Falha ao enviar alerta de condições para ${phone}:`, err);
      }
    }
    return `conditions:sent:${sentCount}`;
  } catch (err) {
    console.error(`[daily-digest] Falha ao checar condições do tenant ${config.tenant_id}:`, err);
    return 'conditions:error';
  }
}
