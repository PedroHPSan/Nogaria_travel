import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { Luggage, Participant } from '../../types/database.types';

interface LuggageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (luggage: any) => void;
  initialData?: Luggage | null;
  participants: Participant[];
  tripId: string;
}

export const LuggageModal: React.FC<LuggageModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  participants,
  tripId
}) => {
  const [participantId, setParticipantId] = useState('');
  const [type, setType] = useState<Luggage['type']>('checked');
  const [bagIdentifier, setBagIdentifier] = useState('');
  const [maxWeightKg, setMaxWeightKg] = useState<number | ''>(23);
  const [currentWeightKg, setCurrentWeightKg] = useState<number | ''>(10);
  const [shoppingSpaceReservedPct, setShoppingSpaceReservedPct] = useState<number | ''>(50);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (initialData) {
      setParticipantId(initialData.participant_id || '');
      setType(initialData.type || 'checked');
      setBagIdentifier(initialData.bag_identifier || '');
      setMaxWeightKg(initialData.max_weight_kg ?? 23);
      setCurrentWeightKg(initialData.current_weight_kg ?? 10);
      setShoppingSpaceReservedPct(initialData.shopping_space_reserved_pct ?? 50);
      setDescription(initialData.description || '');
    } else {
      setParticipantId(participants[0]?.id || '');
      setType('checked');
      setBagIdentifier('Mala Grande');
      setMaxWeightKg(23);
      setCurrentWeightKg(10);
      setShoppingSpaceReservedPct(50);
      setDescription('');
    }
  }, [initialData, isOpen, participants]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bagIdentifier.trim() || !participantId) return;

    onSave({
      trip_id: tripId,
      participant_id: participantId,
      type,
      bag_identifier: bagIdentifier.trim(),
      max_weight_kg: Number(maxWeightKg) || 23,
      current_weight_kg: currentWeightKg !== '' ? Number(currentWeightKg) : undefined,
      shopping_space_reserved_pct: shoppingSpaceReservedPct !== '' ? Number(shoppingSpaceReservedPct) : undefined,
      description: description.trim() || undefined
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Mala' : 'Cadastrar Franquia de Mala'}
      subtitle="Controle franquias por participante, peso máximo, peso atual e espaço para compras de retorno."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Participante Proprietário *</label>
            <select
              required
              value={participantId}
              onChange={e => setParticipantId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
            >
              <option value="">-- Selecione o Participante --</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Tipo de Bagagem *</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
            >
              <option value="checked">🧳 Despachada (23kg)</option>
              <option value="carry_on">💼 Mala de Mão (10kg)</option>
              <option value="personal_item">🎒 Item Pessoal / Mochila</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Identificador da Mala *</label>
          <input
            type="text"
            required
            value={bagIdentifier}
            onChange={e => setBagIdentifier(e.target.value)}
            placeholder="Ex: Mala Samsonite Preta #1 (Bárbara)"
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Peso Máximo (kg) *</label>
            <input
              type="number"
              required
              min="1"
              max="50"
              value={maxWeightKg}
              onChange={e => setMaxWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-bold"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Peso Atual Estimado (kg)</label>
            <input
              type="number"
              min="0"
              max="50"
              value={currentWeightKg}
              onChange={e => setCurrentWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-bold text-warning-400"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Espaço p/ Compras (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={shoppingSpaceReservedPct}
              onChange={e => setShoppingSpaceReservedPct(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-bold text-accent-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Descrição do Conteúdo</label>
          <textarea
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Roupas pessoais, itens infantis e espaço reservado para enxoval/compras."
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
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
            className="px-5 py-2 rounded-xl bg-info-600 hover:bg-info-500 text-white font-bold shadow-lg shadow-info-600/30"
          >
            Salvar Mala
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
