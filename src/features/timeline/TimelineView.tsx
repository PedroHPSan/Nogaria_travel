import React, { useEffect, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { DayTimeline } from './DayTimeline';
import { MonthCalendar } from './MonthCalendar';

export const TimelineView: React.FC = () => {
  const { itinerary, activeTrip, participants } = useTrip();

  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const parkItems = itinerary.filter(i => i.trip_id === activeTrip.id && i.category === 'park');
  const availableDates = Array.from(new Set(parkItems.map(i => i.date))).sort();

  useEffect(() => {
    if (selectedDate || availableDates.length === 0) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    const closest = availableDates.find(d => d >= todayIso) ?? availableDates[0];
    setSelectedDate(closest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDates.join(','), selectedDate]);

  const dayItems = parkItems.filter(i => i.date === selectedDate);
  const parkName = dayItems[0]?.park;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Cronologia dos Parques</h2>
          <p className="text-xs text-slate-400">
            {viewMode === 'timeline' && selectedDate
              ? `${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}${parkName ? ` • ${parkName}` : ''}`
              : 'Setembro 2026'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              viewMode === 'timeline' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Timeline
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              viewMode === 'calendar' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendário
          </button>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        selectedDate ? (
          <DayTimeline items={dayItems} participants={participants} />
        ) : (
          <div className="p-8 rounded-2xl glass-card text-center border border-slate-800 text-slate-400 text-xs">
            Nenhum dia de parque cadastrado nesta viagem.
          </div>
        )
      ) : (
        <MonthCalendar
          parkItems={parkItems}
          participants={participants}
          selectedDate={selectedDate}
          onSelectDate={date => {
            setSelectedDate(date);
            setViewMode('timeline');
          }}
        />
      )}
    </div>
  );
};
