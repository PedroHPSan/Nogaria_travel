// Seleção dos avisos de atividade que devem sair agora.
// Módulo puro (sem I/O, sem Deno) — toda a lógica de janela vive aqui para ser
// testável sem banco nem relógio real.

export interface ReminderCandidate {
  id: string;
  /** Data local da viagem (AAAA-MM-DD). */
  date: string;
  /** Horário local de início (HH:MM ou HH:MM:SS). */
  time_start: string;
  title: string;
  category: string;
  park: string | null;
  city: string | null;
  notes: string | null;
  min_height_cm: number | null;
  /** Override explícito da antecedência, em minutos. */
  reminder_minutes_before: number | null;
  /** "Chegue N minutos antes" — já existente para shows. */
  recommended_arrival_min_before: number | null;
}

export interface DueReminder {
  item: ReminderCandidate;
  /** Antecedência efetivamente aplicada a este item. */
  leadMinutes: number;
  /** Minutos que faltam para o início, no relógio local da viagem. */
  minutesUntil: number;
}

const MINUTES_PER_DAY = 1440;

/** HH:MM[:SS] → minutos desde a meia-noite local. `null` se não parsear. */
export function parseHhMm(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutos desde a meia-noite no fuso informado. */
export function localMinutesOfDay(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? '0');
  // Meia-noite sai como "24" em alguns runtimes com hour12:false.
  return (get('hour') % 24) * 60 + get('minute');
}

export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Antecedência do aviso para um item:
 *   1. override explícito do item, se houver;
 *   2. senão, o padrão do tenant, elevado quando o item pede chegada antecipada
 *      (um show que pede 90 min de chegada não pode ser avisado com 60).
 */
export function resolveLeadMinutes(item: ReminderCandidate, defaultLeadMinutes: number): number {
  if (typeof item.reminder_minutes_before === 'number' && item.reminder_minutes_before >= 0) {
    return item.reminder_minutes_before;
  }
  const arrival = item.recommended_arrival_min_before ?? 0;
  return Math.max(defaultLeadMinutes, arrival > 0 ? arrival + 15 : 0);
}

/**
 * Janela de silêncio, com suporte a virada de meia-noite (ex.: 22:00 → 07:00).
 * Silêncio **adia**, não cancela: como a seleção reavalia a cada execução, o
 * aviso represado sai na primeira rodada depois da janela, desde que a
 * atividade ainda não tenha começado.
 */
export function isWithinQuietHours(localMinutes: number, startHhMm: string, endHhMm: string): boolean {
  const start = parseHhMm(startHhMm);
  const end = parseHhMm(endHhMm);
  if (start === null || end === null || start === end) return false;
  return start < end
    ? localMinutes >= start && localMinutes < end
    : localMinutes >= start || localMinutes < end;
}

/**
 * Abaixo desse tanto de minutos pro início, um aviso "normal" sempre fura o
 * cooldown — a família não pode nunca ficar sem aviso de algo que já está
 * prestes a começar só porque outro aviso saiu há pouco.
 */
const URGENT_OVERRIDE_MINUTES = 10;

/**
 * Todos os itens cujo início caiu dentro da própria antecedência, ordenados
 * pelo mais próximo primeiro. Considera hoje e amanhã para não perder
 * atividades logo após a virada do dia (um item às 00:30 com 60 min de aviso
 * entra na janela às 23:30 do dia anterior).
 *
 * A condição é `0 < minutesUntil <= lead` — deliberadamente uma *janela aberta*
 * e não um intervalo fatiado por execução do cron. Uma execução perdida não
 * perde o aviso: a próxima ainda o vê candidato, e a duplicação é impedida
 * pela chave única do ledger, não pelo formato da janela.
 */
function candidateReminders(input: {
  items: ReminderCandidate[];
  nowLocalDateIso: string;
  nowLocalMinutes: number;
  defaultLeadMinutes: number;
}): DueReminder[] {
  const { items, nowLocalDateIso, nowLocalMinutes, defaultLeadMinutes } = input;
  const tomorrowIso = addDaysIso(nowLocalDateIso, 1);
  const due: DueReminder[] = [];

  for (const item of items) {
    const dayOffset = item.date === nowLocalDateIso ? 0 : item.date === tomorrowIso ? 1 : null;
    if (dayOffset === null) continue;

    const startMinutes = parseHhMm(item.time_start);
    if (startMinutes === null) continue;

    const minutesUntil = startMinutes + dayOffset * MINUTES_PER_DAY - nowLocalMinutes;
    if (minutesUntil <= 0) continue;

    const leadMinutes = resolveLeadMinutes(item, defaultLeadMinutes);
    if (minutesUntil > leadMinutes) continue;

    due.push({ item, leadMinutes, minutesUntil });
  }

  return due.sort((a, b) => a.minutesUntil - b.minutesUntil);
}

/**
 * O único aviso de atividade a disparar nesta execução, se houver.
 *
 * Um roteiro "touring plan" (item a item, ~15-25 min de intervalo) faz vários
 * itens entrarem na janela de antecedência ao mesmo tempo ou em sequência
 * rápida — sem limitar a *um* aviso por execução, uma família com esse tipo
 * de roteiro recebe dezenas de mensagens por dia. Duas defesas:
 *   1. só o item mais próximo de todos os candidatos é considerado;
 *   2. `cooldownMinutes` impõe um intervalo mínimo desde o último aviso
 *      "normal" da viagem — furado só por um override explícito do item
 *      (`reminder_minutes_before`) ou por estar a ≤10min do início, pra nunca
 *      esconder um aviso de algo iminente atrás do cooldown.
 */
export function selectDueReminders(input: {
  items: ReminderCandidate[];
  nowLocalDateIso: string;
  nowLocalMinutes: number;
  defaultLeadMinutes: number;
  /** Minutos desde o último aviso "lead" enviado nesta viagem, ou `null` se nunca houve um. */
  minutesSinceLastReminder: number | null;
  /** Intervalo mínimo entre avisos normais consecutivos. `<= 0` desliga o cooldown. */
  cooldownMinutes: number;
}): DueReminder[] {
  const candidates = candidateReminders(input);
  if (candidates.length === 0) return [];

  const next = candidates[0];
  const hasExplicitOverride = typeof next.item.reminder_minutes_before === 'number';
  const isUrgent = next.minutesUntil <= URGENT_OVERRIDE_MINUTES;
  const cooldownActive =
    input.cooldownMinutes > 0 &&
    input.minutesSinceLastReminder !== null &&
    input.minutesSinceLastReminder < input.cooldownMinutes;

  if (cooldownActive && !hasExplicitOverride && !isUrgent) return [];
  return [next];
}
