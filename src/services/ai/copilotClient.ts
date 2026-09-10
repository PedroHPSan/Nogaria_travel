import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

/** Mesma forma de `_shared/gemini.ts` ChatMessage, mas com o papel usado na UI. */
export interface CopilotHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface CopilotChatInput {
  trip_id: string;
  message: string;
  history: CopilotHistoryMessage[];
}

export interface CopilotChatResult {
  text?: string;
  usage?: { tokens_in: number; tokens_out: number; cost_usd: number };
  error?: string;
}

const GENERIC_ERROR = 'Não foi possível falar com o Copiloto agora. Tente novamente em instantes.';

// Mesmo padrão de extração de erro do priceResearchClient.ts: o corpo
// documentado é `{ error: string }`, mas um 404 (function não implantada) ou
// falha de gateway pode não vir nesse formato.
async function extractServerMessage(error: unknown): Promise<string | undefined> {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      if (error.context instanceof Response) {
        const body = await error.context.clone().json();
        if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
          return (body as { error: string }).error;
        }
      } else if (typeof error.context === 'object' && error.context !== null && 'error' in error.context) {
        return String((error.context as { error: unknown }).error);
      }
    } catch {
      try {
        if (error.context instanceof Response) {
          const text = await error.context.clone().text();
          if (text) return text;
        }
      } catch {
        // ignore
      }
    }
  }
  if (error instanceof Error && error.message && !error.message.includes('FunctionsFetchError')) {
    return error.message;
  }
  return undefined;
}

/** Chama a Edge Function `copilot-chat`. Nunca lança — erros voltam em `.error`. */
export async function sendCopilotMessage(input: CopilotChatInput): Promise<CopilotChatResult> {
  try {
    const { data, error } = await supabase.functions.invoke('copilot-chat', { body: input });

    if (error) {
      const message = await extractServerMessage(error);
      return { error: message ?? GENERIC_ERROR };
    }
    if (!data || typeof data.text !== 'string') {
      if (data && typeof data === 'object' && typeof data.error === 'string') {
        return { error: data.error };
      }
      return { error: GENERIC_ERROR };
    }
    return { text: data.text, usage: data.usage };
  } catch (err: unknown) {
    const message = await extractServerMessage(err);
    return { error: message ?? GENERIC_ERROR };
  }
}
