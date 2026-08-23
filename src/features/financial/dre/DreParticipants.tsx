import React from 'react';
import type { DreGlobalResult } from '../../../services/dreEngine';
import { ArrowRightLeft, CheckCircle2 } from 'lucide-react';

interface DreParticipantsProps {
  dreResult: DreGlobalResult;
  formatVal: (valUsd: number, valBrl: number) => string;
}

export const DreParticipants: React.FC<DreParticipantsProps> = ({ dreResult, formatVal }) => {
  return (
    <div className="space-y-6">
      {/* Matriz de Acerto de Contas (Debt Settlement) */}
      <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
              Balancete de Acerto de Contas (Liquidação Inteligente)
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Transferências financeiras recomendadas para zerar todas as dívidas e rateios entre os membros do grupo.
            </p>
          </div>
        </div>

        {dreResult.settlements.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Todas as contas estão perfeitamente balanceadas! Nenhum acerto pendente.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dreResult.settlements.map((s, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 flex items-center justify-between gap-3 shadow-md"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center text-xs">
                    {s.from_name[0]}
                  </div>
                  <div className="text-xs">
                    <div className="text-slate-200">
                      <strong className="text-white">{s.from_name}</strong> transfere para{' '}
                      <strong className="text-emerald-400">{s.to_name}</strong>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Para quitar rateio de hospedagem, ingressos e passagens
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-base font-extrabold text-emerald-400">
                    {formatVal(s.amount_usd, s.amount_brl)}
                  </div>
                  <div className="text-[10px] text-slate-400">via Pix / Wise</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cards Individuais dos Participantes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dreResult.participants.map(p => (
          <div
            key={p.participant_id}
            className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full ${p.avatar_color} text-white font-bold flex items-center justify-center text-sm shadow`}>
                  {p.nickname ? p.nickname[0] : p.full_name[0]}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-white truncate">{p.full_name}</h4>
                  <div className="text-[11px] text-slate-400">
                    Orçamento: {formatVal(p.budget_limit_usd, p.budget_limit_brl)}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 text-xs py-3 border-y border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Consumido:</span>
                  <span className="font-bold text-slate-200">
                    {formatVal(p.total_consumed_usd, p.total_consumed_brl)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Total Pago (Desembolso):</span>
                  <span className="font-bold text-emerald-400">
                    {formatVal(p.total_paid_usd, p.total_paid_brl)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                  <span className="font-bold text-slate-300">Saldo Líquido:</span>
                  <span
                    className={`font-extrabold text-sm ${
                      p.net_balance_usd > 1
                        ? 'text-emerald-400'
                        : p.net_balance_usd < -1
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {p.net_balance_usd > 1 ? '+' : ''}
                    {formatVal(p.net_balance_usd, p.net_balance_brl)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2">
              <span
                className={`inline-block w-full text-center py-1.5 rounded-lg text-xs font-bold ${
                  p.status === 'creditor'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : p.status === 'debtor'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {p.status === 'creditor'
                  ? 'Credor (A Receber)'
                  : p.status === 'debtor'
                  ? 'Devedor (A Pagar)'
                  : 'Contas Zeradas'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
