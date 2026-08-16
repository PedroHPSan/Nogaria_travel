import { describe, expect, it } from 'vitest';
import { transportFromRow, transportToInsert, type TransportReservationRow } from './transportMapper';
import type { TransportReservation } from '../../types/database.types';

describe('transportMapper', () => {
  const mockRow: TransportReservationRow = {
    id: 'tr-1',
    trip_id: 'trip-1',
    type: 'rental_car',
    provider_company: 'Alamo',
    category_or_model: 'SUV Standard (Nissan Rogue)',
    primary_driver_id: 'p-1',
    additional_driver_ids: ['p-2'],
    pickup_location: 'MCO Airport',
    pickup_time: '2026-09-06T10:00:00Z',
    dropoff_location: 'MCO Airport',
    dropoff_time: '2026-09-20T18:00:00Z',
    confirmation_code: 'ALAMO999',
    price_total: '650.00',
    currency: 'USD',
    status: 'reserved',
    requires_followup_transport: false,
    notes: 'Seguro CDW incluso',
  };

  it('converte TransportReservationRow para TransportReservation', () => {
    const t = transportFromRow(mockRow);
    expect(t.id).toBe('tr-1');
    expect(t.provider_company).toBe('Alamo');
    expect(t.price_total).toBe(650);
    expect(t.primary_driver_id).toBe('p-1');
    expect(t.additional_driver_ids).toEqual(['p-2']);
  });

  it('serializa TransportReservation para TransportReservationRow sem perda', () => {
    const t: TransportReservation = {
      id: 'tr-1',
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
    };

    const row = transportToInsert(t);
    expect(row.id).toBe('tr-1');
    expect(row.primary_driver_id).toBeNull();
    expect(row.confirmation_code).toBeNull();
  });
});
