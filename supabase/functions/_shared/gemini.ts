// Cliente Gemini com function calling para o bot WhatsApp.
// Segue o mesmo padrão de price-research/gemini.ts (REST v1beta, sem SDK).

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GeminiUsage {
  tokensIn: number;
  tokensOut: number;
  /** Rodadas de function calling gastas — o principal driver de latência. */
  toolRounds: number;
  /** Tools efetivamente executadas, para medir roteamento de intenção. */
  toolsCalled: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
  /** Presente no Gemini 3.x; precisa ser ecoado como `id` no FunctionResponse correspondente. */
  id?: string;
}

export interface CandidatePart {
  text?: string;
  functionCall?: FunctionCall;
  thoughtSignature?: string;
}

interface GenerateContentResponse {
  candidates?: { content?: { parts?: CandidatePart[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

const MAX_TOOL_ROUNDS = 4;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/**
 * Modelos Gemini que o bot e o Copiloto sabem falar de fato — a UI de
 * configuração (AiCopilotView) só deve oferecer estes, em vez do texto livre
 * que hoje permite salvar qualquer string e cair no default silenciosamente.
 */
export const SUPPORTED_GEMINI_MODELS = [DEFAULT_GEMINI_MODEL] as const;

/**
 * Resolve o modelo a usar a partir do `model_name` salvo em `ai_provider_configs`.
 * ALLOWLIST, não blocklist: o campo é texto livre na UI do Copiloto, então
 * pode chegar vazio, com um modelo de outro provedor (gpt-*, claude-*), com
 * uma geração descontinuada do Gemini, ou com um nome válido só na API mas
 * que este módulo não sabe operar (generationConfig muda por geração — ver
 * buildGenerationConfig). Qualquer coisa fora de SUPPORTED_GEMINI_MODELS cai
 * silenciosamente no default, inclusive uma config antiga salva como
 * 'gemini-3.5-flash' antes desta migração.
 */
export function resolveGeminiModel(modelName: string | null | undefined): string {
  const name = (modelName ?? '').trim();
  return (SUPPORTED_GEMINI_MODELS as readonly string[]).includes(name) ? name : DEFAULT_GEMINI_MODEL;
}

/** low|medium|high — 'minimal' não é suportado no Gemini 3.8 e retorna erro da API. */
export type ThinkingLevel = 'LOW' | 'MEDIUM' | 'HIGH';

function supportsThinkingLevel(model: string): boolean {
  return model.startsWith('gemini-3.');
}

/**
 * generationConfig varia por geração do modelo: 3.8 exige remover
 * temperature/top_p/top_k (a API aceita mas o guia de migração pede a
 * remoção) e usar thinkingConfig.thinkingLevel no lugar de thinking_budget. thinkingLevel
 * é o botão de custo mais perigoso da migração — thinking tokens são
 * cobrados como OUTPUT — por isso é constante por caminho de chamada, nunca
 * exposto na UI (ver chatWithTools/groundedSearch/extractJsonFromDocument).
 */
export function buildGenerationConfig(
  model: string,
  opts: { temperature: number; thinkingLevel?: ThinkingLevel; responseMimeType?: string },
): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  if (opts.responseMimeType) base.responseMimeType = opts.responseMimeType;

  if (supportsThinkingLevel(model)) {
    return { ...base, thinkingConfig: { thinkingLevel: opts.thinkingLevel ?? 'MEDIUM' } };
  }
  return { ...base, temperature: opts.temperature };
}

/**
 * Normaliza o histórico antes de enviá-lo ao modelo: remove mensagens vazias
 * (a API rejeita `text: ''`) e garante que a conversa comece com o usuário.
 */
export function sanitizeHistory(history: ChatMessage[]): ChatMessage[] {
  const nonEmpty = history.filter(m => m.text.trim().length > 0);
  const firstUser = nonEmpty.findIndex(m => m.role === 'user');
  return firstUser === -1 ? [] : nonEmpty.slice(firstUser);
}

/**
 * Monta o turno do modelo que é ecoado de volta junto com os resultados das tools.
 * Preserva o `thoughtSignature` (obrigatório no Gemini 3.x para function calling)
 * e descarta partes sem conteúdo — devolver `{ text: '' }` gera HTTP 400.
 */
export function buildModelTurnParts(parts: CandidatePart[]): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  for (const p of parts) {
    const signature = p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : {};
    if (p.functionCall) {
      result.push({ functionCall: p.functionCall, ...signature });
    } else if (p.text && p.text.trim()) {
      result.push({ text: p.text, ...signature });
    }
  }
  return result;
}

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 3;
// 429/5xx e timeout são transitórios; 400/403/404 são erro de configuração e
// repetir só queima tempo do orçamento de latência.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface AttemptResult {
  data?: GenerateContentResponse;
  error?: Error;
  retryable: boolean;
}

async function generateContentOnce(
  model: string,
  apiKey: string,
  generationConfig: Record<string, unknown>,
  body: Record<string, unknown>,
): Promise<AttemptResult> {
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig,
        ...body,
      }),
      // Sem timeout, uma chamada pendurada consome a instância inteira e o
      // usuário nunca recebe resposta — o pior modo de falha de um bot.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { error: new Error(`Falha de rede ao chamar o Gemini: ${reason}`), retryable: true };
  }

  if (!response.ok) {
    const errorText = await response.text();
    return {
      error: new Error(`Gemini retornou HTTP ${response.status}: ${errorText.slice(0, 300)}`),
      retryable: RETRYABLE_STATUS.has(response.status),
    };
  }

  try {
    return { data: (await response.json()) as GenerateContentResponse, retryable: false };
  } catch {
    return { error: new Error('Resposta do Gemini não é um JSON válido.'), retryable: true };
  }
}

