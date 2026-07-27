import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import type { Market } from '../../types/database.types';

/**
 * Mirrors `supabase/functions/price-research/types.ts` `PriceQuoteCandidate` exactly.
 * This is untrusted data from an AI model — it is never written to state as a
 * `PriceQuote` directly. The UI must route every candidate through an explicit
 * human approval action (see `PriceResearchModal`'s `onAccept`) before it becomes one.
 */
export interface PriceQuoteCandidate {
  market: Market;
  store_name: string;
  price: number;
  currency: 'USD' | 'BRL';
  price_kind: 'list' | 'promo' | 'used' | 'refurbished';
  url?: string;
  observed_at: string;
  confidence: 'high' | 'medium' | 'low';
  source_note?: string;
}

export interface PriceResearchInput {
  trip_id: string;
  purchase_item_id: string;
  product_name: string;
  brand?: string;
  model_hint?: string;
  markets: Market[];
}

export interface PriceResearchResult {
  candidates: PriceQuoteCandidate[];
  error?: string;
}

const GENERIC_ERROR = 'Não foi possível falar com a pesquisa automática. Registre o preço manualmente.';
const NOT_DEPLOYED_ERROR = 'Pesquisa automática indisponível no momento. Registre o preço manualmente.';

// Best-effort extraction of the `{ error: string }` body the Edge Function sends on every
// documented failure (400/401/403/500/429). A 404 from a not-yet-deployed function, or any
// gateway-level failure, may not return that JSON shape at all — swallow the parse failure
// and fall back to a generic pt-BR message rather than surfacing raw text or a stack trace.
async function extractServerMessage(response: Response): Promise<string | undefined> {
  try {
    const body = await response.json();
    if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
      return (body as { error: string }).error;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Calls the `price-research` Edge Function and maps its response into candidates.
 *
 * Never returns anything shaped like a `PriceQuote` — only raw `PriceQuoteCandidate[]`,
 * which the caller must run through explicit human review before persisting.
 */
export async function researchPrices(input: PriceResearchInput): Promise<PriceResearchResult> {
  try {
    const { data, error } = await supabase.functions.invoke('price-research', { body: input });

    if (error) {
      if (error instanceof FunctionsHttpError && error.context instanceof Response) {
        const status = error.context.status;
        const message = await extractServerMessage(error.context);
        if (status === 404) {
          return { candidates: [], error: message ?? NOT_DEPLOYED_ERROR };
        }
        return { candidates: [], error: message ?? GENERIC_ERROR };
      }
      return { candidates: [], error: GENERIC_ERROR };
    }

    if (!data || !Array.isArray(data.candidates)) {
      return { candidates: [], error: GENERIC_ERROR };
    }

    return { candidates: data.candidates as PriceQuoteCandidate[] };
  } catch {
    return { candidates: [], error: GENERIC_ERROR };
  }
}
