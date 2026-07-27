import { createClient } from 'jsr:@supabase/supabase-js@2';
import { searchPrices } from './gemini.ts';
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sessão ausente.' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Sessão inválida.' }, 401);

    const body = (await request.json()) as PriceResearchRequest;
    if (!body.trip_id || !body.product_name || !body.markets?.length) {
      return json({ error: 'Requisição incompleta.' }, 400);
    }

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
    if (!config) return json({ error: 'Nenhum provedor de IA ativo configurado.' }, 400);

    const today = new Date().toISOString().split('T')[0];
    const monthStart = `${today.slice(0, 7)}-01`;

    const { data: usage } = await supabase
      .from('ai_usage_logs')
      .select('tokens_input, tokens_output, estimated_cost_usd, timestamp')
      .eq('tenant_id', trip.tenant_id)
      .gte('timestamp', monthStart);

    const rows = usage ?? [];
    const tokensHoje = rows
      .filter(r => String(r.timestamp).startsWith(today))
      .reduce((s, r) => s + (r.tokens_input ?? 0) + (r.tokens_output ?? 0), 0);
    const custoMes = rows.reduce((s, r) => s + Number(r.estimated_cost_usd ?? 0), 0);

    if (config.daily_token_limit && tokensHoje >= config.daily_token_limit) {
      return json(
        { error: `Limite diário de ${config.daily_token_limit} tokens atingido. Reseta amanhã.` },
        429,
      );
    }
    if (config.monthly_budget_usd && custoMes >= Number(config.monthly_budget_usd)) {
      return json(
        { error: `Orçamento mensal de US$ ${config.monthly_budget_usd} esgotado. Reseta no dia 1º.` },
        429,
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'GEMINI_API_KEY não configurada.' }, 500);

    const started = Date.now();
    const result = await searchPrices(body, apiKey, config.model_name, Number(config.temperature ?? 0.2));
    const elapsed = Date.now() - started;

    // Gemini Flash: US$ 0,075 por 1M de entrada, US$ 0,30 por 1M de saída.
    const cost = (result.tokensIn / 1_000_000) * 0.075 + (result.tokensOut / 1_000_000) * 0.3;

    await supabase.from('ai_usage_logs').insert({
      tenant_id: trip.tenant_id,
      user_name: user.email ?? user.id,
      function_name: 'price_research',
      provider: 'gemini',
      model: config.model_name,
      tokens_input: result.tokensIn,
      tokens_output: result.tokensOut,
      estimated_cost_usd: Number(cost.toFixed(6)),
      timestamp: new Date().toISOString(),
    });

    return json({
      candidates: result.candidates,
      usage: {
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        cost_usd: Number(cost.toFixed(6)),
        elapsed_ms: elapsed,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, 500);
  }
});
