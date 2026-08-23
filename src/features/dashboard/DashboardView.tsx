import React from 'react';
import { useTrip } from '../../context/TripContext';
import {
  TrendingDown,
  Car,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Users
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    activeTrip,
    participants,
    giftCards,
    transports,
    auditFindings,
    formatAmount,
    currency
  } = useTrip();

  const totalNominalGC = giftCards.reduce((sum, g) => sum + g.nominal_value, 0);
  const totalNetCostGC = giftCards.reduce((sum, g) => sum + g.net_cost, 0);
  const totalSavingsGC = totalNominalGC - totalNetCostGC;
  const avgSavingsPct = totalNominalGC > 0 ? (totalSavingsGC / totalNominalGC) * 100 : 0;

  const unresolvedCritical = auditFindings.filter(f => f.severity === 'critical' && !f.resolved).length;
  const unresolvedWarning = auditFindings.filter(f => f.severity === 'warning' && !f.resolved).length;
  const prepScore = Math.max(0, 100 - (unresolvedCritical * 20 + unresolvedWarning * 10));

  const car = transports.find(t => t.type === 'rental_car');

  return (
    <div className="space-y-6 pb-20">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 p-6 border border-blue-500/20 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Central da Viagem
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              {activeTrip.title}
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Central de inteligência para o grupo ({participants.map(p => p.nickname || p.full_name.split(' ')[0]).join(', ')}). 
              Valores recalculados automaticamente em <strong className="text-emerald-400">{currency}</strong>.
            </p>
          </div>
          <button
            onClick={() => onNavigate('audit')}
            className="self-start md:self-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4" />
            Executar Auditoria Geral
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate('financial')}
          className="glass-card p-5 rounded-2xl border border-emerald-500/20 relative overflow-hidden cursor-pointer hover:border-emerald-500/40 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">Economia Efetiva (Gift Cards)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{formatAmount(totalSavingsGC)}</div>
            <div className="text-xs text-emerald-400/90 font-medium mt-1">
              Desconto real líquido de <span className="font-bold">{avgSavingsPct.toFixed(1)}%</span> sobre nominal
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>Nominal: {formatAmount(totalNominalGC)}</span>
            <span>Pago: {formatAmount(totalNetCostGC)}</span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('logistics')}
          className="glass-card p-5 rounded-2xl border border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400">Devolução do Veículo</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold text-white leading-tight">
              {car ? new Date(car.dropoff_time).toLocaleDateString('pt-BR') + ' às 17h30' : '19/09 às 17h30'}
            </div>
            <div className="text-xs text-amber-400/90 font-medium mt-1">
              {car ? car.provider_company : 'Hertz / Alamo (FLL Airport)'}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span className="text-rose-400 font-semibold">Pendência:</span> Uber pós devolução para hotel final
          </div>
        </div>

        <div
          onClick={() => onNavigate('audit')}
          className="glass-card p-5 rounded-2xl border border-blue-500/20 cursor-pointer hover:border-blue-500/40 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-400">Índice de Preparação</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{prepScore}%</div>
            <div className="text-xs text-slate-400 font-medium mt-1">
              {unresolvedCritical} crítico(s) • {unresolvedWarning} alerta(s)
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${prepScore}%` }} />
          </div>
        </div>
      </div>

      {/* Participants Quick List */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Status dos Participantes da Viagem ({participants.length})
          </h3>
          <button
            onClick={() => onNavigate('participants')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            Gerenciar grupo & cadastros →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {participants.map(p => (
            <div key={p.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${p.avatar_color} text-white font-bold flex items-center justify-center text-sm shadow-md`}>
                {p.nickname ? p.nickname[0] : p.full_name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs text-white truncate">{p.full_name}</div>
                <div className="text-[11px] text-slate-400">{p.age} anos • {p.relationship}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">Orçamento: {formatAmount(p.budget_limit_usd)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
