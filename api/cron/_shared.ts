import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Disparo das edge functions do bot WhatsApp a partir do Vercel Cron, em vez
 * do pg_cron + Supabase Vault (que exigia criar os segredos `project_url` /
 * `cron_secret` uma vez pelo SQL Editor) e do job manual `whatsapp` do
 * GitHub Actions (indisponível com a conta em billing hold). As migrations
 * `*_cron.sql` que agendavam esses jobs no pg_cron foram desagendadas em
 * `20260915000000_move_cron_to_vercel.sql` — não rodar os dois lados ao mesmo
 * tempo, ou a família recebe cada mensagem em dobro.
 *
 * Duas camadas de segredo, propositalmente diferentes:
 *   - `CRON_SECRET` (env do Vercel): protege ESTE endpoint. O Vercel Cron
 *     manda `Authorization: Bearer $CRON_SECRET` quando a env existe —
 *     https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
 *   - `SUPABASE_CRON_SECRET` (env do Vercel, mesmo valor do `supabase secrets
 *     set CRON_SECRET`): é o que a edge function do Supabase espera no header
 *     `x-cron-secret`. Nomes diferentes de propósito — são dois sistemas
 *     checando cada um o seu próprio segredo, não o mesmo segredo passando
 *     por dois lugares.
 */

function isAuthorized(req: IncomingMessage): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.authorization === `Bearer ${expected}`;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * Faz o POST na edge function do Supabase (mesmo contrato que o pg_net do
 * pg_cron usava: `x-cron-secret` + corpo vazio) e repassa o resultado.
 * `path` inclui a query string quando a function precisar (ex.: trip-report).
 */
export async function proxyToSupabaseFunction(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Promise<void> {
  if (!isAuthorized(req)) {
    send(res, 401, { error: 'Não autorizado — chamada fora do Vercel Cron.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const cronSecret = process.env.SUPABASE_CRON_SECRET;
  if (!supabaseUrl || !cronSecret) {
    send(res, 500, { error: 'VITE_SUPABASE_URL ou SUPABASE_CRON_SECRET ausente nas env vars do Vercel.' });
    return;
  }

  try {
    const upstream = await fetch(`${supabaseUrl}/functions/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
      body: '{}',
    });
    const body = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
    res.end(body);
  } catch (err) {
    send(res, 502, { error: `Falha ao chamar ${path}: ${err instanceof Error ? err.message : String(err)}` });
  }
}
