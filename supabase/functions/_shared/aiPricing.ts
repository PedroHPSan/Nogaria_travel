// Tabela de preços da API do Gemini, em USD por 1M de tokens.
//
// Por que isto existe: o custo estava hardcoded como `0.075 / 0.30` em quatro
// lugares (whatsapp-webhook ×2, copilot-chat, price-research) — a tarifa do
// gemini-1.5-flash, nunca atualizada quando o projeto migrou para o 3.5. Com o
// 3.5-flash a US$ 1,50 / US$ 9,00, `estimated_cost_usd` saía ~20× abaixo na
// entrada e ~30× na saída, o que corrompe silenciosamente as duas coisas que
// leem esse campo: o guardrail de `monthly_budget_usd` em price-research e a
// view `tenant_monthly_ai_costs`.

export interface ModelRate {
  /** USD por 1M de tokens de entrada. */
  input: number;
  /** USD por 1M de tokens de saída. */
  output: number;
}

interface ModelPricing {
  /** Tarifa vigente até `standardFrom` (ou permanente, se não houver promoção). */
  rate: ModelRate;
  /**
   * Data ISO (UTC) em que a tarifa promocional acaba e `standard` entra.
   * Modelado aqui em vez de "arrumo depois" porque a virada é conhecida e
   * dobra o preço: sem isso, todo custo registrado a partir de 01/01/2027
   * sairia pela metade até alguém lembrar de fazer deploy de novo.
   */
  standardFrom?: string;
  standard?: ModelRate;
}

const PROMO_ENDS = '2027-01-01';

// Promoção de lançamento da geração 3.6+ vale até 31/12/2026; a partir de
// 01/01/2027 a tarifa padrão é US$ 1,50 / US$ 7,50.
const FLASH_3X_PROMO: ModelPricing = {
  rate: { input: 0.75, output: 3.75 },
  standardFrom: PROMO_ENDS,
  standard: { input: 1.5, output: 7.5 },
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gemini-3.8-flash': FLASH_3X_PROMO,
  'gemini-3.7-flash': FLASH_3X_PROMO,
  'gemini-3.6-flash': FLASH_3X_PROMO,
  // Geração anterior, sem promoção — e mais cara na saída que qualquer 3.6+.
  'gemini-3.5-flash': { rate: { input: 1.5, output: 9 } },
};

/**
 * Tarifa usada para um modelo que não está na tabela.
 *
 * `model_name` é texto livre na UI do Copiloto e `resolveGeminiModel` é
 * deliberadamente permissivo (aceita qualquer `gemini-*` novo), então um modelo
 * desconhecido é esperado, não excepcional. Escolhemos o **teto** entre as
 * tarifas conhecidas de propósito: subestimar deixa a família furar o orçamento
 * sem o guardrail disparar; superestimar só freia mais cedo. Errar para o lado
 * caro é o único erro recuperável dos dois.
 */
export const FALLBACK_RATE: ModelRate = {
  input: Math.max(...Object.values(MODEL_PRICING).map(p => Math.max(p.rate.input, p.standard?.input ?? 0))),
  output: Math.max(...Object.values(MODEL_PRICING).map(p => Math.max(p.rate.output, p.standard?.output ?? 0))),
};

/** Resolve a tarifa vigente de um modelo na data informada. */
export function rateForModel(model: string, now: Date = new Date()): ModelRate {
  const pricing = MODEL_PRICING[model.trim()];
  if (!pricing) return FALLBACK_RATE;
  if (pricing.standard && pricing.standardFrom && now.toISOString().slice(0, 10) >= pricing.standardFrom) {
    return pricing.standard;
  }
  return pricing.rate;
}

/**
 * Custo estimado em USD, já arredondado para as 6 casas que `ai_usage_logs`
 * guarda — os call sites só inserem o retorno, sem repetir `toFixed`.
 */
export function estimateCostUsd(
  model: string,
  tokensIn: number,
  tokensOut: number,
  now: Date = new Date(),
): number {
  const rate = rateForModel(model, now);
  const cost = (tokensIn / 1_000_000) * rate.input + (tokensOut / 1_000_000) * rate.output;
  return Number(cost.toFixed(6));
}
