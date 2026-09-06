import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { ParticipantModal } from '../../components/modals/ParticipantModal';
import { ViewHeader } from '../../components/ui/ViewHeader';
import type { Participant } from '../../types/database.types';
import { Avatar } from '../../components/Avatar';
import { FileText, DollarSign, Ruler, HeartPulse, Plus, Edit2, Trash2, ShieldAlert } from 'lucide-react';

export const ParticipantsView: React.FC = () => {
  const { participants, activeTrip, addParticipant, updateParticipant, deleteParticipant, formatAmount } = useTrip();


  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [search, setSearch] = useState('');

  const tripParticipants = participants.filter(p => p.trip_id === activeTrip.id);
  const filtered = tripParticipants.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.nickname && p.nickname.toLowerCase().includes(search.toLowerCase())) ||
    p.relationship.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenAdd = () => {
    setEditingParticipant(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Participant) => {
    setEditingParticipant(p);
    setIsModalOpen(true);
  };

  const handleSave = (data: any) => {
    if (editingParticipant) {
      updateParticipant(editingParticipant.id, data);
    } else {
      addParticipant(data);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <ViewHeader
        title={`Participantes do Grupo (${tripParticipants.length})`}
        subtitle="Cadastro individualizado com teto orçamentário, passaportes, vistos, regras por idade e restrições de altura."
        actions={
          <>
            <input
              type="text"
              placeholder="Buscar participante..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-2 rounded-xl bg-ink-900 border border-ink-800 text-xs text-ink-100 focus:outline-none focus:border-info-500 w-44"
            />
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-info-600 hover:bg-info-500 text-white font-bold text-xs shadow-lg shadow-info-600/30 transition flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Novo Participante
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(p => (
          <div key={p.id} className="glass-card p-5 rounded-2xl border border-ink-800 space-y-4 relative group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar participant={p} size="lg" />
                <div>
                  <h3 className="font-bold text-base text-ink-100">{p.full_name}</h3>
                  <p className="text-xs text-ink-400">
                    {p.age} anos • {p.relationship}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  p.is_minor ? 'bg-warning-500/10 text-warning-400 border border-warning-500/30' : 'bg-info-500/10 text-info-400 border border-info-500/30'
                }`}>
                  {p.is_minor ? 'Menor de Idade' : 'Adulto Responsável'}
                </span>

                <button
                  onClick={() => handleOpenEdit(p)}
                  className="p-1.5 rounded-lg bg-ink-800/80 text-ink-300 hover:text-ink-100 hover:bg-ink-700 transition"
                  title="Editar Participante"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Deseja remover ${p.full_name} do grupo?`)) {
                      deleteParticipant(p.id);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition"
                  title="Remover Participante"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {p.notes && (
              <div className="p-3 rounded-xl bg-ink-900/80 border border-ink-800 text-xs text-ink-300">
                <span className="font-semibold text-info-400 block mb-0.5">Observações & Regras do Participante:</span>
                {p.notes}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-ink-900/40 border border-ink-800/80 flex items-center gap-2">
                <FileText className="w-4 h-4 text-success-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-ink-400 text-[10px]">Passaporte / Visto</div>
                  <div className="font-semibold text-ink-100 truncate">
                    {p.passport_number || 'N/A'} ({p.visa_status === 'valid' ? 'Visto OK' : p.visa_status})
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-ink-900/40 border border-ink-800/80 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent-400 shrink-0" />
                <div>
                  <div className="text-ink-400 text-[10px]">Teto Orçamentário</div>
                  <div className="font-semibold text-ink-100">{formatAmount(p.budget_limit_usd || 0)}</div>
                </div>
              </div>


              {p.height_cm !== undefined && p.height_cm !== null && (
                <div className="p-2.5 rounded-lg bg-ink-900/40 border border-ink-800/80 flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-warning-400 shrink-0" />
                  <div>
                    <div className="text-ink-400 text-[10px]">Altura Atual</div>
                    <div className="font-semibold text-ink-100">{p.height_cm} cm</div>
                  </div>
                </div>
              )}

              {p.dietary_restrictions && p.dietary_restrictions.length > 0 && (
                <div className="p-2.5 rounded-lg bg-ink-900/40 border border-ink-800/80 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-danger-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-ink-400 text-[10px]">Restrições Alimentares</div>
                    <div className="font-semibold text-ink-100 truncate">{p.dietary_restrictions.join(', ')}</div>
                  </div>
                </div>
              )}
            </div>

            {p.is_minor && p.responsible_participant_id && (
              <div className="text-[11px] text-ink-400 flex items-center gap-1.5 pt-1 border-t border-ink-800/60">
                <ShieldAlert className="w-3.5 h-3.5 text-warning-400" />
                <span>
                  Responsável Legal:{' '}
                  <strong className="text-ink-200">
                    {tripParticipants.find(resp => resp.id === p.responsible_participant_id)?.full_name || 'Designado'}
                  </strong>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <ParticipantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingParticipant}
        existingParticipants={tripParticipants}
        tripId={activeTrip.id}
      />
    </div>
  );
};
