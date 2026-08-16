import type { Accommodation, Currency } from '../../types/database.types';

export interface AccommodationRow {
  id: string;
  trip_id: string;
  name: string;
  chain: string | null;
  address: string;
  city: string;
  check_in: string;
  check_out: string;
  check_in_time: string | null;
  check_out_time: string | null;
  confirmation_code: string | null;
  guest_ids: string[];
  room_type: string | null;
  price_total: number | string;
  resort_fee_per_night: number | string | null;
  parking_fee_per_night: number | string | null;
  is_breakfast_included: boolean;
  currency: 'USD' | 'BRL';
  status: Accommodation['status'];
  replacement_reason: string | null;
  linked_decision_id: string | null;
  file_url: string | null;
  distance_to_airport_km: number | string | null;
  notes: string | null;
  created_at?: string;
}

export function accommodationFromRow(row: AccommodationRow): Accommodation {
  return {
    id: row.id,
    trip_id: row.trip_id,
    name: row.name,
    chain: row.chain ?? undefined,
    address: row.address,
    city: row.city,
    check_in: row.check_in,
    check_out: row.check_out,
    check_in_time: row.check_in_time ?? undefined,
    check_out_time: row.check_out_time ?? undefined,
    confirmation_code: row.confirmation_code ?? undefined,
    guest_ids: Array.isArray(row.guest_ids) ? row.guest_ids : [],
    room_type: row.room_type ?? undefined,
    price_total: Number(row.price_total) || 0,
    resort_fee_per_night: row.resort_fee_per_night !== null && row.resort_fee_per_night !== undefined ? Number(row.resort_fee_per_night) : undefined,
    parking_fee_per_night: row.parking_fee_per_night !== null && row.parking_fee_per_night !== undefined ? Number(row.parking_fee_per_night) : undefined,
    is_breakfast_included: Boolean(row.is_breakfast_included),
    currency: (row.currency as Currency) || 'USD',
    status: row.status,
    replacement_reason: row.replacement_reason ?? undefined,
    linked_decision_id: row.linked_decision_id ?? undefined,
    file_url: row.file_url ?? undefined,
    distance_to_airport_km: row.distance_to_airport_km !== null && row.distance_to_airport_km !== undefined ? Number(row.distance_to_airport_km) : undefined,
    notes: row.notes ?? undefined,
  };
}

export function accommodationToInsert(acc: Accommodation): AccommodationRow {
  return {
    id: acc.id,
    trip_id: acc.trip_id,
    name: acc.name,
    chain: acc.chain ?? null,
    address: acc.address,
    city: acc.city,
    check_in: acc.check_in,
    check_out: acc.check_out,
    check_in_time: acc.check_in_time ?? null,
    check_out_time: acc.check_out_time ?? null,
    confirmation_code: acc.confirmation_code ?? null,
    guest_ids: acc.guest_ids,
    room_type: acc.room_type ?? null,
    price_total: acc.price_total,
    resort_fee_per_night: acc.resort_fee_per_night ?? null,
    parking_fee_per_night: acc.parking_fee_per_night ?? null,
    is_breakfast_included: acc.is_breakfast_included,
    currency: acc.currency,
    status: acc.status,
    replacement_reason: acc.replacement_reason ?? null,
    linked_decision_id: acc.linked_decision_id ?? null,
    file_url: acc.file_url ?? null,
    distance_to_airport_km: acc.distance_to_airport_km ?? null,
    notes: acc.notes ?? null,
  };
}
