import React, { useEffect, useState } from 'react';
import { BaseModal } from './BaseModal';
import type { Market, PriceQuote, PurchaseItem } from '../../types/database.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (q: Omit<PriceQuote, 'id' | 'created_at' | 'is_active'>) => void;
  item: PurchaseItem | null;
  tripId: string;
}

export const PriceQuoteModal: React.FC<Props> = ({ isOpen, onClose, onSave, item, tripId }) => {
  const [market, setMarket] = useState<Market>('US');
  const [storeName, setStoreName] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [priceKind, setPriceKind] = useState<PriceQuote['price_kind']>('list');
  const [url, setUrl] = useState('');
  const [observedAt, setObservedAt] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMarket('US');
      setStoreName('');
      setPrice('');
      setPriceKind('list');
      setUrl('');
      setObservedAt(new Date().toISOString().split('T')[0]);
      setError('');
    }
  }, [isOpen]);

  if (!item) return null;

  const handleSubmit = () => {
    if (!storeName.trim()) return setError('Informe a loja.');
    if (price === '' || Number(price) <= 0) return setError('Preço deve ser maior que zero.');
    if (observedAt > new Date().toISOString().split('T')[0]) return setError('Data não pode ser futura.');

    onSave({
      trip_id: tripId,
      purchase_item_id: item.id,
      market,
      store_name: storeName.trim(),
      url: url.trim() || undefined,
      price: Number(price),
      currency: market === 'US' ? 'USD' : 'BRL',
      price_kind: priceKind,
      includes_tax: market === 'BR',
      observed_at: observedAt,
      source: 'manual',
    });
    onClose();
  };

  const field = 'w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white';

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={`Cotação — ${item.product_name}`}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['US', 'BR'] as Market[]).map(m => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                market === m ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {m === 'US' ? 'Preço EUA (sem imposto)' : 'Preço Brasil (com imposto)'}
            </button>
          ))}
        </div>

        <input className={field} placeholder="Loja" value={storeName} onChange={e => setStoreName(e.target.value)} />
        <input
          className={field}
          type="number"
          step="0.01"
          placeholder={market === 'US' ? 'Preço em US$' : 'Preço em R$'}
          value={price}
          onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
        />
        <select className={field} value={priceKind} onChange={e => setPriceKind(e.target.value as PriceQuote['price_kind'])}>
          <option value="list">Preço de tabela</option>
          <option value="promo">Promoção</option>
          <option value="used">Usado</option>
          <option value="refurbished">Recondicionado</option>
        </select>
        <input className={field} placeholder="Link (opcional)" value={url} onChange={e => setUrl(e.target.value)} />
        <input className={field} type="date" value={observedAt} onChange={e => setObservedAt(e.target.value)} />

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <button onClick={handleSubmit} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition">
          Salvar cotação
        </button>
        <p className="text-[11px] text-slate-500">
          A cotação anterior deste mercado fica arquivada, não é apagada.
        </p>
      </div>
    </BaseModal>
  );
};
