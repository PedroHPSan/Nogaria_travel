import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { chatWithTools, resolveGeminiModel, type ChatMessage } from '../_shared/gemini.ts';
import { sendTextMessage } from '../_shared/whatsappClient.ts';
import { fetchTripContext, buildSystemPrompt, localDateIso } from '../_shared/tripContext.ts';
import { createToolExecutor, TOOL_DECLARATIONS } from '../_shared/tripTools.ts';

const HISTORY_LIMIT = 10;
const MAX_BODY_CHARS = 4000;

// Runtime das Edge Functions do Supabase: `waitUntil` mantém a instância viva
// depois da Response ser devolvida, permitindo responder 200 à Meta na hora e
// processar (Gemini + tools + envio) em background. Ausente em testes locais.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface IncomingMessage {
  waMessageId: string;
  from: string;
  text: string;
  phoneNumberId: string;
}

// Extrai mensagens de texto do payload do webhook da Meta. Qualquer outro tipo
// (status de entrega, mídia, reações) é ignorado propositalmente.
function extractIncomingMessages(payload: unknown): IncomingMessage[] {
  const messages: IncomingMessage[] = [];
  if (typeof payload !== 'object' || payload === null) return messages;

  const entries = (payload as Record<string, unknown>).entry;
  if (!Array.isArray(entries)) return messages;

  for (const entry of entries) {
    const changes = (entry as Record<string, unknown>).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as Record<string, unknown>).value as Record<string, unknown> | undefined;
      if (!value) continue;
      const metadata = value.metadata as Record<string, unknown> | undefined;
      const phoneNumberId = typeof metadata?.phone_number_id === 'string' ? metadata.phone_number_id : null;
      const msgs = value.messages;
      if (!phoneNumberId || !Array.isArray(msgs)) continue;

      for (const msg of msgs) {
        const m = msg as Record<string, unknown>;
        const text = (m.text as Record<string, unknown> | undefined)?.body;
        if (typeof m.id === 'string' && typeof m.from === 'string' && typeof text === 'string' && text.trim()) {
          messages.push({
            waMessageId: m.id,
            from: m.from,
            text: text.trim().slice(0, MAX_BODY_CHARS),
            phoneNumberId,
          });
        }
      }
    }
  }
  return messages;
}

async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const appSecret = Deno.env.get('META_WA_APP_SECRET');
  if (!appSecret) return true; // secret não configurado (dev local) — sem verificação
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  return expected === signatureHeader.slice('sha256='.length);
}

// Histórico recente da conversa com este telefone. A mensagem atual já foi
// gravada antes desta consulta (é o que garante a idempotência), então ela é
// excluída aqui — senão iria ao modelo duas vezes seguidas como turno do usuário.
async function loadHistory(
  supabase: SupabaseClient,
  tenantId: string,
  phone: string,
  currentWaMessageId: string,
): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('direction, body, wa_message_id')
    .eq('tenant_id', tenantId)
    .eq('sender_phone', phone)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT + 1);

  return (data ?? [])
    .filter(m => m.wa_message_id !== currentWaMessageId)
    .slice(0, HISTORY_LIMIT)
    .reverse()
    .map(m => ({ role: m.direction === 'inbound' ? 'user' as const : 'model' as const, text: m.body }));
}

