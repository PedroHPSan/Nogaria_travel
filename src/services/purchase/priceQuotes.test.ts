import { describe, expect, it } from 'vitest';
import type { PriceQuote } from '../../types/database.types';
import { activeQuote, priceTrend, quoteAgeDays, supersede } from './priceQuotes';

function quote(overrides: Partial<PriceQuote>): PriceQuote {
  return {
    id: 'q1',
    trip_id: 'trip-1',
    purchase_item_id: 'item-1',
    market: 'US',
    store_name: 'Apple Store',
    price: 1399,
    currency: 'USD',
    price_kind: 'list',
    includes_tax: false,
    observed_at: '2026-07-20',
    source: 'manual',
    is_active: true,
    created_at: '2026-07-20T10:00:00Z',
    ...overrides,
  };
}

describe('activeQuote', () => {
  it('devolve a cotação ativa do mercado pedido', () => {
    const quotes = [
      quote({ id: 'a', market: 'US' }),
      quote({ id: 'b', market: 'BR', price: 11499, currency: 'BRL' }),
    ];
    expect(activeQuote(quotes, 'item-1', 'US')?.id).toBe('a');
    expect(activeQuote(quotes, 'item-1', 'BR')?.id).toBe('b');
  });

  it('ignora cotações inativas', () => {
    const quotes = [quote({ id: 'a', is_active: false })];
    expect(activeQuote(quotes, 'item-1', 'US')).toBeUndefined();
  });

  it('ignora cotações de outro item', () => {
    const quotes = [quote({ id: 'a', purchase_item_id: 'item-2' })];
    expect(activeQuote(quotes, 'item-1', 'US')).toBeUndefined();
  });
});

describe('supersede', () => {
  it('desativa a anterior e aponta para a nova, sem apagar nada', () => {
    const antiga = quote({ id: 'a', price: 1399 });
    const nova = quote({ id: 'b', price: 1299, observed_at: '2026-07-25' });

    const result = supersede([antiga], nova);

    expect(result).toHaveLength(2);
    const anterior = result.find(q => q.id === 'a');
    expect(anterior?.is_active).toBe(false);
    expect(anterior?.superseded_by_id).toBe('b');
    expect(result.find(q => q.id === 'b')?.is_active).toBe(true);
  });

  it('não mexe em cotações de outro mercado', () => {
    const brl = quote({ id: 'br', market: 'BR', price: 11499, currency: 'BRL' });
    const nova = quote({ id: 'b', market: 'US' });

    const result = supersede([brl], nova);

    expect(result.find(q => q.id === 'br')?.is_active).toBe(true);
  });
});

describe('quoteAgeDays', () => {
  it('conta a diferença em dias', () => {
    expect(quoteAgeDays('2026-07-20', '2026-07-26')).toBe(6);
    expect(quoteAgeDays('2026-07-26', '2026-07-26')).toBe(0);
  });

  it('não devolve idade negativa para data futura', () => {
    expect(quoteAgeDays('2026-08-01', '2026-07-26')).toBe(0);
  });
});

describe('priceTrend', () => {
  it('mede a queda percentual dentro da janela', () => {
    const quotes = [
      quote({ id: 'a', price: 1500, observed_at: '2026-07-01', is_active: false }),
      quote({ id: 'b', price: 1350, observed_at: '2026-07-25' }),
    ];
    const trend = priceTrend(quotes, 'item-1', 'US', '2026-07-26', 45);
    expect(trend.dropPct).toBeCloseTo(10, 5);
    expect(trend.samples).toBe(2);
  });

  it('devolve queda negativa quando o preço subiu', () => {
    const quotes = [
      quote({ id: 'a', price: 1000, observed_at: '2026-07-01', is_active: false }),
      quote({ id: 'b', price: 1100, observed_at: '2026-07-25' }),
    ];
    expect(priceTrend(quotes, 'item-1', 'US', '2026-07-26', 45).dropPct).toBeCloseTo(-10, 5);
  });

  it('ignora cotações fora da janela', () => {
    const quotes = [
      quote({ id: 'a', price: 1500, observed_at: '2026-01-01', is_active: false }),
      quote({ id: 'b', price: 1350, observed_at: '2026-07-25' }),
    ];
    const trend = priceTrend(quotes, 'item-1', 'US', '2026-07-26', 45);
    expect(trend.samples).toBe(1);
    expect(trend.dropPct).toBe(0);
  });

  it('devolve zero quando não há amostra', () => {
    expect(priceTrend([], 'item-1', 'US', '2026-07-26', 45)).toEqual({ dropPct: 0, samples: 0 });
  });
});
