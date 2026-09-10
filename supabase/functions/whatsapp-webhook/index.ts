import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { chatWithTools, extractJsonFromDocument, resolveGeminiModel, type ChatMessage } from '../_shared/gemini.ts';
import { downloadMedia, sendTextMessage } from '../_shared/whatsappClient.ts';
import { fetchTripContext, buildSystemPrompt, localDateIso } from '../_shared/tripContext.ts';
import { createToolExecutor, TOOL_DECLARATIONS } from '../_shared/tripTools.ts';
import { stagePendingWrite } from '../_shared/pendingWrites.ts';
import {
  VOUCHER_PROMPT,
  airportTimeZone,
  buildVoucherPreview,
  matchParticipants,
  parseVoucherExtraction,
  zonedLocalToUtcIso,
} from '../_shared/voucherExtract.ts';
import {
  evaluateQuota,
  formatQuotaExceeded,
  formatQuotaWarning,
  monthStartUtcIso,
  nextMonthStartLocalIso,
  resolveMonthlyQuota,
} from '../_shared/quota.ts';

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

interface IncomingMediaMessage {
  kind: 'media';
  waMessageId: string;
  from: string;
  mediaId: string;
  mimeType: string;
  phoneNumberId: string;
}

type IncomingMessage = IncomingTextMessage | IncomingLocationMessage | IncomingMediaMessage;

// Só o que o Gemini lê como documento: foto (e-ticket na tela, voucher
// impresso) ou PDF. Áudio/vídeo/sticker continuam ignorados.
const VOUCHER_MIME_RE = /^(image\/(jpeg|png|webp)|application\/pdf)$/i;

