import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { PurchaseModal } from '../../components/modals/PurchaseModal';
import { LuggageModal } from '../../components/modals/LuggageModal';
import { PriceQuoteModal } from '../../components/modals/PriceQuoteModal';
import { AssumptionsModal } from '../../components/modals/AssumptionsModal';
import { PurchaseDecisionCard } from './PurchaseDecisionCard';
import { QuotaAllocationPanel } from './QuotaAllocationPanel';
import type { PurchaseItem, Luggage, PurchaseAssumptions } from '../../types/database.types';
import {
  ShoppingBag,
  Luggage as LuggageIcon,
  Plus,
  Edit2,
  Trash2,
  SlidersHorizontal
} from 'lucide-react';


export const PurchasesView: React.FC = () => {
  const {
    activeTrip,
    participants,
    purchases,
    purchaseDecisions,
    addPurchase,
    updatePurchase,
    deletePurchase,
    luggages,
    addLuggage,
    updateLuggage,
    deleteLuggage,
    priceQuotes,
    addPriceQuote,
    assumptions,
    updateAssumptions,
    exchangeRate,
    setExchangeRate,
    formatAmount
  } = useTrip();


  const [activeSubTab, setActiveSubTab] = useState<'purchases' | 'luggage'>('purchases');

  // Modals
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseItem | null>(null);

  const [isLuggageModalOpen, setIsLuggageModalOpen] = useState(false);
  const [editingLuggage, setEditingLuggage] = useState<Luggage | null>(null);

  const [quoteItem, setQuoteItem] = useState<PurchaseItem | null>(null);

  const [isAssumptionsOpen, setIsAssumptionsOpen] = useState(false);

  const tripPurchases = purchases.filter(p => p.trip_id === activeTrip.id);
  const tripLuggages = luggages.filter(l => l.trip_id === activeTrip.id);
  const tripPriceQuotes = priceQuotes.filter(q => q.trip_id === activeTrip.id);

  // Math summary
  const totalTargetUsd = tripPurchases.reduce((sum, p) => sum + p.target_price_usd * p.quantity, 0);

  const handleOpenAddPurchase = () => {
    setEditingPurchase(null);
    setIsPurchaseModalOpen(true);
  };
  const handleOpenEditPurchase = (p: PurchaseItem) => {
    setEditingPurchase(p);
    setIsPurchaseModalOpen(true);
  };

  // TripContext's `exchangeRate` is the single source of truth for USD/BRL
  // (see purchaseDecisions in TripContext.tsx, which always overrides
  // assumptions.usd_brl_rate with it). Saving usd_brl_rate through
  // updateAssumptions would therefore be a silent no-op on every verdict, so
  // that one field is routed to setExchangeRate instead; every other field
  // still goes through updateAssumptions.
  const handleSaveAssumptions = (patch: Partial<PurchaseAssumptions>) => {
    const { usd_brl_rate, ...rest } = patch;
    if (usd_brl_rate !== undefined) setExchangeRate(usd_brl_rate);
    if (Object.keys(rest).length > 0) updateAssumptions(rest);
  };

  const handleOpenAddLuggage = () => {
    setEditingLuggage(null);
    setIsLuggageModalOpen(true);
  };
  const handleOpenEditLuggage = (l: Luggage) => {
    setEditingLuggage(l);
    setIsLuggageModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Módulo de Compras Planejadas & Bagagens
          </h2>
          <p className="text-xs text-slate-400">
            Controle de produtos (Apple, roupas, itens infantis), economia estimada EUA x Brasil e franquia de malas.
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('purchases')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'purchases'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Compras ({tripPurchases.length})
          </button>

          <button
            onClick={() => setActiveSubTab('luggage')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'luggage'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LuggageIcon className="w-3.5 h-3.5" />
            Bagagens ({tripLuggages.length})
          </button>
        </div>
      </div>

      {/* SUB-TAB: PURCHASES */}
      {activeSubTab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Lista de Desejos & Produtos Planejados</h3>
              <span className="text-xs text-purple-400 font-semibold">Total Estimado: {formatAmount(totalTargetUsd)}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAssumptionsOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Parâmetros
              </button>
              <button
                onClick={handleOpenAddPurchase}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Nova Compra
              </button>
            </div>
          </div>

          <QuotaAllocationPanel decisions={purchaseDecisions} participants={participants} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripPurchases.map(p => {
              const decision = purchaseDecisions.find(d => d.purchase_item_id === p.id);
              if (!decision) return null;
              return (
                <PurchaseDecisionCard
                  key={p.id}
                  item={p}
                  decision={decision}
                  quotes={tripPriceQuotes}
                  onEdit={handleOpenEditPurchase}
                  onDelete={deletePurchase}
                  onResearch={setQuoteItem}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB: LUGGAGE */}
      {activeSubTab === 'luggage' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Controle de Franquia de Bagagens</h3>
            <button
              onClick={handleOpenAddLuggage}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nova Mala
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripLuggages.map(l => {
              const participant = participants.find(p => p.id === l.participant_id);
              const weightPct = Math.min(100, Math.round(((l.current_weight_kg || 0) / l.max_weight_kg) * 100));

              return (
                <div key={l.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4 relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                        <LuggageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white">{l.bag_identifier}</h4>
                        <p className="text-xs text-slate-400">Proprietário: <span className="font-bold text-white">{participant?.full_name}</span></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditLuggage(l)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Deseja excluir esta mala?`)) deleteLuggage(l.id);
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Peso Atual / Franquia:</span>
                      <span className="font-bold text-white">{l.current_weight_kg || 0} kg / {l.max_weight_kg} kg</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${weightPct > 90 ? 'bg-rose-500' : weightPct > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${weightPct}%` }}
                      />
                    </div>
                  </div>

                  {l.shopping_space_reserved_pct !== undefined && (
                    <div className="text-xs text-purple-400 font-medium">
                      📦 Space reserved for return shopping: <strong>{l.shopping_space_reserved_pct}%</strong>
                    </div>
                  )}

                  {l.description && (
                    <div className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                      {l.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <PurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSave={pData => {
          if (editingPurchase) updatePurchase(editingPurchase.id, pData);
          else addPurchase(pData);
        }}
        initialData={editingPurchase}
        participants={participants}
        tripId={activeTrip.id}
      />

      <LuggageModal
        isOpen={isLuggageModalOpen}
        onClose={() => setIsLuggageModalOpen(false)}
        onSave={lData => {
          if (editingLuggage) updateLuggage(editingLuggage.id, lData);
          else addLuggage(lData);
        }}
        initialData={editingLuggage}
        participants={participants}
        tripId={activeTrip.id}
      />

      <PriceQuoteModal
        isOpen={quoteItem !== null}
        onClose={() => setQuoteItem(null)}
        onSave={addPriceQuote}
        item={quoteItem}
        tripId={activeTrip.id}
      />

      <AssumptionsModal
        isOpen={isAssumptionsOpen}
        onClose={() => setIsAssumptionsOpen(false)}
        assumptions={{ ...assumptions, usd_brl_rate: exchangeRate }}
        onSave={handleSaveAssumptions}
      />
    </div>
  );
};
