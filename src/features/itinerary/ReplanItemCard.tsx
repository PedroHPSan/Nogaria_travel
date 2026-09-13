import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Lock, MoreVertical } from 'lucide-react';
import type { ItineraryItem } from '../../types/database.types';

function formatDayOption(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export interface ReplanItemCardProps {
  item: ItineraryItem;
  changed: boolean;
  locked: boolean;
  outcome?: { status: 'pending' | 'skipped' | 'cancelled'; note: string | null };
  otherDates: string[];
  onMoveToDay: (toDate: string) => void;
}

/** Cartão arrastável de uma atividade no ReplanBoard. O menu `⋮` é o caminho não-drag equivalente ao arrasto entre colunas. */
export const ReplanItemCard: React.FC<ReplanItemCardProps> = ({ item, changed, locked, outcome, otherDates, onMoveToDay }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: locked });
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1.5 ${
        changed
          ? 'bg-info-500/10 border-info-500/40'
          : outcome?.status === 'skipped'
            ? 'bg-warning-500/5 border-warning-500/30'
            : 'bg-ink-900 border-ink-800'
      }`}
    >
      <div className="flex items-start gap-2">
        {!locked ? (
          <button {...attributes} {...listeners} className="mt-0.5 text-ink-600 hover:text-ink-300 cursor-grab active:cursor-grabbing shrink-0" aria-label="Arrastar atividade">
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span title="Reserva/horário confirmado — não é movido automaticamente" className="mt-0.5 text-warning-500 shrink-0">
            <Lock className="w-3.5 h-3.5" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-ink-100">{item.time_start}</span>
            {item.time_end && <span className="text-ink-500">–{item.time_end}</span>}
            {outcome?.status === 'skipped' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-warning-500/20 text-warning-400">Não rolou</span>
            )}
            {outcome?.status === 'cancelled' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-ink-800 text-ink-500 line-through">Cancelada</span>
            )}
          </div>
          <p className="text-ink-200 font-semibold truncate" title={item.title}>
            {item.title}
          </p>
          {item.park && <p className="text-ink-500 text-[10px] truncate">{item.park}</p>}
        </div>

        {otherDates.length > 0 && (
          <button
            onClick={() => setShowMoveMenu(v => !v)}
            className="text-ink-600 hover:text-ink-200 shrink-0"
            title="Mover para outro dia…"
            aria-label="Mover para outro dia"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showMoveMenu && (
        <select
          autoFocus
          className="w-full text-[10px] rounded-lg bg-ink-950 border border-ink-800 text-ink-200 px-1.5 py-1"
          defaultValue=""
          onChange={e => {
            if (e.target.value) onMoveToDay(e.target.value);
            setShowMoveMenu(false);
          }}
          onBlur={() => setShowMoveMenu(false)}
        >
          <option value="" disabled>
            Mover para…
          </option>
          {otherDates.map(d => (
            <option key={d} value={d}>
              {formatDayOption(d)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};