// Extrai mensagens de texto, localização e mídia (imagem/PDF) do payload do
// webhook da Meta. Status de entrega, reações, áudio e vídeo são ignorados
// propositalmente. Localização entra porque get_directions depende dela como
// origem; mídia entra pela ingestão de voucher (#28).
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
          continue;
        }

        const media = (m.image ?? m.document) as Record<string, unknown> | undefined;
        if (media && typeof media.id === 'string' && typeof media.mime_type === 'string' && VOUCHER_MIME_RE.test(media.mime_type)) {
          messages.push({ kind: 'media', waMessageId: m.id, from: m.from, mediaId: media.id, mimeType: media.mime_type, phoneNumberId });
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

/**
 * Foto/PDF de confirmação (#28): baixa da Meta, o Gemini extrai o voo ou a
 * hospedagem em JSON, e o resultado vira uma pendência de confirmação em duas
 * fases (pending_writes) — a mesma mecânica de reschedule/mark_done. A família
 * confirma na mensagem seguinte e a tool create_*_from_document grava. Nada é
 * gravado sem o "sim": extração de documento erra, e um voo com horário
 * errado no roteiro é pior que pedir pra confirmar.
 */
async function handleMediaMessage(supabase: SupabaseClient, msg: IncomingMediaMessage): Promise<string> {
  const startedAt = Date.now();
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
    body: '[documento enviado]',
    kind: 'chat',
  });
  if (insertErr?.code === '23505') return 'ignored:duplicate';
  if (insertErr) throw new Error(`Falha ao registrar mensagem: ${insertErr.message}`);

  const metaToken = Deno.env.get('META_WA_TOKEN') ?? '';
  const reply = async (text: string) => {
    const sent = await sendTextMessage({ phoneNumberId: msg.phoneNumberId, accessToken: metaToken, to: msg.from, text });
    await supabase.from('whatsapp_messages').insert({
      tenant_id: config.tenant_id,
      wa_message_id: sent.waMessageId,
      direction: 'outbound',
      sender_phone: msg.from,
      body: text,
      kind: 'chat',
    });
  };

  const todayIso = localDateIso(new Date(), config.timezone);
  const ctx = await fetchTripContext(supabase, config.tenant_id, todayIso);
  if (!ctx.trip) {
    await reply('Recebi o documento, mas não achei uma viagem ativa pra cadastrar. Cria a viagem no app primeiro! 🧳');
    return 'replied:no-trip';
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada nas secrets do Supabase.');
  const { data: aiConfig } = await supabase
    .from('ai_provider_configs')
    .select('model_name')
    .eq('tenant_id', config.tenant_id)
    .eq('provider', 'gemini')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();
  const model = resolveGeminiModel(aiConfig?.model_name);

  const media = await downloadMedia({ mediaId: msg.mediaId, accessToken: metaToken });
  const { json, usage } = await extractJsonFromDocument({ apiKey, model, mimeType: media.mimeType, base64: media.base64, prompt: VOUCHER_PROMPT });
  const extraction = parseVoucherExtraction(json);

  try {
    const cost = (usage.tokensIn / 1_000_000) * 0.075 + (usage.tokensOut / 1_000_000) * 0.3;
    await supabase.from('ai_usage_logs').insert({
      tenant_id: config.tenant_id,
      user_name: msg.from,
      function_name: 'voucher_ingest',
      provider: 'gemini',
      model,
      tokens_input: usage.tokensIn,
      tokens_output: usage.tokensOut,
      estimated_cost_usd: Number(cost.toFixed(6)),
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startedAt,
      tool_rounds: 0,
      tools_called: '',
    });
  } catch (err) {
    console.error(`[whatsapp-webhook] Falha ao registrar telemetria do voucher ${msg.waMessageId}:`, err);
  }

  if (!extraction) {
    await reply('Recebi o arquivo, mas não consegui identificar um voo ou hospedagem nele. 🤔 Manda uma foto mais nítida da confirmação (com número do voo/localizador ou nome do hotel e datas) que eu tento de novo.');
    return 'replied:voucher-unreadable';
  }

  const names = extraction.kind === 'flight' ? extraction.passengers : extraction.guests;
  const participantIds = matchParticipants(names, ctx.participants);
  const participantNames = ctx.participants.filter(p => participantIds.includes(p.id)).map(p => p.nickname ?? p.full_name);
  const preview = buildVoucherPreview(extraction, participantNames);

  const payload =
    extraction.kind === 'flight'
      ? {
          airline: extraction.airline,
          flight_number: extraction.flight_number,
          origin_airport: extraction.origin_airport,
          destination_airport: extraction.destination_airport,
          departure_time: zonedLocalToUtcIso(extraction.departure_local, airportTimeZone(extraction.origin_airport, config.timezone)),
          arrival_time: zonedLocalToUtcIso(extraction.arrival_local, airportTimeZone(extraction.destination_airport, config.timezone)),
          booking_code: extraction.booking_code,
          passenger_ids: participantIds,
          summary: preview,
        }
      : {
          name: extraction.name,
          address: extraction.address,
          city: extraction.city,
          check_in: extraction.check_in,
          check_out: extraction.check_out,
          confirmation_code: extraction.confirmation_code,
          guest_ids: participantIds,
          summary: preview,
        };

  await stagePendingWrite(supabase, {
    tenantId: config.tenant_id,
    tripId: ctx.trip.id,
    senderPhone: msg.from,
    toolName: extraction.kind === 'flight' ? 'create_flight_from_document' : 'create_accommodation_from_document',
    payload,
    preview,
  });

  await reply(`${preview}\n\nResponde *sim* que eu gravo, ou me diz o que está errado.`);
  return `replied:voucher-${extraction.kind}`;
}

