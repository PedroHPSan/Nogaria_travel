import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { IdeaModal } from '../../components/modals/IdeaModal';
import { ViewHeader } from '../../components/ui/ViewHeader';
import { Avatar } from '../../components/Avatar';
import type { TripIdea } from '../../types/database.types';
import { Lightbulb, Plus, Edit2, Trash2, MessageCircle, Smartphone } from 'lucide-react';

const CATEGORY_LABEL: Record<NonNullable<TripIdea['category']>, string> = {
  negocio: 'Negócio',
  viagem: 'Viagem',
  outro: 'Outro'
};

const STATUS_LABEL: Record<TripIdea['status'], string> = {
  novo: 'Novo',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  descartado: 'Descartado'
};

const STATUS_STYLE: Record<TripIdea['status'], string> = {
  novo: 'bg-info-500/10 text-info-400 border-info-500/20',
  em_analise: 'bg-warning-500/10 text-warning-400 border-warning-500/20',
  aprovado: 'bg-success-500/10 text-success-400 border-success-500/20',
  descartado: 'bg-ink-800 text-ink-500 border-ink-700'
};

export const IdeasView: React.FC = () => {
  const { activeTrip, participants, ideas, addIdea, updateIdea, deleteIdea } = useTrip();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<TripIdea | null>(null);
  const [statusFilter, setStatusFilter] = useState<TripIdea['status'] | 'all'>('all');

  const tripIdeas = ideas
    .filter(i => i.trip_id === activeTrip.id)
    .filter(i => statusFilter === 'all' || i.status === statusFilter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const handleOpenAdd = () => {
    setEditingIdea(null);
    setIsModalOpen(true);
  };
  const handleOpenEdit = (idea: TripIdea) => {
    setEditingIdea(idea);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      <ViewHeader
        title="Brainstorm de Ideias"
        subtitle="Ideias de negócio e de viagem registradas pelo grupo — direto no app ou mandando mensagem pro bot do WhatsApp."
        actions={
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-info-600 hover:bg-info-500 text-white font-bold text-xs shadow-lg shadow-info-600/30 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nova Ideia
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(['all', 'novo', 'em_analise', 'aprovado', 'descartado'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
              statusFilter === s
                ? 'bg-info-600 border-info-500 text-white'
                : 'bg-ink-900 border-ink-800 text-ink-400 hover:text-ink-200'
            }`}
          >
            {s === 'all' ? 'Todas' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {tripIdeas.length === 0 && (
        <div className="glass-card p-8 rounded-2xl border border-ink-800 text-center text-ink-400 text-sm flex flex-col items-center gap-2">
          <Lightbulb className="w-8 h-8 text-ink-600" />
          Nenhuma ideia registrada ainda. Mande uma mensagem pro bot do WhatsApp ou clique em "Nova Ideia".
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tripIdeas.map(idea => {
          const author = participants.find(p => p.id === idea.participant_id);

          return (
            <div key={idea.id} className="glass-card p-5 rounded-2xl border border-ink-800 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${STATUS_STYLE[idea.status]}`}>
                    {STATUS_LABEL[idea.status]}
                  </span>
                  {idea.category && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-accent-500/10 text-accent-400 border border-accent-500/20">
                      {CATEGORY_LABEL[idea.category]}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-ink-500" title={idea.source === 'whatsapp' ? 'Via WhatsApp' : 'Via App'}>
                    {idea.source === 'whatsapp' ? <MessageCircle className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(idea)}
                    className="p-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-ink-100 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Deseja excluir esta ideia?')) deleteIdea(idea.id);
                    }}
                    className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-ink-100 whitespace-pre-wrap">{idea.content}</p>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-ink-800 text-ink-400">
                <span className="flex items-center gap-1.5">
                  {author ? (
                    <>
                      <Avatar participant={author} size="sm" />
                      <strong className="text-ink-200">{author.full_name}</strong>
                    </>
                  ) : (
                    <strong className="text-ink-200">Grupo</strong>
                  )}
                </span>
                <span>{new Date(idea.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          );
        })}
      </div>

      <IdeaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={data => {
          if (editingIdea) updateIdea(editingIdea.id, data);
          else addIdea(data);
        }}
        initialData={editingIdea}
        participants={participants.filter(p => p.trip_id === activeTrip.id)}
        tripId={activeTrip.id}
      />
    </div>
  );
};
