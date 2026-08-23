import React from 'react';
import type { DreGlobalResult } from '../../../services/dreEngine';
import type { Expense, Participant } from '../../../types/database.types';
import {
  Plus,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Layers,
  Plane,
  Building2,
  Ticket,
  Car,
  Utensils,
  ShoppingBag,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  accommodation: Building2,
  tickets: Ticket,
  transport: Car,
  food: Utensils,
  shopping: ShoppingBag,
  services: ShieldCheck,
  other: Layers
};

const CATEGORY_COLORS: Record<string, string> = {
  flight: '#3b82f6',
  accommodation: '#8b5cf6',
  tickets: '#ec4899',
  transport: '#f59e0b',
  food: '#10b981',
  shopping: '#06b6d4',
  services: '#6366f1',
  other: '#64748b'
};

interface DreCategoriesProps {
  dreResult: DreGlobalResult;
  participants: Participant[];
  expandedCategories: Record<string, boolean>;
  toggleCategoryExpand: (cat: string) => void;
  formatVal: (valUsd: number, valBrl: number) => string;
  handleOpenAddExpense: (cat?: Expense['category']) => void;
  handleOpenEditExpense: (e: Expense) => void;
  handleToggleStatus: (e: Expense) => void;
  deleteExpense: (id: string) => void;
}

export const DreCategories: React.FC<DreCategoriesProps> = ({
  dreResult,
  participants,
  expandedCategories,
  toggleCategoryExpand,
  formatVal,
  handleOpenAddExpense,
  handleOpenEditExpense,
  handleToggleStatus,
  deleteExpense
}) => {
  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl border border-ink-800 overflow-hidden">
        <div className="p-4 bg-ink-900/60 border-b border-ink-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-info-400" />
              Demonstrativo Consolidado de Despesas (DRE)
            </h3>
            <p className="text-[11px] text-ink-400 mt-0.5">
              Clique nas linhas para expandir e auditar cada comprovante/lançamento individual.
            </p>
          </div>
          <button
            onClick={() => handleOpenAddExpense()}
            className="px-3 py-1.5 rounded-xl bg-info-600/20 text-info-400 hover:bg-info-600 hover:text-white border border-info-500/30 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Despesa
          </button>
        </div>

        <div className="divide-y divide-ink-800/80">
          {dreResult.categories.map(c => {
            const Icon = CATEGORY_ICONS[c.category] || Layers;
            const isExpanded = expandedCategories[c.category] ?? false;

            return (
              <div key={c.category} className="group transition bg-ink-950/40 hover:bg-ink-900/30">
                {/* Linha Principal da Categoria */}
                <div
                  onClick={() => toggleCategoryExpand(c.category)}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-[220px]">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[c.category] || '#3b82f6' }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        {c.label}
                        <span className="px-2 py-0.5 rounded-full bg-ink-800 text-ink-400 text-[10px] font-semibold">
                          {c.item_count} itens
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-400 mt-0.5 max-w-sm truncate">
                        {c.description}
                      </div>
                    </div>
                  </div>

                  {/* Números da DRE: Planejado, Realizado, Saldo, % */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 text-xs flex-1 max-w-2xl">
                    {/* Planejado */}
                    <div>
                      <span className="text-[10px] text-ink-400 font-semibold block">Orçado (Meta)</span>
                      <span className="font-bold text-ink-200">
                        {formatVal(c.planned_usd, c.planned_brl)}
                      </span>
                    </div>

                    {/* Realizado */}
                    <div>
                      <span className="text-[10px] text-success-400 font-semibold block">Realizado (Pago)</span>
                      <span className="font-bold text-success-400">
                        {formatVal(c.actual_usd, c.actual_brl)}
                      </span>
                    </div>

                    {/* A Provisionar */}
                    <div>
                      <span className="text-[10px] text-warning-400 font-semibold block">A Provisionar</span>
                      <span className="font-bold text-warning-300">
                        {formatVal(c.to_provision_usd, c.to_provision_brl)}
                      </span>
                    </div>

                    {/* Execução & Variação */}
                    <div>
                      <span className="text-[10px] text-ink-400 font-semibold block">Executado</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-14 bg-ink-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              c.is_over_budget ? 'bg-danger-500' : 'bg-success-500'
                            }`}
                            style={{ width: `${Math.min(100, c.execution_rate_pct)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-ink-300">
                          {c.execution_rate_pct}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleOpenAddExpense(c.category);
                      }}
                      className="p-1.5 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-300 transition"
                      title="Adicionar despesa nesta categoria"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <div className="text-ink-400 group-hover:text-white transition">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Drilldown: Lista de Lançamentos da Categoria */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 bg-ink-950/80 border-t border-ink-900">
                    {c.expenses.length === 0 ? (
                      <div className="text-center py-4 text-xs text-ink-500">
                        Nenhum comprovante lançado nesta categoria ainda.{' '}
                        <button
                          onClick={() => handleOpenAddExpense(c.category)}
                          className="text-info-400 hover:underline font-bold"
                        >
                          Lançar primeiro gasto
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider px-2 flex justify-between">
                          <span>Comprovante / Descrição</span>
                          <span>Valor & Status</span>
                        </div>
                        {c.expenses.map(exp => {
                          const payer = participants.find(p => p.id === exp.paid_by_id);
                          const beneficiaries = participants.filter(p => exp.beneficiary_ids?.includes(p.id));

                          return (
                            <div
                              key={exp.id}
                              className="p-3 rounded-xl bg-ink-900/90 border border-ink-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-white flex items-center gap-2">
                                  {exp.description}
                                  <button
                                    onClick={() => handleToggleStatus(exp)}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                                      exp.status === 'paid'
                                        ? 'bg-success-500/10 text-success-400 border-success-500/30'
                                        : 'bg-warning-500/10 text-warning-400 border-warning-500/30'
                                    }`}
                                  >
                                    {exp.status === 'paid' ? 'Pago' : 'Pendente'}
                                  </button>
                                </div>
                                <div className="text-[11px] text-ink-400 mt-1 flex flex-wrap items-center gap-3">
                                  <span>Data: {new Date(exp.date).toLocaleDateString('pt-BR')}</span>
                                  <span>
                                    Pago por: <strong className="text-ink-200">{payer?.nickname || payer?.full_name || 'Pedro'}</strong>
                                  </span>
                                  {beneficiaries.length > 0 && (
                                    <span>
                                      Para:{' '}
                                      {beneficiaries.map(b => b.nickname || b.full_name.split(' ')[0]).join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                <div className="text-right">
                                  <div className="font-extrabold text-sm text-white">
                                    {formatVal(exp.amount_usd, exp.amount_brl)}
                                  </div>
                                  <div className="text-[10px] text-ink-400">
                                    {exp.currency} {exp.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenEditExpense(exp)}
                                    className="p-1.5 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-300 transition"
                                    title="Editar despesa"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteExpense(exp.id)}
                                    className="p-1.5 rounded-lg bg-danger-950/40 hover:bg-danger-900/60 text-danger-400 transition"
                                    title="Excluir despesa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
