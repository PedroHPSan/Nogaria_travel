// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useAuditResolutionsData } from './useAuditResolutionsData';
import type { SupabaseLike } from './useTripsData';

afterEach(() => {
  cleanup();
});

function mockClient(initialData: unknown[] = []): SupabaseLike {
  return {
    from: () => ({
      select: () => ({
        eq: vi.fn().mockResolvedValue({ data: initialData, error: null }),
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

describe('useAuditResolutionsData', () => {
  it('carrega resoluções de auditoria do Supabase no mount', async () => {
    const client = mockClient([{ finding_id: 'finding-1' }]);

    const { result } = renderHook(() =>
      useAuditResolutionsData({ client, tripId: 'trip-1' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.resolvedAuditIds).toEqual(['finding-1']);
  });

  it('alterna resolução de auditoria', async () => {
    const client = mockClient([]);

    const { result } = renderHook(() =>
      useAuditResolutionsData({ client, tripId: 'trip-1' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.toggleResolveAudit('finding-2');
    });

    expect(result.current.resolvedAuditIds).toEqual(['finding-2']);
  });
});
