import { describe, expect, it } from 'vitest';
import { accommodationFromRow, accommodationToInsert, type AccommodationRow } from './accommodationMapper';
import type { Accommodation } from '../../types/database.types';

describe('accommodationMapper', () => {
  const mockRow: AccommodationRow = {
    id: 'acc-1',
    trip_id: 'trip-1',
    name: 'Universal Endless Summer Resort',
    chain: 'Universal',
    address: '7000 Universal Blvd',
    city: 'Orlando',
    check_in: '2026-09-06',
    check_out: '2026-09-15',
    check_in_time: '16:00',
    check_out_time: '11:00',
    confirmation_code: 'UNI123',
    guest_ids: ['p-1', 'p-2'],
    room_type: '2 Bedroom Suite',
    price_total: '1850.00',
    resort_fee_per_night: '0.00',
    parking_fee_per_night: '18.00',
    is_breakfast_included: false,
    currency: 'USD',
    status: 'confirmed',
    replacement_reason: null,
    linked_decision_id: null,
    file_url: 'https://example.com/voucher.pdf',
    distance_to_airport_km: '24.5',
    notes: 'Quarto com vista para piscina',
  };

  it('converte AccommodationRow para Accommodation', () => {
    const acc = accommodationFromRow(mockRow);
    expect(acc.id).toBe('acc-1');
    expect(acc.name).toBe('Universal Endless Summer Resort');
    expect(acc.price_total).toBe(1850);
    expect(acc.parking_fee_per_night).toBe(18);
    expect(acc.distance_to_airport_km).toBe(24.5);
    expect(acc.guest_ids).toEqual(['p-1', 'p-2']);
  });

  it('serializa Accommodation para AccommodationRow sem perda', () => {
    const acc: Accommodation = {
      id: 'acc-1',
      trip_id: 'trip-1',
      name: 'Universal Endless Summer Resort',
      address: '7000 Universal Blvd',
      city: 'Orlando',
      check_in: '2026-09-06',
      check_out: '2026-09-15',
      guest_ids: ['p-1'],
      price_total: 1850,
      is_breakfast_included: false,
      currency: 'USD',
      status: 'confirmed',
    };

    const row = accommodationToInsert(acc);
    expect(row.id).toBe('acc-1');
    expect(row.chain).toBeNull();
    expect(row.resort_fee_per_night).toBeNull();
  });
});
