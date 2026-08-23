import type { PriceQuoteCandidate, PriceResearchRequest } from './types.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

// A response cut off by maxOutputTokens lands here without a closing '}'/']' for the
// candidates array — extractJsonText's lastIndexOf('}') then grabs the last COMPLETE
// candidate object as the string's end, leaving the outer object/array unclosed. Rather
// than discard the whole (already paid-for) response, count unmatched braces/brackets
// outside of string literals and append what's missing to close them.
function repairTruncatedJson(jsonText: string): string {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (const ch of jsonText) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']');
    } else if (ch === '}' || ch === ']') {
      stack.pop();
    }
  }

  if (stack.length === 0) return jsonText;

  // Drop a dangling trailing comma (from a candidate object that got cut off mid-field)
  // before closing out every still-open brace/bracket, innermost first.
  const withoutTrailingComma = jsonText.replace(/,\s*$/, '');
  return withoutTrailingComma + stack.reverse().join('');
}

function sanitizeCandidates(rawCandidates: unknown[], fallbackDate: string): PriceQuoteCandidate[] {
  if (!Array.isArray(rawCandidates)) return [];

  const validMarkets = new Set(['US', 'BR']);
  const validCurrencies = new Set(['USD', 'BRL']);
  const validPriceKinds = new Set(['list', 'promo', 'used', 'refurbished']);
  const validConfidences = new Set(['high', 'medium', 'low']);

  const sanitized: PriceQuoteCandidate[] = [];

  for (const item of rawCandidates) {
    if (typeof item !== 'object' || item === null) continue;
    const c = item as Record<string, unknown>;

    const market = validMarkets.has(String(c.market).toUpperCase())
      ? (String(c.market).toUpperCase() as 'US' | 'BR')
      : null;
    const storeName = typeof c.store_name === 'string' && c.store_name.trim() ? c.store_name.trim() : null;
    const rawPrice = Number(c.price);
    const price = !isNaN(rawPrice) && rawPrice > 0 ? rawPrice : null;
    const currency = validCurrencies.has(String(c.currency).toUpperCase())
      ? (String(c.currency).toUpperCase() as 'USD' | 'BRL')
      : market === 'US'
      ? 'USD'
      : 'BRL';

    if (!market || !storeName || price === null) continue;

    const priceKind = validPriceKinds.has(String(c.price_kind).toLowerCase())
      ? (String(c.price_kind).toLowerCase() as 'list' | 'promo' | 'used' | 'refurbished')
      : 'list';

    const confidence = validConfidences.has(String(c.confidence).toLowerCase())
      ? (String(c.confidence).toLowerCase() as 'high' | 'medium' | 'low')
      : 'medium';

    sanitized.push({
      market,
      store_name: storeName,
      price,
      currency,
      price_kind: priceKind,
      url: typeof c.url === 'string' && c.url.startsWith('http') ? c.url : undefined,
      observed_at: typeof c.observed_at === 'string' && c.observed_at ? c.observed_at : fallbackDate,
      confidence,
      source_note: typeof c.source_note === 'string' ? c.source_note : undefined,
    });
  }

  return sanitized;
}

export async function searchPrices(
  req: PriceResearchRequest,
  apiKey: string,
  model: string,
  temperature: number,
): Promise<{ candidates: PriceQuoteCandidate[]; tokensIn: number; tokensOut: number }> {
  const today = new Date().toISOString().split('T')[0];
  const produto = [req.brand, req.product_name, req.model_hint].filter(Boolean).join(' ');

  const destinationContext = req.destination
    ? `Localidade/Roteiro da viagem: ${req.destination}. Priorize lojas físicas, grandes varejistas e outlets conhecidos e acessíveis nessa região (ex: Apple Store em shoppings locais como Millenia/Florida Mall, Best Buy, Target, Walmart, Premium Outlets, Sawgrass Mills).`
    : 'Priorize lojas oficiais e grandes varejistas consolidados nos EUA e Brasil.';

  const prompt = [
    `Pesquise o preço atual e lojas de varejo recomendadas para: ${produto}.`,
    destinationContext,
    `Mercados: ${req.markets.join(' e ')}.`,
    `US = varejo nos Estados Unidos, preço SEM sales tax (mencione em source_note a loja/shopping/outlet sugerido na região ou condição).`,
    `BR = varejo no Brasil, preço COM impostos, em reais.`,
    `Devolva até 3 candidatos por mercado, de lojas reconhecidas e confiáveis, com a URL da fonte oficial/varejista.`,
    `Use ${today} como observed_at quando a fonte não informar a data exata.`,
    `Não invente preço: se não encontrar ofertas reais para o item, devolva a lista vazia.`,
    '',
    'IMPORTANTE: Responda EXCLUSIVAMENTE em formato JSON (sem markdown adicional, sem texto explicativo antes ou depois) no seguinte formato:',
    '{',
    '  "candidates": [',
    '    {',
    '      "market": "US" ou "BR",',
    '      "store_name": "Nome da Loja (ex: Apple Store Millenia, Best Buy Florida Mall, Target)",',
    '      "price": 999.99,',
    '      "currency": "USD" ou "BRL",',
    '      "price_kind": "list" ou "promo" ou "used" ou "refurbished",',
    '      "url": "https://...",',
    '      "observed_at": "YYYY-MM-DD",',
    '      "confidence": "high" ou "medium" ou "low",',
    '      "source_note": "Dica de compra local ou observação da loja"',
    '    }',
    '  ]',
    '}',
  ].join('\n');

  const response = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`[price-research] Gemini API respondeu ${response.status}: ${detail}`);
    throw new Error('Falha ao consultar o serviço de pesquisa de preços. Tente novamente mais tarde.');
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"candidates":[]}';

  const jsonText = extractJsonText(text);
  let parsed: { candidates?: unknown[] };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Most commonly a maxOutputTokens cutoff mid-array rather than a malformed response —
    // try recovering the candidates that did arrive complete before giving up entirely.
    try {
      parsed = JSON.parse(repairTruncatedJson(jsonText));
      console.warn(
        `[price-research] Resposta do Gemini truncada, recuperada via repairTruncatedJson (finishReason: ${data?.candidates?.[0]?.finishReason ?? 'desconhecido'})`,
      );
    } catch {
      console.error(`[price-research] Resposta do Gemini não é JSON válido: ${text.slice(0, 500)}`);
      throw new Error('O serviço de pesquisa de preços retornou uma resposta inválida. Tente novamente.');
    }
  }

  const sanitized = sanitizeCandidates(parsed.candidates ?? [], today);

  return {
    candidates: sanitized,
    tokensIn: data?.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
