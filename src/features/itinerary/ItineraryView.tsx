import React, { useEffect, useMemo, useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { ItineraryModal } from '../../components/modals/ItineraryModal';
import { DiningRadarModal } from '../../components/modals/DiningRadarModal';
import { AttractionGuideModal } from '../../components/modals/AttractionGuideModal';
import { DayTimeline } from './DayTimeline';
import { MonthCalendar } from './MonthCalendar';
import { ViewHeader } from '../../components/ui/ViewHeader';
import { Avatar } from '../../components/Avatar';
import type { ItineraryItem } from '../../types/database.types';
import { sortItineraryChronologically } from '../../services/itinerarySort';
import {
  CalendarDays,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Utensils,
  Sparkles,
  Share2,
  Check,
  List,
  Clock,
  Calendar
} from 'lucide-react';

type ViewMode = 'list' | 'timeline' | 'calendar';

export const ItineraryView: React.FC = () => {
  const { itinerary, activeTrip, participants, addItineraryItem, updateItineraryItem, deleteItineraryItem } = useTrip();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);

  const [isDiningRadarOpen, setIsDiningRadarOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [selectedGuideItem, setSelectedGuideItem] = useState<ItineraryItem | null>(null);

  const [copiedDate, setCopiedDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [timelineDate, setTimelineDate] = useState<string>('');

  const tripItinerary = useMemo(
    () => itinerary.filter(i => i.trip_id === activeTrip.id),
    [itinerary, activeTrip.id],
  );

  // Available unique dates
  const availableDates = useMemo(
    () => Array.from(new Set(tripItinerary.map(i => i.date).filter(Boolean))).sort(),
    [tripItinerary],
  );

  const filteredItinerary = useMemo(() => {
    const filtered = tripItinerary.filter(item => {
      if (selectedDate !== 'all' && item.date !== selectedDate) return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      return true;
    });
    return sortItineraryChronologically(filtered);
  }, [tripItinerary, selectedDate, selectedCategory]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ItineraryItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleOpenGuide = (item: ItineraryItem) => {
    setSelectedGuideItem(item);
    setIsGuideModalOpen(true);
  };

  const handleCopyDayForWhatsApp = () => {
    const targetItems = filteredItinerary;
    if (targetItems.length === 0) return;

    const dateStr = selectedDate !== 'all' 
      ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR') 
      : 'Geral da Viagem';

    let text = `🇺🇸 *NOGÁRIA USA 2026 - ROTEIRO DO DIA (${dateStr})*\n\n`;

    targetItems.forEach((item, _idx) => {
      text += `📍 *${item.time_start || 'Horário Livre'}* • ${item.title} (${item.city})\n`;
      text += `   🏷️ Categoria: ${item.category.toUpperCase()}\n`;
      if (item.min_height_cm) {
        text += `   ⚠️ Altura Mínima: ${item.min_height_cm}cm (Gabi: 100cm)\n`;
      }
      if (item.notes) {
        text += `   💡 Estratégia: ${item.notes}\n`;
      }
      text += `\n`;
    });

    text += `✨ *Dica:* Água gelada gratuita nos balcões de serviço rápido e pausas para a Gabi à tarde!\n`;

    navigator.clipboard.writeText(text);
    setCopiedDate(selectedDate);
    setTimeout(() => setCopiedDate(null), 2500);
  };

  const gabi = participants.find(p => p.nickname === 'Gabi' || p.age <= 4);

  // Cronologia / Calendário consideram todos os itens do roteiro (parques, restaurantes, compras etc.)
  const timelineDates = useMemo(
    () => Array.from(new Set(tripItinerary.map(i => i.date).filter(Boolean))).sort(),
    [tripItinerary],
  );

  useEffect(() => {
    if (timelineDate || timelineDates.length === 0) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    const closest = timelineDates.find(d => d >= todayIso) ?? timelineDates[0];
    setTimelineDate(closest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineDates.join(','), timelineDate]);

  const dayItems = tripItinerary.filter(i => i.date === timelineDate);
  const dayParkName = dayItems.find(i => i.park)?.park;

  return (
    <div className="space-y-6 pb-20">
      <ViewHeader
        title={`Roteiro Diário & Atrações (${tripItinerary.length})`}
        subtitle={
          viewMode === 'timeline' && timelineDate
            ? `${new Date(timelineDate + 'T00:00:00').toLocaleDateString('pt-BR')}${dayParkName ? ` • ${dayParkName}` : ''} — Cronologia do Dia`
            : `Cronograma inteligente com validações de altura mínima para Gabi (4 anos • ${gabi?.height_cm || 100}cm) e Débora (12 anos).`
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsDiningRadarOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-warning-500/10 hover:bg-warning-500/20 border border-warning-500/30 text-warning-300 font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              <Utensils className="w-3.5 h-3.5 text-warning-400" />
              Comer Barato ($)
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold text-xs shadow-lg shadow-accent-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nova Atividade
            </button>
          </>
        }
      />

      {/* View Mode Toggle */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-ink-900 border border-ink-800 self-start w-fit">
        <button
          onClick={() => setViewMode('list')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
            viewMode === 'list' ? 'bg-info-600/20 text-info-400' : 'text-ink-400 hover:text-ink-100'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          Lista
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
            viewMode === 'timeline' ? 'bg-info-600/20 text-info-400' : 'text-ink-400 hover:text-ink-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Cronologia
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
            viewMode === 'calendar' ? 'bg-info-600/20 text-info-400' : 'text-ink-400 hover:text-ink-100'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Calendário
        </button>
      </div>

      {viewMode === 'list' && (
        <>
          {/* Filter Bar */}
          <div className="p-3 rounded-2xl glass-panel border border-ink-800 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-accent-400" />
              <span className="font-semibold text-ink-300">Filtrar Data:</span>
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-ink-900 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
              >
                <option value="all">Todas as Datas ({tripItinerary.length})</option>
                {availableDates.map(d => (
                  <option key={d} value={d}>
                    {new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-ink-300">Categoria:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-ink-900 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
              >
                <option value="all">Todas Categorias</option>
                <option value="park">🎡 Parques</option>
                <option value="restaurant">🍽️ Restaurantes</option>
                <option value="shopping">🛍️ Compras</option>
                <option value="transit">🚗 Deslocamentos</option>
                <option value="tour">🗽 Passeios</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleCopyDayForWhatsApp}
              className="ml-auto px-3.5 py-1.5 rounded-xl bg-success-500/10 hover:bg-success-500/20 border border-success-500/30 text-success-300 font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              {copiedDate ? (
                <>
                  <Check className="w-3.5 h-3.5 text-success-400" />
                  Copiado com Sucesso!
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-success-400" />
                  Copiar para WhatsApp
                </>
              )}
            </button>
          </div>

          {/* Timeline Items */}
          <div className="space-y-3">
            {filteredItinerary.length === 0 ? (
          <div className="p-8 rounded-2xl glass-card text-center border border-ink-800 text-ink-400 text-xs">
            Nenhuma atividade cadastrada para os filtros selecionados. Clique em "+ Nova Atividade" para adicionar.
          </div>
        ) : (
          filteredItinerary.map(item => {
            const hasGabiHeightWarning =
              gabi &&
              item.min_height_cm &&
              gabi.height_cm &&
              gabi.height_cm < item.min_height_cm;

            return (
              <div
                key={item.id}
                className="glass-card p-4 rounded-2xl border border-ink-800 hover:border-accent-500/30 transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-500/10 text-accent-400 flex items-center justify-center font-bold text-sm">
                      {item.time_start}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-accent-500/10 text-accent-400 border border-accent-500/20">
                          {item.category.toUpperCase()}
                        </span>
                        <span className="text-xs text-ink-400 font-medium">
                          {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')} • {item.city}
                        </span>
                      </div>
                      <h4 className="font-bold text-base text-ink-100 mt-0.5">{item.title}</h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenGuide(item)}
                      className="px-2.5 py-1 rounded-lg bg-accent-500/10 hover:bg-accent-500/20 text-accent-300 border border-accent-500/30 font-bold text-xs flex items-center gap-1 transition shadow-sm"
                      title="Ver Guia e Dicas Estratégicas"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-accent-400" />
                      Dicas & Estratégia
                    </button>
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-ink-100 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Deseja excluir "${item.title}"?`)) deleteItineraryItem(item.id);
                      }}
                      className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Kid Height Alert Box */}
                {hasGabiHeightWarning && (
                  <div className="p-3 rounded-xl bg-warning-500/10 border border-warning-500/30 text-warning-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-warning-400" />
                    <div>
                      <strong>Alerta de Altura (Gabi 4a):</strong> Altura exigida:{' '}
                      <span className="font-bold">{item.min_height_cm}cm</span>. Gabi tem{' '}
                      <span className="font-bold">{gabi.height_cm}cm</span>. Recomendado utilizar <em>Rider Switch / Child Swap</em>.
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-ink-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-400">Participantes:</span>
                    <div className="flex items-center -space-x-1.5">
                      {item.participant_ids.map(pId => {
                        const p = participants.find(part => part.id === pId);
                        if (!p) return null;
                        return (
                          <div key={pId} className="border border-ink-900 rounded-full" title={p.full_name}>
                            <Avatar participant={p} size="sm" />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {item.estimated_cost !== undefined && item.estimated_cost > 0 && (
                    <span className="text-success-400 font-bold">
                      Custo Est.: US$ {item.estimated_cost}
                    </span>
                  )}
                </div>

                {item.notes && (
                  <div className="text-xs text-ink-400 p-2.5 rounded-lg bg-ink-900/60 border border-ink-800">
                    <span className="text-accent-400 font-semibold">Estratégia:</span> {item.notes}
                  </div>
                )}
              </div>
            );
          })
        )}
          </div>
        </>
      )}

      {viewMode === 'timeline' && (
        timelineDate ? (
          <div className="space-y-4">
            {/* Day Selector */}
            <div className="flex flex-wrap gap-1.5">
              {timelineDates.map(d => (
                <button
                  key={d}
                  onClick={() => setTimelineDate(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                    d === timelineDate
                      ? 'bg-info-600/20 text-info-300 border-info-500/50'
                      : 'bg-ink-900 text-ink-400 border-ink-800 hover:text-ink-100 hover:border-ink-700'
                  }`}
                >
                  {new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </button>
              ))}
            </div>
            <DayTimeline items={dayItems} participants={participants} />
          </div>
        ) : (
          <div className="p-8 rounded-2xl glass-card text-center border border-ink-800 text-ink-400 text-xs">
            Nenhuma atividade cadastrada nesta viagem.
          </div>
        )
      )}

      {viewMode === 'calendar' && (
        <MonthCalendar
          items={tripItinerary}
          participants={participants}
          selectedDate={timelineDate}
          referenceDate={activeTrip.start_date}
          onSelectDate={date => {
            setTimelineDate(date);
            setViewMode('timeline');
          }}
        />
      )}

      <ItineraryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={iData => {
          if (editingItem) updateItineraryItem(editingItem.id, iData);
          else addItineraryItem(iData);
        }}
        initialData={editingItem}
        participants={participants}
        tripId={activeTrip.id}
      />

      <DiningRadarModal
        isOpen={isDiningRadarOpen}
        onClose={() => setIsDiningRadarOpen(false)}
        initialDestination={activeTrip.destination_main.includes('Miami') ? 'Orlando / Kissimmee' : 'Orlando / Kissimmee'}
      />

      <AttractionGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        item={selectedGuideItem}
      />
    </div>
  );
};
