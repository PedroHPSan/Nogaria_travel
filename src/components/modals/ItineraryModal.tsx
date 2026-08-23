import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { ItineraryItem, Participant } from '../../types/database.types';

interface ItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: any) => void;
  initialData?: ItineraryItem | null;
  participants: Participant[];
  tripId: string;
}

const CATEGORY_OPTIONS: { id: ItineraryItem['category']; label: string }[] = [
  { id: 'park', label: '🎡 Parque Temático' },
  { id: 'restaurant', label: '🍽️ Restaurante / Alimentação' },
  { id: 'shopping', label: '🛍️ Compras & Outlets' },
  { id: 'flight', label: '✈️ Voo / Aeroporto' },
  { id: 'hotel', label: '🏨 Hotel / Hospedagem' },
  { id: 'transit', label: '🚗 Deslocamento / Retirada' },
  { id: 'tour', label: '🗽 Passeio / Atração' },
  { id: 'rest', label: '💤 Pausa / Descanso Infantil' },
  { id: 'event', label: '🎟️ Evento / Show' }
];

export const ItineraryModal: React.FC<ItineraryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  participants,
  tripId
}) => {
  const [date, setDate] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [city, setCity] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ItineraryItem['category']>('park');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [estimatedCost, setEstimatedCost] = useState<number | ''>(0);
  const [status, setStatus] = useState<ItineraryItem['status']>('planned');
  const [minHeightCm, setMinHeightCm] = useState<number | ''>('');
  const [minAgeYears, setMinAgeYears] = useState<number | ''>('');
  const [childFriendly, setChildFriendly] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setDate(initialData.date || '');
      setTimeStart(initialData.time_start || '');
      setTimeEnd(initialData.time_end || '');
      setCity(initialData.city || '');
      setTitle(initialData.title || '');
      setCategory(initialData.category || 'park');
      setDescription(initialData.description || '');
      setLocation(initialData.location || '');
      setSelectedParticipants(initialData.participant_ids || []);
      setEstimatedCost(initialData.estimated_cost ?? 0);
      setStatus(initialData.status || 'planned');
      setMinHeightCm(initialData.min_height_cm ?? '');
      setMinAgeYears(initialData.min_age_years ?? '');
      setChildFriendly(initialData.child_friendly ?? true);
      setNotes(initialData.notes || '');
    } else {
      setDate('2026-09-03');
      setTimeStart('09:00');
      setTimeEnd('18:00');
      setCity('Orlando');
      setTitle('');
      setCategory('park');
      setDescription('');
      setLocation('');
      setSelectedParticipants(participants.map(p => p.id));
      setEstimatedCost(0);
      setStatus('planned');
      setMinHeightCm('');
      setMinAgeYears('');
      setChildFriendly(true);
      setNotes('');
    }
  }, [initialData, isOpen, participants]);

  const toggleParticipant = (id: string) => {
    setSelectedParticipants(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !city.trim()) return;

    onSave({
      trip_id: tripId,
      date,
      time_start: timeStart || '09:00',
      time_end: timeEnd || undefined,
      city: city.trim(),
      title: title.trim(),
      category,
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      participant_ids: selectedParticipants,
      estimated_cost: estimatedCost !== '' ? Number(estimatedCost) : 0,
      currency: 'USD',
      status,
      min_height_cm: minHeightCm !== '' ? Number(minHeightCm) : undefined,
      min_age_years: minAgeYears !== '' ? Number(minAgeYears) : undefined,
      child_friendly: childFriendly,
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Atividade do Roteiro' : 'Cadastrar Atividade no Roteiro'}
      subtitle="Organize o cronograma diário, parques, horários e regras de atração infantil para Gabi e Débora."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Data da Atividade *</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Horário Início *</label>
            <input
              type="time"
              required
              value={timeStart}
              onChange={e => setTimeStart(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Horário Fim (Opcional)</label>
            <input
              type="time"
              value={timeEnd}
              onChange={e => setTimeEnd(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-ink-300 font-semibold mb-1">Título da Atividade *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Magic Kingdom (Disney World) / Jantar Hard Rock"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Cidade *</label>
            <input
              type="text"
              required
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Ex: Orlando, Miami, Fort Lauderdale"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Categoria da Atividade</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500 font-medium"
            >
              {CATEGORY_OPTIONS.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Status no Roteiro</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            >
              <option value="planned">Planejada</option>
              <option value="confirmed">Confirmada / Ingressos Comprados</option>
              <option value="optional">Opcional (Plano B)</option>
              <option value="completed">Concluída</option>
              <option value="cancelled">Cancelada / Substituída</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Participantes Presentes</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {participants.map(p => {
              const isSelected = selectedParticipants.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleParticipant(p.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                    isSelected
                      ? 'bg-accent-600/20 text-accent-400 border-accent-500/40'
                      : 'bg-ink-950 text-ink-400 border-ink-800 opacity-60'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.avatar_color}`} />
                  {p.full_name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Custo Estimado (US$)</label>
            <input
              type="number"
              min="0"
              step="10"
              value={estimatedCost}
              onChange={e => setEstimatedCost(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500 font-semibold text-success-400"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Altura Mínima (cm)</label>
            <input
              type="number"
              min="0"
              placeholder="Ex: 102cm / 130cm"
              value={minHeightCm}
              onChange={e => setMinHeightCm(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-warning-500/40 text-warning-300 focus:outline-none focus:border-warning-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Idade Mínima (Anos)</label>
            <input
              type="number"
              min="0"
              placeholder="Ex: 18 para cassino"
              value={minAgeYears}
              onChange={e => setMinAgeYears(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-ink-950/60 border border-ink-800 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-ink-200 font-medium">
            <input
              type="checkbox"
              checked={childFriendly}
              onChange={e => setChildFriendly(e.target.checked)}
              className="w-4 h-4 rounded text-info-600 focus:ring-info-500 bg-ink-900 border-ink-700"
            />
            Adequado para Crianças (Gabi 4a & Débora 12a)
          </label>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Estratégia & Observações do Roteiro</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Genie+ Lightning Lane agendado para 10h. Pausa de almoço no Fantasyland."
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
          />
        </div>

        <div className="pt-3 border-t border-ink-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold shadow-lg shadow-accent-600/30"
          >
            Salvar Atividade
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
