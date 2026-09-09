import type { Currency } from '../types/database.types';

export type ExchangeRateSource = 'ptax' | 'market' | 'cache' | 'manual' | 'default';

export interface ExchangeRateInfo {
  rate: number;
  base: string;
  target: string;
  /** Data da cotação (`YYYY-MM-DD`). */
  lastUpdated: string;
  source: ExchangeRateSource;
}

/**
 * Último recurso quando não há tabela, rede nem cache. Nunca deveria ser o
 * valor exibido em produção — a issue #32 nasceu exatamente de este número
 * ter sido a fonte única por meses.
 */
export const DEFAULT_EXCHANGE_RATE = 5.62;
/** IOF sobre compras internacionais no cartão (alíquota vigente). */
export const CARD_IOF_RATE = 0.035;

const CACHE_KEY = 'nogaria_exchange_rate_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos
/** Uma PTAX mais velha que isto (feriadão + fim de semana) já não representa "hoje". */
const MAX_STORED_RATE_AGE_DAYS = 7;

const todayIso = () => new Date().toISOString().split('T')[0];

/**
 * Cliente mínimo para ler `exchange_rates` — estrutural, para o teste injetar
 * um fake sem rede. O supabase-js real satisfaz este shape.
 */
export interface ExchangeRateClient {
  from: (table: 'exchange_rates') => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, opts: { ascending: boolean }) => {
          limit: (n: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
}

export function getTodayExchangeRate(): ExchangeRateInfo {
  const cached = getCachedRate();
  if (cached) return cached;
  return { rate: DEFAULT_EXCHANGE_RATE, base: 'USD', target: 'BRL', lastUpdated: todayIso(), source: 'default' };
}

export function getCachedRate(): ExchangeRateInfo | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
    if (!raw) return null;
    const data = JSON.parse(raw) as { rate: number; timestamp: number; lastUpdated: string; source?: ExchangeRateSource };
    if (Date.now() - data.timestamp < CACHE_TTL_MS && Number.isFinite(data.rate) && data.rate > 0) {
      return { rate: data.rate, base: 'USD', target: 'BRL', lastUpdated: data.lastUpdated, source: data.source ?? 'cache' };
    }
  } catch {
    // Falha silenciosa no cache
  }
  return null;
}

export function setCachedRate(rate: number, lastUpdated: string, source: ExchangeRateSource = 'cache'): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, lastUpdated, source, timestamp: Date.now() }));
    }
  } catch {
    // Falha silenciosa no cache
  }
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/**
 * PTAX mais recente gravada em `exchange_rates` pela edge function
 * `exchange-rate-sync`. `null` se a tabela está vazia, a linha é velha demais
 * ou a consulta falhou — o chamador cai no próximo degrau.
 */
export async function fetchStoredExchangeRate(client: ExchangeRateClient): Promise<ExchangeRateInfo | null> {
  try {
    const { data, error } = await client
      .from('exchange_rates')
      .select('date, rate')
      .eq('pair', 'USD-BRL')
      .order('date', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;

    const row = data[0] as { date?: unknown; rate?: unknown };
    const rate = Number(row.rate);
    const date = typeof row.date === 'string' ? row.date.slice(0, 10) : '';
    if (!Number.isFinite(rate) || rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    if (daysBetween(date, todayIso()) > MAX_STORED_RATE_AGE_DAYS) return null;

    return { rate: Number(rate.toFixed(4)), base: 'USD', target: 'BRL', lastUpdated: date, source: 'ptax' };
  } catch {
    return null;
  }
}

/** Cotação de mercado ao vivo (AwesomeAPI). Fallback quando a PTAX não está disponível. */
export async function fetchMarketExchangeRate(): Promise<ExchangeRateInfo | null> {
  try {
    const response = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const bid = Number(data?.USDBRL?.bid);
    if (!Number.isFinite(bid) || bid <= 0) return null;
    return { rate: Number(bid.toFixed(4)), base: 'USD', target: 'BRL', lastUpdated: todayIso(), source: 'market' };
  } catch {
    return null;
  }
}

/**
 * Resolve a cotação do dia em cascata: cache (30 min) → PTAX na tabela →
 * mercado ao vivo → `fallbackRate` (normalmente a última taxa que o app
 * conhecia). A ordem é intencional: a PTAX é a referência oficial que o
 * extrato do cartão usa como base; o mercado só entra quando o cron ainda
 * não rodou (ou a tabela não existe).
 */
export async function fetchLiveExchangeRate(
  fallbackRate: number = DEFAULT_EXCHANGE_RATE,
  client?: ExchangeRateClient,
): Promise<ExchangeRateInfo> {
  const cached = getCachedRate();
  if (cached) return cached;

  const stored = client ? await fetchStoredExchangeRate(client) : null;
  if (stored) {
    setCachedRate(stored.rate, stored.lastUpdated, 'ptax');
    return stored;
  }

  const market = await fetchMarketExchangeRate();
  if (market) {
    setCachedRate(market.rate, market.lastUpdated, 'market');
    return market;
  }

  return { rate: fallbackRate, base: 'USD', target: 'BRL', lastUpdated: todayIso(), source: 'default' };
}

/**
 * "Custo real no cartão": cotação × (1 + IOF + spread do emissor). É o número
 * que a família compara com o extrato, não a PTAX seca.
 */
export function cardEffectiveRate(rate: number, issuerSpreadPct = 0): number {
  return Number((rate * (1 + CARD_IOF_RATE + issuerSpreadPct)).toFixed(4));
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
