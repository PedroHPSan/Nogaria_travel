import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import type { Flight, Participant } from '../../types/database.types';

interface FlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (flight: any) => void;
  initialData?: Flight | null;
  participants: Participant[];
  tripId: string;
}

export const FlightModal: React.FC<FlightModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  participants,
  tripId
}) => {
  const [airline, setAirline] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [loyaltyProgram, setLoyaltyProgram] = useState('');
  const [originAirport, setOriginAirport] = useState('');
  const [destAirport, setDestAirport] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [terminal, setTerminal] = useState('');
  const [bookingCode, setBookingCode] = useState('');
  const [classType, setClassType] = useState<'economy' | 'premium_economy' | 'business' | 'first'>('economy');
  const [selectedPassengers, setSelectedPassengers] = useState<string[]>([]);
  const [priceCash, setPriceCash] = useState<number | ''>(0);
  const [pricePoints, setPricePoints] = useState<number | ''>(0);
  const [taxesAmount, setTaxesAmount] = useState<number | ''>(0);
  const [status, setStatus] = useState<'booked' | 'confirmed' | 'changed' | 'cancelled'>('confirmed');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setAirline(initialData.airline || '');
      setFlightNumber(initialData.flight_number || '');
      setLoyaltyProgram(initialData.loyalty_program || '');
      setOriginAirport(initialData.origin_airport || '');
      setDestAirport(initialData.destination_airport || '');
      setDepartureTime(initialData.departure_time || '');
      setArrivalTime(initialData.arrival_time || '');
      setTerminal(initialData.terminal || '');
      setBookingCode(initialData.booking_code || '');
      setClassType(initialData.class_type || 'economy');
      setSelectedPassengers(initialData.passenger_ids || []);
      setPriceCash(initialData.price_cash ?? 0);
      setPricePoints(initialData.price_points ?? 0);
      setTaxesAmount(initialData.taxes_amount ?? 0);
      setStatus(initialData.status || 'confirmed');
      setNotes(initialData.notes || '');
    } else {
      setAirline('Azul Fidelidade');
      setFlightNumber('');
      setLoyaltyProgram('');
      setOriginAirport('VCP');
      setDestAirport('MCO');
      setDepartureTime('2026-09-01T10:00');
      setArrivalTime('2026-09-01T18:00');
      setTerminal('T1');
      setBookingCode('');
      setClassType('economy');
      setSelectedPassengers(participants.map(p => p.id));
      setPriceCash(0);
      setPricePoints(0);
      setTaxesAmount(0);
      setStatus('confirmed');
      setNotes('');
    }
  }, [initialData, isOpen, participants]);

  const togglePassenger = (id: string) => {
    setSelectedPassengers(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!airline.trim() || !flightNumber.trim()) return;

    onSave({
      trip_id: tripId,
      airline: airline.trim(),
      flight_number: flightNumber.trim(),
      loyalty_program: loyaltyProgram.trim() || undefined,
      origin_airport: originAirport.trim(),
      destination_airport: destAirport.trim(),
      departure_time: departureTime,
      arrival_time: arrivalTime,
      terminal: terminal.trim() || undefined,
      booking_code: bookingCode.trim() || 'PNR-PENDING',
      class_type: classType,
      passenger_ids: selectedPassengers,
      price_cash: priceCash !== '' ? Number(priceCash) : 0,
      price_points: pricePoints !== '' ? Number(pricePoints) : 0,
      taxes_amount: taxesAmount !== '' ? Number(taxesAmount) : 0,
      currency: 'USD',
      status: status,
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Voo' : 'Cadastrar Voo'}
      subtitle="Registre detalhes do voo, passageiros, localizador, programa de milhas e custos."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Companhia Aérea *</label>
            <input
              type="text"
              required
              value={airline}
              onChange={e => setAirline(e.target.value)}
              placeholder="Ex: Azul / LATAM / American"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Número do Voo *</label>
            <input
              type="text"
              required
              value={flightNumber}
              onChange={e => setFlightNumber(e.target.value)}
              placeholder="Ex: AD 8702"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500 uppercase"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Programa de Fidelidade</label>
            <input
              type="text"
              value={loyaltyProgram}
              onChange={e => setLoyaltyProgram(e.target.value)}
              placeholder="Ex: Azul Fidelidade / Smiles"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Origem *</label>
            <input
              type="text"
              required
              value={originAirport}
              onChange={e => setOriginAirport(e.target.value)}
              placeholder="Ex: VCP / GRU"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500 uppercase"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Destino *</label>
            <input
              type="text"
              required
              value={destAirport}
              onChange={e => setDestAirport(e.target.value)}
              placeholder="Ex: MCO / MIA / FLL"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500 uppercase"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Terminal</label>
            <input
              type="text"
              value={terminal}
              onChange={e => setTerminal(e.target.value)}
              placeholder="Ex: T1 ou T3"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Localizador (PNR)</label>
            <input
              type="text"
              value={bookingCode}
              onChange={e => setBookingCode(e.target.value)}
              placeholder="Ex: PDRGAB26"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500 uppercase font-mono font-bold text-info-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Data / Hora Partida *</label>
            <input
              type="datetime-local"
              required
              value={departureTime.substring(0, 16)}
              onChange={e => setDepartureTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Data / Hora Chegada *</label>
            <input
              type="datetime-local"
              required
              value={arrivalTime.substring(0, 16)}
              onChange={e => setArrivalTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Passageiros Selecionados</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {participants.map(p => {
              const isSelected = selectedPassengers.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => togglePassenger(p.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                    isSelected
                      ? 'bg-info-600/20 text-info-400 border-info-500/40'
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

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Valor Cash (US$)</label>
            <input
              type="number"
              min="0"
              step="10"
              value={priceCash}
              onChange={e => setPriceCash(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Pontos / Milhas</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={pricePoints}
              onChange={e => setPricePoints(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Taxas (US$)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={taxesAmount}
              onChange={e => setTaxesAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Classe da Cabine</label>
            <select
              value={classType}
              onChange={e => setClassType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            >
              <option value="economy">Econômica</option>
              <option value="premium_economy">Premium Economy</option>
              <option value="business">Executiva</option>
              <option value="first">Primeira Classe</option>
            </select>
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Status do Voo</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
            >
              <option value="confirmed">Confirmado / Emitido</option>
              <option value="booked">Reservado (Pendente)</option>
              <option value="changed">Alterado pelo Horário Aéreo</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-ink-300 font-semibold mb-1">Observações do Voo</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Emitido via pontos Azul Fidelidade com conexão em Campinas."
            className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-white focus:outline-none focus:border-info-500"
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
            className="px-5 py-2 rounded-xl bg-info-600 hover:bg-info-500 text-white font-bold shadow-lg shadow-info-600/30"
          >
            Salvar Voo
          </button>
        </div>
      </form>
    </BaseModal>
  );
};
