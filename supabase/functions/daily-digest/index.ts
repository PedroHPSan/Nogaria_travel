import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendTextMessage } from '../_shared/whatsappClient.ts';
import { fetchTripContext, localDateIso, youngestWithHeight, addDaysIso } from '../_shared/tripContext.ts';
import { formatDailyDigest } from '../_shared/formatter.ts';

const DIGEST_LEAD_DAYS = 1;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Digest diário: envia a lista de atividades do dia + lembretes (tarefas ≤ 48h,
 * voo ≤ 24h) no privado de cada participante com whatsapp_phone cadastrado.
 * Disparado por pg_cron (header x-cron-secret) ou manualmente via curl.
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
    .select('tenant_id, phone_number_id, digest_time, timezone')
    .eq('enabled', true);
  if (error) return json({ error: `Erro ao carregar configs: ${error.message}` }, 500);

  // Disparo manual de teste: ignora a checagem de hora/janela (mesma auth do cron).
  // Útil pra validar o formato do digest antes da janela real abrir.
  const forceSend = request.headers.get('x-force-send') === cronSecret;
  const dateOverride = forceSend ? new URL(request.url).searchParams.get('date') : null;

  const now = new Date();
  const summary: Record<string, string> = {};

  for (const config of configs ?? []) {
    const todayIso = dateOverride ?? localDateIso(now, config.timezone);

    // Roda 1x/hora; só envia quando a hora local bate com a digest_time do tenant.
    const digestHour = String(config.digest_time).slice(0, 2);
    const localHour = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone,
      hour: '2-digit',
      hour12: false,
    }).format(now);
    if (!forceSend && localHour !== digestHour) {
      summary[config.tenant_id] = `skipped:hora-local ${localHour} != ${digestHour}`;
      continue;
    }

    try {
      const ctx = await fetchTripContext(supabase, config.tenant_id, todayIso);
      if (!ctx.trip) {
        summary[config.tenant_id] = 'skipped:sem-viagem-ativa';
        continue;
      }

      // Só envia digest a partir de DIGEST_LEAD_DAYS antes do início da viagem até o fim.
      const windowStart = addDaysIso(ctx.trip.start_date, -DIGEST_LEAD_DAYS);
      if (!forceSend && (todayIso < windowStart || todayIso > ctx.trip.end_date)) {
        summary[config.tenant_id] = `skipped:fora-da-janela (${windowStart} a ${ctx.trip.end_date})`;
        continue;
      }

      const child = youngestWithHeight(ctx.participants);
      const text = formatDailyDigest({
        tripTitle: ctx.trip.title,
        dateIso: todayIso,
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
      });

      const recipients = ctx.participants.filter(p => p.whatsapp_phone);
      if (recipients.length === 0) {
        summary[config.tenant_id] = 'skipped:sem-telefones';
        continue;
      }

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
          });
          sentCount++;
        } catch (err) {
          // Um destinatário sem janela de 24h aberta (ou outro erro pontual) não
          // deve travar o envio pros demais.
          console.error(`[daily-digest] Falha ao enviar para ${phone}:`, err);
          failures.push(phone);
        }
      }
      summary[config.tenant_id] = `sent:${sentCount}${failures.length ? ` failed:${failures.join(',')}` : ''}`;
    } catch (err) {
      console.error(`[daily-digest] Falha no tenant ${config.tenant_id}:`, err);
      summary[config.tenant_id] = 'error';
    }
  }

  return json({ summary });
});
