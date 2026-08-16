// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useDecisionsData } from './useDecisionsData';
import type { Decision } from '../types/database.types';
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

describe('useDecisionsData', () => {
  const initialDecision: Decision = {
    id: 'dec-1',
    trip_id: 'trip-1',
    topic: 'Aluguel SUV vs Uber',
    alternatives_considered: ['Aluguel SUV', 'Uber'],
    chosen_decision: 'Aluguel SUV',
    reason: 'Mais conforto',
    decided_by_id: 'p-1',
    date: '2026-07-20',
    is_active: true,
  };

  it('carrega decisões do Supabase no mount', async () => {
    const client = mockClient([initialDecision]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useDecisionsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.decisions.length).toBe(1);
    expect(result.current.decisions[0].topic).toBe('Aluguel SUV vs Uber');
  });

  it('adiciona decisão com escrita otimista', async () => {
    const client = mockClient([]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useDecisionsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.addDecision({
        trip_id: 'trip-1',
        topic: 'Hotel Disney vs Universal',
        alternatives_considered: ['Pop Century', 'Endless Summer'],
        chosen_decision: 'Endless Summer',
        reason: 'Custo benefício',
        decided_by_id: 'p-1',
        date: '2026-07-22',
        is_active: true,
      });
    });

    expect(result.current.decisions.length).toBe(1);
    expect(result.current.decisions[0].topic).toBe('Hotel Disney vs Universal');
    expect(recordFailure).not.toHaveBeenCalled();
  });
});
