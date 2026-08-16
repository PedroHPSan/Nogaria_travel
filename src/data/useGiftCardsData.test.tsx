// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useGiftCardsData } from './useGiftCardsData';
import type { GiftCard } from '../types/database.types';
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

describe('useGiftCardsData', () => {
  const initialGiftCard: GiftCard = {
    id: 'gc-1',
    trip_id: 'trip-1',
    store_brand: 'Apple',
    nominal_value: 500,
    paid_amount: 450,
    cashback_pct: 2,
    cashback_amount: 9,
    net_cost: 441,
    effective_savings: 59,
    effective_savings_pct: 11.8,
    currency: 'USD',
    purchased_by_id: 'p-1',
    card_code_masked: '•••• 1234',
    current_balance: 500,
    status: 'active',
    purchase_date: '2026-08-01',
  };

  it('carrega gift cards do Supabase no mount', async () => {
    const client = mockClient([initialGiftCard]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useGiftCardsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.giftCards.length).toBe(1);
    expect(result.current.giftCards[0].store_brand).toBe('Apple');
  });

  it('adiciona gift card calculando os valores financeiros', async () => {
    const client = mockClient([]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useGiftCardsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.addGiftCard({
        trip_id: 'trip-1',
        store_brand: 'Target',
        nominal_value: 100,
        paid_amount: 90,
        cashback_pct: 5,
        currency: 'USD',
        purchased_by_id: 'p-1',
        card_code_masked: '•••• 5678',
        current_balance: 100,
        status: 'active',
        purchase_date: '2026-08-01',
      });
    });

    expect(result.current.giftCards.length).toBe(1);
    expect(result.current.giftCards[0].store_brand).toBe('Target');
    expect(result.current.giftCards[0].cashback_amount).toBe(4.5);
    expect(result.current.giftCards[0].net_cost).toBe(85.5);
  });
});
