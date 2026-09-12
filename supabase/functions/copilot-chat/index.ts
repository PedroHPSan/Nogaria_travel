// Copiloto IA da web app (AiCopilotView). Reaproveita a mesma infraestrutura
// do bot do WhatsApp (_shared/gemini.ts + _shared/tripTools.ts), mas com um
// subconjunto de tools e um client com RLS (via JWT do usuário), diferente
// do service role do webhook — aqui não há telefone, então a autorização por
// tenant/trip vem inteiramente de is_tenant_member/is_trip_member.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { chatWithTools, resolveGeminiModel, type ChatMessage } from '../_shared/gemini.ts';
import { estimateCostUsd } from '../_shared/aiPricing.ts';
import { createToolExecutor, TOOL_DECLARATIONS } from '../_shared/tripTools.ts';
import type { ParticipantRow } from '../_shared/tripContext.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY = 10;

// Subconjunto seguro pro Copiloto web: sem get_directions/save_trip_idea/
// list_trip_ideas (dependem de localização e telefone compartilhados via
// WhatsApp) e sem reschedule_itinerary_item/set_activity_reminder (o fan-out
// de reschedule notifica via WhatsApp — fora do escopo desta issue #26).
const WEB_TOOL_NAMES = new Set(['get_itinerary', 'get_tasks', 'get_flight_info', 'mark_itinerary_item_done', 'complete_task']);
const WEB_TOOLS = TOOL_DECLARATIONS.filter(t => WEB_TOOL_NAMES.has(t.name));

interface TripRow {
  id: string;
  tenant_id: string;
  title: string;
  destination_main: string;
  start_date: string;
  end_date: string;
  currency_base: string;
}

