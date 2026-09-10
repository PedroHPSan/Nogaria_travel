import React from 'react';
import { computeCoverage } from '../../services/coverageEngine';
import { AchievementBadge } from '../../components/AchievementBadge';
import type { ItineraryItem, Participant } from '../../types/database.types';

interface MonthCalendarProps {
  items: ItineraryItem[];
  participants: Participant[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Ida da viagem (YYYY-MM-DD). Primeiro mês da grade. */
  startDate: string;
  /** Volta da viagem (YYYY-MM-DD). Último mês da grade. */
  endDate: string;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/** `YYYY-MM` de uma data ISO; `null` para entrada malformada. */
function monthKey(date: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(date);
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Meses (`YYYY-MM`, em ordem) que a grade precisa cobrir: todo mês entre a ida
 * e a volta da viagem, mais qualquer mês em que exista item do roteiro fora
 * desse intervalo (um voo de conexão no dia anterior, por exemplo). Antes da
 * issue #33 só o mês da ida era renderizado, e uma viagem 28/12–05/01 perdia
 * os dias de janeiro.
 */
export function monthsToRender(startDate: string, endDate: string, itemDates: string[]): string[] {
  const keys = new Set<string>();
  const first = monthKey(startDate);
  const last = monthKey(endDate) ?? first;

  if (first) {
    let [y, m] = first.split('-').map(Number);
    const [ly, lm] = (last ?? first).split('-').map(Number);
    // Guarda contra volta < ida (dados inconsistentes): renderiza só a ida.
    const limit = ly * 12 + lm >= y * 12 + m ? ly * 12 + lm : y * 12 + m;
    while (y * 12 + m <= limit) {
      keys.add(`${y}-${String(m).padStart(2, '0')}`);
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
  }

  for (const date of itemDates) {
    const key = monthKey(date);
    if (key) keys.add(key);
  }

  return Array.from(keys).sort();
}

function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return cells;
}

interface MonthBlockProps {
  monthKey: string;
  items: ItineraryItem[];
  participants: Participant[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const MonthBlock: React.FC<MonthBlockProps> = ({ monthKey: key, items, participants, selectedDate, onSelectDate }) => {
  const [year, month] = key.split('-').map(Number);
  const cells = buildMonthGrid(year, month);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-ink-100">{MONTH_LABELS[month - 1]} {year}</h3>
      <div className="grid grid-cols-7 gap-1.5 text-[10px] text-ink-500 font-semibold uppercase text-center">
        {WEEKDAY_LABELS.map(label => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;

          const dayItems = items.filter(i => i.date === date);
          const hasItems = dayItems.length > 0;
          const parkName = dayItems.find(i => i.park)?.park;
          const hasCoverageItems = dayItems.some(i => i.item_type);
          const coverage = hasCoverageItems ? computeCoverage(dayItems, participants) : null;
          const isSelected = date === selectedDate;
          const dayNumber = Number(date.slice(-2));

          return (
            <button
              key={date}
              disabled={!hasItems}
              onClick={() => hasItems && onSelectDate(date)}
              className={`aspect-square rounded-xl border p-1.5 flex flex-col items-center justify-center gap-0.5 text-center transition ${
                !hasItems
                  ? 'border-ink-800/60 text-ink-600 cursor-default'
                  : isSelected
                  ? 'border-info-500 bg-info-500/10 text-info-300'
                  : 'border-ink-800 bg-ink-900/60 text-ink-300 hover:border-info-500/50'
              }`}
            >
              <span className="text-xs font-bold">{dayNumber}</span>
              {hasItems && (
                <>
                  <span className="text-[9px] leading-tight truncate max-w-full">
                    {parkName ?? `${dayItems.length} ${dayItems.length === 1 ? 'item' : 'itens'}`}
                  </span>
                  {coverage && (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-bold text-success-400">{coverage.percent}%</span>
                      <AchievementBadge percent={coverage.percent} />
                    </div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const MonthCalendar: React.FC<MonthCalendarProps> = ({ items, participants, selectedDate, onSelectDate, startDate, endDate }) => {
  const months = monthsToRender(startDate, endDate, items.map(i => i.date));

  return (
    <div className="space-y-8">
      {months.map(key => (
        <MonthBlock
          key={key}
          monthKey={key}
          items={items}
          participants={participants}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />
      ))}
    </div>
  );
};
