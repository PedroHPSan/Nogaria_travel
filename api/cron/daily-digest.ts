import type { IncomingMessage, ServerResponse } from 'node:http';
import { proxyToSupabaseFunction } from './_shared.js';

// Vercel Cron: '7 * * * *' (todo dia, de hora em hora, minuto 7 — mesmo
// horário do antigo pg_cron `whatsapp-daily-digest`). A function filtra por
// digest_time/timezone de cada tenant, então rodar 1x/hora basta.
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return proxyToSupabaseFunction(req, res, 'daily-digest');
}
