import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { ItineraryModal } from '../../components/modals/ItineraryModal';
import type { ItineraryItem } from '../../types/database.types';
import {
  CalendarDays,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle
} from 'lucide-react';


export const ItineraryView: React.FC = () => {
  const { itinerary, activeTrip, participants, addItineraryItem, updateItineraryItem, deleteItineraryItem } = useTrip();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const tripItinerary = itinerary.filter(i => i.trip_id === activeTrip.id);

  // Available unique dates
  const availableDates = Array.from(new Set(tripItinerary.map(i => i.date))).sort();

  const filteredItinerary = tripItinerary.filter(item => {
    if (selectedDate !== 'all' && item.date !== selectedDate) return false;
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    return true;
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ItineraryItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const gabi = participants.find(p => p.nickname === 'Gabi' || p.age <= 4);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Roteiro Diário & Atrações ({tripItinerary.length})
          </h2>
          <p className="text-xs text-slate-400">
            Cronograma inteligente com validações de altura mínima para Gabi (4 anos • {gabi?.height_cm || 100}cm) e Débora (12 anos).
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nova Atividade
        </button>
      </div>

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
    </div>
  );
};
