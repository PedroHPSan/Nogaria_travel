import type { IncomingMessage, ServerResponse } from 'node:http';
import { proxyToSupabaseFunction } from './_shared';

// Vercel Cron: '2,9,16,23,30,37,44,51,58 * * * *' — mesmo passo de ~7min do
// antigo pg_cron `whatsapp-activity-reminders` (coprimo de 10 de propósito,
// ver 20260907000000_fix_reminder_cadence_alignment.sql).
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return proxyToSupabaseFunction(req, res, 'activity-reminders');
}
