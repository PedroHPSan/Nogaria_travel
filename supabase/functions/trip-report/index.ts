import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendTextMessage } from '../_shared/whatsappClient.ts';
import { resolveActiveTrip } from '../_shared/tripContext.ts';
import { formatDatePtBr } from '../_shared/formatter.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface ReportItem {
  date: string;
  time_start: string;
  time_end: string | null;
  title: string;
  location: string | null;
}

/**
 * Relatório detalhado de replanejamento do roteiro, um dia por mensagem
 * (o texto de vários dias juntos estoura o limite de 4096 caracteres do
 * WhatsApp). Diferente do daily-digest (1 dia, automático, todo dia), este
 * é disparado uma vez para cobrir um intervalo de datas específico.
 */
function formatDayReport(dateIso: string, items: ReportItem[]): string {
  const lines = [`🔄 *Roteiro reprogramado — ${formatDatePtBr(dateIso)}*`, ''];
  for (const item of items) {
    const timeRange = item.time_end ? `${item.time_start.slice(0, 5)}–${item.time_end.slice(0, 5)}` : item.time_start.slice(0, 5);
    let line = `🔹 *${timeRange}* • ${item.title}`;
    if (item.location) line += ` (${item.location})`;
    lines.push(line);
  }
  return lines.join('\n');
}

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

  const url = new URL(request.url);
  const startDate = url.searchParams.get('start');
  const endDate = url.searchParams.get('end');
  if (!startDate || !endDate) return json({ error: 'Parâmetros start e end (YYYY-MM-DD) são obrigatórios.' }, 400);

  const { data: configs, error } = await supabase
    .from('whatsapp_configs')
    .select('tenant_id, phone_number_id, timezone')
    .eq('enabled', true);
  if (error) return json({ error: `Erro ao carregar configs: ${error.message}` }, 500);

  const summary: Record<string, string> = {};

  for (const config of configs ?? []) {
    const trip = await resolveActiveTrip(supabase, config.tenant_id, startDate);
    if (!trip) {
      summary[config.tenant_id] = 'skipped:sem-viagem-ativa';
      continue;
    }

    const { data: participants } = await supabase
      .from('participants')
      .select('whatsapp_phone')
      .eq('trip_id', trip.id)
      .not('whatsapp_phone', 'is', null);
    const recipients = (participants ?? []).map(p => p.whatsapp_phone as string).filter(Boolean);
    if (recipients.length === 0) {
      summary[config.tenant_id] = 'skipped:sem-telefones';
      continue;
    }

    const { data: items, error: itemsError } = await supabase
      .from('itinerary_items')
      .select('date, time_start, time_end, title, location')
      .eq('trip_id', trip.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('time_start', { ascending: true });
    if (itemsError) {
      summary[config.tenant_id] = `erro:${itemsError.message}`;
      continue;
    }

    const byDate = new Map<string, ReportItem[]>();
    for (const item of (items ?? []) as ReportItem[]) {
      if (!byDate.has(item.date)) byDate.set(item.date, []);
      byDate.get(item.date)!.push(item);
    }

    const messages = [
      `📋 *Roteiro reprogramado, ${trip.title}!* Segue o detalhamento dia a dia de ${formatDatePtBr(startDate)} a ${formatDatePtBr(endDate)}, com as mudanças de hotel e horários já aplicadas.`,
      ...[...byDate.entries()].map(([dateIso, dayItems]) => formatDayReport(dateIso, dayItems)),
    ];

    let sentCount = 0;
    const failures: string[] = [];
    for (const phoneRaw of recipients) {
      const phone = phoneRaw.replace(/\D/g, '');
      for (const text of messages) {
        try {
          const sent = await sendTextMessage({ phoneNumberId: config.phone_number_id, accessToken: metaToken, to: phone, text });
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
          failures.push(`${phone}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    summary[config.tenant_id] = `enviado:${sentCount}/${recipients.length * messages.length}${failures.length ? ` falhas:${failures.join('; ')}` : ''}`;
  }

  return json({ summary });
});
