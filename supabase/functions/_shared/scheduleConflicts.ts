// Detecção de conflito de horário ao reagendar um item do roteiro. Puro —
// nenhum I/O — para ser testável sem mockar banco.

export interface ScheduleSlot {
  id: string;
  title: string;
  timeStart: string; // HH:MM ou HH:MM:SS
  timeEnd: string | null;
}

const DEFAULT_DURATION_MIN = 60;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function slotRange(slot: ScheduleSlot): { start: number; end: number } {
  const start = toMinutes(slot.timeStart);
  // Item sem time_end recebe duração default só para esta checagem — heurística
  // de exibição, nunca gravada no banco.
  const end = slot.timeEnd ? toMinutes(slot.timeEnd) : start + DEFAULT_DURATION_MIN;
  return { start, end };
}

/**
 * Itens do MESMO DIA que se sobrepõem com o slot movido. `dayItems` já deve
 * vir filtrado para a data de destino e sem o próprio item sendo movido.
 */
export function detectConflicts(moved: ScheduleSlot, dayItems: ScheduleSlot[]): ScheduleSlot[] {
  const movedRange = slotRange(moved);
  return dayItems.filter(other => {
    if (other.id === moved.id) return false;
    const otherRange = slotRange(other);
    return movedRange.start < otherRange.end && otherRange.start < movedRange.end;
  });
}

/**
 * Primeiro horário livre no dia, na mesma duração do item movido, tentando a
 * partir do horário pedido (não do início do dia — a sugestão deve ficar perto
 * do que a família já queria). Retorna null se não achar brecha nas 24h.
 */
export function suggestFreeSlot(moved: ScheduleSlot, dayItems: ScheduleSlot[]): string | null {
  const duration = slotRange(moved).end - slotRange(moved).start;
  const others = dayItems
    .filter(o => o.id !== moved.id)
    .map(slotRange)
    .sort((a, b) => a.start - b.start);

  const fits = (start: number) => {
    const end = start + duration;
    if (end > 24 * 60) return false;
    return others.every(o => start >= o.end || end <= o.start);
  };

  const requestedStart = slotRange(moved).start;
  // Varre em passos de 15 min a partir do horário pedido — não precisa ser
  // exaustivo minuto a minuto para uma sugestão conversacional.
  for (let candidate = requestedStart; candidate <= 24 * 60 - duration; candidate += 15) {
    if (fits(candidate)) return minutesToHHMM(candidate);
  }
  for (let candidate = requestedStart - 15; candidate >= 0; candidate -= 15) {
    if (fits(candidate)) return minutesToHHMM(candidate);
  }
  return null;
}

function minutesToHHMM(total: number): string {
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}
