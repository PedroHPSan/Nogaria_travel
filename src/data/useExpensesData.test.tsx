// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useExpensesData } from './useExpensesData';
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

describe('useExpensesData', () => {
  it('loads expenses from supabase', async () => {
    const row = {
      id: 'exp-1',
      trip_id: 'trip-1',
      description: 'Test Expense',
      amount: '100',
      currency: 'USD',
      amount_usd: '100',
      amount_brl: '562',
      exchange_rate: '5.62',
      category: 'food',
      paid_by_id: 'p-1',
      beneficiary_ids: ['p-1'],
      date: '2026-08-10',
      status: 'paid',
    };

    const client = mockClient([row]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useExpensesData({
        client,
        tripId: 'trip-1',
        recordFailure,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.expenses).toHaveLength(1);
    expect(result.current.expenses[0].description).toBe('Test Expense');
  });

  it('adds an expense optimistically', async () => {
    const client = mockClient([]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useExpensesData({
        client,
        tripId: 'trip-1',
        recordFailure,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.addExpense({
        trip_id: 'trip-1',
        description: 'New Dinner',
        amount: 250,
        currency: 'USD',
        amount_usd: 250,
        amount_brl: 1405,
        exchange_rate: 5.62,
        category: 'food',
        paid_by_id: 'p-1',
        beneficiary_ids: ['p-1'],
        date: '2026-08-15',
        status: 'paid',
      });
    });

    expect(result.current.expenses).toHaveLength(1);
    expect(result.current.expenses[0].description).toBe('New Dinner');
  });
});
