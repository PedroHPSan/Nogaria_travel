import React, { useState } from 'react';
import { Plane, ShieldAlert, Sparkles, DollarSign, Plus, ChevronDown, Building2, RefreshCw, Users, LogOut, Sun, Moon } from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { TripModal } from './modals/TripModal';
import { TeamModal } from './modals/TeamModal';

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

  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [isTripMenuOpen, setIsTripMenuOpen] = useState(false);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(exchangeRate.toString());
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

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
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-ink-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-info-600 via-indigo-600 to-accent-600 flex items-center justify-center shadow-lg shadow-info-500/20 text-white font-bold shrink-0">
              <Plane className="w-5 h-5" />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTripMenuOpen(!isTripMenuOpen)}
                  className="flex items-center gap-1.5 font-extrabold text-base md:text-lg text-ink-100 leading-tight hover:text-info-300 transition text-left"
                >
                  <span>{activeTrip.title}</span>
                  <ChevronDown className="w-4 h-4 text-ink-400" />
                </button>

                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-success-500/10 text-success-400 border border-success-500/20 hidden sm:inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {activeTenant.name.split(' ')[0]} (SaaS)
                </span>
              </div>

              <p className="text-xs text-ink-400 font-medium hidden sm:block">
                {activeTrip.destination_main} • {activeTrip.start_date.substring(0, 7)}
              </p>

              {/* Trip Switcher Dropdown Menu */}
              {isTripMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-ink-900 border border-ink-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="text-[10px] uppercase font-bold text-ink-400 px-2 py-1">
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
                          ? 'bg-info-600/20 text-info-400 font-bold border border-info-500/30'
                          : 'text-ink-300 hover:bg-ink-800'
                      }`}
                    >
                      <span className="truncate">{t.title}</span>
                      {t.id === activeTrip.id && <span className="w-2 h-2 rounded-full bg-info-400" />}
                    </button>
                  ))}

                  <div className="pt-2 mt-1 border-t border-ink-800">
                    <button
                      onClick={() => {
                        setIsTripMenuOpen(false);
                        setIsTripModalOpen(true);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-info-600 hover:bg-info-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
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
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-900/90 border border-ink-800 text-xs">
              <RefreshCw className="w-3.5 h-3.5 text-success-400" />
              {isEditingRate ? (
                <div className="flex items-center gap-1">
                  <span className="text-ink-400 text-[11px]">US$ 1 = R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={tempRate}
                    onChange={e => setTempRate(e.target.value)}
                    className="w-14 px-1 py-0.5 rounded bg-ink-950 border border-success-500 text-ink-100 text-xs font-bold"
                  />
                  <button
                    onClick={handleSaveRate}
                    className="px-2 py-0.5 rounded bg-success-600 text-white font-bold text-[10px]"
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
                  className="hover:text-success-300 transition text-ink-300 font-semibold text-[11px] flex items-center gap-1"
                  title="Clique para ajustar a cotação atual"
                >
                  <span>Cotação Hoje ({exchangeRateDate}):</span>
                  <strong className="text-success-400 font-mono">R$ {exchangeRate.toFixed(2)}</strong>
                </button>
              )}
            </div>

            {/* Participants Avatars */}
            <div className="hidden xl:flex items-center -space-x-2 mr-1">
              {participants.map(p => (
                <div
                  key={p.id}
                  title={`${p.full_name} (${p.age}a) • ${p.relationship}`}
                  className={`w-7 h-7 rounded-full ${p.avatar_color} border-2 border-ink-900 text-white text-xs font-bold flex items-center justify-center shadow-sm`}
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
                  ? 'bg-success-500/20 text-success-300 border-success-500/40 shadow-sm'
                  : 'bg-ink-800/80 text-ink-200 border-ink-700 hover:bg-ink-700'
              }`}
              title={`Moeda ativa: ${currency}. Clique para recalcular os valores em ${currency === 'USD' ? 'Reais (R$)' : 'Dólares (US$)'}`}
            >
              <DollarSign className="w-3.5 h-3.5 text-success-400" />
              <span>{currency} {currency === 'BRL' ? `(R$ ${exchangeRate.toFixed(2)})` : ''}</span>
            </button>

            {/* Audit Status Button */}
            <button
              onClick={onOpenAudit}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                criticalCount > 0
                  ? 'bg-danger-500/10 text-danger-400 border-danger-500/30 hover:bg-danger-500/20'
                  : 'bg-warning-500/10 text-warning-400 border-warning-500/30 hover:bg-warning-500/20'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Auditoria ({criticalCount + warningCount})</span>
            </button>

            {/* AI Copilot Button */}
            <button
              onClick={onOpenAi}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-accent-600 hover:from-indigo-500 hover:to-accent-500 text-xs font-semibold text-white shadow-md shadow-accent-500/20 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Copiloto IA</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-ink-800/80 text-ink-200 hover:bg-ink-700 border border-ink-700 transition"
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Team Button */}
            <button
              onClick={() => setIsTeamModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-800/80 text-ink-200 hover:bg-ink-700 text-xs font-semibold border border-ink-700 transition"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Equipe</span>
            </button>

            {/* Account Menu */}
            <div className="relative">
              <button
                onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-info-600 to-accent-600 text-white text-xs font-bold flex items-center justify-center shadow-sm"
                title={profile?.full_name}
              >
                {profile?.full_name ? profile.full_name[0].toUpperCase() : '?'}
              </button>

              {isAccountMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-ink-900 border border-ink-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 text-xs">
                    <div className="font-semibold text-ink-100 truncate">{profile?.full_name}</div>
                    <div className="text-ink-400 truncate">{profile?.email}</div>
                  </div>
                  <button
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      signOut();
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left text-xs font-semibold text-danger-400 hover:bg-danger-500/10 transition flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sair
                  </button>
                </div>
              )}
            </div>
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

      {/* Team Modal */}
      <TeamModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
      />
    </>
  );
};
