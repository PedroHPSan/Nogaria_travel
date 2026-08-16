// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useTransportsData } from './useTransportsData';
import type { TransportReservation } from '../types/database.types';
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

describe('useTransportsData', () => {
  const initialTransport: TransportReservation = {
    id: 'tr-1',
    trip_id: 'trip-1',
    type: 'rental_car',
    provider_company: 'Alamo',
    pickup_location: 'MCO Airport',
    pickup_time: '2026-09-06T10:00:00Z',
    dropoff_location: 'MCO Airport',
    dropoff_time: '2026-09-20T18:00:00Z',
    price_total: 650,
    currency: 'USD',
    status: 'reserved',
    requires_followup_transport: false,
  };

  it('carrega transportes do Supabase no mount', async () => {
    const client = mockClient([initialTransport]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useTransportsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.transports.length).toBe(1);
    expect(result.current.transports[0].provider_company).toBe('Alamo');
  });

  it('adiciona transporte com escrita otimista', async () => {
    const client = mockClient([]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useTransportsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.addTransport({
        trip_id: 'trip-1',
        type: 'uber',
        provider_company: 'Uber',
        pickup_location: 'Hotel',
        pickup_time: '2026-09-06T10:00:00Z',
        dropoff_location: 'Magic Kingdom',
        dropoff_time: '2026-09-06T10:30:00Z',
        price_total: 35,
        currency: 'USD',
        status: 'completed',
        requires_followup_transport: false,
      });
    });

    expect(result.current.transports.length).toBe(1);
    expect(result.current.transports[0].provider_company).toBe('Uber');
    expect(recordFailure).not.toHaveBeenCalled();
  });
});
