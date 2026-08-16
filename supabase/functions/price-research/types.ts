export interface PriceResearchRequest {
  trip_id: string;
  purchase_item_id: string;
  product_name: string;
  brand?: string;
  model_hint?: string;
  destination?: string;
  markets: Array<'US' | 'BR'>;
}

export interface PriceQuoteCandidate {
  market: 'US' | 'BR';
  store_name: string;
  price: number;
  currency: 'USD' | 'BRL';
  price_kind: 'list' | 'promo' | 'used' | 'refurbished';
  url?: string;
  observed_at: string;
  confidence: 'high' | 'medium' | 'low';
  source_note?: string;
}

export interface PriceResearchResponse {
  candidates: PriceQuoteCandidate[];
  usage: { tokens_in: number; tokens_out: number; cost_usd: number };
}

// Bounds enforced on every incoming request before any Gemini call is made.
export const MAX_PRODUCT_NAME_LENGTH = 200;
export const MAX_BRAND_LENGTH = 100;
export const MAX_MODEL_HINT_LENGTH = 100;
export const MAX_DESTINATION_LENGTH = 120;

// Only 'US' and 'BR' are valid markets today, so the request can never legitimately need
// more than one of each — this also caps how many market segments the prompt fans out to.
export const ALLOWED_MARKETS = ['US', 'BR'] as const;
export const MAX_MARKETS = ALLOWED_MARKETS.length;

// Free Tier Protections & Hard Caps
export const DEFAULT_FREE_TIER_DAILY_REQUESTS = 100;
export const DEFAULT_FREE_TIER_RPM_LIMIT = 8;
export const DEFAULT_FREE_TIER_DAILY_TOKENS = 50_000;
export const DEFAULT_AI_MODEL = 'gemini-3.5-flash';


