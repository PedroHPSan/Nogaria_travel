import React, { useState, useMemo } from 'react';
import { useTrip } from '../../context/TripContext';
import { computeDre } from '../../services/dreEngine';
import { ExpenseModal } from '../../components/modals/ExpenseModal';
import { BudgetGoalModal } from '../../components/modals/BudgetGoalModal';
import type { Expense } from '../../types/database.types';
import {
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Users,
  Calendar,
  Layers,
  Sparkles,
  Plane,
  Building2,
  Ticket,
  Car,
  Utensils,
  ShoppingBag,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Share2,
  Calculator,
  ArrowRightLeft,
  Check,
  Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

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
    setCurrency,
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
  const [activeTab, setActiveTab] = useState<'categories' | 'participants' | 'timeline' | 'simulator'>('categories');
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 p-6 border border-slate-800 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-2">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              DRE Gerencial • Cotação Hoje ({exchangeRateDate}): R$ {exchangeRate.toFixed(2)}
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              DRE da Viagem: Planejado vs. Realizado
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Controle de desembolsos, acompanhamento orçamentário por categoria, cálculo de provisionamento futuro e balancete de acerto entre os participantes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle de Moeda */}
            <div className="inline-flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setCurrency('BRL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  currency === 'BRL' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                R$ Real
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  currency === 'USD' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                US$ Dólar
              </button>
            </div>

            {/* Botão Ajustar Metas */}
            <button
              onClick={() => setIsBudgetModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Calculator className="w-4 h-4 text-purple-400" />
              Metas / Orçado
            </button>

            {/* Botão Copiar WhatsApp */}
            <button
              onClick={handleCopySummary}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center gap-1.5 transition"
            >
              {copySuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-blue-400" />
                  Compartilhar
                </>
              )}
            </button>

            {/* Botão Nova Despesa */}
            <button
              onClick={() => handleOpenAddExpense()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              Lançar Despesa
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Principais da DRE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Planejado */}
        <div className="glass-card p-5 rounded-2xl border border-blue-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400">Provisionamento Total (Orçado)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatVal(dreResult.total_planned_usd, dreResult.total_planned_brl)}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-1">
              {currency === 'BRL'
                ? `≈ US$ ${dreResult.total_planned_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : `≈ R$ ${dreResult.total_planned_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>Cotação Base:</span>
            <span className="text-white font-semibold">R$ {exchangeRate.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 2: Total Realizado (Já Pago) */}
        <div className="glass-card p-5 rounded-2xl border border-emerald-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400">Realizado (Já Pago)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatVal(dreResult.total_actual_usd, dreResult.total_actual_brl)}
            </div>
            <div className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{dreResult.global_execution_rate_pct}% do orçamento liquidado</span>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>Despesas Lançadas:</span>
            <span className="text-white font-semibold">{expenses.length} comprovantes</span>
          </div>
        </div>

        {/* Card 3: Saldo a Provisionar / Restante */}
        <div className="glass-card p-5 rounded-2xl border border-amber-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400">A Provisionar (Saldo Restante)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatVal(dreResult.total_to_provision_usd, dreResult.total_to_provision_brl)}
            </div>
            <div className="text-xs text-amber-400/90 font-medium mt-1">
              Necessário arrecadar / levar para a viagem
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>Pendente lançado:</span>
            <span className="text-amber-300 font-semibold">
              {formatVal(dreResult.total_pending_usd, dreResult.total_pending_brl)}
            </span>
          </div>
        </div>

        {/* Card 4: Economia / Desvio */}
        <div className="glass-card p-5 rounded-2xl border border-purple-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-400">Economia em Benefícios</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatVal(dreResult.gift_card_savings_usd, dreResult.gift_card_savings_brl)}
            </div>
            <div className="text-xs text-purple-300 font-medium mt-1">
              Descontos de Gift Cards & Cashbacks
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>Variação Global:</span>
            <span className={dreResult.total_variance_usd >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {dreResult.total_variance_usd >= 0 ? '+ Folga Orçamentária' : '- Estouro'}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Progresso Global da DRE */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Execução Orçamentária Global: {dreResult.global_execution_rate_pct}% Realizado
          </span>
          <span className="text-slate-400">
            {formatVal(dreResult.total_actual_usd, dreResult.total_actual_brl)} de {formatVal(dreResult.total_planned_usd, dreResult.total_planned_brl)}
          </span>
        </div>
        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden flex">
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
        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
          {dreResult.categories.map(c => (
            <div key={c.category} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.category] }} />
              <span>{c.label.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navegação entre Visões da DRE */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>DRE por Macro-Categorias</span>
        </button>

        <button
          onClick={() => setActiveTab('participants')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'participants'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>DRE por Participante & Acerto ({participants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'timeline'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Pré-Viagem vs. Na Viagem</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Simulador & Cartões</span>
        </button>
      </div>

      {/* ABA 1: DRE por Macro-Categorias (Demonstração Contábil & Drilldown) */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                  Demonstrativo Consolidado de Despesas (DRE)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Clique nas linhas para expandir e auditar cada comprovante/lançamento individual.
                </p>
              </div>
              <button
                onClick={() => handleOpenAddExpense()}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Despesa
              </button>
            </div>

            <div className="divide-y divide-slate-800/80">
              {dreResult.categories.map(c => {
                const Icon = CATEGORY_ICONS[c.category] || Layers;
                const isExpanded = expandedCategories[c.category] ?? false;

                return (
                  <div key={c.category} className="group transition bg-slate-950/40 hover:bg-slate-900/30">
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
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-semibold">
                              {c.item_count} itens
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 max-w-sm truncate">
                            {c.description}
                          </div>
                        </div>
                      </div>

                      {/* Números da DRE: Planejado, Realizado, Saldo, % */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 text-xs flex-1 max-w-2xl">
                        {/* Planejado */}
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block">Orçado (Meta)</span>
                          <span className="font-bold text-slate-200">
                            {formatVal(c.planned_usd, c.planned_brl)}
                          </span>
                        </div>

                        {/* Realizado */}
                        <div>
                          <span className="text-[10px] text-emerald-400 font-semibold block">Realizado (Pago)</span>
                          <span className="font-bold text-emerald-400">
                            {formatVal(c.actual_usd, c.actual_brl)}
                          </span>
                        </div>

                        {/* A Provisionar */}
                        <div>
                          <span className="text-[10px] text-amber-400 font-semibold block">A Provisionar</span>
                          <span className="font-bold text-amber-300">
                            {formatVal(c.to_provision_usd, c.to_provision_brl)}
                          </span>
                        </div>

                        {/* Execução & Variação */}
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block">Executado</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-14 bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  c.is_over_budget ? 'bg-rose-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, c.execution_rate_pct)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-300">
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
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Adicionar despesa nesta categoria"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <div className="text-slate-400 group-hover:text-white transition">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Drilldown: Lista de Lançamentos da Categoria */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-slate-950/80 border-t border-slate-900">
                        {c.expenses.length === 0 ? (
                          <div className="text-center py-4 text-xs text-slate-500">
                            Nenhum comprovante lançado nesta categoria ainda.{' '}
                            <button
                              onClick={() => handleOpenAddExpense(c.category)}
                              className="text-blue-400 hover:underline font-bold"
                            >
                              Lançar primeiro gasto
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 flex justify-between">
                              <span>Comprovante / Descrição</span>
                              <span>Valor & Status</span>
                            </div>
                            {c.expenses.map(exp => {
                              const payer = participants.find(p => p.id === exp.paid_by_id);
                              const beneficiaries = participants.filter(p => exp.beneficiary_ids?.includes(p.id));

                              return (
                                <div
                                  key={exp.id}
                                  className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-white flex items-center gap-2">
                                      {exp.description}
                                      <button
                                        onClick={() => handleToggleStatus(exp)}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                                          exp.status === 'paid'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                        }`}
                                      >
                                        {exp.status === 'paid' ? 'Pago' : 'Pendente'}
                                      </button>
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                                      <span>Data: {new Date(exp.date).toLocaleDateString('pt-BR')}</span>
                                      <span>
                                        Pago por: <strong className="text-slate-200">{payer?.nickname || payer?.full_name || 'Pedro'}</strong>
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
                                      <div className="text-[10px] text-slate-400">
                                        {exp.currency} {exp.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleOpenEditExpense(exp)}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                        title="Editar despesa"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => deleteExpense(exp.id)}
                                        className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 transition"
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
      )}

      {/* ABA 2: DRE por Participante & Acerto de Contas */}
      {activeTab === 'participants' && (
        <div className="space-y-6">
          {/* Matriz de Acerto de Contas (Debt Settlement) */}
          <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                  Balancete de Acerto de Contas (Liquidação Inteligente)
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Transferências financeiras recomendadas para zerar todas as dívidas e rateios entre os membros do grupo.
                </p>
              </div>
            </div>

            {dreResult.settlements.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Todas as contas estão perfeitamente balanceadas! Nenhum acerto pendente.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dreResult.settlements.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-xs">
                        {s.from_name[0]}
                      </div>
                      <div className="text-xs">
                        <div className="text-slate-200">
                          <strong className="text-white">{s.from_name}</strong> transfere para{' '}
                          <strong className="text-emerald-400">{s.to_name}</strong>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Para quitar rateio de hospedagem, ingressos e passagens
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-extrabold text-emerald-400">
                        {formatVal(s.amount_usd, s.amount_brl)}
                      </div>
                      <div className="text-[10px] text-slate-400">via Pix / Wise</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cards Individuais dos Participantes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {dreResult.participants.map(p => (
              <div
                key={p.participant_id}
                className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full ${p.avatar_color} text-white font-bold flex items-center justify-center text-sm shadow`}>
                      {p.nickname ? p.nickname[0] : p.full_name[0]}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-white truncate">{p.full_name}</h4>
                      <div className="text-[11px] text-slate-400">
                        Orçamento: {formatVal(p.budget_limit_usd, p.budget_limit_brl)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs py-3 border-y border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Consumido:</span>
                      <span className="font-bold text-slate-200">
                        {formatVal(p.total_consumed_usd, p.total_consumed_brl)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Pago (Desembolso):</span>
                      <span className="font-bold text-emerald-400">
                        {formatVal(p.total_paid_usd, p.total_paid_brl)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                      <span className="font-bold text-slate-300">Saldo Líquido:</span>
                      <span
                        className={`font-extrabold text-sm ${
                          p.net_balance_usd > 1
                            ? 'text-emerald-400'
                            : p.net_balance_usd < -1
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {p.net_balance_usd > 1 ? '+' : ''}
                        {formatVal(p.net_balance_usd, p.net_balance_brl)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2">
                  <span
                    className={`inline-block w-full text-center py-1.5 rounded-lg text-xs font-bold ${
                      p.status === 'creditor'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : p.status === 'debtor'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {p.status === 'creditor'
                      ? 'Credor (A Receber)'
                      : p.status === 'debtor'
                      ? 'Devedor (A Pagar)'
                      : 'Contas Zeradas'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 3: Pré-Viagem vs. Na Viagem (Fluxo Temporal) */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bloco 1: Pré-Viagem */}
            <div className="glass-panel p-6 rounded-2xl border border-blue-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Plane className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Desembolsos Pré-Viagem (Custos Fixos)</h3>
                    <p className="text-[11px] text-slate-400">Passagens, hotéis parcelados, ingressos e documentação</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Orçado Pré-Viagem:</span>
                  <span className="font-bold text-slate-200 text-base">
                    {formatVal(dreResult.pre_trip_planned_usd, dreResult.pre_trip_planned_brl)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-400 block text-[11px]">Já Pago no Brasil:</span>
                  <span className="font-bold text-emerald-400 text-base">
                    {formatVal(dreResult.pre_trip_actual_usd, dreResult.pre_trip_actual_brl)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Essas despesas devem estar 100% quitadas antes do embarque para evitar comprometer o limite de crédito durante a viagem.
              </p>
            </div>

            {/* Bloco 2: Na Viagem */}
            <div className="glass-panel p-6 rounded-2xl border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Desembolsos Durante a Viagem (Variáveis)</h3>
                    <p className="text-[11px] text-slate-400">Alimentação, compras, combustível, Uber e imprevistos</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Meta de Consumo In Loco:</span>
                  <span className="font-bold text-slate-200 text-base">
                    {formatVal(dreResult.in_trip_planned_usd, dreResult.in_trip_planned_brl)}
                  </span>
                </div>
                <div>
                  <span className="text-amber-400 block text-[11px]">A Levar em Moeda/Cartão:</span>
                  <span className="font-bold text-amber-300 text-base">
                    {formatVal(dreResult.in_trip_planned_usd - dreResult.in_trip_actual_usd, dreResult.in_trip_planned_brl - dreResult.in_trip_actual_brl)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Valor que precisa estar disponível na conta internacional (Nomad / Wise / Espécie) para os dias de viagem.
              </p>
            </div>
          </div>

          {/* Gráficos de Comparativo e Distribuição */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800">
              <h4 className="text-sm font-bold text-white mb-4">
                Comparativo: Planejado vs. Realizado vs. A Provisionar
              </h4>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartCategoryData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="Planejado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Realizado" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="A_Provisionar" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800">
              <h4 className="text-sm font-bold text-white mb-4">
                Composição Percentual dos Gastos Realizados
              </h4>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(val: any) => [
                        `${currency === 'BRL' ? 'R$' : 'US$'} ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                        'Realizado'
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: Simulador de Provisionamento & Gestão de Câmbio */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              Calculadora de Estratégia Cambial e Distribuição de Fundos
            </h3>
            <p className="text-xs text-slate-400">
              Planejamento de como os R$ {dreResult.total_to_provision_brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} restantes devem ser carregados:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-blue-400">Cartão Internacional (Nomad/Wise)</span>
                <div className="text-xl font-bold text-white">
                  {formatVal(dreResult.total_to_provision_usd * 0.7, dreResult.total_to_provision_brl * 0.7)}
                </div>
                <p className="text-[11px] text-slate-400">
                  70% do saldo restante. IOF de 1,1% e spread bancário reduzido.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400">Dólar em Espécie (Papel Moeda)</span>
                <div className="text-xl font-bold text-white">
                  {formatVal(dreResult.total_to_provision_usd * 0.2, dreResult.total_to_provision_brl * 0.2)}
                </div>
                <p className="text-[11px] text-slate-400">
                  20% em dinheiro vivo para gorjetas, pedágios manuais e pequenos comércios.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-purple-400">Reserva de Emergência</span>
                <div className="text-xl font-bold text-white">
                  {formatVal(dreResult.total_to_provision_usd * 0.1, dreResult.total_to_provision_brl * 0.1)}
                </div>
                <p className="text-[11px] text-slate-400">
                  10% de folga em cartão de crédito internacional para contingências médicas/veículo.
                </p>
              </div>
            </div>
          </div>
        </div>
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
