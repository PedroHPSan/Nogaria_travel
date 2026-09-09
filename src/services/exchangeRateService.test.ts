// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchLiveExchangeRate,
  fetchStoredExchangeRate,
  cardEffectiveRate,
  convertCurrency,
  formatCurrencyValue,
  setCachedRate,
  type ExchangeRateClient,
} from './exchangeRateService';

const today = () => new Date().toISOString().slice(0, 10);

function fakeClient(rows: unknown[] | null, error: { message: string } | null = null): ExchangeRateClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: rows, error }),
          }),
        }),
      }),
    }),
  };
}

describe('exchangeRateService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('converte moeda corretamente', () => {
    expect(convertCurrency(100, 'USD')).toBe(100);
    expect(convertCurrency(100, 'BRL', 5.5)).toBe(550);
  });

  it('formata moeda para USD e BRL', () => {
    expect(formatCurrencyValue(100, 'USD')).toContain('US$');
    expect(formatCurrencyValue(100, 'BRL', 5.0)).toContain('R$');
  });

  it('usa cache local se válido', async () => {
    setCachedRate(5.80, '2026-08-16');
    const rate = await fetchLiveExchangeRate();
    expect(rate.rate).toBe(5.80);
    expect(rate.source).toBe('cache');
  });

  it('faz fetch da API de mercado se não houver cache nem cliente', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ USDBRL: { bid: '5.6789' } }),
    } as Response);

    const rate = await fetchLiveExchangeRate();
    expect(rate.rate).toBe(5.6789);
    expect(rate.source).toBe('market');
  });

  it('usa fallback se a API falhar', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const rate = await fetchLiveExchangeRate(5.62);
    expect(rate.rate).toBe(5.62);
    expect(rate.source).toBe('default');
  });

  describe('PTAX na tabela exchange_rates (#32)', () => {
    it('prefere a PTAX gravada à API de mercado', async () => {
      global.fetch = vi.fn();
      const rate = await fetchLiveExchangeRate(5.62, fakeClient([{ date: today(), rate: '5.4106' }]));
      expect(rate).toMatchObject({ rate: 5.4106, source: 'ptax', lastUpdated: today() });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('PTAX de até 7 dias atrás ainda vale (feriado prolongado)', async () => {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - 5);
      const stored = await fetchStoredExchangeRate(fakeClient([{ date: d.toISOString().slice(0, 10), rate: 5.3 }]));
      expect(stored?.rate).toBe(5.3);
    });

    it('PTAX velha demais é descartada e cai no mercado', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ USDBRL: { bid: '5.70' } }) } as Response);
      const rate = await fetchLiveExchangeRate(5.62, fakeClient([{ date: '2020-01-01', rate: 4.0 }]));
      expect(rate).toMatchObject({ rate: 5.7, source: 'market' });
    });

    it('tabela vazia, erro ou linha malformada devolvem null sem lançar', async () => {
      expect(await fetchStoredExchangeRate(fakeClient([]))).toBeNull();
      expect(await fetchStoredExchangeRate(fakeClient(null, { message: 'relation does not exist' }))).toBeNull();
      expect(await fetchStoredExchangeRate(fakeClient([{ date: today(), rate: 'abc' }]))).toBeNull();
      expect(await fetchStoredExchangeRate(fakeClient([{ date: 'ontem', rate: 5 }]))).toBeNull();
    });
  });

  it('custo real no cartão soma IOF (3,5%) e spread do emissor', () => {
    expect(cardEffectiveRate(5.0)).toBe(5.175);
    expect(cardEffectiveRate(5.0, 0.04)).toBe(5.375);
  });
});
