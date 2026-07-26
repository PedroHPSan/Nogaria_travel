import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { TransportReservation, Participant } from '../../types/database.types';

interface TransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transport: any) => void;
  initialData?: TransportReservation | null;
  participants: Participant[];
  tripId: string;
}

export const TransportModal: React.FC<TransportModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  participants,
  tripId
}) => {
  const [type, setType] = useState<TransportReservation['type']>('rental_car');
  const [providerCompany, setProviderCompany] = useState('');
  const [categoryOrModel, setCategoryOrModel] = useState('');
  const [primaryDriverId, setPrimaryDriverId] = useState('');
  const [additionalDriverIds, setAdditionalDriverIds] = useState<string[]>([]);
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [dropoffTime, setDropoffTime] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [priceTotal, setPriceTotal] = useState<number | ''>(0);
  const [status, setStatus] = useState<TransportReservation['status']>('reserved');
  const [requiresFollowup, setRequiresFollowup] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || 'rental_car');
      setProviderCompany(initialData.provider_company || '');
      setCategoryOrModel(initialData.category_or_model || '');
      setPrimaryDriverId(initialData.primary_driver_id || '');
      setAdditionalDriverIds(initialData.additional_driver_ids || []);
      setPickupLocation(initialData.pickup_location || '');
      setPickupTime(initialData.pickup_time || '');
      setDropoffLocation(initialData.dropoff_location || '');
      setDropoffTime(initialData.dropoff_time || '');
      setConfirmationCode(initialData.confirmation_code || '');
      setPriceTotal(initialData.price_total ?? 0);
      setStatus(initialData.status || 'reserved');
      setRequiresFollowup(initialData.requires_followup_transport ?? true);
      setNotes(initialData.notes || '');
    } else {
      setType('rental_car');
      setProviderCompany('Hertz / Alamo');
      setCategoryOrModel('SUV Midsize');
      setPrimaryDriverId(participants.find(p => p.nickname === 'Pedro')?.id || participants[0]?.id || '');
      setAdditionalDriverIds([]);
      setPickupLocation('MCO Airport (Orlando)');
      setPickupTime('2026-09-01T18:30');
      setDropoffLocation('FLL Airport (Fort Lauderdale)');
      setDropoffTime('2026-09-19T17:30');
      setConfirmationCode('');
      setPriceTotal(800);
      setStatus('reserved');
      setRequiresFollowup(true);
      setNotes('');
    }
  }, [initialData, isOpen, participants]);

  const toggleAdditionalDriver = (id: string) => {
    setAdditionalDriverIds(prev =>
      prev.includes(id) ? prev.filter(dId => dId !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerCompany.trim()) return;

    onSave({
      trip_id: tripId,
      type,
      provider_company: providerCompany.trim(),
      category_or_model: categoryOrModel.trim() || undefined,
      primary_driver_id: primaryDriverId || undefined,
      additional_driver_ids: additionalDriverIds,
      pickup_location: pickupLocation.trim(),
      pickup_time: pickupTime,
      dropoff_location: dropoffLocation.trim(),
      dropoff_time: dropoffTime,
      confirmation_code: confirmationCode.trim() || undefined,
      price_total: priceTotal !== '' ? Number(priceTotal) : 0,
      currency: 'USD',
      status,
      requires_followup_transport: requiresFollowup,
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Transporte / Veículo' : 'Cadastrar Transporte / Veículo'}
      subtitle="Controle de aluguel de carros, devolução rígida, motoristas e transportes complementares (Uber/Transfer)."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Tipo de Transporte *</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="rental_car">Aluguel de Carro / SUV</option>
              <option value="uber">Uber / Lyft / Táxi</option>
              <option value="transfer">Transfer Privativo / Ônibus</option>
              <option value="hotel_shuttle">Shuttle do Hotel</option>
              <option value="train">Trem / Metrô</option>
              <option value="other">Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Empresa / Locadora *</label>
            <input
              type="text"
              required
              value={providerCompany}
              onChange={e => setProviderCompany(e.target.value)}
              placeholder="Ex: Hertz, Alamo, Sixt, Uber"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Categoria / Modelo</label>
            <input
              type="text"
              value={categoryOrModel}
              onChange={e => setCategoryOrModel(e.target.value)}
              placeholder="Ex: SUV Midsize (Nissan Rogue ou similar)"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {type === 'rental_car' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Condutor Principal *</label>
              <select
                value={primaryDriverId}
                onChange={e => setPrimaryDriverId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
              >
                <option value="">-- Selecione o Condutor --</option>
                {participants
                  .filter(p => !p.is_minor)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Condutores Adicionais</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {participants
                  .filter(p => !p.is_minor && p.id !== primaryDriverId)
                  .map(p => {
                    const isSelected = additionalDriverIds.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => toggleAdditionalDriver(p.id)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {p.nickname || p.full_name}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Local & Horário de Retirada *</label>
            <input
              type="text"
              required
              value={pickupLocation}
              onChange={e => setPickupLocation(e.target.value)}
              placeholder="Ex: Aeroporto MCO Orlando"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 mb-2"
            />
            <input
              type="datetime-local"
              required
              value={pickupTime.substring(0, 16)}
              onChange={e => setPickupTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Local & Horário de Devolução *</label>
            <input
              type="text"
              required
              value={dropoffLocation}
              onChange={e => setDropoffLocation(e.target.value)}
              placeholder="Ex: Aeroporto FLL Fort Lauderdale"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 mb-2"
            />
            <input
              type="datetime-local"
              required
              value={dropoffTime.substring(0, 16)}
              onChange={e => setDropoffTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-200 focus:outline-none focus:border-amber-500 font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Valor Total (US$)</label>
            <input
              type="number"
              min="0"
              step="10"
              value={priceTotal}
              onChange={e => setPriceTotal(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-semibold text-emerald-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Código Reserva</label>
            <input
              type="text"
              value={confirmationCode}
              onChange={e => setConfirmationCode(e.target.value)}
              placeholder="Ex: HTZ-7738210"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 uppercase font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Status Reserva</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="reserved">Reservado</option>
              <option value="active">Em Uso na Viagem</option>
              <option value="completed">Devolvido / Concluído</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
          <input
            type="checkbox"
            id="chk-followup"
            checked={requiresFollowup}
            onChange={e => setRequiresFollowup(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
          />
          <label htmlFor="chk-followup" className="text-slate-200 font-medium cursor-pointer">
            Requer transporte complementar após a devolução (Ex: Uber para hotel/voo)
          </label>
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Observações & Alertas de Horário</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Devolução no dia 19/09 às 17h30. Abastecer antes e chamar Uber XL para o grupo."
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
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg shadow-amber-600/30"
          >
            Salvar Transporte
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
