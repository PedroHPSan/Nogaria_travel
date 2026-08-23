import React from 'react';
import { computeCoverage } from '../../services/coverageEngine';
import type { ItineraryItem, Participant } from '../../types/database.types';

interface MonthCalendarProps {
  parkItems: ItineraryItem[];
  participants: Participant[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  referenceDate: string;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

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

export const MonthCalendar: React.FC<MonthCalendarProps> = ({ parkItems, participants, selectedDate, onSelectDate, referenceDate }) => {
  const [year, month] = referenceDate.split('-').map(Number);
  const cells = buildMonthGrid(year, month);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white">{MONTH_LABELS[month - 1]} {year}</h3>
      <div className="grid grid-cols-7 gap-1.5 text-[10px] text-ink-500 font-semibold uppercase text-center">
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
                  ? 'border-ink-800/60 text-ink-600 cursor-default'
                  : isSelected
                  ? 'border-info-500 bg-info-500/10 text-info-300'
                  : 'border-ink-800 bg-ink-900/60 text-ink-300 hover:border-info-500/50'
              }`}
            >
              <span className="text-xs font-bold">{dayNumber}</span>
              {hasParkDay && (
                <>
                  <span className="text-[9px] leading-tight truncate max-w-full">{parkName}</span>
                  <span className="text-[9px] font-bold text-success-400">{coverage?.percent}%</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
