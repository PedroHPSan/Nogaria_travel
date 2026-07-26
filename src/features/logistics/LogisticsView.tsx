import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { FlightModal } from '../../components/modals/FlightModal';
import { AccommodationModal } from '../../components/modals/AccommodationModal';
import { TransportModal } from '../../components/modals/TransportModal';
import type { Flight, Accommodation, TransportReservation } from '../../types/database.types';
import {
  Plane,
  Building,
  Car,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Clock
} from 'lucide-react';

export const LogisticsView: React.FC = () => {
  const {
    activeTrip,
    participants,
    flights,
    addFlight,
    updateFlight,
    deleteFlight,
    accommodations,
    addAccommodation,
    updateAccommodation,
    deleteAccommodation,
    transports,
    addTransport,
    updateTransport,
    deleteTransport
  } = useTrip();


  const [activeSubTab, setActiveSubTab] = useState<'flights' | 'accommodations' | 'transports'>('flights');

  // Modal States
  const [isFlightModalOpen, setIsFlightModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null);

  const [isAccModalOpen, setIsAccModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Accommodation | null>(null);

  const [isTrModalOpen, setIsTrModalOpen] = useState(false);
  const [editingTr, setEditingTr] = useState<TransportReservation | null>(null);

  const tripFlights = flights.filter(f => f.trip_id === activeTrip.id);
  const tripAccs = accommodations.filter(a => a.trip_id === activeTrip.id);
  const tripTransports = transports.filter(t => t.trip_id === activeTrip.id);

  // Flight Modal Triggers
  const handleOpenAddFlight = () => {
    setEditingFlight(null);
    setIsFlightModalOpen(true);
  };
  const handleOpenEditFlight = (f: Flight) => {
    setEditingFlight(f);
    setIsFlightModalOpen(true);
  };

  // Accommodation Modal Triggers
  const handleOpenAddAcc = () => {
    setEditingAcc(null);
    setIsAccModalOpen(true);
  };
  const handleOpenEditAcc = (a: Accommodation) => {
    setEditingAcc(a);
    setIsAccModalOpen(true);
  };

  // Transport Modal Triggers
  const handleOpenAddTr = () => {
    setEditingTr(null);
    setIsTrModalOpen(true);
  };
  const handleOpenEditTr = (t: TransportReservation) => {
    setEditingTr(t);
    setIsTrModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Central de Logística da Viagem
          </h2>
          <p className="text-xs text-slate-400">
            Gerencie voos por participante, reservas de hotel e devoluções de veículos sem conflitos de horário.
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('flights')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'flights'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plane className="w-3.5 h-3.5" />
            Voos ({tripFlights.length})
          </button>

          <button
            onClick={() => setActiveSubTab('accommodations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'accommodations'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            Hospedagens ({tripAccs.length})
          </button>

          <button
            onClick={() => setActiveSubTab('transports')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'transports'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            Veículos ({tripTransports.length})
          </button>
        </div>
      </div>

      {/* SUB-TAB: FLIGHTS */}
      {activeSubTab === 'flights' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Trechos Aéreos & Passagens Emitidas</h3>
            <button
              onClick={handleOpenAddFlight}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Novo Voo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripFlights.map(f => (
              <div key={f.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4 relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                      <Plane className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">{f.airline} • {f.flight_number}</h4>
                      <p className="text-xs text-slate-400">PNR: <span className="font-mono font-bold text-blue-400">{f.booking_code}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditFlight(f)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Deseja excluir este voo?')) deleteFlight(f.id);
                      }}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-slate-400 text-[10px]">Origem</div>
                    <div className="font-bold text-white text-sm">{f.origin_airport}</div>
                    <div className="text-slate-400 text-[11px]">{new Date(f.departure_time).toLocaleString()}</div>
                  </div>
                  <div className="text-center px-2">
                    <div className="text-[10px] text-blue-400 font-semibold">{f.class_type.toUpperCase()}</div>
                    <div className="w-16 border-b border-dashed border-slate-700 my-1" />
                    <div className="text-[10px] text-slate-500">{f.terminal ? `Terminal ${f.terminal}` : 'Direto'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-[10px]">Destino</div>
                    <div className="font-bold text-white text-sm">{f.destination_airport}</div>
                    <div className="text-slate-400 text-[11px]">{new Date(f.arrival_time).toLocaleString()}</div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5 font-medium">Passageiros no Voo:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.passenger_ids.map(pId => {
                      const p = participants.find(part => part.id === pId);
                      if (!p) return null;
                      return (
                        <span key={pId} className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${p.avatar_color}`} />
                          {p.full_name}
                          {f.seats && f.seats[pId] && (
                            <span className="text-[10px] text-blue-400 font-mono">({f.seats[pId]})</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {f.notes && (
                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                    <span className="text-slate-300 font-semibold">Notas:</span> {f.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB: ACCOMMODATIONS */}
      {activeSubTab === 'accommodations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Hospedagens & Resorts Registrados</h3>
            <button
              onClick={handleOpenAddAcc}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nova Hospedagem
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripAccs.map(a => (
              <div
                key={a.id}
                className={`glass-card p-5 rounded-2xl border space-y-4 relative ${
                  a.status === 'replaced'
                    ? 'border-amber-500/30 bg-amber-950/10'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">{a.name}</h4>
                      <p className="text-xs text-slate-400">{a.city} • {a.chain || 'Resort'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      a.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                      a.status === 'replaced' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {a.status === 'replaced' ? 'Substituído' : a.status}
                    </span>

                    <button
                      onClick={() => handleOpenEditAcc(a)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Deseja excluir esta hospedagem?')) deleteAccommodation(a.id);
                      }}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <div className="text-slate-400 text-[10px]">Check-in</div>
                    <div className="font-bold text-white">{new Date(a.check_in).toLocaleDateString()}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <div className="text-slate-400 text-[10px]">Check-out</div>
                    <div className="font-bold text-white">{new Date(a.check_out).toLocaleDateString()}</div>
                  </div>
                </div>

                {a.status === 'replaced' && a.replacement_reason && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                    <span className="font-bold block">Histórico de Substituição:</span>
                    {a.replacement_reason}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                  <span className="text-slate-400">Total USD: <strong className="text-emerald-400">US$ {a.price_total}</strong></span>
                  <span className="text-slate-400">Reserva: <strong className="text-white font-mono">{a.confirmation_code || 'N/A'}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB: TRANSPORTS */}
      {activeSubTab === 'transports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Veículos Alugados & Transportes</h3>
            <button
              onClick={handleOpenAddTr}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Novo Veículo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripTransports.map(t => (
              <div key={t.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4 relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">{t.provider_company}</h4>
                      <p className="text-xs text-slate-400">{t.category_or_model || 'Veículo'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditTr(t)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Deseja excluir este transporte?')) deleteTransport(t.id);
                      }}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                    <Clock className="w-4 h-4" />
                    Devolução Rígida: {new Date(t.dropoff_time).toLocaleString('pt-BR')}
                  </div>
                  <div className="text-slate-300 text-[11px]">
                    Local Devolução: <strong>{t.dropoff_location}</strong>
                  </div>
                </div>

                {t.requires_followup_transport && (
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Requer agendamento de Uber XL / Transfer para o grupo pós-devolução.</span>
                  </div>
                )}

                {t.notes && (
                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                    <span className="text-slate-300 font-semibold">Notas:</span> {t.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Components */}
      <FlightModal
        isOpen={isFlightModalOpen}
        onClose={() => setIsFlightModalOpen(false)}
        onSave={fData => {
          if (editingFlight) updateFlight(editingFlight.id, fData);
          else addFlight(fData);
        }}
        initialData={editingFlight}
        participants={participants}
        tripId={activeTrip.id}
      />

      <AccommodationModal
        isOpen={isAccModalOpen}
        onClose={() => setIsAccModalOpen(false)}
        onSave={aData => {
          if (editingAcc) updateAccommodation(editingAcc.id, aData);
          else addAccommodation(aData);
        }}
        initialData={editingAcc}
        participants={participants}
        tripId={activeTrip.id}
      />

      <TransportModal
        isOpen={isTrModalOpen}
        onClose={() => setIsTrModalOpen(false)}
        onSave={tData => {
          if (editingTr) updateTransport(editingTr.id, tData);
          else addTransport(tData);
        }}
        initialData={editingTr}
        participants={participants}
        tripId={activeTrip.id}
      />
    </div>
  );
};
