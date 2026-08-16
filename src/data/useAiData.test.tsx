// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useAiData } from './useAiData';
import type { AiProviderConfig, AiUsageLog } from '../types/database.types';
import type { SupabaseLike } from './useTripsData';

afterEach(() => {
  cleanup();
});

function mockClient(configsData: unknown[] = [], logsData: unknown[] = []): SupabaseLike {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: vi.fn().mockResolvedValue({
          data: table === 'ai_provider_configs' ? configsData : logsData,
          error: null,
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
}

describe('useAiData', () => {
  const initialConfig: AiProviderConfig = {
    id: 'cfg-1',
    provider: 'gemini',
    model_name: 'gemini-3.5-flash',
    is_active: true,
    is_default: true,
    daily_token_limit: 50000,
    monthly_budget_usd: 10,
    temperature: 0.2,
  };

  const initialLog: AiUsageLog = {
    id: 'log-1',
    timestamp: '2026-08-16T12:00:00Z',
    user_name: 'Pedro',
    function_name: 'price_research',
    provider: 'gemini',
    model: 'gemini-3.5-flash',
    tokens_input: 500,
    tokens_output: 200,
    estimated_cost_usd: 0.0001,
  };

  it('carrega configs e logs de IA do Supabase no mount', async () => {
    const client = mockClient([initialConfig], [initialLog]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useAiData({ client, tenantId: 'tenant-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.aiConfigs.length).toBe(1);
    expect(result.current.aiConfigs[0].provider).toBe('gemini');
    expect(result.current.aiLogs.length).toBe(1);
  });
});
