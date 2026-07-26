import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { PurchaseModal } from '../../components/modals/PurchaseModal';
import { LuggageModal } from '../../components/modals/LuggageModal';
import type { PurchaseItem, Luggage } from '../../types/database.types';
import {
  ShoppingBag,
  Luggage as LuggageIcon,
  Plus,
  Edit2,
  Trash2
} from 'lucide-react';


export const PurchasesView: React.FC = () => {
  const {
    activeTrip,
    participants,
    purchases,
    addPurchase,
    updatePurchase,
    deletePurchase,
    luggages,
    addLuggage,
    updateLuggage,
    deleteLuggage,
    formatAmount
  } = useTrip();


  const [activeSubTab, setActiveSubTab] = useState<'purchases' | 'luggage'>('purchases');

  // Modals
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseItem | null>(null);

  const [isLuggageModalOpen, setIsLuggageModalOpen] = useState(false);
  const [editingLuggage, setEditingLuggage] = useState<Luggage | null>(null);

  const tripPurchases = purchases.filter(p => p.trip_id === activeTrip.id);
  const tripLuggages = luggages.filter(l => l.trip_id === activeTrip.id);

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

            <button
              onClick={handleOpenAddPurchase}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nova Compra
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripPurchases.map(p => {
              const participant = participants.find(part => part.id === p.target_participant_id);
              return (
                <div key={p.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4 relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white">{p.product_name}</h4>
                        <p className="text-xs text-slate-400">{p.brand || 'Marca'} • {p.store_name || 'Loja EUA'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        p.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {p.priority === 'high' ? 'Alta Prioridade' : p.priority}
                      </span>

                      <button
                        onClick={() => handleOpenEditPurchase(p)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Deseja excluir "${p.product_name}"?`)) deletePurchase(p.id);
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-slate-400 text-[10px]">Preço Alvo EUA</div>
                      <div className="font-bold text-emerald-400 text-sm">{formatAmount(p.target_price_usd)} (x{p.quantity})</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-slate-400 text-[10px]">Preço Ref. Brasil</div>
                      <div className="font-bold text-white text-sm">
                        {p.brl_equivalent_price ? `R$ ${p.brl_equivalent_price.toLocaleString()}` : 'N/A'}
                      </div>
                    </div>
                  </div>


                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      Responsável:
                      <strong className="text-slate-200">{participant?.full_name || 'Desconhecido'}</strong>
                    </span>

                    {p.gift_card_eligible && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                        Gift Card OK
                      </span>
                    )}
                  </div>

                  {p.notes && (
                    <div className="text-xs text-slate-400 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-purple-400 font-semibold">Notas:</span> {p.notes}
                    </div>
                  )}
                </div>
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
    </div>
  );
};
