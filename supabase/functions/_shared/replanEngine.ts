// Motor puro de replanejamento em lote (empurrar dia, trocar dias, mover dia,
// reordenar, arrastar item entre dias). Zero I/O, zero import de Deno — só
// `import type` e ./scheduleConflicts.ts, também puro. É o contrato
// compartilhado por três consumidores: a tool `replan_day` do bot, a RPC
// `apply_itinerary_changes` (que recebe o resultado já serializado) e o
// ReplanBoard do app (via src/services/replanEngine.ts, shim de re-export).
//
// Testável sem banco e sem relógio real — ver __tests__/replanEngine.test.ts.

import { detectConflicts, suggestFreeSlot, type ScheduleSlot } from './scheduleConflicts.ts';

export interface ReplanItem {
  id: string;
  title: string;
  /** AAAA-MM-DD */
  date: string;
  /** HH:MM ou HH:MM:SS */
  time_start: string;
  time_end: string | null;
  base_order: number | null;
  park: string | null;
  /** counts_toward_completion === false → deslocamento/pausa; pode ser reagrupado sem alarde. */
  is_filler: boolean;
  /** status === 'confirmed' || tem show_block_start → reserva/horário fixo; nunca movido sozinho. */
  locked: boolean;
}

export interface ReplanSlot {
  date: string;
  time_start: string;
  time_end: string | null;
  base_order: number | null;
}

export interface ReplanChange {
  item_id: string;
  title: string;
  from: ReplanSlot;
  to: ReplanSlot;
}

export type ReplanWarningKind =
  | 'conflict'
  | 'outside_trip'
  | 'crosses_midnight'
  | 'locked_item'
  | 'park_closed'
  | 'attraction_closed'
  | 'outside_park_hours'
  | 'empty_day';

export interface ReplanWarning {
  kind: ReplanWarningKind;
  item_id: string | null;
  message: string;
}

export type ReplanOperation = 'shift_day' | 'swap_days' | 'move_day' | 'resequence' | 'move_item' | 'manual';

export interface ReplanProposal {
  operation: ReplanOperation;
  /** Dias tocados, ordenados. */
  dates: string[];
  changes: ReplanChange[];
  warnings: ReplanWarning[];
  /** Texto pt-BR determinístico — mesmo preview no WhatsApp e na tela. */
  summary: string;
}

export interface ParkWindow {
  park: string;
  date: string;
  opening: string | null;
  closing: string | null;
  closed: boolean;
}

