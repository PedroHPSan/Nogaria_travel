import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, Search, MapPin, Tag, RefreshCw } from 'lucide-react';
import { BaseModal } from './BaseModal';
import type { PriceQuote, PurchaseItem } from '../../types/database.types';
import { researchPrices } from '../../services/purchase/priceResearchClient';
import type { PriceQuoteCandidate } from '../../services/purchase/priceResearchClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: PurchaseItem | null;
  tripId: string;
  destination?: string;
  userId: string;
  onAccept: (q: Omit<PriceQuote, 'id' | 'created_at' | 'is_active'>) => void;
}

const DESTINATION_OPTIONS = [
  { value: 'Orlando, FL (The Mall at Millenia, Florida Mall, Premium Outlets)', label: '🌴 Orlando, FL (Millenia, Florida Mall, Outlets)' },
  { value: 'Miami & Sunrise, FL (Sawgrass Mills, Aventura Mall, Dolphin Mall)', label: '🛍️ Miami & Sunrise (Sawgrass Mills, Aventura)' },
  { value: 'Kissimmee, FL (Super Target, Walmart, The Loop)', label: '🎯 Kissimmee, FL (Target, Walmart, Loop)' },
  { value: 'EUA Geral / Grandes Varejistas Online e Físicos', label: '🇺🇸 EUA Geral (Best Buy, Apple, Target, Amazon)' },
];

