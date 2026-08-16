import { createClient } from 'jsr:@supabase/supabase-js@2';
import { searchPrices } from './gemini.ts';
import {
  ALLOWED_MARKETS,
  DEFAULT_AI_MODEL,
  DEFAULT_FREE_TIER_DAILY_REQUESTS,
  DEFAULT_FREE_TIER_DAILY_TOKENS,
  DEFAULT_FREE_TIER_RPM_LIMIT,
  MAX_BRAND_LENGTH,
  MAX_MARKETS,
  MAX_MODEL_HINT_LENGTH,
  MAX_PRODUCT_NAME_LENGTH,
} from './types.ts';
import type { PriceResearchRequest } from './types.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// Runtime validation of the request body. The 'US'|'BR' union in PriceResearchRequest is a
// TypeScript-only guarantee that erases at runtime — an untrusted caller can send any JSON
// shape, so every field consumed downstream (especially anything interpolated into the
// Gemini prompt) must be re-checked here. Returns a pt-BR message naming the violation, or
// null if the body is valid.
function validateRequestBody(raw: unknown): { error: string } | { body: PriceResearchRequest } {
  if (typeof raw !== 'object' || raw === null) {
    return { error: 'Requisição incompleta.' };
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.trip_id !== 'string' || !body.trip_id) {
    return { error: 'Requisição incompleta: trip_id ausente.' };
  }
  if (typeof body.product_name !== 'string' || !body.product_name) {
    return { error: 'Requisição incompleta: product_name ausente.' };
  }
  if (body.product_name.length > MAX_PRODUCT_NAME_LENGTH) {
    return { error: `product_name excede o limite de ${MAX_PRODUCT_NAME_LENGTH} caracteres.` };
  }
  if (body.brand !== undefined) {
    if (typeof body.brand !== 'string' || body.brand.length > MAX_BRAND_LENGTH) {
      return { error: `brand excede o limite de ${MAX_BRAND_LENGTH} caracteres.` };
    }
  }
  if (body.model_hint !== undefined) {
    if (typeof body.model_hint !== 'string' || body.model_hint.length > MAX_MODEL_HINT_LENGTH) {
      return { error: `model_hint excede o limite de ${MAX_MODEL_HINT_LENGTH} caracteres.` };
    }
  }
  if (!Array.isArray(body.markets) || body.markets.length === 0) {
    return { error: 'Requisição incompleta: markets ausente.' };
  }
  if (body.markets.length > MAX_MARKETS) {
    return { error: `markets excede o número de mercados suportados (máximo ${MAX_MARKETS}).` };
  }
  if (new Set(body.markets).size !== body.markets.length) {
    return { error: 'markets contém valores duplicados.' };
  }
  for (const market of body.markets) {
    if (typeof market !== 'string' || !(ALLOWED_MARKETS as readonly string[]).includes(market)) {
      return { error: `Mercado inválido: "${String(market)}". Mercados suportados: ${ALLOWED_MARKETS.join(', ')}.` };
    }
  }

  return { body: body as unknown as PriceResearchRequest };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sessão ausente.' }, 401);

    // SUPABASE_ANON_KEY is the legacy auto-injected name; SUPABASE_PUBLISHABLE_KEY is the
    // newer one this project uses elsewhere. Support both, fail closed if neither is set —
    // cheap insurance against a dead-on-arrival deploy after a future key-naming migration.
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    if (!supabaseAnonKey) {
      return json({ error: 'Configuração do servidor incompleta: chave anônima do Supabase ausente.' }, 500);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Sessão inválida.' }, 401);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return json({ error: 'Corpo da requisição não é um JSON válido.' }, 400);
    }

    const validated = validateRequestBody(rawBody);
    if ('error' in validated) return json({ error: validated.error }, 400);
    const body = validated.body;

    // O trip_id só é visível se o usuário for membro do tenant — a própria RLS decide.
    const { data: trip } = await supabase
      .from('trips')
      .select('id, tenant_id')
      .eq('id', body.trip_id)
      .maybeSingle();
    if (!trip) return json({ error: 'Viagem não encontrada ou sem acesso.' }, 403);

    const { data: config } = await supabase
      .from('ai_provider_configs')
      .select('*')
      .eq('tenant_id', trip.tenant_id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();

    const modelName = config?.model_name || DEFAULT_AI_MODEL;
    const modelTemperature = Number(config?.temperature ?? 0.2);
    const dailyTokenLimit = config?.daily_token_limit ?? DEFAULT_FREE_TIER_DAILY_TOKENS;
    const monthlyBudgetUsd = config?.monthly_budget_usd ? Number(config.monthly_budget_usd) : null;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const monthStart = `${today.slice(0, 7)}-01`;
    const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString();

    const { data: usage } = await supabase
      .from('ai_usage_logs')
      .select('tokens_input, tokens_output, estimated_cost_usd, timestamp')
      .eq('tenant_id', trip.tenant_id)
      .gte('timestamp', monthStart);

    const rows = usage ?? [];

    // 1. Guardrail de RPM (Proteção contra estouro de requisições por minuto do Free Tier)
    const requestsLastMinute = rows.filter(r => String(r.timestamp) >= oneMinuteAgo).length;
    if (requestsLastMinute >= DEFAULT_FREE_TIER_RPM_LIMIT) {
      return json(
        { error: 'Muitas pesquisas em sequência. Aguarde alguns segundos para respeitar o limite gratuito.' },
        429,
      );
    }

    // 2. Guardrail de RPD (Proteção contra estouro de requisições por dia)
    const rowsHoje = rows.filter(r => String(r.timestamp).startsWith(today));
    if (rowsHoje.length >= DEFAULT_FREE_TIER_DAILY_REQUESTS) {
      return json(
        { error: `Limite diário de ${DEFAULT_FREE_TIER_DAILY_REQUESTS} pesquisas gratuitas atingido. Reseta amanhã.` },
        429,
      );
    }

    // 3. Guardrail de Tokens Diários
    const tokensHoje = rowsHoje.reduce((s, r) => s + (r.tokens_input ?? 0) + (r.tokens_output ?? 0), 0);
    if (tokensHoje >= dailyTokenLimit) {
      return json(
        { error: `Limite diário de ${dailyTokenLimit.toLocaleString()} tokens atingido. Reseta amanhã.` },
        429,
      );
    }

    // 4. Guardrail de Orçamento Mensal
    const custoMes = rows.reduce((s, r) => s + Number(r.estimated_cost_usd ?? 0), 0);
    if (monthlyBudgetUsd !== null && custoMes >= monthlyBudgetUsd) {
      return json(
        { error: `Orçamento mensal de US$ ${monthlyBudgetUsd.toFixed(2)} esgotado. Reseta no dia 1º.` },
        429,
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'GEMINI_API_KEY não configurada nas secrets do Supabase.' }, 500);

    const started = Date.now();
    const result = await searchPrices(body, apiKey, modelName, modelTemperature);
    const elapsed = Date.now() - started;

    // Gemini Flash: US$ 0,075 por 1M de entrada, US$ 0,30 por 1M de saída.
    const cost = (result.tokensIn / 1_000_000) * 0.075 + (result.tokensOut / 1_000_000) * 0.3;

    const { error: usageInsertError } = await supabase.from('ai_usage_logs').insert({
      tenant_id: trip.tenant_id,
      user_name: user.email ?? user.id,
      function_name: 'price_research',
      provider: 'gemini',
      model: modelName,
      tokens_input: result.tokensIn,
      tokens_output: result.tokensOut,
      estimated_cost_usd: Number(cost.toFixed(6)),
      timestamp: new Date().toISOString(),
    });

    if (usageInsertError) {
      // The daily-token and monthly-budget checks above derive their counters entirely by
      // re-reading this table, so a silently failed insert switches off the only guardrail
      // against runaway spend. The Gemini call has already happened and cost money by this
      // point, so we still return the (already-paid-for) candidates — discarding them would
      // waste the spend without fixing the accounting gap — but we log the failure server-side
      // and tell the caller usage accounting is degraded via `usage.logged`.
      console.error(
        `[price-research] Falha ao registrar uso em ai_usage_logs (tenant ${trip.tenant_id}): ${usageInsertError.message}`,
      );
    }

    return json({
      candidates: result.candidates,
      usage: {
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        cost_usd: Number(cost.toFixed(6)),
        elapsed_ms: elapsed,
        logged: !usageInsertError,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, 500);
  }
});
