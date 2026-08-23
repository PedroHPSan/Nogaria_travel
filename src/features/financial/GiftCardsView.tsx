import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { GiftCardModal } from '../../components/modals/GiftCardModal';
import { ExpenseModal } from '../../components/modals/ExpenseModal';
import { LoyaltyModal } from '../../components/modals/LoyaltyModal';
import type { GiftCard, Expense, LoyaltyAccount } from '../../types/database.types';
import {
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  Award,
  Receipt,
  Sparkles
} from 'lucide-react';

export const GiftCardsView: React.FC = () => {
  const {
    activeTrip,
    participants,
    giftCards,
    addGiftCard,
    updateGiftCard,
    deleteGiftCard,
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    loyaltyAccounts,
    addLoyaltyAccount,
    updateLoyaltyAccount,
    deleteLoyaltyAccount,
    formatAmount,
    currency
  } = useTrip();


  const [activeSubTab, setActiveSubTab] = useState<'gift_cards' | 'expenses' | 'loyalty'>('gift_cards');

  // Modals
  const [isGcModalOpen, setIsGcModalOpen] = useState(false);
  const [editingGc, setEditingGc] = useState<GiftCard | null>(null);

  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);

  const [isLoyModalOpen, setIsLoyModalOpen] = useState(false);
  const [editingLoy, setEditingLoy] = useState<LoyaltyAccount | null>(null);

  const tripGiftCards = giftCards.filter(g => g.trip_id === activeTrip.id);
  const tripExpenses = expenses.filter(e => e.trip_id === activeTrip.id);
  const tripLoyalty = loyaltyAccounts.filter(l => l.trip_id === activeTrip.id);

  // Gift card summary calculations
  const totalNominal = tripGiftCards.reduce((sum, g) => sum + g.nominal_value, 0);
  const totalNetCost = tripGiftCards.reduce((sum, g) => sum + g.net_cost, 0);
  const totalSavings = totalNominal - totalNetCost;
  const avgSavingsPct = totalNominal > 0 ? (totalSavings / totalNominal) * 100 : 0;


  // Gift Card Triggers
  const handleOpenAddGc = () => {
    setEditingGc(null);
    setIsGcModalOpen(true);
  };
  const handleOpenEditGc = (g: GiftCard) => {
    setEditingGc(g);
    setIsGcModalOpen(true);
  };

  // Expense Triggers
  const handleOpenAddExp = () => {
    setEditingExp(null);
    setIsExpModalOpen(true);
  };
  const handleOpenEditExp = (e: Expense) => {
    setEditingExp(e);
    setIsExpModalOpen(true);
  };

  // Loyalty Triggers
  const handleOpenAddLoy = () => {
    setEditingLoy(null);
    setIsLoyModalOpen(true);
  };
  const handleOpenEditLoy = (l: LoyaltyAccount) => {
    setEditingLoy(l);
    setIsLoyModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Módulo Financeiro & Inteligência de Benefícios
          </h2>
          <p className="text-xs text-slate-400">
            Calculadora determinística de custo líquido de gift cards, rateio de despesas do grupo e saldos de milhas.
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('gift_cards')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'gift_cards'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Gift Cards ({tripGiftCards.length})
          </button>

          <button
            onClick={() => setActiveSubTab('expenses')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'expenses'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Despesas & Rateios ({tripExpenses.length})
          </button>

          <button
            onClick={() => setActiveSubTab('loyalty')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'loyalty'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Milhas & Fidelidade ({tripLoyalty.length})
          </button>
        </div>
      </div>

      {/* SUB-TAB: GIFT CARDS */}
      {activeSubTab === 'gift_cards' && (
        <div className="space-y-6">
          {/* Math Summary Header Box */}
          <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-950">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Resumo de Economia Determinística
                </span>
                <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
                  {formatAmount(totalSavings)}{' '}
                  <span className="text-sm font-bold text-emerald-400 font-sans">
                    ({avgSavingsPct.toFixed(1)}% economizados)
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Custo líquido calculado descontando o valor pago e o cashback percentual recebido, em {currency}.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Valor Nominal Total</div>
                  <div className="text-base font-bold text-white">{formatAmount(totalNominal)}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Custo Real Pago</div>
                  <div className="text-base font-bold text-blue-400">{formatAmount(totalNetCost)}</div>
                </div>
              </div>

            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Carteira de Gift Cards</h3>
            <button
              onClick={handleOpenAddGc}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Novo Gift Card
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tripGiftCards.map(g => {
              const buyer = participants.find(p => p.id === g.purchased_by_id);

              return (
                <div key={g.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4 relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white">{g.store_brand}</h4>
                        <p className="text-xs font-mono text-slate-400">{g.card_code_masked}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditGc(g)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Deseja excluir o gift card ${g.store_brand}?`)) deleteGiftCard(g.id);
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-slate-400 text-[10px]">Valor Nominal</div>
                      <div className="font-bold text-white text-sm">{formatAmount(g.nominal_value)}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-slate-400 text-[10px]">Custo Real Líquido</div>
                      <div className="font-bold text-emerald-400 text-sm">{formatAmount(g.net_cost)}</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                    <span>Economia Efetiva:</span>
                    <strong className="font-bold">{formatAmount(g.effective_savings)} ({g.effective_savings_pct.toFixed(1)}%)</strong>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                    <span className="text-slate-400">Comprador: <strong className="text-slate-200">{buyer?.full_name || 'Desconhecido'}</strong></span>
                    <span className="text-slate-400">Saldo: <strong className="text-white font-bold">{formatAmount(g.current_balance)}</strong></span>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB: EXPENSES & SPLITS */}
      {activeSubTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Despesas & Divisão de Custos (Rateio)</h3>
            <button
              onClick={handleOpenAddExp}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nova Despesa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripExpenses.map(e => {
              const payer = participants.find(p => p.id === e.paid_by_id);
              return (
                <div key={e.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4 relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white">{e.description}</h4>
                        <p className="text-xs text-slate-400">{e.category.toUpperCase()} • {new Date(e.date).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditExp(e)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Deseja excluir a despesa "${e.description}"?`)) deleteExpense(e.id);
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-slate-400 text-[10px]">Pago por</div>
                      <div className="font-bold text-white text-sm">{payer?.full_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 text-[10px]">Valor Total</div>
                      <div className="font-bold text-emerald-400 text-sm">
                        {e.currency === 'USD' ? `US$ ${e.amount}` : `R$ ${e.amount}`}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400 mb-1.5 font-medium">Dividido entre ({e.beneficiary_ids.length} participantes):</div>
                    <div className="flex flex-wrap gap-1.5">
                      {e.beneficiary_ids.map(bId => {
                        const p = participants.find(part => part.id === bId);
                        if (!p) return null;
                        return (
                          <span key={bId} className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${p.avatar_color}`} />
                            {p.full_name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB: LOYALTY & MILES */}
      {activeSubTab === 'loyalty' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Programas de Milhas, Pontos & Fidelidade</h3>
            <button
              onClick={handleOpenAddLoy}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Novo Programa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tripLoyalty.map(l => {
              const holder = participants.find(p => p.id === l.holder_id);

              return (
                <div key={l.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4 relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white">{l.program_name}</h4>
                        <p className="text-xs text-slate-400">Titular: <span className="font-bold text-white">{holder?.full_name}</span></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditLoy(l)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Deseja excluir ${l.program_name}?`)) deleteLoyaltyAccount(l.id);
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Saldo de Milhas / Pontos</div>
                    <div className="text-xl font-extrabold text-purple-400">{l.balance_points.toLocaleString()} pts</div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Equiv. Cash: <strong className="text-emerald-400">{formatAmount(l.cash_equivalent_usd)}</strong></span>
                    <span>CPM: <strong className="text-purple-300">US$ {l.cpm_usd}</strong></span>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <GiftCardModal
        isOpen={isGcModalOpen}
        onClose={() => setIsGcModalOpen(false)}
        onSave={gData => {
          if (editingGc) updateGiftCard(editingGc.id, gData);
          else addGiftCard(gData);
        }}
        initialData={editingGc}
        participants={participants}
        tripId={activeTrip.id}
      />

      <ExpenseModal
        isOpen={isExpModalOpen}
        onClose={() => setIsExpModalOpen(false)}
        onSave={eData => {
          if (editingExp) updateExpense(editingExp.id, eData);
          else addExpense(eData);
        }}
        initialData={editingExp}
        participants={participants}
        tripId={activeTrip.id}
      />

      <LoyaltyModal
        isOpen={isLoyModalOpen}
        onClose={() => setIsLoyModalOpen(false)}
        onSave={lData => {
          if (editingLoy) updateLoyaltyAccount(editingLoy.id, lData);
          else addLoyaltyAccount(lData);
        }}
        initialData={editingLoy}
        participants={participants}
        tripId={activeTrip.id}
      />
    </div>
  );
};