export const PriceResearchModal: React.FC<Props> = ({
  isOpen,
  onClose,
  item,
  tripId,
  destination = 'Orlando, FL',
  userId,
  onAccept,
}) => {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<PriceQuoteCandidate[]>([]);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState<Set<number>>(new Set());

  // Search refinement states
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [modelHint, setModelHint] = useState('');
  const [selectedDestination, setSelectedDestination] = useState(destination);

  // Sync initial state when item opens
  useEffect(() => {
    if (!isOpen || !item) return;

    setProductName(item.product_name || '');
    setBrand(item.brand || '');
    setModelHint(item.notes || '');
    setSelectedDestination(
      destination.includes('Miami')
        ? DESTINATION_OPTIONS[1].value
        : DESTINATION_OPTIONS[0].value
    );
    setAccepted(new Set());
    setCandidates([]);
    setError('');

    // Trigger initial search
    executeSearch({
      productName: item.product_name || '',
      brand: item.brand || '',
      modelHint: item.notes || '',
      dest: destination.includes('Miami') ? DESTINATION_OPTIONS[1].value : DESTINATION_OPTIONS[0].value,
      itemId: item.id,
    });
  }, [isOpen, item, destination]);

  const executeSearch = (params?: {
    productName?: string;
    brand?: string;
    modelHint?: string;
    dest?: string;
    itemId?: string;
  }) => {
    if (!item) return;

    const pName = (params?.productName ?? productName).trim();
    if (!pName) return;

    setLoading(true);
    setError('');
    setCandidates([]);

    researchPrices({
      trip_id: tripId,
      purchase_item_id: params?.itemId ?? item.id,
      product_name: pName,
      brand: (params?.brand ?? brand).trim() || undefined,
      model_hint: (params?.modelHint ?? modelHint).trim() || undefined,
      destination: (params?.dest ?? selectedDestination).trim() || undefined,
      markets: ['US', 'BR'],
    }).then(result => {
      setLoading(false);
      if (result.error) setError(result.error);
      else setCandidates(result.candidates);
    });
  };

  const handleAddModifier = (text: string) => {
    if (!productName.includes(text)) {
      const updated = `${productName} ${text}`.trim();
      setProductName(updated);
      executeSearch({ productName: updated });
    }
  };

  if (!item) return null;

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

  // Smart suggestion tags based on category or name
  const isApple = (item.brand || productName).toLowerCase().includes('apple') || productName.toLowerCase().includes('iphone');
  const isClothing = item.category === 'clothing' || item.category === 'footwear';
  const isCosmetic = item.category === 'cosmetics';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pesquisa com IA — ${item.product_name}`}
      subtitle="Cotações em tempo real contextualizadas com os locais de passagem e shoppings da viagem."
    >
      <div className="space-y-4">
        {/* Search Refinement Box */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-inner">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && executeSearch()}
                placeholder="Nome detalhado (ex: iPhone 16 Pro Max 256GB)"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>

            <input
              type="text"
              value={brand}
              onChange={e => setBrand(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && executeSearch()}
              placeholder="Marca (opcional)"
              className="sm:w-32 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={selectedDestination}
                onChange={e => {
                  setSelectedDestination(e.target.value);
                  executeSearch({ dest: e.target.value });
                }}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                {DESTINATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => executeSearch()}
              disabled={loading || !productName.trim()}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/30 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Pesquisando…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Atualizar Pesquisa</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Modifier Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
              <Tag className="w-3 h-3 text-purple-400" /> Sugestões de refinamento:
            </span>

            {isApple && (
              <>
                <button
                  type="button"
                  onClick={() => handleAddModifier('128GB')}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] transition"
                >
                  + 128GB
                </button>
                <button
                  type="button"
                  onClick={() => handleAddModifier('256GB')}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] transition"
                >
                  + 256GB
                </button>
                <button
                  type="button"
                  onClick={() => handleAddModifier('512GB')}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] transition"
                >
                  + 512GB
                </button>
                <button
                  type="button"
                  onClick={() => handleAddModifier('Desbloqueado (Unlocked)')}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] transition"
                >
                  + Desbloqueado
                </button>
              </>
            )}

            {isClothing && (
              <>
                <button
                  type="button"
                  onClick={() => handleAddModifier('Outlet Oficial')}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] transition"
                >
                  + Outlet Oficial
                </button>
                <button
                  type="button"
                  onClick={() => handleAddModifier('Sawgrass Mills')}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] transition"
                >
                  + Sawgrass Mills
                </button>
              </>
            )}

            {isCosmetic && (
              <>
                <button
                  type="button"
                  onClick={() => handleAddModifier('Sephora')}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] transition"
                >
                  + Sephora
                </button>
                <button
                  type="button"
                  onClick={() => handleAddModifier('100ml')}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] transition"
                >
                  + 100ml
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => handleAddModifier('Best Buy')}
              className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] transition"
            >
              + Best Buy
            </button>
            <button
              type="button"
              onClick={() => handleAddModifier('Target')}
              className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] transition"
            >
              + Target
            </button>
          </div>
        </div>

        {/* Status / Loading / Error */}
        {loading && (
          <div className="flex flex-col items-center gap-2 py-8 justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span className="text-xs font-medium">Buscando cotações nos EUA e Brasil com IA…</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && candidates.length === 0 && (
          <p className="text-xs text-slate-500 py-6 text-center">
            Nenhuma cotação encontrada para esta descrição. Ajuste os termos acima e tente novamente.
          </p>
        )}

        {/* Results */}
        {!loading && candidates.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1">
              <span>{candidates.length} opções encontradas:</span>
              <span className="text-purple-400 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3" /> Sugestões baseadas no roteiro
              </span>
            </div>

            {candidates.map((c, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="truncate">{c.store_name}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                          c.market === 'US'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {c.market === 'US' ? 'EUA (s/ tax)' : 'Brasil (c/ imposto)'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-0.5">
                      {c.price_kind} • observado em {c.observed_at} • confiança {c.confidence}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base font-bold text-emerald-400">
                      {c.currency === 'USD' ? 'US$' : 'R$'} {c.price.toFixed(2)}
                    </div>
                  </div>
                </div>

                {c.source_note && (
                  <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                    <span>{c.source_note}</span>
                  </div>
                )}

                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-[10px] text-blue-400 truncate hover:underline"
                  >
                    🔗 {c.url}
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => handleAccept(c, i)}
                  disabled={accepted.has(i)}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    accepted.has(i)
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20'
                  }`}
                >
                  {accepted.has(i) ? '✓ Cotação Aceita e Vinculada' : 'Aceitar como Cotação Oficial'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseModal>
  );
};
