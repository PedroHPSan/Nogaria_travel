import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildPtaxUrl, parsePtaxResponse } from '../_shared/ptax.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Janela reconsultada a cada execução: cobre feriados prolongados e atrasos do BCB. */
const LOOKBACK_DAYS = 10;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Sincroniza a PTAX (venda, fechamento) do Banco Central para
 * public.exchange_rates. Disparada por pg_cron (x-cron-secret) em dia útil;
 * idempotente — faz upsert por (pair, date). Pode ser rodada à mão com curl
 * para preencher histórico (?days=90).
 */
Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Método não suportado.' }, 405);

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'Não autorizado.' }, 401);
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return json({ error: 'Service role key ausente no servidor.' }, 500);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  const url = new URL(request.url);
  const daysParam = Number(url.searchParams.get('days'));
  const lookback = Number.isInteger(daysParam) && daysParam > 0 && daysParam <= 400 ? daysParam : LOOKBACK_DAYS;

  const start = isoDaysAgo(lookback);
  const end = isoDaysAgo(0);

  let payload: unknown;
  try {
    const response = await fetch(buildPtaxUrl(start, end), { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return json({ error: `BCB respondeu HTTP ${response.status}` }, 502);
    payload = await response.json();
  } catch (err) {
    return json({ error: `Falha ao consultar o BCB: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }

  const rates = parsePtaxResponse(payload);
  if (rates.length === 0) return json({ synced: 0, note: 'BCB não devolveu cotações no período (feriado/fim de semana?).' });

  const { error } = await supabase.from('exchange_rates').upsert(
    rates.map(r => ({ pair: 'USD-BRL', date: r.date, rate: r.rate, source: 'bcb_ptax_venda', fetched_at: new Date().toISOString() })),
    { onConflict: 'pair,date' },
  );
  if (error) return json({ error: `Falha ao gravar cotações: ${error.message}` }, 500);

  return json({ synced: rates.length, latest: rates[0] });
});
