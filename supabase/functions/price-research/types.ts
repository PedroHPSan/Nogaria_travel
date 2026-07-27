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
