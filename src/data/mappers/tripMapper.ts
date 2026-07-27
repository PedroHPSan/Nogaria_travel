import type { Trip } from '../../types/database.types';

/** Linha da tabela public.trips exatamente como o Postgres devolve. */
export interface TripRow {
  id: string;
  tenant_id: string;
  title: string;
  destination_main: string;
  start_date: string;
  end_date: string;
  cover_image: string | null;
  currency_base: 'USD' | 'BRL';
  status: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

export function tripFromRow(row: TripRow): Trip {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    title: row.title,
    destination_main: row.destination_main,
    start_date: row.start_date,
    end_date: row.end_date,
    cover_image: row.cover_image ?? undefined,
    currency_base: row.currency_base,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function tripToInsert(trip: Trip): TripRow {
  return {
    id: trip.id,
    tenant_id: trip.tenant_id,
    title: trip.title,
    destination_main: trip.destination_main,
    start_date: trip.start_date,
    end_date: trip.end_date,
    cover_image: trip.cover_image ?? null,
    currency_base: trip.currency_base,
    status: trip.status,
    created_at: trip.created_at,
    updated_at: trip.updated_at,
  };
}