/** Backoff exponencial: 400ms, 800ms. */
export function backoffDelayMs(attempt: number): number {
  return 400 * 2 ** (attempt - 1);
}

async function generateContent(
  model: string,
  apiKey: string,
  generationConfig: Record<string, unknown>,
  body: Record<string, unknown>,
): Promise<GenerateContentResponse> {
  let lastError = new Error('Gemini não respondeu.');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await generateContentOnce(model, apiKey, generationConfig, body);
    if (result.data) return result.data;

    lastError = result.error!;
    if (!result.retryable || attempt === MAX_ATTEMPTS) break;

    console.warn(`[gemini] tentativa ${attempt}/${MAX_ATTEMPTS} falhou: ${lastError.message}`);
    await sleep(backoffDelayMs(attempt));
  }

  throw lastError;
}

/**
 * Extração estruturada de uma imagem/PDF (voucher, e-ticket): manda o arquivo
 * inline + instrução e força resposta JSON. Sem tools, sem histórico —
 * é uma chamada só, temperatura zero. Devolve o JSON já parseado (ou null
 * se o modelo não devolveu JSON válido) e o uso de tokens.
 */
export async function extractJsonFromDocument(input: {
  apiKey: string;
  model: string;
  mimeType: string;
  base64: string;
  prompt: string;
}): Promise<{ json: unknown; usage: Pick<GeminiUsage, 'tokensIn' | 'tokensOut'> }> {
  // MEDIUM: extração estruturada de imagem se beneficia de mais raciocínio, e
  // é uma chamada rara (um voucher por vez), diferente do caminho quente do chat.
  const data = await generateContent(
    input.model,
    input.apiKey,
    buildGenerationConfig(input.model, { temperature: 0, thinkingLevel: 'MEDIUM', responseMimeType: 'application/json' }),
    { contents: [{ role: 'user', parts: [{ inlineData: { mimeType: input.mimeType, data: input.base64 } }, { text: input.prompt }] }] },
  );
  const usage = { tokensIn: data.usageMetadata?.promptTokenCount ?? 0, tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0 };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim();
  try {
    return { json: text ? JSON.parse(text) : null, usage };
  } catch {
    return { json: null, usage };
  }
}

export interface GroundedSearchResult {
  text: string;
  sources: string[];
  usage: Pick<GeminiUsage, 'tokensIn' | 'tokensOut'>;
}

/**
 * Busca na web via grounding nativo do Gemini (`google_search`). É uma chamada
 * isolada, sem os `tools` de function calling: misturar tool nativa com
 * function_declarations no mesmo request é instável entre gerações do Gemini,
 * então o `web_search` exposto ao modelo (tripTools.ts) chama isto por fora do
 * loop de `chatWithTools` e devolve o resultado como se fosse a resposta de
 * uma tool comum. Temperatura baixa: é busca factual, não criação de texto.
 */
