import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { GiftCard, Participant } from '../../types/database.types';
import { calculateGiftCardNetCost } from '../../services/giftCardCalculator';

interface GiftCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (card: any) => void;
  initialData?: GiftCard | null;
  participants: Participant[];
  tripId: string;
}

export const GiftCardModal: React.FC<GiftCardModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  participants,
  tripId
}) => {
  const [storeBrand, setStoreBrand] = useState('');
  const [nominalValue, setNominalValue] = useState<number | ''>(50);
  const [paidAmount, setPaidAmount] = useState<number | ''>(35);
  const [cashbackPct, setCashbackPct] = useState<number | ''>(4);
  const [purchasedById, setPurchasedById] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [cardCodeMasked, setCardCodeMasked] = useState('');
  const [currentBalance, setCurrentBalance] = useState<number | ''>(50);
  const [expiryDate, setExpiryDate] = useState('');
  const [status, setStatus] = useState<GiftCard['status']>('active');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setStoreBrand(initialData.store_brand || '');
      setNominalValue(initialData.nominal_value ?? 50);
      setPaidAmount(initialData.paid_amount ?? 35);
      setCashbackPct(initialData.cashback_pct ?? 0);
      setPurchasedById(initialData.purchased_by_id || '');
      setBeneficiaryId(initialData.beneficiary_id || '');
      setCardCodeMasked(initialData.card_code_masked || '');
      setCurrentBalance(initialData.current_balance ?? 50);
      setExpiryDate(initialData.expiry_date || '');
      setStatus(initialData.status || 'active');
      setNotes(initialData.notes || '');
    } else {
      setStoreBrand('Disney Store');
      setNominalValue(100);
      setPaidAmount(85);
      setCashbackPct(5);
      setPurchasedById(participants[0]?.id || '');
      setBeneficiaryId('');
      setCardCodeMasked('•••• •••• •••• 1234');
      setCurrentBalance(100);
      setExpiryDate('');
      setStatus('active');
      setNotes('');
    }
  }, [initialData, isOpen, participants]);

  // Live Math Calculation Preview
  const mathPreview = calculateGiftCardNetCost(
    Number(nominalValue) || 0,
    Number(paidAmount) || 0,
    Number(cashbackPct) || 0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeBrand.trim() || !purchasedById) return;

    onSave({
      trip_id: tripId,
      store_brand: storeBrand.trim(),
      nominal_value: Number(nominalValue) || 0,
      paid_amount: Number(paidAmount) || 0,
      cashback_pct: Number(cashbackPct) || 0,
      currency: 'USD',
      purchased_by_id: purchasedById,
      beneficiary_id: beneficiaryId || undefined,
      card_code_masked: cardCodeMasked.trim() || '•••• •••• •••• ????',
      current_balance: currentBalance !== '' ? Number(currentBalance) : Number(nominalValue),
      expiry_date: expiryDate || undefined,
      status,
      purchase_date: new Date().toISOString().split('T')[0],
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Gift Card' : 'Cadastrar Gift Card'}
      subtitle="Cálculo determinístico de custo líquido, cashback e desconto real líquido sobre o valor nominal."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Loja / Marca *</label>
            <input
              type="text"
              required
              value={storeBrand}
              onChange={e => setStoreBrand(e.target.value)}
              placeholder="Ex: Disney Store, Apple, Adidas, Best Buy, Carter's"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Código Mascarado / Final</label>
            <input
              type="text"
              value={cardCodeMasked}
              onChange={e => setCardCodeMasked(e.target.value)}
              placeholder="Ex: •••• •••• •••• 9942"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Valor Nominal (US$) *</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={nominalValue}
              onChange={e => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                setNominalValue(val);
                if (initialData === null) setCurrentBalance(val);
              }}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-bold text-ink-100"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Valor Efetivamente Pago (US$) *</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-bold text-warning-400"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Cashback (% s/ valor pago)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cashbackPct}
              onChange={e => setCashbackPct(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-bold text-accent-400"
            />
          </div>
        </div>

        {/* Live Calculation Box */}
        <div className="p-3.5 rounded-xl bg-ink-950/80 border border-success-500/30 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-[10px] text-ink-400 uppercase font-semibold">Cashback Estimado</div>
            <div className="text-sm font-bold text-accent-400">US$ {mathPreview.cashbackValue.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] text-ink-400 uppercase font-semibold">Custo Real Líquido</div>
            <div className="text-sm font-bold text-info-400">US$ {mathPreview.netCost.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] text-ink-400 uppercase font-semibold">Economia Efetiva</div>
            <div className="text-sm font-bold text-success-400">US$ {mathPreview.effectiveSavingsUSD.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] text-ink-400 uppercase font-semibold">% Economia Real</div>
            <div className="text-sm font-bold text-success-400">{mathPreview.effectiveSavingsPct.toFixed(1)}%</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Comprador / Pagador *</label>
            <select
              required
              value={purchasedById}
              onChange={e => setPurchasedById(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            >
              <option value="">-- Selecione o Comprador --</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Beneficiário Final (Opcional)</label>
            <select
              value={beneficiaryId}
              onChange={e => setBeneficiaryId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            >
              <option value="">-- Todos do Grupo / Não especificado --</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Saldo Atual (US$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={currentBalance}
              onChange={e => setCurrentBalance(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Validade (Opcional)</label>
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            >
              <option value="active">Ativo (Com Saldo)</option>
              <option value="used">Totalmente Utilizado</option>
              <option value="expired">Expirado</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Observações do Gift Card</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Comprado com 15% de desconto promocional no Inter + 5% cashback no aplicativo."
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
          />
        </div>

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
            className="px-5 py-2 rounded-xl bg-success-600 hover:bg-success-500 text-white font-bold shadow-lg shadow-success-600/30"
          >
            Salvar Gift Card
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
