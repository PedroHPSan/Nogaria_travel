import React, { useState } from 'react';
import { BaseModal } from './BaseModal';
import { Sparkles, Globe } from 'lucide-react';

interface TripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (trip: any) => void;
  tenantId: string;
}

export const TripModal: React.FC<TripModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tenantId
}) => {
  const [title, setTitle] = useState('');
  const [destinationMain, setDestinationMain] = useState('');
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-20');
  const [currencyBase, setCurrencyBase] = useState<'USD' | 'BRL'>('USD');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !destinationMain.trim()) return;

    onSave({
      tenant_id: tenantId,
      title: title.trim(),
      destination_main: destinationMain.trim(),
      start_date: startDate,
      end_date: endDate,
      currency_base: currencyBase,
      status: 'planning'
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Criar Nova Viagem (Multitenant SaaS)"
      subtitle="Cadastre um novo projeto de viagem inteligente para grupos, famílias ou viagens corporativas."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-2 text-blue-300">
          <Globe className="w-4 h-4 text-blue-400 shrink-0" />
          <span>SaaS Ready: Você pode gerenciar múltiplos projetos de viagem isolados na mesma conta.</span>
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Nome do Projeto de Viagem *</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Paris & Londres 2027 / Nova York Réveillon"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-semibold text-sm"
          />
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Destinos Principais *</label>
          <input
            type="text"
            required
            value={destinationMain}
            onChange={e => setDestinationMain(e.target.value)}
            placeholder="Ex: França, Reino Unido e arredores"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Data Início *</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Data Término *</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Moeda Base do Projeto</label>
          <select
            value={currencyBase}
            onChange={e => setCurrencyBase(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-semibold"
          >
            <option value="USD">Dólar Americano (USD)</option>
            <option value="BRL">Real Brasileiro (BRL)</option>
          </select>
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
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            Criar Viagem
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
