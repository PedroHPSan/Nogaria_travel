import type { Currency } from '../types/database.types';

export interface ExchangeRateInfo {
  rate: number;
  base: string;
  target: string;
  lastUpdated: string;
}

const DEFAULT_RATE = 5.62; // Cotação atual USD/BRL

export function getTodayExchangeRate(): ExchangeRateInfo {
  const now = new Date();
  return {
    rate: DEFAULT_RATE,
    base: 'USD',
    target: 'BRL',
    lastUpdated: now.toISOString().split('T')[0]
  };
}

export function convertCurrency(
  amount: number,
  targetCurrency: Currency,
  exchangeRate: number = DEFAULT_RATE
): number {
  if (targetCurrency === 'BRL') {
    return Number((amount * exchangeRate).toFixed(2));
  }
  return Number(amount.toFixed(2));
}

export function formatCurrencyValue(
  amountInUSD: number,
  targetCurrency: Currency,
  exchangeRate: number = DEFAULT_RATE
): string {
  if (targetCurrency === 'BRL') {
    const brlValue = amountInUSD * exchangeRate;
    return `R$ ${brlValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `US$ ${amountInUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
