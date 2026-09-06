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

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

/**
 * Resolve o modelo a usar a partir do `model_name` salvo em `ai_provider_configs`.
 * O campo é texto livre na UI do Copiloto, então pode chegar vazio, com um modelo
 * de outro provedor (gpt-*, claude-*) ou com uma geração descontinuada do Gemini —
 * qualquer um desses derrubaria o bot com HTTP 404 na API do Gemini.
 */
export function resolveGeminiModel(modelName: string | null | undefined): string {
  const name = (modelName ?? '').trim();
  if (!name.startsWith('gemini-')) return DEFAULT_GEMINI_MODEL;
  if (name.includes('1.5') || name.includes('2.5') || name.includes('flash-latest')) return DEFAULT_GEMINI_MODEL;
  return name;
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
  temperature: number,
  body: Record<string, unknown>,
): Promise<AttemptResult> {
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: { temperature },
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
  temperature: number,
  body: Record<string, unknown>,
): Promise<GenerateContentResponse> {
  let lastError = new Error('Gemini não respondeu.');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await generateContentOnce(model, apiKey, temperature, body);
    if (result.data) return result.data;

    lastError = result.error!;
    if (!result.retryable || attempt === MAX_ATTEMPTS) break;

    console.warn(`[gemini] tentativa ${attempt}/${MAX_ATTEMPTS} falhou: ${lastError.message}`);
    await sleep(backoffDelayMs(attempt));
  }

  throw lastError;
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

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const data = await generateContent(model, apiKey, temperature, {
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
      responseParts.push({ functionResponse: { name: call.name, response: { result } } });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return { text: 'Desculpe, não consegui concluir essa solicitação agora.', usage };
}
