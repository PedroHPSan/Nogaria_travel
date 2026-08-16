// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useAccommodationsData } from './useAccommodationsData';
import type { Accommodation } from '../types/database.types';
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

describe('useAccommodationsData', () => {
  const initialAcc: Accommodation = {
    id: 'acc-1',
    trip_id: 'trip-1',
    name: 'Universal Endless Summer',
    address: '7000 Universal Blvd',
    city: 'Orlando',
    check_in: '2026-09-06',
    check_out: '2026-09-15',
    guest_ids: ['p-1'],
    price_total: 1850,
    is_breakfast_included: false,
    currency: 'USD',
    status: 'confirmed',
  };

  it('carrega acomodações do Supabase no mount', async () => {
    const client = mockClient([initialAcc]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useAccommodationsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accommodations.length).toBe(1);
    expect(result.current.accommodations[0].name).toBe('Universal Endless Summer');
  });

  it('adiciona acomodação com escrita otimista', async () => {
    const client = mockClient([]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useAccommodationsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.addAccommodation({
        trip_id: 'trip-1',
        name: 'Disney Pop Century',
        address: '1050 Century Dr',
        city: 'Orlando',
        check_in: '2026-09-15',
        check_out: '2026-09-20',
        guest_ids: ['p-1'],
        price_total: 950,
        is_breakfast_included: false,
        currency: 'USD',
        status: 'confirmed',
      });
    });

    expect(result.current.accommodations.length).toBe(1);
    expect(result.current.accommodations[0].name).toBe('Disney Pop Century');
    expect(recordFailure).not.toHaveBeenCalled();
  });
});
