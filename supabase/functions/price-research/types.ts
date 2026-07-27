export interface PriceResearchRequest {
  trip_id: string;
  purchase_item_id: string;
  product_name: string;
  brand?: string;
  model_hint?: string;
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
// These exist to cap the cost of a single request (see task-10 review finding 1) —
// they are independent of, and in addition to, the daily/monthly ai_usage_logs budget checks.
//
// - MAX_PRODUCT_NAME_LENGTH / MAX_BRAND_LENGTH / MAX_MODEL_HINT_LENGTH: generous for any
//   real product listing (e.g. "Apple MacBook Pro 16-inch M4 Max 48GB RAM 1TB SSD Space Black"
//   is ~65 chars; even verbose retail titles with every spec rarely exceed 150), while bounding
//   how much attacker-controlled text can be interpolated into the Gemini prompt.
export const MAX_PRODUCT_NAME_LENGTH = 200;
export const MAX_BRAND_LENGTH = 100;
export const MAX_MODEL_HINT_LENGTH = 100;

// Only 'US' and 'BR' are valid markets today, so the request can never legitimately need
// more than one of each — this also caps how many market segments the prompt fans out to.
export const ALLOWED_MARKETS = ['US', 'BR'] as const;
export const MAX_MARKETS = ALLOWED_MARKETS.length;
