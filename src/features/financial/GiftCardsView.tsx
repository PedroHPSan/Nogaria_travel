import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { GiftCardModal } from '../../components/modals/GiftCardModal';
import { LoyaltyModal } from '../../components/modals/LoyaltyModal';
import { calculateGiftCardPortfolioSavings } from '../../services/giftCardCalculator';
import { ViewHeader } from '../../components/ui/ViewHeader';
import { SubTabs } from '../../components/ui/SubTabs';
import type { GiftCard, LoyaltyAccount } from '../../types/database.types';
import {
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  Award,
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
    loyaltyAccounts,
    addLoyaltyAccount,
    updateLoyaltyAccount,
    deleteLoyaltyAccount,
    formatAmount,
    currency
  } = useTrip();


  const [activeSubTab, setActiveSubTab] = useState<'gift_cards' | 'loyalty'>('gift_cards');

  // Modals
  const [isGcModalOpen, setIsGcModalOpen] = useState(false);
  const [editingGc, setEditingGc] = useState<GiftCard | null>(null);

  const [isLoyModalOpen, setIsLoyModalOpen] = useState(false);
  const [editingLoy, setEditingLoy] = useState<LoyaltyAccount | null>(null);

  const tripGiftCards = giftCards.filter(g => g.trip_id === activeTrip.id);
  const tripLoyalty = loyaltyAccounts.filter(l => l.trip_id === activeTrip.id);

  // Gift card summary calculations
  const { totalNominal, totalNetCost, totalSavings, avgSavingsPct } =
    calculateGiftCardPortfolioSavings(tripGiftCards);


  // Gift Card Triggers
  const handleOpenAddGc = () => {
    setEditingGc(null);
    setIsGcModalOpen(true);
  };
  const handleOpenEditGc = (g: GiftCard) => {
    setEditingGc(g);
    setIsGcModalOpen(true);
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
      <ViewHeader
        title="Gift Cards & Milhas"
        subtitle="Calculadora determinística de custo líquido de gift cards e saldos de milhas/fidelidade. Despesas e rateios ficam na DRE."
        actions={
          <SubTabs
            items={[
              { id: 'gift_cards', label: `Gift Cards (${tripGiftCards.length})`, icon: CreditCard, accent: 'emerald' },
              { id: 'loyalty', label: `Milhas & Fidelidade (${tripLoyalty.length})`, icon: Award, accent: 'purple' }
            ]}
            activeId={activeSubTab}
            onChange={setActiveSubTab}
          />
        }
      />

      {/* SUB-TAB: GIFT CARDS */}
      {activeSubTab === 'gift_cards' && (
        <div className="space-y-6">
          {/* Math Summary Header Box */}
          <div className="glass-panel p-5 rounded-2xl border border-success-500/30 bg-gradient-to-r from-success-950/30 via-ink-900 to-ink-950">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-success-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Resumo de Economia Determinística
                </span>
                <div className="text-2xl md:text-3xl font-extrabold text-white mt-1">
                  {formatAmount(totalSavings)}{' '}
                  <span className="text-sm font-bold text-success-400 font-sans">
                    ({avgSavingsPct.toFixed(1)}% economizados)
                  </span>
                </div>
                <p className="text-xs text-ink-300 mt-1">
                  Custo líquido calculado descontando o valor pago e o cashback percentual recebido, em {currency}.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-ink-900 border border-ink-800">
                  <div className="text-ink-400 text-[10px]">Valor Nominal Total</div>
                  <div className="text-base font-bold text-white">{formatAmount(totalNominal)}</div>
                </div>
                <div className="p-3 rounded-xl bg-ink-900 border border-ink-800">
                  <div className="text-ink-400 text-[10px]">Custo Real Pago</div>
                  <div className="text-base font-bold text-info-400">{formatAmount(totalNetCost)}</div>
                </div>
              </div>

            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Carteira de Gift Cards</h3>
            <button
              onClick={handleOpenAddGc}
              className="px-4 py-2 rounded-xl bg-success-600 hover:bg-success-500 text-white font-bold text-xs shadow-lg shadow-success-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Novo Gift Card
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tripGiftCards.map(g => {
              const buyer = participants.find(p => p.id === g.purchased_by_id);

              return (
                <div key={g.id} className="glass-card p-5 rounded-2xl border border-ink-800 space-y-4 relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-success-500/10 text-success-400 flex items-center justify-center font-bold">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white">{g.store_brand}</h4>
                        <p className="text-xs font-mono text-ink-400">{g.card_code_masked}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditGc(g)}
                        className="p-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Deseja excluir o gift card ${g.store_brand}?`)) deleteGiftCard(g.id);
                        }}
                        className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-ink-900/60 border border-ink-800">
                      <div className="text-ink-400 text-[10px]">Valor Nominal</div>
                      <div className="font-bold text-white text-sm">{formatAmount(g.nominal_value)}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-ink-900/60 border border-ink-800">
                      <div className="text-ink-400 text-[10px]">Custo Real Líquido</div>
                      <div className="font-bold text-success-400 text-sm">{formatAmount(g.net_cost)}</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-success-500/10 border border-success-500/30 flex items-center justify-between text-xs text-success-300">
                    <span>Economia Efetiva:</span>
                    <strong className="font-bold">{formatAmount(g.effective_savings)} ({g.effective_savings_pct.toFixed(1)}%)</strong>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-ink-800">
                    <span className="text-ink-400">Comprador: <strong className="text-ink-200">{buyer?.full_name || 'Desconhecido'}</strong></span>
                    <span className="text-ink-400">Saldo: <strong className="text-white font-bold">{formatAmount(g.current_balance)}</strong></span>
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
              className="px-4 py-2 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold text-xs shadow-lg shadow-accent-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Novo Programa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tripLoyalty.map(l => {
              const holder = participants.find(p => p.id === l.holder_id);

              return (
                <div key={l.id} className="glass-card p-5 rounded-2xl border border-ink-800 space-y-4 relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-500/10 text-accent-400 flex items-center justify-center font-bold">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white">{l.program_name}</h4>
                        <p className="text-xs text-ink-400">Titular: <span className="font-bold text-white">{holder?.full_name}</span></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditLoy(l)}
                        className="p-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Deseja excluir ${l.program_name}?`)) deleteLoyaltyAccount(l.id);
                        }}
                        className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-ink-900/60 border border-ink-800">
                    <div className="text-ink-400 text-[10px]">Saldo de Milhas / Pontos</div>
                    <div className="text-xl font-extrabold text-accent-400">{l.balance_points.toLocaleString()} pts</div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-ink-300">
                    <span>Equiv. Cash: <strong className="text-success-400">{formatAmount(l.cash_equivalent_usd)}</strong></span>
                    <span>CPM: <strong className="text-accent-300">US$ {l.cpm_usd}</strong></span>
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
