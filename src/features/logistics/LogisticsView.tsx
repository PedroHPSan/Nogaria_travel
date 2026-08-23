import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { FlightModal } from '../../components/modals/FlightModal';
import { AccommodationModal } from '../../components/modals/AccommodationModal';
import { TransportModal } from '../../components/modals/TransportModal';
import { DiningRadarModal } from '../../components/modals/DiningRadarModal';
import { HotelServicesModal } from '../../components/modals/HotelServicesModal';
import { ViewHeader } from '../../components/ui/ViewHeader';
import { SubTabs } from '../../components/ui/SubTabs';
import type { Flight, Accommodation, TransportReservation } from '../../types/database.types';
import {
  Plane,
  Building,
  Car,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Clock,
  Utensils,
  ShieldPlus
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

  const [isDiningRadarOpen, setIsDiningRadarOpen] = useState(false);
  const [diningDestination, setDiningDestination] = useState('Orlando / Kissimmee');

  const [isHotelServicesOpen, setIsHotelServicesOpen] = useState(false);
  const [selectedHotelForServices, setSelectedHotelForServices] = useState<{ name: string; city: string }>({
    name: 'Celebration Suites (Kissimmee)',
    city: 'Kissimmee',
  });

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
      <ViewHeader
        title="Central de Logística da Viagem"
        subtitle="Gerencie voos por participante, reservas de hotel e devoluções de veículos sem conflitos de horário."
        actions={
          <SubTabs
            items={[
              { id: 'flights', label: `Voos (${tripFlights.length})`, icon: Plane, accent: 'blue' },
              { id: 'accommodations', label: `Hospedagens (${tripAccs.length})`, icon: Building, accent: 'emerald' },
              { id: 'transports', label: `Veículos (${tripTransports.length})`, icon: Car, accent: 'amber' }
            ]}
            activeId={activeSubTab}
            onChange={setActiveSubTab}
          />
        }
      />

      {/* SUB-TAB: FLIGHTS */}
      {activeSubTab === 'flights' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Trechos Aéreos & Passagens Emitidas</h3>
            <button
              onClick={handleOpenAddFlight}
              className="px-4 py-2 rounded-xl bg-info-600 hover:bg-info-500 text-white font-bold text-xs shadow-lg shadow-info-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Novo Voo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripFlights.map(f => (
              <div key={f.id} className="glass-card p-5 rounded-2xl border border-ink-800 space-y-4 relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-info-500/10 text-info-400 flex items-center justify-center font-bold">
                      <Plane className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">{f.airline} • {f.flight_number}</h4>
                      <p className="text-xs text-ink-400">PNR: <span className="font-mono font-bold text-info-400">{f.booking_code}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditFlight(f)}
                      className="p-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Deseja excluir este voo?')) deleteFlight(f.id);
                      }}
                      className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-ink-900/60 border border-ink-800/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-ink-400 text-[10px]">Origem</div>
                    <div className="font-bold text-white text-sm">{f.origin_airport}</div>
                    <div className="text-ink-400 text-[11px]">{new Date(f.departure_time).toLocaleString()}</div>
                  </div>
                  <div className="text-center px-2">
                    <div className="text-[10px] text-info-400 font-semibold">{f.class_type.toUpperCase()}</div>
                    <div className="w-16 border-b border-dashed border-ink-700 my-1" />
                    <div className="text-[10px] text-ink-500">{f.terminal ? `Terminal ${f.terminal}` : 'Direto'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-ink-400 text-[10px]">Destino</div>
                    <div className="font-bold text-white text-sm">{f.destination_airport}</div>
                    <div className="text-ink-400 text-[11px]">{new Date(f.arrival_time).toLocaleString()}</div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-ink-400 mb-1.5 font-medium">Passageiros no Voo:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.passenger_ids.map(pId => {
                      const p = participants.find(part => part.id === pId);
                      if (!p) return null;
                      return (
                        <span key={pId} className="px-2.5 py-1 rounded-lg bg-ink-800 text-ink-200 text-xs font-semibold flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${p.avatar_color}`} />
                          {p.full_name}
                          {f.seats && f.seats[pId] && (
                            <span className="text-[10px] text-info-400 font-mono">({f.seats[pId]})</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {f.notes && (
                  <div className="text-xs text-ink-400 pt-2 border-t border-ink-800">
                    <span className="text-ink-300 font-semibold">Notas:</span> {f.notes}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Hospedagens & Resorts Registrados</h3>
              <p className="text-xs text-ink-400">Consulte serviços e refeições econômicas próximas a cada hotel.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setSelectedHotelForServices({ name: 'Hotéis em Orlando/Kissimmee', city: 'Kissimmee' });
                  setIsHotelServicesOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-info-500/10 hover:bg-info-500/20 border border-info-500/30 text-info-300 font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                <ShieldPlus className="w-3.5 h-3.5 text-info-400" />
                Farmácias & Mercados
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiningDestination('Orlando / Kissimmee');
                  setIsDiningRadarOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-warning-500/10 hover:bg-warning-500/20 border border-warning-500/30 text-warning-300 font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                <Utensils className="w-3.5 h-3.5 text-warning-400" />
                Alimentação Econômica ($)
              </button>
              <button
                onClick={handleOpenAddAcc}
                className="px-4 py-2 rounded-xl bg-success-600 hover:bg-success-500 text-white font-bold text-xs shadow-lg shadow-success-600/30 transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Nova Hospedagem
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripAccs.map(a => (
              <div
                key={a.id}
                className={`glass-card p-5 rounded-2xl border space-y-4 relative ${
                  a.status === 'replaced'
                    ? 'border-warning-500/30 bg-warning-950/10'
                    : 'border-ink-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success-500/10 text-success-400 flex items-center justify-center font-bold">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">{a.name}</h4>
                      <p className="text-xs text-ink-400">{a.city} • {a.chain || 'Resort'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      a.status === 'confirmed' ? 'bg-success-500/10 text-success-400 border border-success-500/30' :
                      a.status === 'replaced' ? 'bg-warning-500/10 text-warning-400 border border-warning-500/30' : 'bg-ink-800 text-ink-400'
                    }`}>
                      {a.status === 'replaced' ? 'Substituído' : a.status}
                    </span>

                    <button
                      onClick={() => handleOpenEditAcc(a)}
                      className="p-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Deseja excluir esta hospedagem?')) deleteAccommodation(a.id);
                      }}
                      className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-ink-900/60 border border-ink-800/80">
                    <div className="text-ink-400 text-[10px]">Check-in</div>
                    <div className="font-bold text-white">{new Date(a.check_in).toLocaleDateString()}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-ink-900/60 border border-ink-800/80">
                    <div className="text-ink-400 text-[10px]">Check-out</div>
                    <div className="font-bold text-white">{new Date(a.check_out).toLocaleDateString()}</div>
                  </div>
                </div>

                {a.status === 'replaced' && a.replacement_reason && (
                  <div className="p-3 rounded-xl bg-warning-500/10 border border-warning-500/30 text-warning-300 text-xs">
                    <span className="font-bold block">Histórico de Substituição:</span>
                    {a.replacement_reason}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs pt-2 border-t border-ink-800 flex-wrap gap-2">
                  <span className="text-ink-400">Total USD: <strong className="text-success-400">US$ {a.price_total}</strong></span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedHotelForServices({ name: a.name, city: a.city });
                        setIsHotelServicesOpen(true);
                      }}
                      className="text-[11px] text-info-400 hover:text-info-300 font-bold flex items-center gap-1 transition"
                    >
                      <ShieldPlus className="w-3 h-3" />
                      Serviços
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDiningDestination(a.city.includes('Miami') ? 'Miami Beach, FL' : 'Orlando / Kissimmee');
                        setIsDiningRadarOpen(true);
                      }}
                      className="text-[11px] text-warning-400 hover:text-warning-300 font-bold flex items-center gap-1 transition"
                    >
                      <Utensils className="w-3 h-3" />
                      Comer Barato
                    </button>
                  </div>
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
              className="px-4 py-2 rounded-xl bg-warning-600 hover:bg-warning-500 text-white font-bold text-xs shadow-lg shadow-warning-600/30 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Novo Veículo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripTransports.map(t => (
              <div key={t.id} className="glass-card p-5 rounded-2xl border border-ink-800 space-y-4 relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-warning-500/10 text-warning-400 flex items-center justify-center font-bold">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">{t.provider_company}</h4>
                      <p className="text-xs text-ink-400">{t.category_or_model || 'Veículo'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditTr(t)}
                      className="p-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Deseja excluir este transporte?')) deleteTransport(t.id);
                      }}
                      className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-warning-500/10 border border-warning-500/30 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-warning-300 font-bold">
                    <Clock className="w-4 h-4" />
                    Devolução Rígida: {new Date(t.dropoff_time).toLocaleString('pt-BR')}
                  </div>
                  <div className="text-ink-300 text-[11px]">
                    Local Devolução: <strong>{t.dropoff_location}</strong>
                  </div>
                </div>

                {t.requires_followup_transport && (
                  <div className="p-2.5 rounded-lg bg-ink-900/60 border border-ink-800 text-xs text-ink-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning-400 shrink-0" />
                    <span>Requer agendamento de Uber XL / Transfer para o grupo pós-devolução.</span>
                  </div>
                )}

                {t.notes && (
                  <div className="text-xs text-ink-400 pt-2 border-t border-ink-800">
                    <span className="text-ink-300 font-semibold">Notas:</span> {t.notes}
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

      <DiningRadarModal
        isOpen={isDiningRadarOpen}
        onClose={() => setIsDiningRadarOpen(false)}
        initialDestination={diningDestination}
      />

      <HotelServicesModal
        isOpen={isHotelServicesOpen}
        onClose={() => setIsHotelServicesOpen(false)}
        hotelName={selectedHotelForServices.name}
        hotelCity={selectedHotelForServices.city}
      />
    </div>
  );
};
