import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ArrowLeftRight, CalendarClock, Clock3 } from 'lucide-react';
import type { ItineraryItem } from '../../types/database.types';
import { ReplanItemCard } from './ReplanItemCard';

export interface ReplanDayColumnProps {
  date: string;
  items: ItineraryItem[];
  changedIds: Set<string>;
  outcomes: Record<string, { status: 'pending' | 'skipped' | 'cancelled'; note: string | null }>;
  weatherLabel?: string | null;
  parkLabel?: string | null;
  allDates: string[];
  onShift: (minutes: number) => void;
  onSwap: (otherDate: string) => void;
  onMoveDay: (toDate: string) => void;
  onMoveItem: (itemId: string, toDate: string) => void;
}

function formatDateLabel(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

/** Coluna de um dia no ReplanBoard: droppable para cartões + cabeçalho com o caminho não-drag (Empurrar/Trocar/Mover). */
export const ReplanDayColumn: React.FC<ReplanDayColumnProps> = ({
  date,
  items,
  changedIds,
  outcomes,
  weatherLabel,
  parkLabel,
  allDates,
  onShift,
  onSwap,
  onMoveDay,
  onMoveItem,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const [menuOpen, setMenuOpen] = useState<'shift' | 'swap' | 'move' | null>(null);
  const otherDates = allDates.filter(d => d !== date);

  return (
    <div className="w-72 shrink-0 flex flex-col gap-2">
      <div className="p-2.5 rounded-xl bg-ink-900 border border-ink-800 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <span className="font-bold text-ink-100 text-sm capitalize">{formatDateLabel(date)}</span>
          <span className="text-[10px] text-ink-500">{items.length} ativ.</span>
        </div>
        {(weatherLabel || parkLabel) && (
          <p className="mt-1 text-[10px] text-ink-500 truncate">{[weatherLabel, parkLabel].filter(Boolean).join(' · ')}</p>
        )}

        <div className="mt-2 flex items-center gap-1 text-[10px]">
          <button
            onClick={() => setMenuOpen(m => (m === 'shift' ? null : 'shift'))}
            className="px-1.5 py-1 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-300 flex items-center gap-1"
            title="Empurrar o dia inteiro"
          >
            <Clock3 className="w-3 h-3" /> Empurrar
          </button>
          {otherDates.length > 0 && (
            <>
              <button
                onClick={() => setMenuOpen(m => (m === 'swap' ? null : 'swap'))}
                className="px-1.5 py-1 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-300 flex items-center gap-1"
                title="Trocar com outro dia"
              >
                <ArrowLeftRight className="w-3 h-3" /> Trocar
              </button>
              <button
                onClick={() => setMenuOpen(m => (m === 'move' ? null : 'move'))}
                className="px-1.5 py-1 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-300 flex items-center gap-1"
                title="Mover o dia inteiro para outra data"
              >
                <CalendarClock className="w-3 h-3" /> Mover
              </button>
            </>
          )}
        </div>

        {menuOpen === 'shift' && (
          <div className="mt-2 flex flex-wrap gap-1">
            {[-30, -15, 15, 30, 60].map(m => (
              <button
                key={m}
                onClick={() => {
                  onShift(m);
                  setMenuOpen(null);
                }}
                className="px-2 py-1 rounded-lg bg-info-600/20 text-info-300 text-[10px] font-bold"
              >
                {m > 0 ? `+${m}min` : `${m}min`}
              </button>
            ))}
          </div>
        )}
        {menuOpen === 'swap' && (
          <select
            className="mt-2 w-full text-[10px] rounded-lg bg-ink-950 border border-ink-800 text-ink-200 px-1.5 py-1"
            defaultValue=""
            onChange={e => {
              if (e.target.value) onSwap(e.target.value);
              setMenuOpen(null);
            }}
          >
            <option value="" disabled>
              Trocar com…
            </option>
            {otherDates.map(d => (
              <option key={d} value={d}>
                {formatDateLabel(d)}
              </option>
            ))}
          </select>
        )}
        {menuOpen === 'move' && (
          <select
            className="mt-2 w-full text-[10px] rounded-lg bg-ink-950 border border-ink-800 text-ink-200 px-1.5 py-1"
            defaultValue=""
            onChange={e => {
              if (e.target.value) onMoveDay(e.target.value);
              setMenuOpen(null);
            }}
          >
            <option value="" disabled>
              Mover para…
            </option>
            {otherDates.map(d => (
              <option key={d} value={d}>
                {formatDateLabel(d)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div ref={setNodeRef} className={`flex-1 space-y-1.5 p-1.5 rounded-xl min-h-[80px] transition ${isOver ? 'bg-info-500/5 ring-1 ring-info-500/30' : ''}`}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <ReplanItemCard
              key={item.id}
              item={item}
              changed={changedIds.has(item.id)}
              locked={item.status === 'confirmed' || Boolean(item.show_block_start)}
              outcome={outcomes[item.id]}
              otherDates={otherDates}
              onMoveToDay={toDate => onMoveItem(item.id, toDate)}
            />
          ))}
        </SortableContext>
        {items.length === 0 && <p className="text-center text-[10px] text-ink-600 py-4">Solte uma atividade aqui</p>}
      </div>
    </div>
  );
};
