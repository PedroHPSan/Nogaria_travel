// Cliente Claude (Anthropic Messages API) com function calling, para o bot
// WhatsApp e o Copiloto web poderem rodar num provedor diferente do Gemini —
// mesmo contrato de `chatWithTools` de gemini.ts, para o dispatcher em
// aiProvider.ts poder trocar de provedor sem os callers saberem a diferença.
import type { ChatMessage, GeminiToolDeclaration, GeminiUsage, ToolExecutor } from './gemini.ts';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOOL_ROUNDS = 4;
const MAX_OUTPUT_TOKENS = 1024;
const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Modelos Claude validados para este bot — mesma lista curada que
 * SUPPORTED_GEMINI_MODELS, pela mesma razão: `model_name` livre na UI
 * derrubaria o bot com HTTP 404/erro de configuração na API da Anthropic.
 */
export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
export const SUPPORTED_CLAUDE_MODELS = [DEFAULT_CLAUDE_MODEL] as const;

export function resolveClaudeModel(modelName: string | null | undefined): string {
  const name = (modelName ?? '').trim();
  return (SUPPORTED_CLAUDE_MODELS as readonly string[]).includes(name) ? name : DEFAULT_CLAUDE_MODEL;
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface MessagesResponse {
  content?: ContentBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

async function callClaude(apiKey: string, body: Record<string, unknown>): Promise<MessagesResponse> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    // Mesmo racional do gemini.ts: sem timeout, uma chamada pendurada consome
    // a instância inteira e a família nunca recebe resposta.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = (await response.json()) as MessagesResponse;
  if (!response.ok) {
    throw new Error(`Claude retornou HTTP ${response.status}: ${data.error?.message ?? 'erro desconhecido'}`);
  }
  return data;
}

/** JSON Schema é o mesmo formato para `parameters` (Gemini) e `input_schema` (Anthropic) — só o nome do campo muda. */
function toClaudeTools(tools: GeminiToolDeclaration[]): Record<string, unknown>[] {
  return tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
}

/**
 * Mesmo loop de `chatWithTools` do gemini.ts, adaptado ao formato de blocos de
 * conteúdo da Anthropic: `tool_use` no lugar de `functionCall`, resposta
 * devolvida como mensagem `user` com bloco `tool_result` (não `function`).
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

  const messages: Record<string, unknown>[] = [
    ...history.filter(m => m.text.trim()).map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
    { role: 'user', content: userText },
  ];

  const usage: GeminiUsage = { tokensIn: 0, tokensOut: 0, toolRounds: 0, toolsCalled: [] };
  const claudeTools = toClaudeTools(tools);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const data = await callClaude(apiKey, {
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature,
      system: systemPrompt,
      messages,
      tools: claudeTools,
    });

    usage.tokensIn += data.usage?.input_tokens ?? 0;
    usage.tokensOut += data.usage?.output_tokens ?? 0;

    const blocks = data.content ?? [];
    const toolUses = blocks.filter(b => b.type === 'tool_use');

    if (toolUses.length === 0) {
      const text = blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim();
      return { text: text || 'Desculpe, não consegui gerar uma resposta agora.', usage };
    }

    usage.toolRounds++;
    for (const call of toolUses) usage.toolsCalled.push(call.name!);

    messages.push({ role: 'assistant', content: blocks });

    const resultBlocks: ContentBlock[] = [];
    for (const call of toolUses) {
      let result: unknown;
      try {
        result = await executeTool(call.name!, call.input ?? {});
      } catch (error) {
        result = { error: error instanceof Error ? error.message : 'Falha ao executar a ação.' };
      }
      resultBlocks.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result) });
    }
    messages.push({ role: 'user', content: resultBlocks });
  }

  return { text: 'Desculpe, não consegui concluir essa solicitação agora.', usage };
}
