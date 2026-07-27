import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { BaseModal } from './BaseModal';
import type { PriceQuote, PurchaseItem } from '../../types/database.types';
import { researchPrices } from '../../services/purchase/priceResearchClient';
import type { PriceQuoteCandidate } from '../../services/purchase/priceResearchClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: PurchaseItem | null;
  tripId: string;
  userId: string;
  onAccept: (q: Omit<PriceQuote, 'id' | 'created_at' | 'is_active'>) => void;
}

export const PriceResearchModal: React.FC<Props> = ({ isOpen, onClose, item, tripId, userId, onAccept }) => {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<PriceQuoteCandidate[]>([]);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isOpen || !item) return;

    // Guards against a stale response landing after the modal was reopened for a
    // different item (or closed) before the request resolved.
    let cancelled = false;

    setLoading(true);
    setError('');
    setCandidates([]);
    setAccepted(new Set());

    researchPrices({
      trip_id: tripId,
      purchase_item_id: item.id,
      product_name: item.product_name,
      brand: item.brand,
      markets: ['US', 'BR'],
    }).then(result => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) setError(result.error);
      else setCandidates(result.candidates);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, item, tripId]);

  if (!item) return null;

  // THE HUMAN-APPROVAL GATE: a candidate only becomes a `PriceQuote` when the user
  // clicks "Aceitar como cotação" for that specific card. Nothing here runs on arrival —
  // `candidates` from the effect above is display-only state, never passed to `onAccept`
  // except inside this handler, and only for the one candidate the user chose.
  const handleAccept = (candidate: PriceQuoteCandidate, index: number) => {
    onAccept({
      trip_id: tripId,
      purchase_item_id: item.id,
      market: candidate.market,
      store_name: candidate.store_name,
      url: candidate.url,
      price: candidate.price,
      currency: candidate.currency,
      price_kind: candidate.price_kind,
      includes_tax: candidate.market === 'BR',
      observed_at: candidate.observed_at,
      source: 'ai_search',
      source_note: candidate.source_note ?? candidate.url,
      confidence: candidate.confidence,
      validated_by: userId,
      validated_at: new Date().toISOString(),
    });
    setAccepted(prev => new Set(prev).add(index));
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={`Pesquisa de preços com IA — ${item.product_name}`}>
      <div className="space-y-3">
        <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-px" />
          Resultados sugeridos pela IA. Nada é salvo até você aceitar — confira a loja, o preço e a fonte antes.
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Pesquisando…
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
            {error}
          </div>
        )}

        {!loading && !error && candidates.length === 0 && (
          <p className="text-xs text-slate-500 py-6 text-center">
            Nenhum preço encontrado. Registre manualmente.
          </p>
        )}

        {candidates.map((c, i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{c.store_name}</div>
                <div className="text-[11px] text-slate-500">
                  {c.market === 'US' ? 'EUA' : 'Brasil'} • {c.price_kind} • {c.observed_at} • confiança {c.confidence}
                </div>
              </div>
              <div className="text-sm font-bold text-emerald-400 shrink-0">
                {c.currency === 'USD' ? 'US$' : 'R$'} {c.price.toFixed(2)}
              </div>
            </div>

            {c.url && (
              <a href={c.url} target="_blank" rel="noreferrer" className="block text-[10px] text-blue-400 truncate hover:underline">
                {c.url}
              </a>
            )}

            {c.source_note && (
              <p className="text-[10px] text-slate-500 italic">{c.source_note}</p>
            )}

            <button
              onClick={() => handleAccept(c, i)}
              disabled={accepted.has(i)}
              className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition ${
                accepted.has(i)
                  ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {accepted.has(i) ? 'Aceita ✓' : 'Aceitar como cotação'}
            </button>
          </div>
        ))}
      </div>
    </BaseModal>
  );
};
