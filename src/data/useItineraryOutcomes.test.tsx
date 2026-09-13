// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useItineraryOutcomes } from './useItineraryOutcomes';
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
      update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  };
}

describe('useItineraryOutcomes', () => {
  it('indexa as linhas por itinerary_item_id', async () => {
    const client = mockClient([
      { id: 'o1', itinerary_item_id: 'i1', status: 'skipped', note: 'fila enorme' },
      { id: 'o2', itinerary_item_id: 'i2', status: 'cancelled', note: null },
    ]);

    const { result } = renderHook(() => useItineraryOutcomes({ client, tripId: 'trip-1' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.outcomes).toEqual({
      i1: { status: 'skipped', note: 'fila enorme' },
      i2: { status: 'cancelled', note: null },
    });
  });

  it('sem tripId não busca nada e não fica em loading', async () => {
    const client = mockClient([]);
    const { result } = renderHook(() => useItineraryOutcomes({ client, tripId: null }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.outcomes).toEqual({});
  });
});
