import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { Task, Decision, Participant } from '../../types/database.types';

interface TaskDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'task' | 'decision';
  onSaveTask: (task: any) => void;
  onSaveDecision: (decision: any) => void;
  initialTaskData?: Task | null;
  initialDecisionData?: Decision | null;
  participants: Participant[];
  tripId: string;
}

export const TaskDecisionModal: React.FC<TaskDecisionModalProps> = ({
  isOpen,
  onClose,
  mode,
  onSaveTask,
  onSaveDecision,
  initialTaskData,
  initialDecisionData,
  participants,
  tripId
}) => {
  // Task state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignedId, setTaskAssignedId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<Task['priority']>('medium');
  const [taskCategory, setTaskCategory] = useState<Task['category']>('logistics');

  // Decision state
  const [decTopic, setDecTopic] = useState('');
  const [decAlternatives, setDecAlternatives] = useState('');
  const [decChosen, setDecChosen] = useState('');
  const [decReason, setDecReason] = useState('');
  const [decDecidedById, setDecDecidedById] = useState('');
  const [decFinancialImpact, setDecFinancialImpact] = useState<number | ''>(0);

  useEffect(() => {
    if (mode === 'task') {
      if (initialTaskData) {
        setTaskTitle(initialTaskData.title || '');
        setTaskDesc(initialTaskData.description || '');
        setTaskAssignedId(initialTaskData.assigned_to_id || '');
        setTaskDueDate(initialTaskData.due_date || '');
        setTaskPriority(initialTaskData.priority || 'medium');
        setTaskCategory(initialTaskData.category || 'logistics');
      } else {
        setTaskTitle('');
        setTaskDesc('');
        setTaskAssignedId(participants[0]?.id || '');
        setTaskDueDate('');
        setTaskPriority('medium');
        setTaskCategory('logistics');
      }
    } else {
      if (initialDecisionData) {
        setDecTopic(initialDecisionData.topic || '');
        setDecAlternatives(initialDecisionData.alternatives_considered ? initialDecisionData.alternatives_considered.join(', ') : '');
        setDecChosen(initialDecisionData.chosen_decision || '');
        setDecReason(initialDecisionData.reason || '');
        setDecDecidedById(initialDecisionData.decided_by_id || '');
        setDecFinancialImpact(initialDecisionData.financial_impact_usd ?? 0);
      } else {
        setDecTopic('');
        setDecAlternatives('');
        setDecChosen('');
        setDecReason('');
        setDecDecidedById(participants[0]?.id || '');
        setDecFinancialImpact(0);
      }
    }
  }, [mode, initialTaskData, initialDecisionData, isOpen, participants]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'task') {
      if (!taskTitle.trim()) return;
      onSaveTask({
        trip_id: tripId,
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        assigned_to_id: taskAssignedId || undefined,
        due_date: taskDueDate || undefined,
        priority: taskPriority,
        category: taskCategory,
        status: 'pending'
      });
    } else {
      if (!decTopic.trim() || !decChosen.trim()) return;
      const altArray = decAlternatives
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      onSaveDecision({
        trip_id: tripId,
        topic: decTopic.trim(),
        alternatives_considered: altArray,
        chosen_decision: decChosen.trim(),
        reason: decReason.trim(),
        decided_by_id: decDecidedById,
        date: new Date().toISOString().split('T')[0],
        financial_impact_usd: decFinancialImpact !== '' ? Number(decFinancialImpact) : undefined,
        is_active: true
      });
    }
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'task'
          ? initialTaskData ? 'Editar Pendência' : 'Cadastrar Nova Pendência'
          : initialDecisionData ? 'Editar Decisão Registrada' : 'Registrar Decisão de Planejamento'
      }
      subtitle={
        mode === 'task'
          ? 'Crie tarefas e acompanhe responsabilidades do grupo.'
          : 'Preserve o histórico de escolhas, alternativas descartadas e impacto financeiro.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {mode === 'task' ? (
          <>
            <div>
              <label className="block text-ink-300 font-semibold mb-1">Título da Pendência *</label>
              <input
                type="text"
                required
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                placeholder="Ex: Confirmar Uber pós devolução do carro em 19/09 às 17h30"
                className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-300 font-semibold mb-1">Responsável</label>
                <select
                  value={taskAssignedId}
                  onChange={e => setTaskAssignedId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
                >
                  <option value="">-- Qualquer Responsável --</option>
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Data Limite / Prazo</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={e => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-300 font-semibold mb-1">Prioridade</label>
                <select
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
                >
                  <option value="high">🔥 Alta Prioridade</option>
                  <option value="medium">⚡ Média Prioridade</option>
                  <option value="low">💡 Baixa Prioridade</option>
                </select>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Categoria da Pendência</label>
                <select
                  value={taskCategory}
                  onChange={e => setTaskCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
                >
                  <option value="logistics">🚗 Logística / Transportes</option>
                  <option value="finance">💳 Financeiro / Gift Cards</option>
                  <option value="tickets">🎟️ Ingressos & Parques</option>
                  <option value="documents">📄 Documentos & Vistos</option>
                  <option value="shopping">🛍️ Compras & Mala</option>
                  <option value="general">📦 Geral</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-ink-300 font-semibold mb-1">Descrição Detalhada</label>
              <textarea
                rows={3}
                value={taskDesc}
                onChange={e => setTaskDesc(e.target.value)}
                placeholder="Ex: Agendar transporte com capacidade para 4 passageiros e malas."
                className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-ink-300 font-semibold mb-1">Tema da Decisão *</label>
              <input
                type="text"
                required
                value={decTopic}
                onChange={e => setDecTopic(e.target.value)}
                placeholder="Ex: Substituição do Hotel da última noite (Celebration Suites -> Four Points FLL)"
                className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-ink-300 font-semibold mb-1">Alternativas Consideradas (separadas por vírgula)</label>
              <input
                type="text"
                value={decAlternatives}
                onChange={e => setDecAlternatives(e.target.value)}
                placeholder="Ex: Celebration Suites Kissimmee, Four Points FLL, Hotel Próximo MCO"
                className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
              />
            </div>

            <div>
              <label className="block text-ink-300 font-semibold mb-1">Decisão Escolhida *</label>
              <input
                type="text"
                required
                value={decChosen}
                onChange={e => setDecChosen(e.target.value)}
                placeholder="Ex: Four Points by Sheraton Fort Lauderdale Airport"
                className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500 font-bold text-success-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-300 font-semibold mb-1">Responsável pela Decisão *</label>
                <select
                  required
                  value={decDecidedById}
                  onChange={e => setDecDecidedById(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
                >
                  <option value="">-- Selecione o Responsável --</option>
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Impacto Financeiro Líquido (US$)</label>
                <input
                  type="number"
                  step="5"
                  value={decFinancialImpact}
                  onChange={e => setDecFinancialImpact(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ex: 70.00 ou -50.00"
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-ink-300 font-semibold mb-1">Motivo & Raciocínio da Escolha *</label>
              <textarea
                rows={3}
                required
                value={decReason}
                onChange={e => setDecReason(e.target.value)}
                placeholder="Ex: Elimina o risco de trânsito longo no dia do voo noturno após a entrega do carro alugado."
                className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
              />
            </div>
          </>
        )}

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
            {mode === 'task' ? 'Salvar Pendência' : 'Salvar Decisão'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
