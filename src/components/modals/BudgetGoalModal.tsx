import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { DEFAULT_CATEGORY_META } from '../../services/dreEngine';
import type { Expense, Currency } from '../../types/database.types';
import { Save, RefreshCw } from 'lucide-react';

interface BudgetGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoals: Partial<Record<Expense['category'], number>>;
  onSaveGoals: (goals: Partial<Record<Expense['category'], number>>) => void;
  currency: Currency;
  exchangeRate: number;
}

export const BudgetGoalModal: React.FC<BudgetGoalModalProps> = ({
  isOpen,
  onClose,
  currentGoals,
  onSaveGoals,
  currency,
  exchangeRate
}) => {
  const categories: Expense['category'][] = [
    'flight',
    'accommodation',
    'tickets',
    'transport',
    'food',
    'shopping',
    'services',
    'other'
  ];

  const [formGoals, setFormGoals] = useState<Record<Expense['category'], number>>({
    flight: 0,
    accommodation: 0,
    tickets: 0,
    transport: 0,
    food: 0,
    shopping: 0,
    services: 0,
    other: 0,
  });

  useEffect(() => {
    if (isOpen) {
      const initial: Record<Expense['category'], number> = {
        flight: 0,
        accommodation: 0,
        tickets: 0,
        transport: 0,
        food: 0,
        shopping: 0,
        services: 0,
        other: 0,
      };

      categories.forEach(cat => {
        const valUsd = currentGoals[cat] || 0;
        initial[cat] = currency === 'BRL' ? Math.round(valUsd * exchangeRate) : Math.round(valUsd);
      });

      setFormGoals(initial);
    }
  }, [isOpen, currentGoals, currency, exchangeRate]);

  const handleChange = (cat: Expense['category'], val: number) => {
    setFormGoals(prev => ({
      ...prev,
      [cat]: Math.max(0, val)
    }));
  };

  const handleResetDefaults = () => {
    const defaultsUsd: Record<Expense['category'], number> = {
      flight: 2200,
      accommodation: 3500,
      tickets: 3600,
      transport: 1200,
      food: 2000,
      shopping: 4000,
      services: 500,
      other: 1000,
    };

    const res: Record<Expense['category'], number> = { ...formGoals };
    categories.forEach(cat => {
      res[cat] = currency === 'BRL' ? Math.round(defaultsUsd[cat] * exchangeRate) : defaultsUsd[cat];
    });
    setFormGoals(res);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const convertedGoals: Partial<Record<Expense['category'], number>> = {};

    categories.forEach(cat => {
      const val = formGoals[cat] || 0;
      convertedGoals[cat] = currency === 'BRL' ? val / exchangeRate : val;
    });

    onSaveGoals(convertedGoals);
    onClose();
  };

  const totalBudget = categories.reduce((sum, cat) => sum + (formGoals[cat] || 0), 0);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Ajustar Metas de Provisionamento & Orçamento Planejado"
      subtitle={`Defina quanto o grupo planeja gastar por categoria da DRE em ${currency} (Câmbio R$ ${exchangeRate.toFixed(2)}).`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-950/40 border border-blue-500/20">
          <div>
            <span className="text-slate-400 font-medium">Orçamento Total Planejado:</span>
            <div className="text-xl font-extrabold text-blue-400">
              {currency === 'BRL' ? `R$ ${totalBudget.toLocaleString('pt-BR')}` : `US$ ${totalBudget.toLocaleString('en-US')}`}
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            Sugerir Valores Padrão
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {categories.map(cat => {
            const meta = DEFAULT_CATEGORY_META[cat];
            const currentVal = formGoals[cat] || 0;
            const convertedOther = currency === 'BRL' ? currentVal / exchangeRate : currentVal * exchangeRate;

            return (
              <div key={cat} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-200">{meta.label}</label>
                  <span className="text-[10px] text-slate-400">
                    ≈ {currency === 'BRL' ? `US$ ${convertedOther.toFixed(0)}` : `R$ ${convertedOther.toFixed(0)}`}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 font-bold text-slate-400">
                    {currency === 'BRL' ? 'R$' : 'US$'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={currentVal || ''}
                    onChange={e => handleChange(cat, Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full pl-10 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1">{meta.description}</p>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30"
          >
            <Save className="w-4 h-4" />
            Salvar Metas da DRE
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
