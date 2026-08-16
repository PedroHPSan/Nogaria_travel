import { describe, expect, it } from 'vitest';
import { aiConfigFromRow, aiConfigToInsert, aiUsageLogFromRow, type AiProviderConfigRow, type AiUsageLogRow } from './aiConfigMapper';
import type { AiProviderConfig } from '../../types/database.types';

describe('aiConfigMapper', () => {
  const mockConfigRow: AiProviderConfigRow = {
    id: 'cfg-1',
    tenant_id: 'tenant-1',
    provider: 'gemini',
    model_name: 'gemini-3.5-flash',
    is_active: true,
    is_default: true,
    daily_token_limit: 50000,
    monthly_budget_usd: '10.00',
    temperature: '0.20',
  };

  it('converte AiProviderConfigRow para AiProviderConfig', () => {
    const cfg = aiConfigFromRow(mockConfigRow);
    expect(cfg.id).toBe('cfg-1');
    expect(cfg.provider).toBe('gemini');
    expect(cfg.model_name).toBe('gemini-3.5-flash');
    expect(cfg.monthly_budget_usd).toBe(10);
    expect(cfg.temperature).toBe(0.2);
  });

  it('serializa AiProviderConfig para AiProviderConfigRow com tenant_id', () => {
    const cfg: AiProviderConfig = {
      id: 'cfg-1',
      provider: 'openai',
      model_name: 'gpt-4o',
      is_active: true,
      is_default: false,
      daily_token_limit: 100000,
      monthly_budget_usd: 20,
      temperature: 0.5,
    };

    const row = aiConfigToInsert(cfg, 'tenant-1');
    expect(row.id).toBe('cfg-1');
    expect(row.tenant_id).toBe('tenant-1');
    expect(row.provider).toBe('openai');
  });

  it('converte AiUsageLogRow para AiUsageLog', () => {
    const mockUsageRow: AiUsageLogRow = {
      id: 'log-1',
      tenant_id: 'tenant-1',
      timestamp: '2026-08-16T12:00:00Z',
      user_name: 'Pedro',
      function_name: 'price_research',
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      tokens_input: 450,
      tokens_output: 220,
      estimated_cost_usd: '0.00010',
    };

    const log = aiUsageLogFromRow(mockUsageRow);
    expect(log.id).toBe('log-1');
    expect(log.tokens_input).toBe(450);
    expect(log.estimated_cost_usd).toBe(0.0001);
  });
});