function buildWebSystemPrompt(trip: TripRow, participants: ParticipantRow[]): string {
  const roster = participants.map(p => `${p.nickname ?? p.full_name}${p.is_minor ? ' [menor]' : ''}`).join(', ');
  return [
    'Você é o Copiloto de IA da Plataforma de Viagens, um assistente que responde perguntas sobre uma viagem específica com acesso aos dados reais dela.',
    'Responda sempre em português (pt-BR), de forma direta e objetiva.',
    `Viagem ativa: "${trip.title}" para ${trip.destination_main}, de ${trip.start_date} a ${trip.end_date}. Moeda base: ${trip.currency_base}.`,
    `Participantes: ${roster || 'não cadastrados'}.`,
    '- Use as ferramentas disponíveis (roteiro, tarefas, voos) para consultar dados reais antes de responder. Nunca invente horários, preços ou reservas.',
    '- mark_itinerary_item_done e complete_task têm confirmação em duas etapas: a primeira chamada (sem confirm) só valida e devolve um resumo em "preview" — mostre esse resumo ao usuário e espere confirmação explícita numa mensagem seguinte antes de chamar a MESMA ferramenta de novo com confirm=true.',
    '- Compras, gift cards e orçamento não têm ferramenta aqui: responda em 1-2 frases dizendo que esse relatório é consultado nas telas do app, sem tentar calcular ou estimar nada.',
    '- Se a pergunta não for sobre a viagem, responda brevemente e redirecione de forma leve para o assunto da viagem.',
  ].join('\n');
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Método não suportado.' }, 405);

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sessão ausente.' }, 401);

    // SUPABASE_ANON_KEY é o nome legado auto-injetado; SUPABASE_PUBLISHABLE_KEY é o
    // atual usado no resto do projeto. Mesmo fallback do price-research.
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
    const body = rawBody as Record<string, unknown>;

    const tripId = body.trip_id;
    if (typeof tripId !== 'string' || !tripId) {
      return json({ error: 'Requisição incompleta: trip_id ausente.' }, 400);
    }
    const message = body.message;
    if (typeof message !== 'string' || !message.trim()) {
      return json({ error: 'Requisição incompleta: message ausente.' }, 400);
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return json({ error: `message excede o limite de ${MAX_MESSAGE_CHARS} caracteres.` }, 400);
    }

    const historyRaw = Array.isArray(body.history) ? body.history : [];
    const history: ChatMessage[] = historyRaw
      .filter((m): m is { role: unknown; text: unknown } => typeof m === 'object' && m !== null)
      .filter(m => typeof m.text === 'string' && (m.text as string).trim())
      .slice(-MAX_HISTORY)
      .map(m => ({ role: m.role === 'user' ? 'user' as const : 'model' as const, text: String(m.text).slice(0, MAX_MESSAGE_CHARS) }));

    // RLS (is_trip_member) garante que só volta uma viagem que o usuário pode ver.
    const { data: trip } = await supabase
      .from('trips')
      .select('id, tenant_id, title, destination_main, start_date, end_date, currency_base')
      .eq('id', tripId)
      .maybeSingle();
    if (!trip) return json({ error: 'Viagem não encontrada ou sem acesso.' }, 404);

    const [participantsRes, whatsappConfigRes, aiConfigRes] = await Promise.all([
      supabase
        .from('participants')
        .select('id, full_name, nickname, is_minor, height_cm, whatsapp_phone')
        .eq('trip_id', trip.id),
      supabase.from('whatsapp_configs').select('timezone').eq('tenant_id', trip.tenant_id).maybeSingle(),
      supabase
        .from('ai_provider_configs')
        .select('model_name, temperature')
        .eq('tenant_id', trip.tenant_id)
        .eq('provider', 'gemini')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const participants = (participantsRes.data ?? []) as ParticipantRow[];
    const timeZone = whatsappConfigRes.data?.timezone ?? 'America/Sao_Paulo';
    const model = resolveGeminiModel(aiConfigRes.data?.model_name);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'GEMINI_API_KEY não configurada nas secrets do Supabase.' }, 500);

    const startedAt = Date.now();
    const { text, usage } = await chatWithTools({
      apiKey,
      model,
      temperature: Number(aiConfigRes.data?.temperature ?? 0.3),
      systemPrompt: buildWebSystemPrompt(trip, participants),
      history,
      userText: message,
      tools: WEB_TOOLS,
      executeTool: createToolExecutor({
        supabase,
        tenantId: trip.tenant_id,
        tripId: trip.id,
        todayIso: new Date().toISOString().slice(0, 10),
        participants,
        timeZone,
        // Sem telefone no web: identifica a pendência de confirmação por usuário.
        senderPhone: `web:${user.id}`,
        // Só usados por get_directions/reschedule, ambos fora do subconjunto exposto aqui.
        phoneNumberId: '',
        metaAccessToken: '',
        googleMapsApiKey: null,
      }),
    });
    const elapsed = Date.now() - startedAt;

    const cost = estimateCostUsd(model, usage.tokensIn, usage.tokensOut);
    const { error: logErr } = await supabase.from('ai_usage_logs').insert({
      tenant_id: trip.tenant_id,
      user_name: user.email ?? user.id,
      function_name: 'copilot_web',
      provider: 'gemini',
      model,
      tokens_input: usage.tokensIn,
      tokens_output: usage.tokensOut,
      estimated_cost_usd: cost,
      timestamp: new Date().toISOString(),
      latency_ms: elapsed,
      tool_rounds: usage.toolRounds,
      tools_called: usage.toolsCalled.join(','),
    });
    // A resposta já foi gerada e vai ser devolvida de qualquer forma — falha
    // de telemetria é observabilidade degradada, não motivo pra descartar
    // uma resposta que já saiu certa (mesmo racional do whatsapp-webhook).
    if (logErr) console.error(`[copilot-chat] Falha ao registrar telemetria: ${logErr.message}`);

    return json({
      text,
      usage: { tokens_in: usage.tokensIn, tokens_out: usage.tokensOut, cost_usd: cost },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, 500);
  }
});