export async function groundedSearch(input: {
  apiKey: string;
  model: string;
  query: string;
}): Promise<GroundedSearchResult> {
  // LOW: busca factual, não criação de texto — não vale gastar thinking tokens
  // (cobrados como output) numa chamada que só precisa reformular resultados de busca.
  const data = await generateContent(
    input.model,
    input.apiKey,
    buildGenerationConfig(input.model, { temperature: 0.1, thinkingLevel: 'LOW' }),
    { contents: [{ role: 'user', parts: [{ text: input.query }] }], tools: [{ google_search: {} }] },
  );

  const usage = { tokensIn: data.usageMetadata?.promptTokenCount ?? 0, tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0 };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map(p => p.text ?? '').join('').trim();

  // groundingChunks não está tipado em GenerateContentResponse (campo extra da
  // API só usado aqui); acesso solto de propósito em vez de inflar a interface
  // geral do módulo com um shape usado por uma única função.
  const candidate = (data as unknown as { candidates?: { groundingMetadata?: { groundingChunks?: { web?: { uri?: string } }[] } }[] }).candidates?.[0];
  const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map(c => c.web?.uri)
    .filter((uri): uri is string => Boolean(uri));

  return { text: text || 'Não encontrei informação confiável sobre isso agora.', sources: [...new Set(sources)].slice(0, 5), usage };
}

/**
 * Conversa com o Gemini executando function calling em loop:
 * cada functionCall do modelo é executada via `executeTool` e o resultado
 * volta ao modelo até ele responder com texto (ou estourar MAX_TOOL_ROUNDS).
 */
export async function chatWithTools(input: {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  history: ChatMessage[];
  userText: string;
  tools: GeminiToolDeclaration[];
  executeTool: ToolExecutor;
}): Promise<{ text: string; usage: GeminiUsage }> {
  const { apiKey, model, temperature, systemPrompt, history, userText, tools, executeTool } = input;

  const contents: Record<string, unknown>[] = [
    ...sanitizeHistory(history).map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: 'user', parts: [{ text: userText }] },
  ];

  const usage: GeminiUsage = { tokensIn: 0, tokensOut: 0, toolRounds: 0, toolsCalled: [] };

  // LOW: caminho quente do WhatsApp — resposta curta e factual com tools;
  // thinking tokens são cobrados como output (3,75 USD/M no 3.8 Flash), o
  // maior vetor de custo real da migração para 3.8, maior que o de entrada.
  const generationConfig = buildGenerationConfig(model, { temperature, thinkingLevel: 'LOW' });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const data = await generateContent(model, apiKey, generationConfig, {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: [{ function_declarations: tools }],
    });

    usage.tokensIn += data.usageMetadata?.promptTokenCount ?? 0;
    usage.tokensOut += data.usageMetadata?.candidatesTokenCount ?? 0;

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall!) as FunctionCall[];

    if (functionCalls.length === 0) {
      const text = parts.map(p => p.text ?? '').join('').trim();
      return { text: text || 'Desculpe, não consegui gerar uma resposta agora.', usage };
    }

    usage.toolRounds++;
    for (const call of functionCalls) usage.toolsCalled.push(call.name);

    // Devolve ao modelo a chamada e o resultado de cada tool.
    contents.push({ role: 'model', parts: buildModelTurnParts(parts) });

    const responseParts = [];
    for (const call of functionCalls) {
      let result: unknown;
      try {
        result = await executeTool(call.name, call.args ?? {});
      } catch (error) {
        result = { error: error instanceof Error ? error.message : 'Falha ao executar a ação.' };
      }
      // O guia de migração do 3.8 exige name + id em cada FunctionResponse
      // via generateContent — sem isto o tool-calling quebra silenciosamente.
      // Campo é `id` (camelCase, mesmo nome de FunctionCall.id na resposta),
      // não `call_id` — a API rejeita com HTTP 400 "Cannot find field".
      const callId = call.id ? { id: call.id } : {};
      responseParts.push({ functionResponse: { name: call.name, response: { result }, ...callId } });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return { text: 'Desculpe, não consegui concluir essa solicitação agora.', usage };
}