async function handleMessage(supabase: SupabaseClient, msg: IncomingMessage): Promise<string> {
  // Idempotência: Meta reenvia webhooks; wa_message_id é unique no banco.
  const { data: config } = await supabase
    .from('whatsapp_configs')
    .select('tenant_id, timezone, enabled')
    .eq('phone_number_id', msg.phoneNumberId)
    .maybeSingle();
  if (!config || !config.enabled) return 'ignored:no-config';

  const { error: insertErr } = await supabase.from('whatsapp_messages').insert({
    tenant_id: config.tenant_id,
    wa_message_id: msg.waMessageId,
    direction: 'inbound',
    sender_phone: msg.from,
    body: msg.text,
  });
  if (insertErr?.code === '23505') return 'ignored:duplicate';
  if (insertErr) throw new Error(`Falha ao registrar mensagem: ${insertErr.message}`);

  const todayIso = localDateIso(new Date(), config.timezone);
  const ctx = await fetchTripContext(supabase, config.tenant_id, todayIso);
  if (!ctx.trip) {
    const reply = 'Nenhuma viagem ativa encontrada. Cadastre uma viagem na plataforma para eu poder ajudar! 🧳';
    await sendTextMessage({
      phoneNumberId: msg.phoneNumberId,
      accessToken: Deno.env.get('META_WA_TOKEN') ?? '',
      to: msg.from,
      text: reply,
    });
    return 'replied:no-trip';
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada nas secrets do Supabase.');

  // Só configs do Gemini: o Copiloto permite provedores OpenAI/Claude/DeepSeek
  // com is_active, e o nome desses modelos não existe na API do Gemini.
  const { data: aiConfig } = await supabase
    .from('ai_provider_configs')
    .select('model_name, temperature')
    .eq('tenant_id', config.tenant_id)
    .eq('provider', 'gemini')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();
  const model = resolveGeminiModel(aiConfig?.model_name);

  const history = await loadHistory(supabase, config.tenant_id, msg.from, msg.waMessageId);
  const { text, usage } = await chatWithTools({
    apiKey,
    model,
    temperature: Number(aiConfig?.temperature ?? 0.4),
    systemPrompt: buildSystemPrompt(ctx, todayIso),
    history,
    userText: msg.text,
    tools: TOOL_DECLARATIONS,
    executeTool: createToolExecutor({
      supabase,
      tripId: ctx.trip.id,
      todayIso,
      participants: ctx.participants,
    }),
  });

  const sent = await sendTextMessage({
    phoneNumberId: msg.phoneNumberId,
    accessToken: Deno.env.get('META_WA_TOKEN') ?? '',
    to: msg.from,
    text,
  });

  await supabase.from('whatsapp_messages').insert({
    tenant_id: config.tenant_id,
    wa_message_id: sent.waMessageId,
    direction: 'outbound',
    sender_phone: msg.from,
    body: text,
  });

  // Mesmo modelo de custo do price-research (Gemini Flash).
  const cost = (usage.tokensIn / 1_000_000) * 0.075 + (usage.tokensOut / 1_000_000) * 0.3;
  await supabase.from('ai_usage_logs').insert({
    tenant_id: config.tenant_id,
    user_name: msg.from,
    function_name: 'whatsapp_bot',
    provider: 'gemini',
    model,
    tokens_input: usage.tokensIn,
    tokens_output: usage.tokensOut,
    estimated_cost_usd: Number(cost.toFixed(6)),
    timestamp: new Date().toISOString(),
  });

  return 'replied';
}

Deno.serve(async request => {
  // Verificação do webhook pelo painel da Meta.
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === Deno.env.get('META_WA_VERIFY_TOKEN') && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (request.method !== 'POST') return json({ error: 'Método não suportado.' }, 405);

  const rawBody = await request.text();
  if (!(await verifySignature(rawBody, request.headers.get('X-Hub-Signature-256')))) {
    // Sem este log, um App Secret rotacionado na Meta vira "silêncio total" no bot.
    console.warn('[whatsapp-webhook] Assinatura X-Hub-Signature-256 inválida ou ausente — confira META_WA_APP_SECRET.');
    return json({ error: 'Assinatura inválida.' }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Payload não é um JSON válido.' }, 400);
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return json({ error: 'Service role key ausente no servidor.' }, 500);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  const messages = extractIncomingMessages(payload);
  if (messages.length === 0) return json({ accepted: 0 });

  // A Meta exige 200 rápido (senão reenvia o evento e, com falhas repetidas,
  // desativa a assinatura do webhook). Gemini com thinking + tools + envio leva
  // dezenas de segundos, então o processamento roda depois da Response.
  const processing = processMessages(supabase, messages);
  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(processing);
    return json({ accepted: messages.length });
  }
  return json({ accepted: messages.length, results: await processing });
});

async function processMessages(supabase: SupabaseClient, messages: IncomingMessage[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  for (const msg of messages) {
    try {
      results[msg.waMessageId] = await handleMessage(supabase, msg);
    } catch (error) {
      // Falhas individuais ficam no log da function (Dashboard → Edge Functions → Logs).
      console.error(`[whatsapp-webhook] Falha ao processar ${msg.waMessageId}:`, error);
      results[msg.waMessageId] = 'error';
    }
    console.log(`[whatsapp-webhook] ${msg.waMessageId}: ${results[msg.waMessageId]}`);
  }
  return results;
}
