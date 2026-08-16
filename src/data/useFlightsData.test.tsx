// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useFlightsData } from './useFlightsData';
import type { Flight } from '../types/database.types';
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

describe('useFlightsData', () => {
  const initialFlight: Flight = {
    id: 'f-1',
    trip_id: 'trip-1',
    airline: 'LATAM',
    flight_number: 'LA8120',
    origin_airport: 'GRU',
    destination_airport: 'MIA',
    departure_time: '2026-09-05T22:30:00Z',
    arrival_time: '2026-09-06T06:00:00Z',
    booking_code: 'ABCDEF',
    class_type: 'economy',
    passenger_ids: ['p-1'],
    currency: 'USD',
    status: 'booked',
  };

  it('carrega voos do Supabase no mount', async () => {
    const client = mockClient([initialFlight]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useFlightsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.flights.length).toBe(1);
    expect(result.current.flights[0].airline).toBe('LATAM');
  });

  it('adiciona voo com escrita otimista', async () => {
    const client = mockClient([]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useFlightsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.addFlight({
        trip_id: 'trip-1',
        airline: 'Azul',
        flight_number: 'AD8706',
        origin_airport: 'VCP',
        destination_airport: 'MCO',
        departure_time: '2026-09-06T09:00:00Z',
        arrival_time: '2026-09-06T17:00:00Z',
        booking_code: 'XYZ123',
        class_type: 'economy',
        passenger_ids: ['p-1'],
        currency: 'USD',
        status: 'booked',
      });
    });

    expect(result.current.flights.length).toBe(1);
    expect(result.current.flights[0].airline).toBe('Azul');
    expect(recordFailure).not.toHaveBeenCalled();
  });
});
