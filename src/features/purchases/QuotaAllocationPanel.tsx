import React from 'react';
import type { Participant } from '../../types/database.types';
import type { PurchaseDecision } from '../../types/purchase.types';

interface Props {
  decisions: PurchaseDecision[];
  participants: Participant[];
}

export const QuotaAllocationPanel: React.FC<Props> = ({ decisions, participants }) => {
  const owners = new Map<string, { total: number; quota: number; excedente: number; imposto: number }>();

  for (const d of decisions) {
    const q = d.quota;
    if (q.total_pessoa_usd === 0 && q.imposto_do_item_usd === 0) continue;
    const current = owners.get(q.quota_owner_id) ?? {
      total: q.total_pessoa_usd,
      quota: q.quota_usd,
      excedente: q.excedente_usd,
      imposto: 0,
    };
    current.imposto += q.imposto_do_item_usd;
    owners.set(q.quota_owner_id, current);
  }

  if (owners.size === 0) return null;

  return (
    <div className="glass-panel p-5 rounded-2xl border border-ink-800 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-ink-100">Cota alfandegária por participante</h3>
        <p className="text-[11px] text-ink-500">
          A cota é individual e não se soma entre viajantes. Um bem acima do limite gera excedente
          mesmo que outra pessoa tenha folga.
        </p>
      </div>

      {[...owners.entries()].map(([ownerId, o]) => {
        const nome = participants.find(p => p.id === ownerId)?.full_name ?? ownerId;
        const pct = o.quota > 0 ? Math.min(100, Math.round((o.total / o.quota) * 100)) : 100;
        const estourou = o.excedente > 0;

        return (
          <div key={ownerId} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold text-ink-200">{nome}</span>
              <span className={estourou ? 'text-danger-400 font-bold' : 'text-ink-400'}>
                US$ {o.total.toFixed(2)} / US$ {o.quota.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-ink-800 h-2 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${estourou ? 'bg-danger-500' : pct > 80 ? 'bg-warning-500' : 'bg-success-500'}`} style={{ width: `${pct}%` }} />
            </div>
            {estourou && (
              <p className="text-[11px] text-danger-400">
                Excedente de US$ {o.excedente.toFixed(2)} — imposto projetado US$ {o.imposto.toFixed(2)}
              </p>
            )}
            {!estourou && (
              <p className="text-[11px] text-success-400">Folga de US$ {(o.quota - o.total).toFixed(2)}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
