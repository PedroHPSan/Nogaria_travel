import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Edit2, Sparkles, Trash2 } from 'lucide-react';
import type { PriceQuote, PurchaseItem } from '../../types/database.types';
import type { PurchaseDecision, PurchaseVerdict } from '../../types/purchase.types';
import { PurchaseBreakdown } from './PurchaseBreakdown';
import { PriceQuoteHistory } from './PriceQuoteHistory';

const VERDICT_STYLE: Record<PurchaseVerdict, { label: string; className: string }> = {
  COMPRAR_EUA: { label: 'Comprar nos EUA', className: 'bg-success-500/10 text-success-400 border-success-500/30' },
  COMPRAR_BRASIL: { label: 'Comprar no Brasil', className: 'bg-warning-500/10 text-warning-400 border-warning-500/30' },
  INDIFERENTE: { label: 'Indiferente', className: 'bg-ink-700/40 text-ink-300 border-ink-600/40' },
  AGUARDAR_PRECO: { label: 'Aguardar preço', className: 'bg-info-500/10 text-info-400 border-info-500/30' },
  DADOS_INSUFICIENTES: { label: 'Dados insuficientes', className: 'bg-ink-800 text-ink-500 border-ink-700' },
};

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  item: PurchaseItem;
  decision: PurchaseDecision;
  quotes: PriceQuote[];
  onEdit: (item: PurchaseItem) => void;
  onDelete: (id: string) => void;
  onResearch: (item: PurchaseItem) => void;
  onAiResearch: (item: PurchaseItem) => void;
  onMarkBought: (id: string, paid: number) => void;
}

export const PurchaseDecisionCard: React.FC<Props> = ({ item, decision, quotes, onEdit, onDelete, onResearch, onAiResearch, onMarkBought }) => {
  const [expanded, setExpanded] = useState(false);
  const style = VERDICT_STYLE[decision.verdict];
  const positiva = decision.economia_brl > 0;

  return (
    <div className="glass-card p-5 rounded-2xl border border-ink-800 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-bold text-base text-white truncate">{item.product_name}</h4>
          <p className="text-xs text-ink-400">{item.brand || 'Marca'} • {item.store_name || 'Loja EUA'}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg bg-ink-800 text-ink-300 hover:text-white transition">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { if (confirm(`Deseja excluir "${item.product_name}"?`)) onDelete(item.id); }}
            className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase border ${style.className}`}>
          {style.label}
        </span>
        {item.verdict_override && (
          <span className="text-[10px] text-ink-500 italic">manual: {item.override_reason}</span>
        )}
      </div>

      {decision.verdict === 'DADOS_INSUFICIENTES' ? (
        <div className="flex gap-2">
          <button
            onClick={() => onResearch(item)}
            className="flex-1 py-2 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold text-xs transition"
          >
            Registrar preço
          </button>
          <button
            onClick={() => onAiResearch(item)}
            className="flex-1 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-accent-300 font-bold text-xs transition flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Pesquisar com IA
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-ink-900/60 border border-ink-800">
          <div className="text-[10px] text-ink-400">Economia líquida comprando nos EUA</div>
          <div className={`text-lg font-bold ${positiva ? 'text-success-400' : 'text-danger-400'}`}>
            {brl(decision.economia_brl)}
            <span className="text-xs font-semibold ml-2">({decision.economia_pct.toFixed(2)}%)</span>
          </div>
        </div>
      )}

      {decision.alerts.length > 0 && (
        <ul className="space-y-1">
          {decision.alerts.map((alert, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-warning-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{alert.message}</span>
            </li>
          ))}
        </ul>
      )}

      {item.status === 'planned' && decision.verdict !== 'DADOS_INSUFICIENTES' && (
        <button
          onClick={() => {
            const entrada = prompt('Valor efetivamente pago, em US$:', String(decision.us.liquido_usd));
            if (entrada === null) return;
            const textoLimpo = entrada.trim();
            const valor = Number(textoLimpo);
            if (textoLimpo === '' || !Number.isFinite(valor) || valor < 0) {
              alert('Valor pago inválido. Informe um número maior ou igual a zero, em US$.');
              return;
            }
            onMarkBought(item.id, valor);
          }}
          className="w-full py-2 rounded-xl bg-success-600 hover:bg-success-500 text-white font-bold text-xs transition"
        >
          Marcar como comprado
        </button>
      )}

      {item.status === 'bought' && (
        <div className="text-[11px] text-success-400 font-semibold">
          Decidido em {decision.computed_at} • pago US$ {(item.actual_paid_usd ?? 0).toFixed(2)}
        </div>
      )}

      {decision.verdict !== 'DADOS_INSUFICIENTES' && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-ink-400 hover:text-white transition"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Ocultar cálculo' : 'Ver cálculo'}
          </button>
          {expanded && (
            <div className="pt-3 border-t border-ink-800">
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-semibold text-ink-400 mb-1">Histórico de preços — EUA</div>
                  <PriceQuoteHistory quotes={quotes} itemId={item.id} market="US" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-ink-400 mb-1">Histórico de preços — Brasil</div>
                  <PriceQuoteHistory quotes={quotes} itemId={item.id} market="BR" />
                </div>
              </div>
              <div className="flex gap-2 mt-2 mb-3">
                <button
                  onClick={() => onResearch(item)}
                  className="flex-1 py-1.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-200 font-semibold text-[11px] transition"
                >
                  Registrar nova cotação
                </button>
                <button
                  onClick={() => onAiResearch(item)}
                  className="flex-1 py-1.5 rounded-xl bg-accent-600/20 hover:bg-accent-600/30 text-accent-300 font-semibold text-[11px] transition flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Pesquisar com IA
                </button>
              </div>
              <PurchaseBreakdown decision={decision} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
