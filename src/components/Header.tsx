import React, { useState } from 'react';
import { Plane, ShieldAlert, Sparkles, DollarSign, Plus, ChevronDown, Building2, RefreshCw } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { TripModal } from './modals/TripModal';

interface HeaderProps {
  onOpenAudit: () => void;
  onOpenAi: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAudit, onOpenAi }) => {
  const {
    trips,
    activeTrip,
    setActiveTripId,
    createTrip,
    activeTenant,
    participants,
    auditFindings,
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate,
    exchangeRateDate
  } = useTrip();

  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [isTripMenuOpen, setIsTripMenuOpen] = useState(false);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(exchangeRate.toString());

  const criticalCount = auditFindings.filter(f => f.severity === 'critical' && !f.resolved).length;
  const warningCount = auditFindings.filter(f => f.severity === 'warning' && !f.resolved).length;

  const handleSaveRate = () => {
    const val = parseFloat(tempRate);
    if (!isNaN(val) && val > 0) {
      setExchangeRate(val);
    }
    setIsEditingRate(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold shrink-0">
              <Plane className="w-5 h-5" />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTripMenuOpen(!isTripMenuOpen)}
                  className="flex items-center gap-1.5 font-extrabold text-base md:text-lg text-white leading-tight hover:text-blue-300 transition text-left"
                >
                  <span>{activeTrip.title}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hidden sm:inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {activeTenant.name.split(' ')[0]} (SaaS)
                </span>
              </div>

              <p className="text-xs text-slate-400 font-medium hidden sm:block">
                {activeTrip.destination_main} • {activeTrip.start_date.substring(0, 7)}
              </p>

              {/* Trip Switcher Dropdown Menu */}
              {isTripMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1">
                    Seus Projetos de Viagem ({trips.length})
                  </div>
                  {trips.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTripId(t.id);
                        setIsTripMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                        t.id === activeTrip.id
                          ? 'bg-blue-600/20 text-blue-400 font-bold border border-blue-500/30'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{t.title}</span>
                      {t.id === activeTrip.id && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                    </button>
                  ))}

                  <div className="pt-2 mt-1 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setIsTripMenuOpen(false);
                        setIsTripModalOpen(true);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Criar Nova Viagem
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Live Exchange Rate Display */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              {isEditingRate ? (
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-[11px]">US$ 1 = R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={tempRate}
                    onChange={e => setTempRate(e.target.value)}
                    className="w-14 px-1 py-0.5 rounded bg-slate-950 border border-emerald-500 text-white text-xs font-bold"
                  />
                  <button
                    onClick={handleSaveRate}
                    className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setTempRate(exchangeRate.toString());
                    setIsEditingRate(true);
                  }}
                  className="hover:text-emerald-300 transition text-slate-300 font-semibold text-[11px] flex items-center gap-1"
                  title="Clique para ajustar a cotação atual"
                >
                  <span>Cotação Hoje ({exchangeRateDate}):</span>
                  <strong className="text-emerald-400 font-mono">R$ {exchangeRate.toFixed(2)}</strong>
                </button>
              )}
            </div>

            {/* Participants Avatars */}
            <div className="hidden xl:flex items-center -space-x-2 mr-1">
              {participants.map(p => (
                <div
                  key={p.id}
                  title={`${p.full_name} (${p.age}a) • ${p.relationship}`}
                  className={`w-7 h-7 rounded-full ${p.avatar_color} border-2 border-slate-900 text-white text-xs font-bold flex items-center justify-center shadow-sm`}
                >
                  {p.nickname ? p.nickname[0] : p.full_name[0]}
                </div>
              ))}
            </div>

            {/* Currency Switcher */}
            <button
              onClick={() => setCurrency(currency === 'USD' ? 'BRL' : 'USD')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                currency === 'BRL'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
              title={`Moeda ativa: ${currency}. Clique para recalcular os valores em ${currency === 'USD' ? 'Reais (R$)' : 'Dólares (US$)'}`}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currency} {currency === 'BRL' ? `(R$ ${exchangeRate.toFixed(2)})` : ''}</span>
            </button>

            {/* Audit Status Button */}
            <button
              onClick={onOpenAudit}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                criticalCount > 0
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Auditoria ({criticalCount + warningCount})</span>
            </button>

            {/* AI Copilot Button */}
            <button
              onClick={onOpenAi}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-semibold text-white shadow-md shadow-purple-500/20 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Copiloto IA</span>
            </button>
          </div>
        </div>
      </header>

      {/* Trip Modal for Creating New Trip */}
      <TripModal
        isOpen={isTripModalOpen}
        onClose={() => setIsTripModalOpen(false)}
        onSave={tripData => createTrip(tripData)}
        tenantId={activeTenant.id}
      />
    </>
  );
};
