// Roteamento multi-provedor: escolhe Gemini ou Claude a partir de
// `ai_provider_configs.provider` e chama o cliente correspondente com o mesmo
// contrato (`chatWithTools` → { text, usage }). Antes disso, tanto o webhook
// quanto o copilot-chat estavam hardcoded em Gemini — `ai_provider_configs`
// aceitava "anthropic" na UI mas nada de fato chamava a API da Anthropic.
import * as gemini from './gemini.ts';
import * as claude from './claude.ts';
import type { ChatMessage, GeminiToolDeclaration, GeminiUsage, ToolExecutor } from './gemini.ts';

export type SupportedProvider = 'gemini' | 'anthropic';

/**
 * Custo por milhão de tokens (USD). Só os modelos curados têm preço aqui de
 * propósito — evita estimar custo de um modelo que nunca foi de fato chamado.
 * O fallback em estimateCostUsd usa PRICING[DEFAULT_GEMINI_MODEL]: trocar o
 * default sem atualizar este valor subestimaria o custo em até 10x na view
 * tenant_monthly_ai_costs — mantenha os dois em sincronia.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  // Preço introdutório do gemini-3.8-flash até 2026-12-31; depois 1,50/7,50 — revisar.
  [gemini.DEFAULT_GEMINI_MODEL]: { input: 0.75, output: 3.75 },
  [claude.DEFAULT_CLAUDE_MODEL]: { input: 1.0, output: 5.0 },
};

export interface ProviderConfigRow {
  provider: string | null | undefined;
  model_name: string | null | undefined;
  temperature: number | null | undefined;
}

export interface ProviderApiKeys {
  geminiApiKey: string | null;
  claudeApiKey: string | null;
}

/** Provedor + modelo efetivos: `provider` desconhecido ou sem chave configurada cai em Gemini, que é o único garantido disponível hoje. */
export function resolveProvider(config: ProviderConfigRow, keys: ProviderApiKeys): { provider: SupportedProvider; model: string } {
  if (config.provider === 'anthropic' && keys.claudeApiKey) {
    return { provider: 'anthropic', model: claude.resolveClaudeModel(config.model_name) };
  }
  return { provider: 'gemini', model: gemini.resolveGeminiModel(config.model_name) };
}

export function estimateCostUsd(model: string, usage: Pick<GeminiUsage, 'tokensIn' | 'tokensOut'>): number {
  const price = PRICING[model] ?? PRICING[gemini.DEFAULT_GEMINI_MODEL];
  return (usage.tokensIn / 1_000_000) * price.input + (usage.tokensOut / 1_000_000) * price.output;
}

export async function chatWithConfiguredProvider(input: {
  config: ProviderConfigRow;
  keys: ProviderApiKeys;
  systemPrompt: string;
  history: ChatMessage[];
  userText: string;
  tools: GeminiToolDeclaration[];
  executeTool: ToolExecutor;
}): Promise<{ text: string; usage: GeminiUsage; provider: SupportedProvider; model: string; costUsd: number }> {
  const { provider, model } = resolveProvider(input.config, input.keys);
  const temperature = Number(input.config.temperature ?? 0.3);
  const client = provider === 'anthropic' ? claude : gemini;
  const apiKey = provider === 'anthropic' ? input.keys.claudeApiKey! : input.keys.geminiApiKey!;

  const { text, usage } = await client.chatWithTools({
    apiKey,
    model,
    temperature,
    systemPrompt: input.systemPrompt,
    history: input.history,
    userText: input.userText,
    tools: input.tools,
    executeTool: input.executeTool,
  });

  return { text, usage, provider, model, costUsd: Number(estimateCostUsd(model, usage).toFixed(6)) };
}
