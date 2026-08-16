import type { AiProviderConfig, AiUsageLog } from '../../types/database.types';

export interface AiProviderConfigRow {
  id: string;
  tenant_id: string;
  provider: AiProviderConfig['provider'];
  model_name: string;
  is_active: boolean;
  is_default: boolean;
  daily_token_limit: number;
  monthly_budget_usd: number | string;
  temperature: number | string;
  created_at?: string;
}

export interface AiUsageLogRow {
  id: string;
  tenant_id: string;
  timestamp: string;
  user_name: string;
  function_name: string;
  provider: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
  estimated_cost_usd: number | string;
}

export function aiConfigFromRow(row: AiProviderConfigRow): AiProviderConfig {
  return {
    id: row.id,
    provider: row.provider,
    model_name: row.model_name,
    is_active: Boolean(row.is_active),
    is_default: Boolean(row.is_default),
    daily_token_limit: Number(row.daily_token_limit) || 0,
    monthly_budget_usd: Number(row.monthly_budget_usd) || 0,
    temperature: Number(row.temperature) || 0.7,
  };
}

export function aiConfigToInsert(cfg: AiProviderConfig, tenantId: string): AiProviderConfigRow {
  return {
    id: cfg.id,
    tenant_id: tenantId,
    provider: cfg.provider,
    model_name: cfg.model_name,
    is_active: cfg.is_active,
    is_default: cfg.is_default,
    daily_token_limit: cfg.daily_token_limit,
    monthly_budget_usd: cfg.monthly_budget_usd,
    temperature: cfg.temperature,
  };
}

export function aiUsageLogFromRow(row: AiUsageLogRow): AiUsageLog {
  return {
    id: row.id,
    timestamp: row.timestamp,
    user_name: row.user_name,
    function_name: row.function_name,
    provider: row.provider,
    model: row.model,
    tokens_input: Number(row.tokens_input) || 0,
    tokens_output: Number(row.tokens_output) || 0,
    estimated_cost_usd: Number(row.estimated_cost_usd) || 0,
  };
}
