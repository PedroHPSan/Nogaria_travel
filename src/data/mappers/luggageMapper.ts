import type { Luggage } from '../../types/database.types';

export interface LuggageRow {
  id: string;
  trip_id: string;
  participant_id: string;
  type: Luggage['type'];
  bag_identifier: string;
  max_weight_kg: number | string;
  current_weight_kg: number | string | null;
  description: string | null;
  shopping_space_reserved_pct: number | string | null;
  created_at?: string;
}

export function luggageFromRow(row: LuggageRow): Luggage {
  return {
    id: row.id,
    trip_id: row.trip_id,
    participant_id: row.participant_id,
    type: row.type,
    bag_identifier: row.bag_identifier,
    max_weight_kg: Number(row.max_weight_kg) || 23,
    current_weight_kg: row.current_weight_kg !== null && row.current_weight_kg !== undefined ? Number(row.current_weight_kg) : undefined,
    description: row.description ?? undefined,
    shopping_space_reserved_pct: row.shopping_space_reserved_pct !== null && row.shopping_space_reserved_pct !== undefined ? Number(row.shopping_space_reserved_pct) : undefined,
  };
}

export function luggageToInsert(l: Luggage): LuggageRow {
  return {
    id: l.id,
    trip_id: l.trip_id,
    participant_id: l.participant_id,
    type: l.type,
    bag_identifier: l.bag_identifier,
    max_weight_kg: l.max_weight_kg,
    current_weight_kg: l.current_weight_kg ?? null,
    description: l.description ?? null,
    shopping_space_reserved_pct: l.shopping_space_reserved_pct ?? null,
  };
}
