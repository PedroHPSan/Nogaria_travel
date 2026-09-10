// Seleção dos itens do roteiro elegíveis pra um check-in de "isso rolou?".
// Módulo puro (sem I/O, sem Deno) — mesmo padrão de reminderScheduler.ts.
//
// Diferente do lembrete de "está prestes a começar" (reminderScheduler.ts),
// aqui a pergunta é sempre em LOTE — nunca item a item — porque um roteiro
// "touring plan" (15-25min de intervalo entre itens) teria dezenas de itens
// elegíveis ao longo do dia; perguntar um a um reproduziria exatamente o
// excesso de mensagens já corrigido nos avisos de horário.

export interface CheckinCandidate {
  id: string;
  /** Data local da viagem (AAAA-MM-DD). */
  date: string;
  /** Horário local de início (HH:MM ou HH:MM:SS). */
  time_start: string;
  /** Horário local de fim, se houver. */
  time_end: string | null;
  title: string;
}

const MINUTES_PER_DAY = 1440;
const DEFAULT_DURATION_MINUTES = 30;

function parseHhMm(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minuto (desde a meia-noite local, podendo passar de 1440 se for "ontem") em que o item termina, de fato ou por estimativa. */
function effectiveEndMinutes(item: CheckinCandidate, dayOffset: number): number | null {
  const start = parseHhMm(item.time_start);
  if (start === null) return null;
  const end = parseHhMm(item.time_end) ?? start + DEFAULT_DURATION_MINUTES;
  return end + dayOffset * MINUTES_PER_DAY;
}

// Teto de itens numa única mensagem de check-in: acima disso a lista vira
// ilegível no WhatsApp, e um backlog desse tamanho é sintoma de configuração
// ruim (grace/cooldown baixos demais pro roteiro), não algo pra despejar de
// uma vez só.
const MAX_ITEMS_PER_CHECKIN = 8;

/**
 * Itens já encerrados (de hoje ou de ontem, pra não perder o rabo da noite
 * anterior) há mais que `graceMinutes`, ordenados do mais antigo pro mais
 * recente. `items` já deve chegar filtrado (sem outcome registrado, sem
 * ninguém marcado como concluído) — este módulo só decide a janela de tempo
 * e o cooldown, não o que já foi resolvido.
 */
export function selectOverdueItemsForCheckin(input: {
  items: CheckinCandidate[];
  nowLocalDateIso: string;
  nowLocalMinutes: number;
  graceMinutes: number;
  /** Minutos desde o último check-in enviado nesta viagem, ou `null` se nunca houve um. */
  minutesSinceLastCheckin: number | null;
  cooldownMinutes: number;
}): CheckinCandidate[] {
  const { items, nowLocalDateIso, nowLocalMinutes, graceMinutes, minutesSinceLastCheckin, cooldownMinutes } = input;

  const cooldownActive =
    cooldownMinutes > 0 && minutesSinceLastCheckin !== null && minutesSinceLastCheckin < cooldownMinutes;
  if (cooldownActive) return [];

  const yesterdayOffset = -1;
  const todayOffset = 0;

  type Scored = { item: CheckinCandidate; elapsedMinutes: number };
  const overdue: Scored[] = [];

  for (const item of items) {
    const dayOffset = item.date === nowLocalDateIso ? todayOffset : addDaysIso(item.date, 1) === nowLocalDateIso ? yesterdayOffset : null;
    if (dayOffset === null) continue;

    const end = effectiveEndMinutes(item, dayOffset);
    if (end === null) continue;

    const elapsedMinutes = nowLocalMinutes - end;
    if (elapsedMinutes < graceMinutes) continue;

    overdue.push({ item, elapsedMinutes });
  }

  return overdue
    .sort((a, b) => b.elapsedMinutes - a.elapsedMinutes)
    .slice(0, MAX_ITEMS_PER_CHECKIN)
    .map(s => s.item);
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
