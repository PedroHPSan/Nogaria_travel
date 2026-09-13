import { useCallback, useMemo, useState } from 'react';
import type { ItineraryItem } from '../../types/database.types';
import {
  moveDay as engineMoveDay,
  moveItemToDay as engineMoveItemToDay,
  resequence as engineResequence,
  shiftDay as engineShiftDay,
  swapDays as engineSwapDays,
  validateProposal,
  type ReplanChange,
  type ReplanItem,
  type ReplanProposal,
  type ReplanSlot,
  type ReplanWarning,
} from '../../services/replanEngine';

function normalizeTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : '';
}

function toReplanItem(item: ItineraryItem): ReplanItem {
  return {
    id: item.id,
    title: item.title,
    date: item.date,
    time_start: item.time_start,
    time_end: item.time_end ?? null,
    base_order: item.base_order ?? null,
    park: item.park ?? null,
    is_filler: item.counts_toward_completion === false,
    locked: item.status === 'confirmed' || Boolean(item.show_block_start),
  };
}

function slotOf(item: ItineraryItem): ReplanSlot {
  return { date: item.date, time_start: normalizeTime(item.time_start), time_end: normalizeTime(item.time_end) || null, base_order: item.base_order ?? null };
}

/** Diff mínimo entre o roteiro original e o rascunho — nunca composição de propostas: arrastar e voltar produz zero mudanças. */
function diffDrafts(original: ItineraryItem[], draft: ItineraryItem[]): ReplanChange[] {
  const byId = new Map(original.map(i => [i.id, i]));
  const changes: ReplanChange[] = [];
  for (const item of draft) {
    const orig = byId.get(item.id);
    if (!orig) continue;
    const from = slotOf(orig);
    const to = slotOf(item);
    if (from.date !== to.date || from.time_start !== to.time_start || from.time_end !== to.time_end || from.base_order !== to.base_order) {
      changes.push({ item_id: item.id, title: item.title, from, to });
    }
  }
  return changes;
}

function applyChangesToDraft(draft: ItineraryItem[], changes: ReplanChange[]): ItineraryItem[] {
  if (changes.length === 0) return draft;
  const byId = new Map(changes.map(c => [c.item_id, c]));
  return draft.map(item => {
    const change = byId.get(item.id);
    if (!change) return item;
    return { ...item, date: change.to.date, time_start: change.to.time_start, time_end: change.to.time_end ?? undefined, base_order: change.to.base_order ?? undefined };
  });
}

export interface ApplyResult {
  ok: boolean;
}

export interface UseReplanDraftOptions {
  items: ItineraryItem[];
  tripStart: string;
  tripEnd: string;
  onApply: (
    changes: { item_id: string; date: string; time_start: string; time_end: string | null; base_order: number | null }[],
  ) => Promise<{ ok: true; before: Record<string, unknown>[] } | { ok: false }>;
}

/**
 * Estado de rascunho do ReplanBoard: cada gesto (drag, botão "Empurrar dia") é
 * aplicado localmente sobre `draftItems`; nada é escrito no TripContext até
 * `apply()`. `proposal` é sempre o diff entre o roteiro original (capturado
 * uma vez, no primeiro render) e o rascunho atual — nunca a composição das
 * operações intermediárias, que é o que evita "arrastei e voltei, mas gravou
 * duas mudanças".
 */
