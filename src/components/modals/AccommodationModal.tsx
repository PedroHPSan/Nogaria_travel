import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { Accommodation, Participant } from '../../types/database.types';

interface AccommodationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (accommodation: any) => void;
  initialData?: Accommodation | null;
  participants: Participant[];
  tripId: string;
}

export const AccommodationModal: React.FC<AccommodationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  participants,
  tripId
}) => {
  const [name, setName] = useState('');
  const [chain, setChain] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]);
  const [roomType, setRoomType] = useState('');
  const [priceTotal, setPriceTotal] = useState<number | ''>(0);
  const [resortFee, setResortFee] = useState<number | ''>(0);
  const [parkingFee, setParkingFee] = useState<number | ''>(0);
  const [isBreakfastIncluded, setIsBreakfastIncluded] = useState(false);
  const [status, setStatus] = useState<'confirmed' | 'planning' | 'replaced' | 'cancelled'>('confirmed');
  const [replacementReason, setReplacementReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setChain(initialData.chain || '');
      setAddress(initialData.address || '');
      setCity(initialData.city || '');
      setCheckIn(initialData.check_in || '');
      setCheckOut(initialData.check_out || '');
      setConfirmationCode(initialData.confirmation_code || '');
      setSelectedGuests(initialData.guest_ids || []);
      setRoomType(initialData.room_type || '');
      setPriceTotal(initialData.price_total ?? 0);
      setResortFee(initialData.resort_fee_per_night ?? 0);
      setParkingFee(initialData.parking_fee_per_night ?? 0);
      setIsBreakfastIncluded(initialData.is_breakfast_included || false);
      setStatus(initialData.status || 'confirmed');
      setReplacementReason(initialData.replacement_reason || '');
      setNotes(initialData.notes || '');
    } else {
      setName('');
      setChain('');
      setAddress('');
      setCity('Orlando');
      setCheckIn('2026-09-01T15:00');
      setCheckOut('2026-09-12T11:00');
      setConfirmationCode('');
      setSelectedGuests(participants.map(p => p.id));
      setRoomType('Quarto Padrão');
      setPriceTotal(1000);
      setResortFee(0);
      setParkingFee(0);
      setIsBreakfastIncluded(false);
      setStatus('confirmed');
      setReplacementReason('');
      setNotes('');
    }
  }, [initialData, isOpen, participants]);

  const toggleGuest = (id: string) => {
    setSelectedGuests(prev =>
      prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !city.trim()) return;

    onSave({
      trip_id: tripId,
      name: name.trim(),
      chain: chain.trim() || undefined,
      address: address.trim(),
      city: city.trim(),
      check_in: checkIn,
      check_out: checkOut,
      confirmation_code: confirmationCode.trim() || undefined,
      guest_ids: selectedGuests,
      room_type: roomType.trim() || undefined,
      price_total: priceTotal !== '' ? Number(priceTotal) : 0,
      resort_fee_per_night: resortFee !== '' ? Number(resortFee) : 0,
      parking_fee_per_night: parkingFee !== '' ? Number(parkingFee) : 0,
      is_breakfast_included: isBreakfastIncluded,
      currency: 'USD',
      status: status,
      replacement_reason: status === 'replaced' ? replacementReason.trim() : undefined,
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Hospedagem' : 'Cadastrar Hospedagem'}
      subtitle="Cadastre hotéis, resorts e histórico de hospedagens substituídas."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Nome do Hotel *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Disney All-Star Movies / Four Points FLL"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Rede / Grupo</label>
            <input
              type="text"
              value={chain}
              onChange={e => setChain(e.target.value)}
              placeholder="Ex: Disney Parks & Resorts / Marriott"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-ink-300 font-semibold mb-1">Endereço Completo</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Ex: 1901 West Buena Vista Drive, Lake Buena Vista, FL"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Cidade *</label>
            <input
              type="text"
              required
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Ex: Orlando / Fort Lauderdale"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Data / Hora Check-in *</label>
            <input
              type="datetime-local"
              required
              value={checkIn.substring(0, 16)}
              onChange={e => setCheckIn(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Data / Hora Check-out *</label>
            <input
              type="datetime-local"
              required
              value={checkOut.substring(0, 16)}
              onChange={e => setCheckOut(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Hóspedes Alocados</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {participants.map(p => {
              const isSelected = selectedGuests.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleGuest(p.id)}
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Valor Total (US$)</label>
            <input
              type="number"
              min="0"
              step="10"
              value={priceTotal}
              onChange={e => setPriceTotal(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 font-semibold text-success-400"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Resort Fee / dia</label>
            <input
              type="number"
              min="0"
              step="1"
              value={resortFee}
              onChange={e => setResortFee(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Estacionamento / dia</label>
            <input
              type="number"
              min="0"
              step="1"
              value={parkingFee}
              onChange={e => setParkingFee(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Código Confirmação</label>
            <input
              type="text"
              value={confirmationCode}
              onChange={e => setConfirmationCode(e.target.value)}
              placeholder="Ex: DSNY-994821"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500 uppercase font-mono font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-ink-950/60 border border-ink-800 flex items-center gap-2">
            <input
              type="checkbox"
              id="chk-breakfast"
              checked={isBreakfastIncluded}
              onChange={e => setIsBreakfastIncluded(e.target.checked)}
              className="w-4 h-4 rounded text-info-600 focus:ring-info-500 bg-ink-900 border-ink-700"
            />
            <label htmlFor="chk-breakfast" className="text-ink-200 font-medium cursor-pointer">
              Café da Manhã Incluso na Diária
            </label>
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Status da Hospedagem</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            >
              <option value="confirmed">Confirmada (Ativa)</option>
              <option value="planning">Em Planejamento / Cotação</option>
              <option value="replaced">Substituída por Outra Reserva</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
        </div>

        {status === 'replaced' && (
          <div>
            <label className="block text-warning-400 font-semibold mb-1">Motivo da Substituição / Histórico</label>
            <input
              type="text"
              value={replacementReason}
              onChange={e => setReplacementReason(e.target.value)}
              placeholder="Ex: Substituído pelo Four Points para garantir proximidade do aeroporto FLL."
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-warning-500/40 text-warning-200 focus:outline-none focus:border-warning-500"
            />
          </div>
        )}

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Observações</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Quarto temático próximo à área da piscina."
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
            Salvar Hospedagem
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
