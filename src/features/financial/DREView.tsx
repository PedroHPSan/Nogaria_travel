import React, { useState, useMemo } from 'react';
import { useTrip } from '../../context/TripContext';
import { computeDre } from '../../services/dreEngine';
import { ExpenseModal } from '../../components/modals/ExpenseModal';
import { BudgetGoalModal } from '../../components/modals/BudgetGoalModal';
import { DreCategories } from './dre/DreCategories';
import { DreParticipants } from './dre/DreParticipants';
import { DreTimeline } from './dre/DreTimeline';
import { KpiCard } from '../../components/ui/KpiCard';
import type { Expense } from '../../types/database.types';
import {
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Plus,
  FileSpreadsheet,
  Users,
  Calendar,
  Sparkles,
  Share2,
  Calculator,
  Check,
  Clock
} from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  flight: '#3b82f6', // blue
  accommodation: '#8b5cf6', // purple
  tickets: '#ec4899', // pink
  transport: '#f59e0b', // amber
  food: '#10b981', // emerald
  shopping: '#06b6d4', // cyan
  services: '#6366f1', // indigo
  other: '#64748b' // slate
};

export const DREView: React.FC = () => {
  const {
    activeTrip,
    participants,
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    flights,
    accommodations,
    transports,
    purchases,
    giftCards,
    currency,
    exchangeRate,
    exchangeRateDate
  } = useTrip();

  // Storage key para metas customizadas da DRE
  const DRE_GOALS_KEY = `DRE_GOALS_${activeTrip.id}`;

  const [customGoals, setCustomGoals] = useState<Partial<Record<Expense['category'], number>>>(() => {
    try {
      const saved = localStorage.getItem(DRE_GOALS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleSaveGoals = (goals: Partial<Record<Expense['category'], number>>) => {
    setCustomGoals(goals);
    localStorage.setItem(DRE_GOALS_KEY, JSON.stringify(goals));
  };

  // Estado das Abas e Modais
  const [activeTab, setActiveTab] = useState<'categories' | 'participants' | 'timeline'>('categories');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    flight: true,
    accommodation: true,
    tickets: true
  });
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Computação da DRE via Engine
  const dreResult = useMemo(() => {
    return computeDre({
      expenses,
      participants,
      flights,
      accommodations,
      transports,
      purchases,
      giftCards,
      exchangeRate,
      currency,
      customGoals
    });
  }, [expenses, participants, flights, accommodations, transports, purchases, giftCards, exchangeRate, currency, customGoals]);

  const toggleCategoryExpand = (cat: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const handleOpenAddExpense = (cat?: Expense['category']) => {
    if (cat) {
      setEditingExpense({
        id: '',
        trip_id: activeTrip.id,
        description: '',
        amount: 0,
        currency,
        amount_usd: 0,
        amount_brl: 0,
        exchange_rate: exchangeRate,
        category: cat,
        paid_by_id: participants[0]?.id || '',
        beneficiary_ids: participants.map(p => p.id),
        date: new Date().toISOString().split('T')[0],
        status: 'paid',
      });
    } else {
      setEditingExpense(null);
    }
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (e: Expense) => {
    setEditingExpense(e);
    setIsExpenseModalOpen(true);
  };

  const handleToggleStatus = (e: Expense) => {
    const nextStatus: Expense['status'] = e.status === 'paid' ? 'pending' : 'paid';
    updateExpense(e.id, { status: nextStatus });
  };

  // Formatação de valores baseada na moeda ativa
  const formatVal = (valUsd: number, valBrl: number) => {
    if (currency === 'BRL') {
      return `R$ ${valBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `US$ ${valUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Copiar Resumo Executivo para WhatsApp
  const handleCopySummary = () => {
    const symbol = currency === 'BRL' ? 'R$' : 'US$';
    const totalP = currency === 'BRL' ? dreResult.total_planned_brl : dreResult.total_planned_usd;
    const totalA = currency === 'BRL' ? dreResult.total_actual_brl : dreResult.total_actual_usd;
    const totalProv = currency === 'BRL' ? dreResult.total_to_provision_brl : dreResult.total_to_provision_usd;

    let text = `📊 *DRE & CONTROLE FINANCEIRO - ${activeTrip.title.toUpperCase()}*\n`;
    text += `💵 *Moeda:* ${currency} (Câmbio R$ ${exchangeRate.toFixed(2)})\n\n`;
    text += `🎯 *Total Planejado:* ${symbol} ${totalP.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    text += `💳 *Total Realizado (Já Pago):* ${symbol} ${totalA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${dreResult.global_execution_rate_pct}%)\n`;
    text += `⏳ *A Provisionar / Saldo Pendente:* ${symbol} ${totalProv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;
    text += `📌 *RESUMO POR CATEGORIA:*\n`;

    dreResult.categories.forEach(c => {
      const p = currency === 'BRL' ? c.planned_brl : c.planned_usd;
      const a = currency === 'BRL' ? c.actual_brl : c.actual_usd;
      const prov = currency === 'BRL' ? c.to_provision_brl : c.to_provision_usd;
      text += `• *${c.label}:* Pago ${symbol} ${a.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / Planejado ${symbol} ${p.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Falta ${symbol} ${prov.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n`;
    });

    if (dreResult.settlements.length > 0) {
      text += `\n🤝 *ACERTO DE CONTAS ENTRE PARTICIPANTES:*\n`;
      dreResult.settlements.forEach(s => {
        const val = currency === 'BRL' ? s.amount_brl : s.amount_usd;
        text += `👉 ${s.from_name} deve transferir ${symbol} ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para ${s.to_name}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Dados para gráficos
  const chartCategoryData = dreResult.categories.map(c => ({
    name: c.label.split(' ')[0],
    Planejado: currency === 'BRL' ? c.planned_brl : c.planned_usd,
    Realizado: currency === 'BRL' ? c.actual_brl : c.actual_usd,
    A_Provisionar: currency === 'BRL' ? c.to_provision_brl : c.to_provision_usd,
  }));

  const pieData = dreResult.categories
    .filter(c => (currency === 'BRL' ? c.actual_brl : c.actual_usd) > 0)
    .map(c => ({
      name: c.label,
      value: currency === 'BRL' ? c.actual_brl : c.actual_usd,
      color: CATEGORY_COLORS[c.category] || '#64748b'
    }));

  return (
    <div className="space-y-6 pb-24">
      {/* Header Executivo da DRE */}
      <div className="hero-banner relative overflow-hidden rounded-2xl p-6 border border-ink-800 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-info-500/10 border border-info-500/30 text-info-400 text-xs font-semibold mb-2">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              DRE Gerencial • Cotação Hoje ({exchangeRateDate}): R$ {exchangeRate.toFixed(2)}
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-ink-100 tracking-tight">
              DRE da Viagem: Planejado vs. Realizado
            </h2>
            <p className="text-xs text-ink-300 mt-1 max-w-2xl">
              Controle de desembolsos, acompanhamento orçamentário por categoria, cálculo de provisionamento futuro e balancete de acerto entre os participantes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Botão Ajustar Metas */}
            <button
              onClick={() => setIsBudgetModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-200 font-semibold text-xs border border-ink-700 flex items-center gap-1.5 transition"
            >
              <Calculator className="w-4 h-4 text-accent-400" />
              Metas / Orçado
            </button>

            {/* Botão Copiar WhatsApp */}
            <button
              onClick={handleCopySummary}
              className="px-3.5 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-200 font-semibold text-xs border border-ink-700 flex items-center gap-1.5 transition"
            >
              {copySuccess ? (
                <>
                  <Check className="w-4 h-4 text-success-400" />
                  <span className="text-success-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-info-400" />
                  Compartilhar
                </>
              )}
            </button>

            {/* Botão Nova Despesa */}
            <button
              onClick={() => handleOpenAddExpense()}
              className="px-4 py-2 rounded-xl bg-success-600 hover:bg-success-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-success-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              Lançar Despesa
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Principais da DRE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          accent="blue"
          icon={Calculator}
          label="Provisionamento Total (Orçado)"
          value={formatVal(dreResult.total_planned_usd, dreResult.total_planned_brl)}
          sublabel={
            currency === 'BRL'
              ? `≈ US$ ${dreResult.total_planned_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
              : `≈ R$ ${dreResult.total_planned_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          }
        />

        <KpiCard
          accent="emerald"
          icon={DollarSign}
          label="Realizado (Já Pago)"
          value={formatVal(dreResult.total_actual_usd, dreResult.total_actual_brl)}
          sublabel={
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {dreResult.global_execution_rate_pct}% do orçamento liquidado
            </span>
          }
          footer={
            <>
              <span>Despesas Lançadas:</span>
              <span className="text-ink-100 font-semibold">{expenses.length} comprovantes</span>
            </>
          }
        />

        <KpiCard
          accent="amber"
          icon={Clock}
          label="A Provisionar (Saldo Restante)"
          value={formatVal(dreResult.total_to_provision_usd, dreResult.total_to_provision_brl)}
          sublabel="Necessário arrecadar / levar para a viagem"
          footer={
            <>
              <span>Pendente lançado:</span>
              <span className="text-warning-300 font-semibold">
                {formatVal(dreResult.total_pending_usd, dreResult.total_pending_brl)}
              </span>
            </>
          }
        />

        <KpiCard
          accent="purple"
          icon={Sparkles}
          label="Economia em Benefícios"
          value={formatVal(dreResult.gift_card_savings_usd, dreResult.gift_card_savings_brl)}
          sublabel="Descontos de Gift Cards & Cashbacks"
          footer={
            <>
              <span>Variação Global:</span>
              <span className={dreResult.total_variance_usd >= 0 ? 'text-success-400 font-bold' : 'text-danger-400 font-bold'}>
                {dreResult.total_variance_usd >= 0 ? '+ Folga Orçamentária' : '- Estouro'}
              </span>
            </>
          }
        />
      </div>

      {/* Barra de Progresso Global da DRE */}
      <div className="glass-panel p-4 rounded-2xl border border-ink-800 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-ink-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success-400" />
            Execução Orçamentária Global: {dreResult.global_execution_rate_pct}% Realizado
          </span>
          <span className="text-ink-400">
            {formatVal(dreResult.total_actual_usd, dreResult.total_actual_brl)} de {formatVal(dreResult.total_planned_usd, dreResult.total_planned_brl)}
          </span>
        </div>
        <div className="w-full bg-ink-900 h-3 rounded-full overflow-hidden flex">
          {dreResult.categories.map(c => {
            const val = currency === 'BRL' ? c.actual_brl : c.actual_usd;
            const total = currency === 'BRL' ? dreResult.total_planned_brl : dreResult.total_planned_usd;
            const pct = total > 0 ? (val / total) * 100 : 0;
            if (pct <= 0) return null;
            return (
              <div
                key={c.category}
                style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[c.category] || '#3b82f6' }}
                title={`${c.label}: ${formatVal(c.actual_usd, c.actual_brl)} (${pct.toFixed(1)}%)`}
                className="h-full transition-all duration-500"
              />
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-ink-400">
          {dreResult.categories.map(c => (
            <div key={c.category} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.category] }} />
              <span>{c.label.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navegação entre Visões da DRE */}
      <div className="flex items-center gap-1 p-1 bg-ink-900/90 rounded-2xl border border-ink-800 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-info-600 text-white shadow-md'
              : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800/60'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>DRE por Macro-Categorias</span>
        </button>

        <button
          onClick={() => setActiveTab('participants')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'participants'
              ? 'bg-info-600 text-white shadow-md'
              : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>DRE por Participante & Acerto ({participants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'timeline'
              ? 'bg-info-600 text-white shadow-md'
              : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800/60'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Pré-Viagem vs. Na Viagem</span>
        </button>
      </div>


      {activeTab === 'categories' && (
        <DreCategories
          dreResult={dreResult}
          participants={participants}
          expandedCategories={expandedCategories}
          toggleCategoryExpand={toggleCategoryExpand}
          formatVal={formatVal}
          handleOpenAddExpense={handleOpenAddExpense}
          handleOpenEditExpense={handleOpenEditExpense}
          handleToggleStatus={handleToggleStatus}
          deleteExpense={deleteExpense}
        />
      )}

      {activeTab === 'participants' && (
        <DreParticipants dreResult={dreResult} formatVal={formatVal} />
      )}

      {activeTab === 'timeline' && (
        <DreTimeline
          dreResult={dreResult}
          formatVal={formatVal}
          chartCategoryData={chartCategoryData}
          pieData={pieData}
          currency={currency}
        />
      )}

      {/* Modal de Lançamento / Edição de Despesa */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSave={(data) => {
          if (editingExpense) {
            updateExpense(editingExpense.id, data);
          } else {
            addExpense(data);
          }
        }}
        initialData={editingExpense}
        participants={participants}
        tripId={activeTrip.id}
      />

      {/* Modal de Ajuste de Metas da DRE */}
      <BudgetGoalModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        currentGoals={customGoals}
        onSaveGoals={handleSaveGoals}
        currency={currency}
        exchangeRate={exchangeRate}
      />
    </div>
  );
};
