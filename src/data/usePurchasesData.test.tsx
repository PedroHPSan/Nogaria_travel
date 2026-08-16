// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { usePurchasesData } from './usePurchasesData';
import type { PurchaseItem } from '../types/database.types';
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

describe('usePurchasesData', () => {
  const initialPurchase: PurchaseItem = {
    id: 'item-1',
    trip_id: 'trip-1',
    product_name: 'iPhone 16',
    category: 'electronics',
    target_participant_id: 'p-1',
    priority: 'high',
    quantity: 1,
    target_price_usd: 799,
    gift_card_eligible: true,
    status: 'planned',
  };

  it('carrega purchases do Supabase no mount', async () => {
    const client = mockClient([initialPurchase]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      usePurchasesData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.purchases.length).toBe(1);
    expect(result.current.purchases[0].product_name).toBe('iPhone 16');
  });

  it('adiciona purchase com escrita otimista', async () => {
    const client = mockClient([]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      usePurchasesData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.addPurchase({
        trip_id: 'trip-1',
        product_name: 'Apple Watch',
        category: 'electronics',
        target_participant_id: 'p-1',
        priority: 'medium',
        quantity: 1,
        target_price_usd: 399,
        gift_card_eligible: true,
        status: 'planned',
      });
    });

    expect(result.current.purchases.length).toBe(1);
    expect(result.current.purchases[0].product_name).toBe('Apple Watch');
    expect(recordFailure).not.toHaveBeenCalled();
  });
});