async function handleMessage(supabase: SupabaseClient, msg: IncomingTextMessage): Promise<string> {
  const startedAt = Date.now();

  // Idempotência: Meta reenvia webhooks; wa_message_id é unique no banco.
  const { data: config } = await supabase
    .from('whatsapp_configs')
    .select('tenant_id, timezone, enabled, monthly_message_quota, tenants(plan)')
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

  // Franquia mensal (#27): contada DEPOIS do insert, então `used` já inclui
  // esta mensagem. Corte suave — avisa uma vez por dia por telefone em vez de
  // silenciar (silêncio é o modo de falha que a família lê como bug).
  const now = new Date();
  const quota = await checkQuota(supabase, config, msg, now);
  if (quota.kind === 'exceeded') {
    const noticed = await quotaNoticeSentToday(supabase, config.tenant_id, msg.from, 'exceeded', now);
    if (!noticed) {
      const text = formatQuotaExceeded(quota, nextMonthStartLocalIso(now, config.timezone));
      await sendTextMessage({
        phoneNumberId: msg.phoneNumberId,
        accessToken: Deno.env.get('META_WA_TOKEN') ?? '',
        to: msg.from,
        text,
      });
      await supabase.from('whatsapp_messages').insert({
        tenant_id: config.tenant_id,
        direction: 'outbound',
        sender_phone: msg.from,
        body: text,
        kind: 'chat',
        payload: { quota: 'exceeded' },
      });
    }
    return noticed ? 'ignored:quota-exceeded' : 'replied:quota-exceeded';
  }

  const todayIso = localDateIso(now, config.timezone);
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

  let quotaFooter: { quota: 'warning' } | null = null;
  let outgoing = text;
  if (quota.kind === 'warning' && !(await quotaNoticeSentToday(supabase, config.tenant_id, msg.from, 'warning', now))) {
    outgoing = `${text}\n\n${formatQuotaWarning(quota)}`;
    quotaFooter = { quota: 'warning' };
  }

  const sent = await sendTextMessage({
    phoneNumberId: msg.phoneNumberId,
    accessToken: Deno.env.get('META_WA_TOKEN') ?? '',
    to: msg.from,
    text: outgoing,
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
      body: outgoing,
      kind: 'chat',
      ...(quotaFooter ? { payload: quotaFooter } : {}),
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

interface QuotaConfig {
  tenant_id: string;
  timezone: string;
  monthly_message_quota: number | null;
  // PostgREST devolve o embed de FK como objeto (ou lista, se a relação for ambígua).
  tenants: { plan: string } | { plan: string }[] | null;
}

/** Mensagens recebidas (chat) do tenant no mês local corrente vs. franquia efetiva. */
async function checkQuota(supabase: SupabaseClient, config: QuotaConfig, msg: IncomingTextMessage, now: Date) {
  const tenant = Array.isArray(config.tenants) ? config.tenants[0] : config.tenants;
  const quota = resolveMonthlyQuota({ plan: tenant?.plan, override: config.monthly_message_quota });
  if (quota === null) return evaluateQuota(0, null);

  const { count, error } = await supabase
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', config.tenant_id)
    .eq('direction', 'inbound')
    .eq('kind', 'chat')
    .gte('created_at', monthStartUtcIso(now, config.timezone));
  if (error) {
    // Falha de contagem não pode bloquear a conversa: trata como dentro da franquia.
    console.warn(`[whatsapp-webhook] Falha ao contar franquia de ${msg.from}:`, error.message);
    return evaluateQuota(0, null);
  }
  return evaluateQuota(count ?? 0, quota);
}

/** Já mandamos este aviso (exceeded/warning) para este telefone nas últimas 24h? */
async function quotaNoticeSentToday(
  supabase: SupabaseClient,
  tenantId: string,
  phone: string,
  kind: 'exceeded' | 'warning',
  now: Date,
): Promise<boolean> {
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('sender_phone', phone)
    .eq('direction', 'outbound')
    .contains('payload', { quota: kind })
    .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * O 200 já foi devolvido à Meta, então ela não reenvia: sem esta mensagem, uma
 * falha do Gemini ou do banco vira silêncio absoluto do lado da família — o
 * pior modo de falha possível, porque é indistinguível de "o bot ignorou".
 */
async function sendFallback(msg: Pick<IncomingTextMessage, 'from' | 'phoneNumberId'>): Promise<boolean> {
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
      results[msg.waMessageId] =
        msg.kind === 'location'
          ? await handleLocationMessage(supabase, msg)
          : msg.kind === 'media'
            ? await handleMediaMessage(supabase, msg)
            : await handleMessage(supabase, msg);
    } catch (error) {
      // Falhas individuais ficam no log da function (Dashboard → Edge Functions → Logs).
      console.error(`[whatsapp-webhook] Falha ao processar ${msg.waMessageId}:`, error);
      results[msg.waMessageId] = msg.kind !== 'location' && (await sendFallback(msg)) ? 'error:fallback-enviado' : 'error';
    }
    console.log(`[whatsapp-webhook] ${msg.waMessageId}: ${results[msg.waMessageId]}`);
  }
  return results;
}