export function useReplanDraft({ items, tripStart, tripEnd, onApply }: UseReplanDraftOptions) {
  const [original, setOriginal] = useState(items);
  const [draftItems, setDraftItems] = useState(items);
  const [applying, setApplying] = useState(false);
  const [undoChanges, setUndoChanges] = useState<{ item_id: string; date: string; time_start: string; time_end: string | null; base_order: number | null }[] | null>(null);

  const proposal: ReplanProposal = useMemo(() => {
    const changes = diffDrafts(original, draftItems);
    const dates = [...new Set(changes.flatMap(c => [c.from.date, c.to.date]))].sort();
    const byDate: Record<string, ReplanItem[]> = {};
    for (const item of draftItems) {
      const key = item.date;
      (byDate[key] ??= []).push(toReplanItem(item));
    }
    const raw: ReplanProposal = { operation: 'manual', dates, changes, warnings: [], summary: `${changes.length} ${changes.length === 1 ? 'mudança' : 'mudanças'}` };
    return validateProposal(raw, { tripStart, tripEnd, dayItemsByDate: byDate });
  }, [original, draftItems, tripStart, tripEnd]);

  const runOperation = useCallback((operate: (dayItems: ReplanItem[]) => ReplanProposal, date: string) => {
    setDraftItems(prev => {
      const dayItems = prev.filter(i => i.date === date).map(toReplanItem);
      const result = operate(dayItems);
      return applyChangesToDraft(prev, result.changes);
    });
  }, []);

  const shiftDay = useCallback(
    (date: string, minutes: number, fromTime?: string) => runOperation(dayItems => engineShiftDay(dayItems, { minutes, fromTime }), date),
    [runOperation],
  );

  const swapDays = useCallback((dateA: string, dateB: string) => {
    setDraftItems(prev => {
      const itemsA = prev.filter(i => i.date === dateA).map(toReplanItem);
      const itemsB = prev.filter(i => i.date === dateB).map(toReplanItem);
      const result = engineSwapDays(itemsA, itemsB, dateA, dateB);
      return applyChangesToDraft(prev, result.changes);
    });
  }, []);

  const moveDay = useCallback((date: string, toDate: string) => {
    setDraftItems(prev => {
      const items = prev.filter(i => i.date === date).map(toReplanItem);
      const existing = prev.filter(i => i.date === toDate).map(toReplanItem);
      const result = engineMoveDay(items, toDate, existing);
      return applyChangesToDraft(prev, result.changes);
    });
  }, []);

  const resequenceDay = useCallback(
    (date: string, orderedIds: string[]) => runOperation(dayItems => engineResequence(dayItems, orderedIds), date),
    [runOperation],
  );

  const moveItemToDay = useCallback((itemId: string, toDate: string, index: number) => {
    setDraftItems(prev => {
      const item = prev.find(i => i.id === itemId);
      if (!item) return prev;
      const targetDayItems = prev.filter(i => i.date === toDate && i.id !== itemId).map(toReplanItem);
      const result = engineMoveItemToDay(toReplanItem(item), targetDayItems, toDate, index);
      return applyChangesToDraft(prev, result.changes);
    });
  }, []);

  const reset = useCallback(() => setDraftItems(original), [original]);

  const apply = useCallback(async (): Promise<ApplyResult> => {
    if (proposal.changes.length === 0) return { ok: false };
    setApplying(true);
    try {
      const changes = proposal.changes.map(c => ({ item_id: c.item_id, date: c.to.date, time_start: c.to.time_start, time_end: c.to.time_end, base_order: c.to.base_order }));
      const result = await onApply(changes);
      if (!result.ok) return { ok: false };

      // Proposta inversa (Desfazer de sessão) a partir do `before` que a RPC
      // devolve — sem tabela de histórico.
      setUndoChanges(
        (result.before as { item_id: string; date: string; time_start: string; time_end: string | null; base_order: number | null }[]).map(b => ({
          item_id: b.item_id,
          date: b.date,
          time_start: normalizeTime(b.time_start),
          time_end: b.time_end,
          base_order: b.base_order,
        })),
      );
      setOriginal(draftItems);
      return { ok: true };
    } finally {
      setApplying(false);
    }
  }, [proposal, onApply, draftItems]);

  const undo = useCallback(async (): Promise<ApplyResult> => {
    if (!undoChanges) return { ok: false };
    setApplying(true);
    try {
      const result = await onApply(undoChanges);
      if (!result.ok) return { ok: false };
      const byId = new Map(undoChanges.map(c => [c.item_id, c]));
      const restored = draftItems.map(item => {
        const c = byId.get(item.id);
        if (!c) return item;
        return { ...item, date: c.date, time_start: c.time_start, time_end: c.time_end ?? undefined, base_order: c.base_order ?? undefined };
      });
      setOriginal(restored);
      setDraftItems(restored);
      setUndoChanges(null);
      return { ok: true };
    } finally {
      setApplying(false);
    }
  }, [undoChanges, onApply, draftItems]);

  return { draftItems, proposal, applying, shiftDay, swapDays, moveDay, resequenceDay, moveItemToDay, reset, apply, undo, canUndo: undoChanges !== null };
}

export type { ReplanChange, ReplanProposal, ReplanWarning };