const MINUTES_PER_DAY = 24 * 60;

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number): string {
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function slotOf(item: ReplanItem): ReplanSlot {
  return { date: item.date, time_start: item.time_start.slice(0, 5), time_end: item.time_end?.slice(0, 5) ?? null, base_order: item.base_order };
}

function slotsEqual(a: ReplanSlot, b: ReplanSlot): boolean {
  return a.date === b.date && a.time_start === b.time_start && a.time_end === b.time_end && a.base_order === b.base_order;
}

function toScheduleSlot(item: ReplanItem, override?: Partial<ReplanSlot>): ScheduleSlot {
  const time_start = override?.time_start ?? item.time_start.slice(0, 5);
  const time_end = override?.time_end !== undefined ? override.time_end : item.time_end?.slice(0, 5) ?? null;
  return { id: item.id, title: item.title, timeStart: time_start, timeEnd: time_end };
}

/** Monta um ReplanChange só se o slot de fato mudou (evita no-ops no diff). */
function diffChange(item: ReplanItem, to: ReplanSlot): ReplanChange | null {
  const from = slotOf(item);
  if (slotsEqual(from, to)) return null;
  return { item_id: item.id, title: item.title, from, to };
}

// ---------------------------------------------------------------------------
// Operações
// ---------------------------------------------------------------------------

/**
 * Empurra time_start/time_end de todos os itens do dia com time_start >=
 * fromTime (default: todos), preservando a duração de cada item. Item que
 * cruzaria a meia-noite não entra em `changes` — vira `crosses_midnight`.
 * Itens `locked` (reserva confirmada, show com horário fixo) ficam parados,
 * com `locked_item`.
 */
export function shiftDay(items: ReplanItem[], opts: { minutes: number; fromTime?: string }): ReplanProposal {
  const date = items[0]?.date ?? '';
  const fromMin = opts.fromTime ? timeToMinutes(opts.fromTime) : -1;
  const changes: ReplanChange[] = [];
  const warnings: ReplanWarning[] = [];

  for (const item of items) {
    const startMin = timeToMinutes(item.time_start.slice(0, 5));
    if (startMin < fromMin) continue;

    if (item.locked) {
      warnings.push({ kind: 'locked_item', item_id: item.id, message: `"${item.title}" é reserva/horário confirmado e não foi movido.` });
      continue;
    }

    const durationMin = item.time_end ? timeToMinutes(item.time_end.slice(0, 5)) - startMin : null;
    const newStart = startMin + opts.minutes;
    if (newStart < 0 || newStart >= MINUTES_PER_DAY) {
      warnings.push({ kind: 'crosses_midnight', item_id: item.id, message: `"${item.title}" cruzaria a meia-noite e não foi movido.` });
      continue;
    }

    const newTimeEnd = durationMin !== null ? minutesToTime(newStart + durationMin) : null;
    const change = diffChange(item, { date: item.date, time_start: minutesToTime(newStart), time_end: newTimeEnd, base_order: item.base_order });
    if (change) changes.push(change);
  }

  return {
    operation: 'shift_day',
    dates: date ? [date] : [],
    changes,
    warnings,
    summary: summarizeShift(date, opts.minutes, changes.length, warnings),
  };
}

/** Troca só a DATA entre os dois dias — cada item mantém sua hora do dia. */
export function swapDays(itemsA: ReplanItem[], itemsB: ReplanItem[], dateA: string, dateB: string): ReplanProposal {
  const changes: ReplanChange[] = [];
  const warnings: ReplanWarning[] = [];

  for (const item of itemsA) {
    const change = diffChange(item, { date: dateB, time_start: item.time_start.slice(0, 5), time_end: item.time_end?.slice(0, 5) ?? null, base_order: item.base_order });
    if (change) changes.push(change);
  }
  for (const item of itemsB) {
    const change = diffChange(item, { date: dateA, time_start: item.time_start.slice(0, 5), time_end: item.time_end?.slice(0, 5) ?? null, base_order: item.base_order });
    if (change) changes.push(change);
  }

  if (itemsA.length === 0 && itemsB.length === 0) {
    warnings.push({ kind: 'empty_day', item_id: null, message: `Nem ${dateA} nem ${dateB} têm atividades cadastradas.` });
  }

  return {
    operation: 'swap_days',
    dates: [dateA, dateB].sort(),
    changes,
    warnings,
    summary: `Trocar ${dateA} com ${dateB}: ${changes.length} ${changes.length === 1 ? 'atividade muda' : 'atividades mudam'} de data, mantendo o horário do dia.`,
  };
}

/**
 * Move todos os itens de `items` para `toDate`, mantendo o horário. Se o
 * destino já tem itens (`existingAtTarget`), roda detectConflicts par a par e
 * avisa — nunca mescla ou reordena o dia de destino sozinho.
 */
export function moveDay(items: ReplanItem[], toDate: string, existingAtTarget: ReplanItem[] = []): ReplanProposal {
  const fromDate = items[0]?.date ?? '';
  const changes: ReplanChange[] = [];
  const warnings: ReplanWarning[] = [];

  for (const item of items) {
    const change = diffChange(item, { date: toDate, time_start: item.time_start.slice(0, 5), time_end: item.time_end?.slice(0, 5) ?? null, base_order: item.base_order });
    if (change) changes.push(change);

    if (existingAtTarget.length > 0) {
      const conflicts = detectConflicts(toScheduleSlot(item), existingAtTarget.map(e => toScheduleSlot(e)));
      for (const c of conflicts) {
        warnings.push({ kind: 'conflict', item_id: item.id, message: `"${item.title}" conflita com "${c.title}" já marcado em ${toDate}.` });
      }
    }
  }

  return {
    operation: 'move_day',
    dates: [fromDate, toDate].filter(Boolean).sort(),
    changes,
    warnings,
    summary: `Mover o dia ${fromDate} inteiro para ${toDate}: ${changes.length} ${changes.length === 1 ? 'atividade' : 'atividades'}, mesmo horário.`,
  };
}

/**
 * Reordena os itens de um dia preservando os SLOTS (horários de início já
 * existentes) e a duração de cada item — não herda o fim do slot alheio.
 * `base_order` é reescrito como index*10 (espaço para inserção futura).
 */
export function resequence(items: ReplanItem[], orderedIds: string[]): ReplanProposal {
  const date = items[0]?.date ?? '';
  const byId = new Map(items.map(i => [i.id, i]));
  const slots = [...items]
    .sort((a, b) => timeToMinutes(a.time_start.slice(0, 5)) - timeToMinutes(b.time_start.slice(0, 5)))
    .map(i => timeToMinutes(i.time_start.slice(0, 5)));

  const changes: ReplanChange[] = [];
  const warnings: ReplanWarning[] = [];

  orderedIds.forEach((id, index) => {
    const item = byId.get(id);
    if (!item) return;
    if (item.locked) {
      warnings.push({ kind: 'locked_item', item_id: item.id, message: `"${item.title}" é reserva/horário confirmado e manteve o horário original.` });
      return;
    }
    const startMin = slots[index] ?? slots[slots.length - 1] ?? timeToMinutes(item.time_start.slice(0, 5));
    const durationMin = item.time_end ? timeToMinutes(item.time_end.slice(0, 5)) - timeToMinutes(item.time_start.slice(0, 5)) : null;
    const newTimeEnd = durationMin !== null ? minutesToTime(startMin + durationMin) : null;
    const change = diffChange(item, { date, time_start: minutesToTime(startMin), time_end: newTimeEnd, base_order: index * 10 });
    if (change) changes.push(change);
  });

  return {
    operation: 'resequence',
    dates: date ? [date] : [],
    changes,
    warnings,
    summary: `Reordenar ${date}: ${changes.length} ${changes.length === 1 ? 'atividade muda' : 'atividades mudam'} de posição.`,
  };
}

/**
 * Move um item para outro dia numa posição específica (drag entre colunas do
 * board). Calcula o horário pelo vizinho; se não couber, usa suggestFreeSlot
 * e ainda assim marca `conflict` caso a brecha não exista.
 */
export function moveItemToDay(item: ReplanItem, targetDayItems: ReplanItem[], toDate: string, index: number): ReplanProposal {
  const ordered = [...targetDayItems].sort((a, b) => timeToMinutes(a.time_start.slice(0, 5)) - timeToMinutes(b.time_start.slice(0, 5)));
  const before = ordered[index - 1] ?? null;
  const after = ordered[index] ?? null;
  const durationMin = item.time_end ? timeToMinutes(item.time_end.slice(0, 5)) - timeToMinutes(item.time_start.slice(0, 5)) : 60;

  const warnings: ReplanWarning[] = [];
  let newStartMin: number;

  if (before && after) {
    const gapStart = timeToMinutes(before.time_end?.slice(0, 5) ?? before.time_start.slice(0, 5));
    const gapEnd = timeToMinutes(after.time_start.slice(0, 5));
    newStartMin = gapStart;
    if (gapEnd - gapStart < durationMin) {
      warnings.push({ kind: 'conflict', item_id: item.id, message: `Não há brecha de ${durationMin}min entre "${before.title}" e "${after.title}" em ${toDate}.` });
    }
  } else if (before) {
    newStartMin = timeToMinutes(before.time_end?.slice(0, 5) ?? before.time_start.slice(0, 5));
  } else if (after) {
    newStartMin = Math.max(0, timeToMinutes(after.time_start.slice(0, 5)) - durationMin);
  } else {
    newStartMin = timeToMinutes(item.time_start.slice(0, 5));
  }

  const proposedSlot = toScheduleSlot(item, { time_start: minutesToTime(newStartMin), time_end: minutesToTime(newStartMin + durationMin) });
  const conflicts = detectConflicts(proposedSlot, ordered.map(o => toScheduleSlot(o)));
  if (conflicts.length > 0) {
    const free = suggestFreeSlot(proposedSlot, ordered.map(o => toScheduleSlot(o)));
    if (free) newStartMin = timeToMinutes(free);
    else warnings.push({ kind: 'conflict', item_id: item.id, message: `"${item.title}" ficou sobreposto em ${toDate} — nenhuma brecha livre encontrada.` });
  }

  const change = diffChange(item, { date: toDate, time_start: minutesToTime(newStartMin), time_end: minutesToTime(newStartMin + durationMin), base_order: item.base_order });

  return {
    operation: 'move_item',
    dates: [item.date, toDate].filter(Boolean).sort(),
    changes: change ? [change] : [],
    warnings,
    summary: `Mover "${item.title}" para ${toDate} às ${minutesToTime(newStartMin)}.`,
  };
}

// ---------------------------------------------------------------------------
// Validação — único ponto que conhece limites da viagem e janelas de parque.
// Chamado sempre depois de qualquer operação, por bot e app.
// ---------------------------------------------------------------------------

export function validateProposal(
  proposal: ReplanProposal,
  ctx: {
    tripStart: string;
    tripEnd: string;
    /** Itens já existentes em cada data tocada, por data (sem os que estão sendo movidos). */
    dayItemsByDate?: Record<string, ReplanItem[]>;
    parkWindows?: ParkWindow[];
  },
): ReplanProposal {
  const warnings = [...proposal.warnings];

  for (const change of proposal.changes) {
    if (change.to.date < ctx.tripStart || change.to.date > ctx.tripEnd) {
      warnings.push({
        kind: 'outside_trip',
        item_id: change.item_id,
        message: `"${change.title}" iria para ${change.to.date}, fora do período da viagem (${ctx.tripStart} a ${ctx.tripEnd}).`,
      });
    }
  }

  if (ctx.dayItemsByDate) {
    for (const change of proposal.changes) {
      const others = (ctx.dayItemsByDate[change.to.date] ?? []).filter(o => o.id !== change.item_id);
      if (others.length === 0) continue;
      const conflicts = detectConflicts(
        { id: change.item_id, title: change.title, timeStart: change.to.time_start, timeEnd: change.to.time_end },
        others.map(o => toScheduleSlot(o)),
      );
      for (const c of conflicts) {
        warnings.push({ kind: 'conflict', item_id: change.item_id, message: `"${change.title}" conflitaria com "${c.title}" em ${change.to.date}.` });
      }
    }
  }

  if (ctx.parkWindows) {
    for (const change of proposal.changes) {
      const window = ctx.parkWindows.find(w => w.date === change.to.date);
      if (!window) continue;
      if (window.closed) {
        warnings.push({ kind: 'park_closed', item_id: change.item_id, message: `${window.park} consta fechado em ${change.to.date}.` });
        continue;
      }
      if (window.opening && change.to.time_start < window.opening) {
        warnings.push({ kind: 'outside_park_hours', item_id: change.item_id, message: `"${change.title}" ficaria antes da abertura de ${window.park} (${window.opening}) em ${change.to.date}.` });
      }
      if (window.closing && change.to.time_start > window.closing) {
        warnings.push({ kind: 'outside_park_hours', item_id: change.item_id, message: `"${change.title}" ficaria depois do fechamento de ${window.park} (${window.closing}) em ${change.to.date}.` });
      }
    }
  }

  return { ...proposal, warnings };
}

function summarizeShift(date: string, minutes: number, changeCount: number, warnings: ReplanWarning[]): string {
  const direction = minutes > 0 ? 'Empurrar' : 'Adiantar';
  const abs = Math.abs(minutes);
  let text = `${direction} o dia ${date} em ${abs}min: ${changeCount} ${changeCount === 1 ? 'atividade muda' : 'atividades mudam'} de horário.`;
  const blocking = warnings.filter(w => w.kind === 'locked_item' || w.kind === 'crosses_midnight');
  for (const w of blocking) text += ` ⚠️ ${w.message}`;
  return text;
}

/** Texto pt-BR determinístico — reusado como preview no WhatsApp e na tela. */
export function summarizeProposal(proposal: ReplanProposal): string {
  let text = proposal.summary;
  const others = proposal.warnings.filter(
    w => !text.includes(w.message) && w.kind !== 'locked_item' && w.kind !== 'crosses_midnight',
  );
  for (const w of others) text += ` ⚠️ ${w.message}`;
  return text;
}

/** Serializador único para apply_itinerary_changes — usado por bot e app. */
export function toRpcChanges(proposal: ReplanProposal): Array<{ item_id: string; date: string; time_start: string; time_end: string | null; base_order: number | null }> {
  return proposal.changes.map(c => ({
    item_id: c.item_id,
    date: c.to.date,
    time_start: c.to.time_start,
    time_end: c.to.time_end,
    base_order: c.to.base_order,
  }));
}
