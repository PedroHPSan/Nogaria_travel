// Espelho client-side de SUPPORTED_GEMINI_MODELS/SUPPORTED_CLAUDE_MODELS
// (supabase/functions/_shared/gemini.ts e claude.ts) — não dá para importar
// direto porque as Edge Functions rodam em Deno e este arquivo em Vite/browser.
// Mudar um modelo suportado exige editar os dois lados.
export interface SupportedModelOption {
  provider: 'gemini' | 'anthropic';
  model: string;
  label: string;
}

export const SUPPORTED_MODELS: SupportedModelOption[] = [
  { provider: 'gemini', model: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (padrão — rápido e mais barato)' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (mais confiável em ações, custo maior)' },
];

export function findSupportedModel(provider: string, modelName: string): SupportedModelOption | undefined {
  return SUPPORTED_MODELS.find(m => m.provider === provider && m.model === modelName);
}
