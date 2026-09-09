// Franquia mensal de mensagens do bot (issue #27). Puro: a function só faz I/O.

export type TenantPlan = 'free' | 'family' | 'pro' | 'enterprise';

/** Espelho de public.plan_message_quota — manter os dois em sincronia. */
export const PLAN_MESSAGE_QUOTA: Record<TenantPlan, number | null> = {
  free: 50,
  family: 300,
  pro: 1500,
  enterprise: null,
};

/** A partir desta fração da franquia a resposta ganha um rodapé de aviso. */
export const QUOTA_WARNING_RATIO = 0.9;

export type QuotaStatus =
  | { kind: 'unlimited' }
  | { kind: 'ok'; used: number; quota: number; remaining: number }
  | { kind: 'warning'; used: number; quota: number; remaining: number }
  | { kind: 'exceeded'; used: number; quota: number };

/** Franquia efetiva: override da config (inclusive 0) vence; senão a do plano; plano desconhecido = ilimitado. */
export function resolveMonthlyQuota(input: { plan: string | null | undefined; override: number | null | undefined }): number | null {
  if (typeof input.override === 'number' && Number.isInteger(input.override) && input.override >= 0) return input.override;
  const plan = input.plan as TenantPlan;
  return plan in PLAN_MESSAGE_QUOTA ? PLAN_MESSAGE_QUOTA[plan] : null;
}

/**
 * `used` já inclui a mensagem que está sendo processada (ela é gravada antes,
 * pela idempotência), então "exceeded" significa que ESTA mensagem passou do teto.
 */
export function evaluateQuota(used: number, quota: number | null): QuotaStatus {
  if (quota === null) return { kind: 'unlimited' };
  if (used > quota) return { kind: 'exceeded', used, quota };
  const remaining = quota - used;
  if (quota > 0 && used / quota >= QUOTA_WARNING_RATIO) return { kind: 'warning', used, quota, remaining };
  return { kind: 'ok', used, quota, remaining };
}

/**
 * Instante UTC (ISO) da meia-noite do dia 1 do mês corrente no fuso do tenant.
 * Fronteira do mês é local — "mês" para a família é o do calendário dela.
 */
export function monthStartUtcIso(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const year = get('year');
  const month = get('month');

  // Meia-noite local = meia-noite UTC deslocada pelo offset do fuso naquele instante.
  const guess = Date.UTC(year, month - 1, 1);
  const offsetMin = timeZoneOffsetMinutes(new Date(guess), timeZone);
  return new Date(guess - offsetMin * 60_000).toISOString();
}

/** Offset (min) de `timeZone` em relação ao UTC no instante dado (positivo a leste). */
function timeZoneOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

export function formatQuotaExceeded(status: Extract<QuotaStatus, { kind: 'exceeded' }>, renewsOnIso: string): string {
  const [y, m, d] = renewsOnIso.split('-');
  return (
    `A franquia de ${status.quota} mensagens deste mês acabou, então dou uma pausa por aqui. 😴\n` +
    `Ela renova em ${d}/${m}/${y}. Enquanto isso, o roteiro, as tarefas e os voos continuam no app — ` +
    `e quem administra a conta pode ampliar o plano por lá.`
  );
}

export function formatQuotaWarning(status: Extract<QuotaStatus, { kind: 'warning' }>): string {
  return `_Aviso: ${status.used} de ${status.quota} mensagens do mês já usadas (restam ${status.remaining})._`;
}

/** Primeiro dia do mês seguinte, no fuso do tenant (`YYYY-MM-DD`). */
export function nextMonthStartLocalIso(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  let year = get('year');
  let month = get('month') + 1;
  if (month > 12) { month = 1; year += 1; }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}
