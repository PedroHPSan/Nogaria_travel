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
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

interface CandidatePart {
  text?: string;
  functionCall?: FunctionCall;
}

interface GenerateContentResponse {
  candidates?: { content?: { parts?: CandidatePart[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

const MAX_TOOL_ROUNDS = 4;

async function generateContent(
  model: string,
  apiKey: string,
  temperature: number,
  body: Record<string, unknown>,
): Promise<GenerateContentResponse> {
  const response = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature },
      ...body,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini retornou HTTP ${response.status}: ${errorText.slice(0, 300)}`);
  }
  return (await response.json()) as GenerateContentResponse;
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
    ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: 'user', parts: [{ text: userText }] },
  ];

  const usage: GeminiUsage = { tokensIn: 0, tokensOut: 0 };

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

    // Devolve ao modelo a chamada e o resultado de cada tool.
    contents.push({ role: 'model', parts: parts.map(p => (p.functionCall ? { functionCall: p.functionCall } : { text: p.text ?? '' })) });

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
