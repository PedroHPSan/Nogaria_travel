import { describe, expect, it } from 'vitest';
import { flightFromRow, flightToInsert, type FlightRow } from './flightMapper';
import type { Flight } from '../../types/database.types';

describe('flightMapper', () => {
  const mockRow: FlightRow = {
    id: 'f-1',
    trip_id: 'trip-1',
    airline: 'LATAM',
    flight_number: 'LA8120',
    loyalty_program: 'LATAM Pass',
    origin_airport: 'GRU',
    destination_airport: 'MIA',
    departure_time: '2026-09-05T22:30:00Z',
    arrival_time: '2026-09-06T06:00:00Z',
    terminal: '3',
    booking_code: 'ABCDEF',
    class_type: 'economy',
    passenger_ids: ['p-1', 'p-2'],
    seats: { 'p-1': '14A', 'p-2': '14B' },
    price_cash: '1200.50',
    price_points: null,
    taxes_amount: '120.00',
    currency: 'USD',
    status: 'booked',
    file_url: 'https://example.com/ticket.pdf',
    notes: 'Voo direto',
  };

  it('converte FlightRow para Flight corretamente', () => {
    const flight = flightFromRow(mockRow);
    expect(flight.id).toBe('f-1');
    expect(flight.airline).toBe('LATAM');
    expect(flight.price_cash).toBe(1200.5);
    expect(flight.passenger_ids).toEqual(['p-1', 'p-2']);
    expect(flight.seats).toEqual({ 'p-1': '14A', 'p-2': '14B' });
  });

  it('serializa Flight para FlightRow sem perda', () => {
    const flight: Flight = {
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

    const row = flightToInsert(flight);
    expect(row.id).toBe('f-1');
    expect(row.terminal).toBeNull();
    expect(row.price_cash).toBeNull();
  });
});
