import type { IncomingMessage, ServerResponse } from 'node:http';
import { proxyToSupabaseFunction } from './_shared';

// Vercel Cron: '5,20,35,50 * * * *' — mesmo passo de 15min do antigo pg_cron
// `whatsapp-activity-checkins`.
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return proxyToSupabaseFunction(req, res, 'activity-checkins');
}
