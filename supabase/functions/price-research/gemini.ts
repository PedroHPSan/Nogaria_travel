import type { PriceQuoteCandidate, PriceResearchRequest } from './types.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          market: { type: 'string', enum: ['US', 'BR'] },
          store_name: { type: 'string' },
          price: { type: 'number' },
          currency: { type: 'string', enum: ['USD', 'BRL'] },
          price_kind: { type: 'string', enum: ['list', 'promo', 'used', 'refurbished'] },
          url: { type: 'string' },
          observed_at: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          source_note: { type: 'string' },
        },
        required: ['market', 'store_name', 'price', 'currency', 'price_kind', 'confidence'],
      },
    },
  },
  required: ['candidates'],
};

export async function searchPrices(
  req: PriceResearchRequest,
  apiKey: string,
  model: string,
  temperature: number,
): Promise<{ candidates: PriceQuoteCandidate[]; tokensIn: number; tokensOut: number }> {
  const today = new Date().toISOString().split('T')[0];
  const produto = [req.brand, req.product_name, req.model_hint].filter(Boolean).join(' ');

  const prompt = [
    `Pesquise o preço atual de: ${produto}.`,
    `Mercados: ${req.markets.join(' e ')}. US = varejo nos Estados Unidos, preço SEM sales tax.`,
    `BR = varejo no Brasil, preço COM impostos, em reais.`,
    `Devolva até 3 candidatos por mercado, de lojas reconhecidas, com a URL da fonte.`,
    `Use ${today} como observed_at quando a fonte não informar a data.`,
    `Não invente preço: se não encontrar, devolva a lista vazia.`,
  ].join('\n');

  const response = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini respondeu ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"candidates":[]}';

  let parsed: { candidates?: PriceQuoteCandidate[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Resposta do Gemini não é JSON válido: ${text.slice(0, 200)}`);
  }

  return {
    candidates: (parsed.candidates ?? []).map(c => ({ ...c, observed_at: c.observed_at || today })),
    tokensIn: data?.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
