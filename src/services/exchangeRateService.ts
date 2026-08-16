import type { Currency } from '../types/database.types';

export interface ExchangeRateInfo {
  rate: number;
  base: string;
  target: string;
  lastUpdated: string;
}

export const DEFAULT_EXCHANGE_RATE = 5.62;
const CACHE_KEY = 'nogaria_exchange_rate_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

export function getTodayExchangeRate(): ExchangeRateInfo {
  const cached = getCachedRate();
  if (cached) return cached;

  const now = new Date();
  return {
    rate: DEFAULT_EXCHANGE_RATE,
    base: 'USD',
    target: 'BRL',
    lastUpdated: now.toISOString().split('T')[0],
  };
}

export function getCachedRate(): ExchangeRateInfo | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
    if (!raw) return null;
    const data = JSON.parse(raw) as { rate: number; timestamp: number; lastUpdated: string };
    if (Date.now() - data.timestamp < CACHE_TTL_MS && Number.isFinite(data.rate) && data.rate > 0) {
      return {
        rate: data.rate,
        base: 'USD',
        target: 'BRL',
        lastUpdated: data.lastUpdated,
      };
    }
  } catch {
    // Falha silenciosa no cache
  }
  return null;
}

export function setCachedRate(rate: number, lastUpdated: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ rate, lastUpdated, timestamp: Date.now() }),
      );
    }
  } catch {
    // Falha silenciosa no cache
  }
}

export async function fetchLiveExchangeRate(fallbackRate: number = DEFAULT_EXCHANGE_RATE): Promise<ExchangeRateInfo> {
  const cached = getCachedRate();
  if (cached) return cached;

  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const response = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const bid = Number(data?.USDBRL?.bid);

    if (Number.isFinite(bid) && bid > 0) {
      const rounded = Number(bid.toFixed(4));
      const info: ExchangeRateInfo = {
        rate: rounded,
        base: 'USD',
        target: 'BRL',
        lastUpdated: todayStr,
      };
      setCachedRate(rounded, todayStr);
      return info;
    }
  } catch {
    // Fallback gracioso para a cotação padrão ou de fallback
  }

  return {
    rate: fallbackRate,
    base: 'USD',
    target: 'BRL',
    lastUpdated: todayStr,
  };
}

export function convertCurrency(
  amount: number,
  targetCurrency: Currency,
  exchangeRate: number = DEFAULT_EXCHANGE_RATE,
): number {
  if (targetCurrency === 'BRL') {
    return Number((amount * exchangeRate).toFixed(2));
  }
  return Number(amount.toFixed(2));
}

export function formatCurrencyValue(
  amountInUSD: number,
  targetCurrency: Currency,
  exchangeRate: number = DEFAULT_EXCHANGE_RATE,
): string {
  if (targetCurrency === 'BRL') {
    const brlValue = amountInUSD * exchangeRate;
    return `R$ ${brlValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `US$ ${amountInUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
