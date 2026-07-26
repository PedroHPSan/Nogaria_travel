import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { ParticipantModal } from '../../components/modals/ParticipantModal';
import type { Participant } from '../../types/database.types';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Participantes do Grupo ({tripParticipants.length})
          </h2>
          <p className="text-xs text-slate-400">
            Cadastro individualizado com teto orçamentário, passaportes, vistos, regras por idade e restrições de altura.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar participante..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 w-44"
          />
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novo Participante
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(p => (
          <div key={p.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4 relative group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl ${p.avatar_color} text-white font-bold flex items-center justify-center text-lg shadow-lg`}>
                  {p.nickname ? p.nickname[0] : p.full_name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{p.full_name}</h3>
                  <p className="text-xs text-slate-400">
                    {p.age} anos • {p.relationship}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  p.is_minor ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                }`}>
                  {p.is_minor ? 'Menor de Idade' : 'Adulto Responsável'}
                </span>

                <button
                  onClick={() => handleOpenEdit(p)}
                  className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition"
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
                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                  title="Remover Participante"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {p.notes && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-blue-400 block mb-0.5">Observações & Regras do Participante:</span>
                {p.notes}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-slate-400 text-[10px]">Passaporte / Visto</div>
                  <div className="font-semibold text-white truncate">
                    {p.passport_number || 'N/A'} ({p.visa_status === 'valid' ? 'Visto OK' : p.visa_status})
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="text-slate-400 text-[10px]">Teto Orçamentário</div>
                  <div className="font-semibold text-white">{formatAmount(p.budget_limit_usd || 0)}</div>
                </div>
              </div>


              {p.height_cm !== undefined && p.height_cm !== null && (
                <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-slate-400 text-[10px]">Altura Atual</div>
                    <div className="font-semibold text-white">{p.height_cm} cm</div>
                  </div>
                </div>
              )}

              {p.dietary_restrictions && p.dietary_restrictions.length > 0 && (
                <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-rose-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-slate-400 text-[10px]">Restrições Alimentares</div>
                    <div className="font-semibold text-white truncate">{p.dietary_restrictions.join(', ')}</div>
                  </div>
                </div>
              )}
            </div>

            {p.is_minor && p.responsible_participant_id && (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Responsável Legal:{' '}
                  <strong className="text-slate-200">
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
