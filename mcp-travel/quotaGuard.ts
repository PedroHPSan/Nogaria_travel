import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.resolve(__dirname, '../.cache_mcp.json');

interface ServiceUsage {
  daily: { date: string; count: number };
  monthly: { month: string; count: number };
}

interface CacheStore {
  rapidapi: ServiceUsage;
  google: ServiceUsage;
  entries: Record<string, { timestamp: number; data: unknown }>;
}

// Strict Free Tier Limits (Garantia de Custo Zero)
const LIMITS = {
  rapidapi: {
    maxDaily: 20, // Free tier max 500/mês
    maxMonthly: 450,
  },
  google: {
    maxDaily: 50, // Google Places $200/mês (~5.000 requisições livres)
    maxMonthly: 1000,
  },
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days cache to maximize reuse

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function loadCache(): CacheStore {
  const today = getTodayString();
  const month = getMonthString();

  const defaultUsage = (): ServiceUsage => ({
    daily: { date: today, count: 0 },
    monthly: { month, count: 0 },
  });

  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);

      return {
        rapidapi: parsed.rapidapi || defaultUsage(),
        google: parsed.google || defaultUsage(),
        entries: parsed.entries || {},
      };
    }
  } catch {
    // Ignore error
  }

  return {
    rapidapi: defaultUsage(),
    google: defaultUsage(),
    entries: {},
  };
}

function saveCache(store: CacheStore): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Falha ao salvar cache MCP:', err);
  }
}

export function getCachedData<T>(key: string): T | null {
  const store = loadCache();
  const entry = store.entries[key];
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    return null;
  }

  return entry.data as T;
}

export function setCachedData<T>(key: string, data: T): void {
  const store = loadCache();
  store.entries[key] = {
    timestamp: Date.now(),
    data,
  };
  saveCache(store);
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  remainingDaily: number;
  remainingMonthly: number;
  dailyCount: number;
  monthlyCount: number;
}

export function checkAndIncrementQuota(service: 'rapidapi' | 'google'): QuotaCheckResult {
  const store = loadCache();
  const today = getTodayString();
  const month = getMonthString();
  const limit = LIMITS[service];
  const usage = store[service];

  // Reset daily if date changed
  if (usage.daily.date !== today) {
    usage.daily = { date: today, count: 0 };
  }

  // Reset monthly if month changed
  if (usage.monthly.month !== month) {
    usage.monthly = { month, count: 0 };
  }

  // Check monthly limit
  if (usage.monthly.count >= limit.maxMonthly) {
    return {
      allowed: false,
      reason: `Limite mensal de Free Tier atingido para ${service} (${usage.monthly.count}/${limit.maxMonthly} requisições no mês).`,
      remainingDaily: 0,
      remainingMonthly: 0,
      dailyCount: usage.daily.count,
      monthlyCount: usage.monthly.count,
    };
  }

  // Check daily limit
  if (usage.daily.count >= limit.maxDaily) {
    return {
      allowed: false,
      reason: `Limite diário de Free Tier atingido para ${service} (${usage.daily.count}/${limit.maxDaily} requisições hoje).`,
      remainingDaily: 0,
      remainingMonthly: limit.maxMonthly - usage.monthly.count,
      dailyCount: usage.daily.count,
      monthlyCount: usage.monthly.count,
    };
  }

  // Increment counters
  usage.daily.count += 1;
  usage.monthly.count += 1;
  saveCache(store);

  return {
    allowed: true,
    remainingDaily: limit.maxDaily - usage.daily.count,
    remainingMonthly: limit.maxMonthly - usage.monthly.count,
    dailyCount: usage.daily.count,
    monthlyCount: usage.monthly.count,
  };
}
