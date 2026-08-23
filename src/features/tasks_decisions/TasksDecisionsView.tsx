import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { TaskDecisionModal } from '../../components/modals/TaskDecisionModal';
import { ViewHeader } from '../../components/ui/ViewHeader';
import { SubTabs } from '../../components/ui/SubTabs';
import type { Task, Decision } from '../../types/database.types';
import {
  CheckSquare,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  User,
  History
} from 'lucide-react';


export const TasksDecisionsView: React.FC = () => {
  const {
    activeTrip,
    participants,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    decisions,
    addDecision,
    updateDecision,
    deleteDecision
  } = useTrip();

  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'decisions'>('tasks');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'task' | 'decision'>('task');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null);

  const tripTasks = tasks.filter(t => t.trip_id === activeTrip.id);
  const tripDecisions = decisions.filter(d => d.trip_id === activeTrip.id);

  const handleOpenAddTask = () => {
    setModalMode('task');
    setEditingTask(null);
    setIsModalOpen(true);
  };
  const handleOpenEditTask = (t: Task) => {
    setModalMode('task');
    setEditingTask(t);
    setIsModalOpen(true);
  };

  const handleOpenAddDecision = () => {
    setModalMode('decision');
    setEditingDecision(null);
    setIsModalOpen(true);
  };
  const handleOpenEditDecision = (d: Decision) => {
    setModalMode('decision');
    setEditingDecision(d);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      <ViewHeader
        title="Pendências & Registro de Decisões"
        subtitle="Acompanhe tarefas a concluir e preserve o histórico de escolhas de planejamento sem perder alternativas descartadas."
        actions={
          <SubTabs
            items={[
              { id: 'tasks', label: `Pendências (${tripTasks.length})`, icon: CheckSquare, accent: 'blue' },
              { id: 'decisions', label: `Decisões (${tripDecisions.length})`, icon: History, accent: 'purple' }
            ]}
            activeId={activeSubTab}
            onChange={setActiveSubTab}
          />
        }
      />

      {/* SUB-TAB: TASKS */}
      {activeSubTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Tarefas & Ações do Planejamento</h3>
            <button
              onClick={handleOpenAddTask}
              className="px-4 py-2 rounded-xl bg-info-600 hover:bg-info-500 text-white font-bold text-xs shadow-lg shadow-info-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nova Pendência
            </button>
          </div>

          <div className="space-y-3">
            {tripTasks.map(t => {
              const assigned = participants.find(p => p.id === t.assigned_to_id);
              const isCompleted = t.status === 'completed';

              return (
                <div
                  key={t.id}
                  className={`glass-card p-4 rounded-2xl border transition flex items-start gap-3 ${
                    isCompleted ? 'border-ink-800 opacity-60 bg-ink-900/40' : 'border-info-500/30'
                  }`}
                >
                  <button
                    onClick={() => toggleTaskStatus(t.id)}
                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${
                      isCompleted ? 'bg-success-500 border-success-400 text-white' : 'border-ink-700 hover:border-info-400 bg-ink-900'
                    }`}
                  >
                    {isCompleted && <CheckCircle2 className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.priority === 'high' ? 'bg-danger-500/10 text-danger-400 border border-danger-500/20' : 'bg-info-500/10 text-info-400'
                      }`}>
                        {t.priority === 'high' ? 'Urgente' : t.priority}
                      </span>
                      <h4 className={`font-bold text-sm text-white ${isCompleted ? 'line-through text-ink-400' : ''}`}>
                        {t.title}
                      </h4>
                    </div>

                    {t.description && <p className="text-xs text-ink-300 mt-1">{t.description}</p>}

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-400 mt-2">
                      {assigned && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-info-400" />
                          Responsável: <strong className="text-ink-200">{assigned.full_name}</strong>
                        </span>
                      )}
                      {t.due_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-warning-400" />
                          Prazo: <strong className="text-ink-200">{new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditTask(t)}
                      className="p-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Deseja excluir esta pendência?')) deleteTask(t.id);
                      }}
                      className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB: DECISIONS */}
      {activeSubTab === 'decisions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Histórico de Decisões de Viagem</h3>
            <button
              onClick={handleOpenAddDecision}
              className="px-4 py-2 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold text-xs shadow-lg shadow-accent-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nova Decisão
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripDecisions.map(d => {
              const decidedBy = participants.find(p => p.id === d.decided_by_id);

              return (
                <div key={d.id} className="glass-card p-5 rounded-2xl border border-ink-800 space-y-3 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-accent-500/10 text-accent-400 border border-accent-500/20">
                        {new Date(d.date).toLocaleDateString('pt-BR')}
                      </span>
                      <h4 className="font-bold text-base text-white mt-1">{d.topic}</h4>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditDecision(d)}
                        className="p-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Deseja excluir este registro de decisão?')) deleteDecision(d.id);
                        }}
                        className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-accent-600/10 border border-accent-500/30 text-xs">
                    <div className="text-accent-300 font-bold mb-0.5">Escolha Definitiva:</div>
                    <div className="text-white font-extrabold text-sm">{d.chosen_decision}</div>
                  </div>

                  {d.alternatives_considered && d.alternatives_considered.length > 0 && (
                    <div className="text-xs text-ink-400">
                      <span className="font-semibold text-ink-300">Alternativas Descartadas:</span>{' '}
                      {d.alternatives_considered.join(', ')}
                    </div>
                  )}

                  <div className="p-2.5 rounded-lg bg-ink-900/60 border border-ink-800 text-xs text-ink-300">
                    <span className="font-semibold text-info-400">Justificativa & Motivo:</span> {d.reason}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-ink-800 text-ink-400">
                    <span>Decidido por: <strong className="text-ink-200">{decidedBy?.full_name || 'Grupo'}</strong></span>
                    {d.financial_impact_usd !== undefined && (
                      <span className="text-success-400 font-bold">Impacto: US$ {d.financial_impact_usd}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      <TaskDecisionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        onSaveTask={tData => {
          if (editingTask) updateTask(editingTask.id, tData);
          else addTask(tData);
        }}
        onSaveDecision={dData => {
          if (editingDecision) updateDecision(editingDecision.id, dData);
          else addDecision(dData);
        }}
        initialTaskData={editingTask}
        initialDecisionData={editingDecision}
        participants={participants}
        tripId={activeTrip.id}
      />
    </div>
  );
};
