import React from 'react';
import { computeCoverage } from '../../services/coverageEngine';
import type { ItineraryItem, Participant } from '../../types/database.types';

interface MonthCalendarProps {
  parkItems: ItineraryItem[];
  participants: Participant[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const YEAR = 2026;
const MONTH = 9; // Setembro — a viagem cabe inteira neste mês (ver spec da fatia 2)

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function buildMonthGrid(): (string | null)[] {
  const firstWeekday = new Date(YEAR, MONTH - 1, 1).getDay();
  const daysInMonth = new Date(YEAR, MONTH, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${YEAR}-${String(MONTH).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return cells;
}

export const MonthCalendar: React.FC<MonthCalendarProps> = ({ parkItems, participants, selectedDate, onSelectDate }) => {
  const cells = buildMonthGrid();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white">Setembro 2026</h3>
      <div className="grid grid-cols-7 gap-1.5 text-[10px] text-slate-500 font-semibold uppercase text-center">
        {WEEKDAY_LABELS.map(label => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;

          const dayItems = parkItems.filter(i => i.date === date);
          const hasParkDay = dayItems.length > 0;
          const parkName = hasParkDay ? dayItems[0].park : undefined;
          const coverage = hasParkDay ? computeCoverage(dayItems, participants) : null;
          const isSelected = date === selectedDate;
          const dayNumber = Number(date.slice(-2));

          return (
            <button
              key={date}
              disabled={!hasParkDay}
              onClick={() => hasParkDay && onSelectDate(date)}
              className={`aspect-square rounded-xl border p-1.5 flex flex-col items-center justify-center gap-0.5 text-center transition ${
                !hasParkDay
                  ? 'border-slate-800/60 text-slate-600 cursor-default'
                  : isSelected
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-blue-500/50'
              }`}
            >
              <span className="text-xs font-bold">{dayNumber}</span>
              {hasParkDay && (
                <>
                  <span className="text-[9px] leading-tight truncate max-w-full">{parkName}</span>
                  <span className="text-[9px] font-bold text-emerald-400">{coverage?.percent}%</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
