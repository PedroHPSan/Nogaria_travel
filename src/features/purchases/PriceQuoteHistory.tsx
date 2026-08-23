import React from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Market, PriceQuote } from '../../types/database.types';

interface Props {
  quotes: PriceQuote[];
  itemId: string;
  market: Market;
}

export const PriceQuoteHistory: React.FC<Props> = ({ quotes, itemId, market }) => {
  const series = quotes
    .filter(q => q.purchase_item_id === itemId && q.market === market)
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at))
    .map(q => ({ data: q.observed_at.slice(5), preco: q.price, loja: q.store_name }));

  if (series.length < 2) {
    return <p className="text-[11px] text-ink-500">Registre ao menos duas cotações para ver a tendência.</p>;
  }

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series}>
          <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11 }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Line type="monotone" dataKey="preco" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
