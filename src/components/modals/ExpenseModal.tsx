import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { Expense, Participant } from '../../types/database.types';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: any) => void;
  initialData?: Expense | null;
  participants: Participant[];
  tripId: string;
}

const CATEGORIES: { id: Expense['category']; label: string }[] = [
  { id: 'accommodation', label: '🏨 Hospedagem' },
  { id: 'flight', label: '✈️ Passagens Aéreas' },
  { id: 'transport', label: '🚗 Transporte & Aluguel' },
  { id: 'food', label: '🍽️ Alimentação' },
  { id: 'shopping', label: '🛍️ Compras' },
  { id: 'tickets', label: '🎟️ Ingressos & Parques' },
  { id: 'services', label: '🛠️ Serviços & Seguros' },
  { id: 'other', label: '📦 Outros Geral' }
];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  participants,
  tripId
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>(100);
  const [currency, setCurrency] = useState<'USD' | 'BRL'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(5.50);
  const [category, setCategory] = useState<Expense['category']>('food');
  const [paidById, setPaidById] = useState('');
  const [beneficiaryIds, setBeneficiaryIds] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<Expense['status']>('paid');

  useEffect(() => {
    if (initialData) {
      setDescription(initialData.description || '');
      setAmount(initialData.amount ?? 100);
      setCurrency(initialData.currency || 'USD');
      setExchangeRate(initialData.exchange_rate || 5.50);
      setCategory(initialData.category || 'food');
      setPaidById(initialData.paid_by_id || '');
      setBeneficiaryIds(initialData.beneficiary_ids || []);
      setDate(initialData.date || new Date().toISOString().split('T')[0]);
      setStatus(initialData.status || 'paid');
    } else {
      setDescription('');
      setAmount(100);
      setCurrency('USD');
      setExchangeRate(5.50);
      setCategory('food');
      setPaidById(participants[0]?.id || '');
      setBeneficiaryIds(participants.map(p => p.id));
      setDate(new Date().toISOString().split('T')[0]);
      setStatus('paid');
    }
  }, [initialData, isOpen, participants]);

  const toggleBeneficiary = (id: string) => {
    setBeneficiaryIds(prev =>
      prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
    );
  };

  const amountUsd = currency === 'USD' ? Number(amount) || 0 : (Number(amount) || 0) / exchangeRate;
  const amountBrl = currency === 'BRL' ? Number(amount) || 0 : (Number(amount) || 0) * exchangeRate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !paidById) return;

    onSave({
      trip_id: tripId,
      description: description.trim(),
      amount: Number(amount) || 0,
      currency,
      amount_usd: Number(amountUsd.toFixed(2)),
      amount_brl: Number(amountBrl.toFixed(2)),
      exchange_rate: Number(exchangeRate) || 5.50,
      category,
      paid_by_id: paidById,
      beneficiary_ids: beneficiaryIds,
      date,
      status
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Despesa' : 'Cadastrar Nova Despesa & Rateio'}
      subtitle="Registre quem pagou, os beneficiários do consumo, conversão em câmbio e acerto de contas."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-ink-300 font-semibold mb-1">Descrição da Despesa *</label>
          <input
            type="text"
            required
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Jantar em grupo no Olive Garden / Abastecimento SUV FLL"
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Valor *</label>
            <input
              type="number"
              required
              min="0"
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-bold text-success-400"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Moeda</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-bold"
            >
              <option value="USD">Dólar (US$)</option>
              <option value="BRL">Real (R$)</option>
            </select>
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Cotação Câmbio</label>
            <input
              type="number"
              min="1"
              step="0.05"
              value={exchangeRate}
              onChange={e => setExchangeRate(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Categoria</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            >
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Currency preview */}
        <div className="p-3 rounded-xl bg-ink-950/60 border border-ink-800 flex items-center justify-between text-ink-300 font-medium">
          <span>Equivalente Convertido:</span>
          <span className="font-bold text-ink-100">
            US$ {amountUsd.toFixed(2)} / R$ {amountBrl.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Quem Pagou a Despesa? *</label>
            <select
              required
              value={paidById}
              onChange={e => setPaidById(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold"
            >
              <option value="">-- Selecione quem Pagou --</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Data da Despesa</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">
            Divisão do Rateio (Participantes Beneficiados)
          </label>
          <div className="flex flex-wrap gap-2 mt-1">
            {participants.map(p => {
              const isSelected = beneficiaryIds.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleBeneficiary(p.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                    isSelected
                      ? 'bg-success-600/20 text-success-400 border-success-500/40'
                      : 'bg-ink-950 text-ink-400 border-ink-800 opacity-60'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.avatar_color}`} />
                  {p.full_name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Status da Despesa</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
          >
            <option value="paid">Paga / Efetuada</option>
            <option value="pending">Pendente de Pagamento</option>
            <option value="reimbursed">Reembolsada / Acertada</option>
          </select>
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
            Salvar Despesa
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
