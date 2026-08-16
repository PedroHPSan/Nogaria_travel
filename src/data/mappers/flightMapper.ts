import type { Flight, Currency } from '../../types/database.types';

export interface FlightRow {
  id: string;
  trip_id: string;
  airline: string;
  flight_number: string;
  loyalty_program: string | null;
  origin_airport: string;
  destination_airport: string;
  departure_time: string;
  arrival_time: string;
  terminal: string | null;
  booking_code: string;
  class_type: Flight['class_type'];
  passenger_ids: string[];
  seats: Record<string, string> | null;
  price_cash: number | string | null;
  price_points: number | string | null;
  taxes_amount: number | string | null;
  currency: 'USD' | 'BRL';
  status: Flight['status'];
  file_url: string | null;
  notes: string | null;
  created_at?: string;
}

export function flightFromRow(row: FlightRow): Flight {
  return {
    id: row.id,
    trip_id: row.trip_id,
    airline: row.airline,
    flight_number: row.flight_number,
    loyalty_program: row.loyalty_program ?? undefined,
    origin_airport: row.origin_airport,
    destination_airport: row.destination_airport,
    departure_time: row.departure_time,
    arrival_time: row.arrival_time,
    terminal: row.terminal ?? undefined,
    booking_code: row.booking_code,
    class_type: row.class_type,
    passenger_ids: Array.isArray(row.passenger_ids) ? row.passenger_ids : [],
    seats: row.seats && typeof row.seats === 'object' ? row.seats : undefined,
    price_cash: row.price_cash !== null && row.price_cash !== undefined ? Number(row.price_cash) : undefined,
    price_points: row.price_points !== null && row.price_points !== undefined ? Number(row.price_points) : undefined,
    taxes_amount: row.taxes_amount !== null && row.taxes_amount !== undefined ? Number(row.taxes_amount) : undefined,
    currency: (row.currency as Currency) || 'USD',
    status: row.status,
    file_url: row.file_url ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function flightToInsert(flight: Flight): FlightRow {
  return {
    id: flight.id,
    trip_id: flight.trip_id,
    airline: flight.airline,
    flight_number: flight.flight_number,
    loyalty_program: flight.loyalty_program ?? null,
    origin_airport: flight.origin_airport,
    destination_airport: flight.destination_airport,
    departure_time: flight.departure_time,
    arrival_time: flight.arrival_time,
    terminal: flight.terminal ?? null,
    booking_code: flight.booking_code,
    class_type: flight.class_type,
    passenger_ids: flight.passenger_ids,
    seats: flight.seats ?? null,
    price_cash: flight.price_cash ?? null,
    price_points: flight.price_points ?? null,
    taxes_amount: flight.taxes_amount ?? null,
    currency: flight.currency,
    status: flight.status,
    file_url: flight.file_url ?? null,
    notes: flight.notes ?? null,
  };
}
