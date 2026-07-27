import type { Market, PriceQuote } from '../../types/database.types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** A cotação vigente de um item num mercado. */
export function activeQuote(
  quotes: PriceQuote[],
  itemId: string,
  market: Market,
): PriceQuote | undefined {
  return quotes.find(q => q.purchase_item_id === itemId && q.market === market && q.is_active);
}

/**
 * Registra uma cotação nova sem apagar a anterior (RN-16): a antiga vira
 * inativa e passa a apontar para quem a substituiu.
 */
export function supersede(quotes: PriceQuote[], incoming: PriceQuote): PriceQuote[] {
  const updated = quotes.map(q =>
    q.purchase_item_id === incoming.purchase_item_id &&
    q.market === incoming.market &&
    q.is_active
      ? { ...q, is_active: false, superseded_by_id: incoming.id }
      : q,
  );
  return [...updated, { ...incoming, is_active: true }];
}

/** Idade da cotação em dias inteiros. Datas futuras contam como zero. */
export function quoteAgeDays(observedAt: string, today: string): number {
  const diff = Date.parse(today) - Date.parse(observedAt);
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Tendência de preço na janela. dropPct positivo significa queda.
 * Considera cotações ativas e superadas — a série inteira é o histórico.
 */
export function priceTrend(
  quotes: PriceQuote[],
  itemId: string,
  market: Market,
  today: string,
  windowDays: number,
): { dropPct: number; samples: number } {
  const window = quotes
    .filter(
      q =>
        q.purchase_item_id === itemId &&
        q.market === market &&
        quoteAgeDays(q.observed_at, today) <= windowDays,
    )
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));

  if (window.length < 2) {
    return { dropPct: 0, samples: window.length };
  }

  const first = window[0].price;
  const last = window[window.length - 1].price;
  if (first <= 0) {
    return { dropPct: 0, samples: window.length };
  }

  return { dropPct: ((first - last) / first) * 100, samples: window.length };
}
