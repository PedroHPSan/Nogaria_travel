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

interface IncomingTextMessage {
  kind: 'text';
  waMessageId: string;
  from: string;
  text: string;
  phoneNumberId: string;
}

interface IncomingLocationMessage {
  kind: 'location';
  waMessageId: string;
  from: string;
  lat: number;
  lng: number;
  phoneNumberId: string;
}

type IncomingMessage = IncomingTextMessage | IncomingLocationMessage;

// Extrai mensagens de texto e localização do payload do webhook da Meta.
// Qualquer outro tipo (status de entrega, mídia, reações) é ignorado
// propositalmente. Localização entra aqui porque get_directions depende dela
// como origem — antes disso o webhook descartava esse tipo de mensagem.
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
        if (typeof m.id !== 'string' || typeof m.from !== 'string') continue;

        const text = (m.text as Record<string, unknown> | undefined)?.body;
        if (typeof text === 'string' && text.trim()) {
          messages.push({ kind: 'text', waMessageId: m.id, from: m.from, text: text.trim().slice(0, MAX_BODY_CHARS), phoneNumberId });
          continue;
        }

        const location = m.location as Record<string, unknown> | undefined;
        if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
          messages.push({ kind: 'location', waMessageId: m.id, from: m.from, lat: location.latitude, lng: location.longitude, phoneNumberId });
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
  // `kind = 'chat'` exclui digests e avisos automáticos: são textos longos que
  // entrariam como turnos do modelo e consumiriam a janela de contexto sem
  // serem diálogo. Serve o índice (tenant_id, sender_phone, created_at desc).
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('direction, body, wa_message_id')
    .eq('tenant_id', tenantId)
    .eq('sender_phone', phone)
    .eq('kind', 'chat')
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT + 1);

  return (data ?? [])
    .filter(m => m.wa_message_id !== currentWaMessageId)
    .slice(0, HISTORY_LIMIT)
    .reverse()
    .map(m => ({ role: m.direction === 'inbound' ? 'user' as const : 'model' as const, text: m.body }));
}

/**
 * Localização compartilhada: não passa pelo Gemini (não é uma pergunta),
 * só atualiza o cache de posição usado por get_directions como origem e
 * confirma o recebimento. Idempotente pelo mesmo unique de wa_message_id.
 */
async function handleLocationMessage(supabase: SupabaseClient, msg: IncomingLocationMessage): Promise<string> {
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
    body: '[localização compartilhada]',
    kind: 'chat',
  });
  if (insertErr?.code === '23505') return 'ignored:duplicate';
  if (insertErr) throw new Error(`Falha ao registrar localização: ${insertErr.message}`);

  const todayIso = localDateIso(new Date(), config.timezone);
  const ctx = await fetchTripContext(supabase, config.tenant_id, todayIso);
  const senderDigits = msg.from.replace(/\D/g, '');
  const sender = ctx.participants.find(p => (p.whatsapp_phone ?? '').replace(/\D/g, '') === senderDigits);

  if (sender && ctx.trip) {
    const { error: upsertErr } = await supabase.from('participant_locations').upsert(
      {
        tenant_id: config.tenant_id,
        trip_id: ctx.trip.id,
        participant_id: sender.id,
        lat: msg.lat,
        lng: msg.lng,
        shared_at: new Date().toISOString(),
      },
      { onConflict: 'participant_id' },
    );
    if (upsertErr) console.error(`[whatsapp-webhook] Falha ao salvar localização de ${msg.from}:`, upsertErr);
  }

  await sendTextMessage({
    phoneNumberId: msg.phoneNumberId,
    accessToken: Deno.env.get('META_WA_TOKEN') ?? '',
    to: msg.from,
    text: '📍 Localização recebida! Já uso ela pra calcular a rota quando você perguntar "como chego lá".',
  });

  return 'replied:location';
}

async function handleMessage(supabase: SupabaseClient, msg: IncomingTextMessage): Promise<string> {
  const startedAt = Date.now();

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
    kind: 'chat',
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
    systemPrompt: buildSystemPrompt(ctx, todayIso, config.timezone),
    history,
    userText: msg.text,
    tools: TOOL_DECLARATIONS,
    executeTool: createToolExecutor({
      supabase,
      tenantId: config.tenant_id,
      tripId: ctx.trip.id,
      todayIso,
      participants: ctx.participants,
      timeZone: config.timezone,
      senderPhone: msg.from,
      phoneNumberId: msg.phoneNumberId,
      metaAccessToken: Deno.env.get('META_WA_TOKEN') ?? '',
      googleMapsApiKey: Deno.env.get('GOOGLE_MAPS_API_KEY') ?? null,
    }),
  });

  const sent = await sendTextMessage({
    phoneNumberId: msg.phoneNumberId,
    accessToken: Deno.env.get('META_WA_TOKEN') ?? '',
    to: msg.from,
    text,
  });

  // A resposta já saiu. Falha de escrita daqui pra baixo é problema de
  // observabilidade, não de conversa — não pode escalar e virar fallback
  // enviado por cima de uma resposta que deu certo.
  try {
    await supabase.from('whatsapp_messages').insert({
      tenant_id: config.tenant_id,
      wa_message_id: sent.waMessageId,
      direction: 'outbound',
      sender_phone: msg.from,
      body: text,
      kind: 'chat',
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
      latency_ms: Date.now() - startedAt,
      tool_rounds: usage.toolRounds,
      tools_called: usage.toolsCalled.join(','),
    });
  } catch (err) {
    console.error(`[whatsapp-webhook] Falha ao registrar telemetria de ${msg.waMessageId}:`, err);
  }

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

/**
 * O 200 já foi devolvido à Meta, então ela não reenvia: sem esta mensagem, uma
 * falha do Gemini ou do banco vira silêncio absoluto do lado da família — o
 * pior modo de falha possível, porque é indistinguível de "o bot ignorou".
 */
async function sendFallback(msg: IncomingTextMessage): Promise<boolean> {
  try {
    await sendTextMessage({
      phoneNumberId: msg.phoneNumberId,
      accessToken: Deno.env.get('META_WA_TOKEN') ?? '',
      to: msg.from,
      text: 'Ops, tive um probleminha técnico aqui e não consegui responder agora. 😅 Manda de novo em instantes?',
    });
    return true;
  } catch (error) {
    console.error(`[whatsapp-webhook] Falha ao enviar fallback para ${msg.from}:`, error);
    return false;
  }
}

async function processMessages(supabase: SupabaseClient, messages: IncomingMessage[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  for (const msg of messages) {
    try {
      results[msg.waMessageId] = msg.kind === 'location' ? await handleLocationMessage(supabase, msg) : await handleMessage(supabase, msg);
    } catch (error) {
      // Falhas individuais ficam no log da function (Dashboard → Edge Functions → Logs).
      console.error(`[whatsapp-webhook] Falha ao processar ${msg.waMessageId}:`, error);
      results[msg.waMessageId] = msg.kind === 'text' && (await sendFallback(msg)) ? 'error:fallback-enviado' : 'error';
    }
    console.log(`[whatsapp-webhook] ${msg.waMessageId}: ${results[msg.waMessageId]}`);
  }
  return results;
}
