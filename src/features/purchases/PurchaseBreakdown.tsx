import React from 'react';
import type { PurchaseDecision } from '../../types/purchase.types';

const usd = (n: number) => `US$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const PurchaseBreakdown: React.FC<{ decision: PurchaseDecision }> = ({ decision }) => (
  <div className="space-y-4 text-xs">
    <div className="space-y-1.5">
      <h5 className="font-bold text-ink-200 uppercase text-[10px] tracking-wide">Custo nos EUA</h5>
      {decision.us.lines.map((line, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 py-1 border-b border-ink-800/60">
          <span className="text-ink-400">
            {line.label}
            {line.parameter && <span className="block text-[10px] text-ink-600">{line.parameter}</span>}
          </span>
          <span className={line.amount < 0 ? 'text-success-400 font-semibold' : 'text-ink-200 font-semibold'}>
            {usd(line.amount)}
          </span>
        </div>
      ))}
      <div className="flex justify-between pt-1.5 font-bold text-ink-100">
        <span>Desembarcado</span>
        <span>{usd(decision.us.desembarcado_usd)} = {brl(decision.us.desembarcado_brl)}</span>
      </div>
    </div>

    <div className="space-y-1.5">
      <h5 className="font-bold text-ink-200 uppercase text-[10px] tracking-wide">Referência no Brasil</h5>
      {decision.br.lines.map((line, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 py-1 border-b border-ink-800/60">
          <span className="text-ink-400">{line.label}</span>
          <span className="text-ink-200 font-semibold">{brl(line.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between pt-1.5 font-bold text-ink-100">
        <span>Líquido Brasil</span>
        <span>{brl(decision.br.br_liquido_brl)}</span>
      </div>
    </div>

    <div className="space-y-1.5">
      <h5 className="font-bold text-ink-200 uppercase text-[10px] tracking-wide">Premissas</h5>
      {decision.premises.map((p, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 text-[11px]">
          <span className="text-ink-400">{p.label}</span>
          <span className="text-right text-ink-300">
            {p.value}
            <span className="block text-[10px] text-ink-600">{p.source}</span>
          </span>
        </div>
      ))}
    </div>
  </div>
);
