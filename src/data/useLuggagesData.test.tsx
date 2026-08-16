// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useLuggagesData } from './useLuggagesData';
import type { Luggage } from '../types/database.types';
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

describe('useLuggagesData', () => {
  const initialLuggage: Luggage = {
    id: 'lug-1',
    trip_id: 'trip-1',
    participant_id: 'p-1',
    type: 'checked',
    bag_identifier: 'Mala Grande Samsonite',
    max_weight_kg: 23,
  };

  it('carrega bagagens do Supabase no mount', async () => {
    const client = mockClient([initialLuggage]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useLuggagesData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.luggages.length).toBe(1);
    expect(result.current.luggages[0].bag_identifier).toBe('Mala Grande Samsonite');
  });

  it('adiciona bagagem com escrita otimista', async () => {
    const client = mockClient([]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useLuggagesData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.addLuggage({
        trip_id: 'trip-1',
        participant_id: 'p-1',
        type: 'carry_on',
        bag_identifier: 'Mala Bordo Azul',
        max_weight_kg: 10,
      });
    });

    expect(result.current.luggages.length).toBe(1);
    expect(result.current.luggages[0].bag_identifier).toBe('Mala Bordo Azul');
    expect(recordFailure).not.toHaveBeenCalled();
  });
});
