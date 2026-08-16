// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useLoyaltyData } from './useLoyaltyData';
import type { LoyaltyAccount } from '../types/database.types';
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

describe('useLoyaltyData', () => {
  const initialAcc: LoyaltyAccount = {
    id: 'loy-1',
    trip_id: 'trip-1',
    program_name: 'LATAM Pass',
    holder_id: 'p-1',
    balance_points: 120000,
    cpm_usd: 14.5,
    cash_equivalent_usd: 1740,
  };

  it('carrega contas de fidelidade do Supabase no mount', async () => {
    const client = mockClient([initialAcc]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useLoyaltyData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.loyaltyAccounts.length).toBe(1);
    expect(result.current.loyaltyAccounts[0].program_name).toBe('LATAM Pass');
  });

  it('adiciona conta de fidelidade com escrita otimista', async () => {
    const client = mockClient([]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useLoyaltyData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.addLoyaltyAccount({
        trip_id: 'trip-1',
        program_name: 'Smiles',
        holder_id: 'p-1',
        balance_points: 50000,
        cpm_usd: 12.0,
        cash_equivalent_usd: 600,
      });
    });

    expect(result.current.loyaltyAccounts.length).toBe(1);
    expect(result.current.loyaltyAccounts[0].program_name).toBe('Smiles');
    expect(recordFailure).not.toHaveBeenCalled();
  });
});
