import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { AlertTriangle, Undo2 } from 'lucide-react';
import type { ItineraryItem, Participant } from '../../types/database.types';
import { useReplanDraft } from './useReplanDraft';
import { ReplanDayColumn } from './ReplanDayColumn';
import { ReplanItemCard } from './ReplanItemCard';

export interface ReplanBoardProps {
  items: ItineraryItem[];
  participants: Participant[];
  outcomes: Record<string, { status: 'pending' | 'skipped' | 'cancelled'; note: string | null }>;
  tripStart: string;
  tripEnd: string;
  onApply: (
    changes: { item_id: string; date: string; time_start: string; time_end: string | null; base_order: number | null }[],
  ) => Promise<{ ok: true; before: Record<string, unknown>[] } | { ok: false }>;
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  // Teto de segurança: uma viagem real deste app não passa de ~60 dias.
  let guard = 0;
  while (cursor <= last && guard < 90) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    guard++;
  }
  return dates;
}

/**
 * Rascunho visual de replanejamento: kanban de dias com drag-and-drop
 * (@dnd-kit) + o mesmo menu não-drag (Empurrar/Trocar/Mover) que o WhatsApp
 * usa por trás — nada é escrito até "Aplicar". Ver useReplanDraft.ts pelo
 * contrato de diff mínimo e _shared/replanEngine.ts pelas operações.
 */
export const ReplanBoard: React.FC<ReplanBoardProps> = ({ items, participants, outcomes, tripStart, tripEnd, onApply }) => {
  const { draftItems, proposal, applying, shiftDay, swapDays, moveDay, resequenceDay, moveItemToDay, reset, apply, undo, canUndo } = useReplanDraft({
    items,
    tripStart,
    tripEnd,
    onApply,
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const dates = useMemo(() => enumerateDates(tripStart, tripEnd), [tripStart, tripEnd]);
  const itemsByDate = useMemo(() => {
    const map: Record<string, ItineraryItem[]> = {};
    for (const d of dates) map[d] = [];
    for (const item of draftItems) (map[item.date] ??= []).push(item);
    for (const d of Object.keys(map)) map[d].sort((a, b) => a.time_start.localeCompare(b.time_start));
    return map;
  }, [draftItems, dates]);

  const changedIds = useMemo(() => new Set(proposal.changes.map(c => c.item_id)), [proposal.changes]);
  const pendingItems = useMemo(() => draftItems.filter(i => outcomes[i.id]?.status === 'skipped'), [draftItems, outcomes]);
  const activeItem = activeId ? draftItems.find(i => i.id === activeId) ?? null : null;
  const blockingWarnings = proposal.warnings.filter(w => w.kind === 'outside_trip');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeItemId = String(active.id);
    const moved = draftItems.find(i => i.id === activeItemId);
    if (!moved) return;

    const overId = String(over.id);
    const overIsDate = Boolean(itemsByDate[overId]);

    if (overIsDate) {
      if (overId === moved.date) return;
      moveItemToDay(activeItemId, overId, itemsByDate[overId].length);
      return;
    }

    const overItem = draftItems.find(i => i.id === overId);
    if (!overItem) return;

    if (overItem.date === moved.date) {
      const dayIds = itemsByDate[moved.date].map(i => i.id);
      const oldIndex = dayIds.indexOf(activeItemId);
      const newIndex = dayIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      resequenceDay(moved.date, arrayMove(dayIds, oldIndex, newIndex));
    } else {
      const targetIndex = itemsByDate[overItem.date].findIndex(i => i.id === overId);
      moveItemToDay(activeItemId, overItem.date, targetIndex);
    }
  }

  async function handleApply() {
    const result = await apply();
    setFeedback(result.ok ? 'Roteiro atualizado.' : 'Não deu pra aplicar agora — tente de novo em instantes.');
  }

  async function handleUndo() {
    const result = await undo();
    setFeedback(result.ok ? 'Desfeito.' : 'Não deu pra desfazer agora.');
  }

  return (
    <div className="space-y-3">
      {pendingItems.length > 0 && (
        <div className="p-3 rounded-2xl glass-panel border border-warning-500/30">
          <p className="text-xs font-bold text-warning-300 mb-2">Pendências (não rolaram) — arraste o menu ⋮ para reencaixar</p>
          <div className="flex flex-wrap gap-2">
            {pendingItems.map(item => (
              <div key={item.id} className="w-64">
                <ReplanItemCard
                  item={item}
                  changed={changedIds.has(item.id)}
                  locked={false}
                  outcome={outcomes[item.id]}
                  otherDates={dates.filter(d => d !== item.date)}
                  onMoveToDay={toDate => moveItemToDay(item.id, toDate, itemsByDate[toDate]?.length ?? 0)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {dates.map(date => (
            <ReplanDayColumn
              key={date}
              date={date}
              items={itemsByDate[date]}
              changedIds={changedIds}
              outcomes={outcomes}
              allDates={dates}
              onShift={minutes => shiftDay(date, minutes)}
              onSwap={otherDate => swapDays(date, otherDate)}
              onMoveDay={toDate => moveDay(date, toDate)}
              onMoveItem={(itemId, toDate) => moveItemToDay(itemId, toDate, itemsByDate[toDate]?.length ?? 0)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeItem && (
            <div className="w-64">
              <ReplanItemCard item={activeItem} changed={changedIds.has(activeItem.id)} locked={false} outcome={outcomes[activeItem.id]} otherDates={[]} onMoveToDay={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className="sticky bottom-0 p-3 rounded-2xl glass-panel border border-ink-800 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-bold text-ink-100">
          {proposal.changes.length} {proposal.changes.length === 1 ? 'mudança' : 'mudanças'}
        </span>
        {proposal.warnings.length > 0 && (
          <span className="flex items-center gap-1 text-warning-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {proposal.warnings.length} {proposal.warnings.length === 1 ? 'aviso' : 'avisos'}
          </span>
        )}
        {feedback && <span className="text-ink-400">{feedback}</span>}
        <div className="ml-auto flex items-center gap-2">
          {canUndo && (
            <button onClick={handleUndo} disabled={applying} className="px-3 py-1.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-bold flex items-center gap-1.5 disabled:opacity-50">
              <Undo2 className="w-3.5 h-3.5" /> Desfazer
            </button>
          )}
          <button onClick={reset} disabled={proposal.changes.length === 0 || applying} className="px-3 py-1.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-bold disabled:opacity-30">
            Descartar
          </button>
          <button
            onClick={handleApply}
            disabled={proposal.changes.length === 0 || applying || blockingWarnings.length > 0}
            title={blockingWarnings.length > 0 ? blockingWarnings.map(w => w.message).join(' ') : undefined}
            className="px-4 py-1.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold disabled:opacity-30"
          >
            {applying ? 'Aplicando…' : 'Aplicar'}
          </button>
        </div>
      </div>

      {proposal.warnings.length > 0 && (
        <div className="p-3 rounded-2xl bg-warning-500/5 border border-warning-500/30 text-warning-300 text-xs space-y-1">
          {proposal.warnings.map((w, i) => (
            <p key={i}>⚠️ {w.message}</p>
          ))}
        </div>
      )}

      <p className="text-[10px] text-ink-600">
        Participantes na viagem: {participants.length}. Arraste um cartão entre dias ou use o menu do cabeçalho — os dois caminhos fazem a mesma coisa.
      </p>
    </div>
  );
};
