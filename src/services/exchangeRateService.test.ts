// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchLiveExchangeRate,
  convertCurrency,
  formatCurrencyValue,
  setCachedRate,
} from './exchangeRateService';

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
  });

  it('faz fetch da API se não houver cache', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ USDBRL: { bid: '5.6789' } }),
    } as Response);

    const rate = await fetchLiveExchangeRate();
    expect(rate.rate).toBe(5.6789);
    expect(rate.base).toBe('USD');
  });

  it('usa fallback se a API falhar', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const rate = await fetchLiveExchangeRate(5.62);
    expect(rate.rate).toBe(5.62);
  });
});
