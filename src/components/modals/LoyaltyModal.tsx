import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { LoyaltyAccount, Participant } from '../../types/database.types';

interface LoyaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (acc: any) => void;
  initialData?: LoyaltyAccount | null;
  participants: Participant[];
  tripId: string;
}

export const LoyaltyModal: React.FC<LoyaltyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  participants,
  tripId
}) => {
  const [programName, setProgramName] = useState('');
  const [holderId, setHolderId] = useState('');
  const [balancePoints, setBalancePoints] = useState<number | ''>(50000);
  const [cpmUsd, setCpmUsd] = useState<number | ''>(3.5);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setProgramName(initialData.program_name || '');
      setHolderId(initialData.holder_id || '');
      setBalancePoints(initialData.balance_points ?? 50000);
      setCpmUsd(initialData.cpm_usd ?? 3.5);
      setNotes(initialData.notes || '');
    } else {
      setProgramName('Azul Fidelidade');
      setHolderId(participants[0]?.id || '');
      setBalancePoints(50000);
      setCpmUsd(3.5);
      setNotes('');
    }
  }, [initialData, isOpen, participants]);

  const cashEquiv = ((Number(balancePoints) || 0) / 1000) * (Number(cpmUsd) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!programName.trim() || !holderId) return;

    onSave({
      trip_id: tripId,
      program_name: programName.trim(),
      holder_id: holderId,
      balance_points: Number(balancePoints) || 0,
      cpm_usd: Number(cpmUsd) || 0,
      cash_equivalent_usd: Number(cashEquiv.toFixed(2)),
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Conta de Milhas' : 'Cadastrar Programa de Milhas'}
      subtitle="Calcule o valor equivalente em dinheiro e o custo por milheiro (CPM)."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nome do Programa *</label>
            <input
              type="text"
              required
              value={programName}
              onChange={e => setProgramName(e.target.value)}
              placeholder="Ex: Azul Fidelidade, LATAM Pass, Smiles, ALL Accor"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Titular da Conta *</label>
            <select
              required
              value={holderId}
              onChange={e => setHolderId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="">-- Selecione o Titular --</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Saldo de Milhas / Pontos *</label>
            <input
              type="number"
              required
              min="0"
              step="1000"
              value={balancePoints}
              onChange={e => setBalancePoints(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-bold text-emerald-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Custo por 1.000 Milhas (CPM em US$)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={cpmUsd}
              onChange={e => setCpmUsd(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 3.50 para R$ 19,25/1k"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-semibold text-purple-400"
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-slate-300 font-medium">
          <span>Valor Equivalente em Dinheiro:</span>
          <span className="font-bold text-emerald-400 text-sm">US$ {cashEquiv.toFixed(2)}</span>
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Observações</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Acúmulo via cartão de crédito + bônus de transferência."
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
          />
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
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-600/30"
          >
            Salvar Conta de Milhas
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
