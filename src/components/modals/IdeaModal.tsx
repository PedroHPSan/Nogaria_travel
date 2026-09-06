import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { TripIdea, Participant } from '../../types/database.types';

interface IdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<TripIdea, 'id' | 'created_at'>) => void;
  initialData: TripIdea | null;
  participants: Participant[];
  tripId: string;
}

const emptyForm = {
  content: '',
  category: '' as TripIdea['category'] | '',
  participant_id: '',
  status: 'novo' as TripIdea['status']
};

export const IdeaModal: React.FC<IdeaModalProps> = ({ isOpen, onClose, onSave, initialData, participants, tripId }) => {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (initialData) {
      setForm({
        content: initialData.content,
        category: initialData.category ?? '',
        participant_id: initialData.participant_id ?? '',
        status: initialData.status
      });
    } else {
      setForm(emptyForm);
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    onSave({
      trip_id: tripId,
      content: form.content.trim(),
      category: form.category || undefined,
      participant_id: form.participant_id || undefined,
      status: form.status,
      source: initialData?.source ?? 'app'
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Ideia' : 'Nova Ideia'}
      subtitle="Registre ideias de negócio ou de viagem que surgirem — pelo app ou pelo WhatsApp."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-ink-300 mb-1.5">Ideia</label>
          <textarea
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            rows={4}
            required
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-sm text-ink-100 focus:border-info-500 outline-none"
            placeholder="Descreva a ideia..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-ink-300 mb-1.5">Categoria</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value as TripIdea['category'] })}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-sm text-ink-100 focus:border-info-500 outline-none"
            >
              <option value="">—</option>
              <option value="negocio">Negócio</option>
              <option value="viagem">Viagem</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-300 mb-1.5">Autor</label>
            <select
              value={form.participant_id}
              onChange={e => setForm({ ...form, participant_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-sm text-ink-100 focus:border-info-500 outline-none"
            >
              <option value="">—</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-ink-300 mb-1.5">Status</label>
          <select
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value as TripIdea['status'] })}
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-sm text-ink-100 focus:border-info-500 outline-none"
          >
            <option value="novo">Novo</option>
            <option value="em_analise">Em análise</option>
            <option value="aprovado">Aprovado</option>
            <option value="descartado">Descartado</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-ink-800 text-ink-200 font-bold text-xs hover:bg-ink-700 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-info-600 hover:bg-info-500 text-white font-bold text-xs shadow-lg shadow-info-600/30 transition"
          >
            Salvar
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
