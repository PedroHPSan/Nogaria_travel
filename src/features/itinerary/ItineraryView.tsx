import React, { useEffect, useMemo, useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { ItineraryModal } from '../../components/modals/ItineraryModal';
import { DiningRadarModal } from '../../components/modals/DiningRadarModal';
import { AttractionGuideModal } from '../../components/modals/AttractionGuideModal';
import { DayTimeline } from './DayTimeline';
import { MonthCalendar } from './MonthCalendar';
import { ViewHeader } from '../../components/ui/ViewHeader';
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
  const [parkSelectedDate, setParkSelectedDate] = useState<string>('');

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

  // Timeline / Calendar modes only consider park items (Cronologia)
  const parkItems = useMemo(
    () => tripItinerary.filter(i => i.category === 'park'),
    [tripItinerary],
  );
  const parkDates = useMemo(
    () => Array.from(new Set(parkItems.map(i => i.date))).sort(),
    [parkItems],
  );

  useEffect(() => {
    if (parkSelectedDate || parkDates.length === 0) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    const closest = parkDates.find(d => d >= todayIso) ?? parkDates[0];
    setParkSelectedDate(closest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkDates.join(','), parkSelectedDate]);

  const parkDayItems = parkItems.filter(i => i.date === parkSelectedDate);
  const parkName = parkDayItems[0]?.park;

  return (
    <div className="space-y-6 pb-20">
      <ViewHeader
        title={`Roteiro Diário & Atrações (${tripItinerary.length})`}
        subtitle={
          viewMode === 'timeline' && parkSelectedDate
            ? `${new Date(parkSelectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}${parkName ? ` • ${parkName}` : ''} — Cronologia dos Parques`
            : `Cronograma inteligente com validações de altura mínima para Gabi (4 anos • ${gabi?.height_cm || 100}cm) e Débora (12 anos).`
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsDiningRadarOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              Comer Barato ($)
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nova Atividade
            </button>
          </>
        }
      />

      {/* View Mode Toggle */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start w-fit">
        <button
          onClick={() => setViewMode('list')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
            viewMode === 'list' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          Lista
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
            viewMode === 'timeline' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Cronologia
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

      {viewMode === 'list' && (
        <>
          {/* Filter Bar */}
          <div className="p-3 rounded-2xl glass-panel border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-slate-300">Filtrar Data:</span>
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-semibold"
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
              <span className="font-semibold text-slate-300">Categoria:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-semibold"
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
              className="ml-auto px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              {copiedDate ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copiado com Sucesso!
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  Copiar para WhatsApp
                </>
              )}
            </button>
          </div>

          {/* Timeline Items */}
          <div className="space-y-3">
            {filteredItinerary.length === 0 ? (
          <div className="p-8 rounded-2xl glass-card text-center border border-slate-800 text-slate-400 text-xs">
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
                className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-purple-500/30 transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-sm">
                      {item.time_start}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {item.category.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')} • {item.city}
                        </span>
                      </div>
                      <h4 className="font-bold text-base text-white mt-0.5">{item.title}</h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenGuide(item)}
                      className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold text-xs flex items-center gap-1 transition shadow-sm"
                      title="Ver Guia e Dicas Estratégicas"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Dicas & Estratégia
                    </button>
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Deseja excluir "${item.title}"?`)) deleteItineraryItem(item.id);
                      }}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Kid Height Alert Box */}
                {hasGabiHeightWarning && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <div>
                      <strong>Alerta de Altura (Gabi 4a):</strong> Altura exigida:{' '}
                      <span className="font-bold">{item.min_height_cm}cm</span>. Gabi tem{' '}
                      <span className="font-bold">{gabi.height_cm}cm</span>. Recomendado utilizar <em>Rider Switch / Child Swap</em>.
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Participantes:</span>
                    <div className="flex items-center -space-x-1.5">
                      {item.participant_ids.map(pId => {
                        const p = participants.find(part => part.id === pId);
                        if (!p) return null;
                        return (
                          <span
                            key={pId}
                            title={p.full_name}
                            className={`w-6 h-6 rounded-full ${p.avatar_color} text-white font-bold text-[10px] flex items-center justify-center border border-slate-900`}
                          >
                            {p.nickname ? p.nickname[0] : p.full_name[0]}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {item.estimated_cost !== undefined && item.estimated_cost > 0 && (
                    <span className="text-emerald-400 font-bold">
                      Custo Est.: US$ {item.estimated_cost}
                    </span>
                  )}
                </div>

                {item.notes && (
                  <div className="text-xs text-slate-400 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-purple-400 font-semibold">Estratégia:</span> {item.notes}
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
        parkSelectedDate ? (
          <DayTimeline items={parkDayItems} participants={participants} />
        ) : (
          <div className="p-8 rounded-2xl glass-card text-center border border-slate-800 text-slate-400 text-xs">
            Nenhum dia de parque cadastrado nesta viagem.
          </div>
        )
      )}

      {viewMode === 'calendar' && (
        <MonthCalendar
          parkItems={parkItems}
          participants={participants}
          selectedDate={parkSelectedDate}
          onSelectDate={date => {
            setParkSelectedDate(date);
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
