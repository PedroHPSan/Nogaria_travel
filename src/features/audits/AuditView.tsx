import React from 'react';
import { useTrip } from '../../context/TripContext';
import { ViewHeader } from '../../components/ui/ViewHeader';
import { ShieldAlert, AlertTriangle, CheckCircle2, RotateCw } from 'lucide-react';

interface AuditViewProps {
  onReRunAudit?: () => void;
}

export const AuditView: React.FC<AuditViewProps> = () => {
  const { auditFindings, toggleResolveAudit, rerunAudit } = useTrip();

  const unresolved = auditFindings.filter(f => !f.resolved);
  const resolved = auditFindings.filter(f => f.resolved);

  const criticals = unresolved.filter(f => f.severity === 'critical');
  const warnings = unresolved.filter(f => f.severity === 'warning');
  const infos = unresolved.filter(f => f.severity === 'info');

  return (
    <div className="space-y-6 pb-20">
      <ViewHeader
        title="Módulo de Auditoria Autônoma de Viagem"
        subtitle="Varredura automática em busca de buracos em hospedagens, devoluções de carros incompatíveis, divergências de bagagem e restrições infantis."
        actions={
          <button
            onClick={rerunAudit}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RotateCw className="w-4 h-4" />
            Reexecutar Varredura
          </button>
        }
      />

      {/* Summary Scoreboard */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="glass-card p-4 rounded-2xl border border-rose-500/30">
          <div className="text-[10px] uppercase font-bold text-rose-400">Erros Críticos</div>
          <div className="text-2xl font-extrabold text-white mt-1">{criticals.length}</div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-amber-500/30">
          <div className="text-[10px] uppercase font-bold text-amber-400">Alertas Logísticos</div>
          <div className="text-2xl font-extrabold text-white mt-1">{warnings.length}</div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-blue-500/30">
          <div className="text-[10px] uppercase font-bold text-blue-400">Recomendações</div>
          <div className="text-2xl font-extrabold text-white mt-1">{infos.length}</div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-emerald-500/30">
          <div className="text-[10px] uppercase font-bold text-emerald-400">Resolvidos</div>
          <div className="text-2xl font-extrabold text-white mt-1">{resolved.length}</div>
        </div>
      </div>

      {/* Unresolved Audit Items */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white">Apontamentos Ativos ({unresolved.length})</h3>

        {unresolved.map(finding => {
          const isCritical = finding.severity === 'critical';
          const isWarning = finding.severity === 'warning';

          return (
            <div
              key={finding.id}
              className={`glass-card p-5 rounded-2xl border transition space-y-3 ${
                isCritical ? 'border-rose-500/40 bg-rose-950/10' :
                isWarning ? 'border-amber-500/30 bg-amber-950/10' : 'border-blue-500/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    isCritical ? 'bg-rose-500/20 text-rose-400' :
                    isWarning ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {isCritical ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {finding.severity.toUpperCase()} • {finding.code}
                    </span>
                    <h4 className="font-bold text-base text-white mt-0.5">{finding.title}</h4>
                  </div>
                </div>

                <button
                  onClick={() => toggleResolveAudit(finding.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-400 border border-slate-700 text-xs font-semibold transition shrink-0"
                >
                  Marcar Resolvido
                </button>
              </div>

              <p className="text-xs text-slate-300">{finding.description}</p>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200">
                <span className="font-bold text-blue-400 block mb-0.5">Recomendação IA / Sistema:</span>
                {finding.recommendation}
              </div>
            </div>
          );
        })}
      </div>

      {/* Resolved Items */}
      {resolved.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <h3 className="text-sm font-bold text-slate-400">Apontamentos Resolvidos ({resolved.length})</h3>
          {resolved.map(finding => (
            <div key={finding.id} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between text-xs text-slate-400 opacity-60">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="line-through">{finding.title}</span>
              </div>
              <button
                onClick={() => toggleResolveAudit(finding.id)}
                className="text-[11px] text-blue-400 hover:underline"
              >
                Reabrir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
