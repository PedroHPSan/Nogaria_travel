import type { TransportReservation, Currency } from '../../types/database.types';

export interface TransportReservationRow {
  id: string;
  trip_id: string;
  type: TransportReservation['type'];
  provider_company: string;
  category_or_model: string | null;
  primary_driver_id: string | null;
  additional_driver_ids: string[];
  pickup_location: string;
  pickup_time: string;
  dropoff_location: string;
  dropoff_time: string;
  confirmation_code: string | null;
  price_total: number | string;
  currency: 'USD' | 'BRL';
  status: TransportReservation['status'];
  requires_followup_transport: boolean;
  notes: string | null;
  created_at?: string;
}

export function transportFromRow(row: TransportReservationRow): TransportReservation {
  return {
    id: row.id,
    trip_id: row.trip_id,
    type: row.type,
    provider_company: row.provider_company,
    category_or_model: row.category_or_model ?? undefined,
    primary_driver_id: row.primary_driver_id ?? undefined,
    additional_driver_ids: Array.isArray(row.additional_driver_ids) ? row.additional_driver_ids : [],
    pickup_location: row.pickup_location,
    pickup_time: row.pickup_time,
    dropoff_location: row.dropoff_location,
    dropoff_time: row.dropoff_time,
    confirmation_code: row.confirmation_code ?? undefined,
    price_total: Number(row.price_total) || 0,
    currency: (row.currency as Currency) || 'USD',
    status: row.status,
    requires_followup_transport: Boolean(row.requires_followup_transport),
    notes: row.notes ?? undefined,
  };
}

export function transportToInsert(t: TransportReservation): TransportReservationRow {
  return {
    id: t.id,
    trip_id: t.trip_id,
    type: t.type,
    provider_company: t.provider_company,
    category_or_model: t.category_or_model ?? null,
    primary_driver_id: t.primary_driver_id ?? null,
    additional_driver_ids: t.additional_driver_ids ?? [],
    pickup_location: t.pickup_location,
    pickup_time: t.pickup_time,
    dropoff_location: t.dropoff_location,
    dropoff_time: t.dropoff_time,
    confirmation_code: t.confirmation_code ?? null,
    price_total: t.price_total,
    currency: t.currency,
    status: t.status,
    requires_followup_transport: t.requires_followup_transport,
    notes: t.notes ?? null,
  };
}
