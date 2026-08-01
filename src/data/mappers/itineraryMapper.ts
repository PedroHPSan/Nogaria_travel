import type { ItineraryItem } from '../../types/database.types';

/** Linha da tabela public.itinerary_items exatamente como o Postgres devolve. */
export interface ItineraryItemRow {
  id: string;
  trip_id: string;
  date: string;
  time_start: string;
  time_end: string | null;
  city: string;
  title: string;
  category: 'flight' | 'hotel' | 'park' | 'restaurant' | 'shopping' | 'tour' | 'rest' | 'transit' | 'event';
  description: string | null;
  location: string | null;
  participant_ids: string[];
  estimated_cost: number | null;
  currency: 'USD' | 'BRL' | null;
  payment_method_id: string | null;
  status: 'planned' | 'confirmed' | 'optional' | 'completed' | 'cancelled';
  min_height_cm: number | null;
  min_age_years: number | null;
  child_friendly: boolean;
  notes: string | null;
  park: string | null;
  area: string | null;
  base_order: number | null;
  item_type: 'attraction' | 'show' | 'experience' | 'character' | null;
  priority_tier: 'S' | 'A' | 'B' | 'C' | null;
  lightning_lane: 'none' | 'genie_plus' | 'individual' | 'express' | null;
  lightning_lane_priority_rank: number | null;
  single_rider: boolean;
  child_switch: boolean;
  recommended_window: string | null;
  early_closure_risk: boolean;
  operational_status: 'operating' | 'scheduled_closure' | 'temporarily_closed' | 'refurbishment' | null;
  counts_toward_completion: boolean | null;
  participant_status: Record<string, 'pending' | 'done' | 'skipped' | 'height_restricted' | 'not_applicable'>;
  plan_b: string | null;
  time_is_estimated: boolean;
  show_block_start: string | null;
  show_block_end: string | null;
  recommended_arrival_min_before: number | null;
  last_showtime_of_day: boolean;
}

/** Colunas `time` do Postgres voltam como "HH:MM:SS" — trunca pros 5 primeiros caracteres. */
function truncarHora(valor: string | null): string | undefined {
  return valor ? valor.slice(0, 5) : undefined;
}

export function itineraryFromRow(row: ItineraryItemRow): ItineraryItem {
  return {
    id: row.id,
    trip_id: row.trip_id,
    date: row.date,
    time_start: row.time_start.slice(0, 5),
    time_end: truncarHora(row.time_end),
    city: row.city,
    title: row.title,
    category: row.category,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    participant_ids: row.participant_ids,
    estimated_cost: row.estimated_cost ?? undefined,
    currency: row.currency ?? undefined,
    payment_method_id: row.payment_method_id ?? undefined,
    status: row.status,
    min_height_cm: row.min_height_cm ?? undefined,
    min_age_years: row.min_age_years ?? undefined,
    child_friendly: row.child_friendly,
    notes: row.notes ?? undefined,
    park: row.park ?? undefined,
    area: row.area ?? undefined,
    base_order: row.base_order ?? undefined,
    item_type: row.item_type ?? undefined,
    priority_tier: row.priority_tier ?? undefined,
    lightning_lane: row.lightning_lane ?? undefined,
    lightning_lane_priority_rank: row.lightning_lane_priority_rank ?? undefined,
    single_rider: row.single_rider,
    child_switch: row.child_switch,
    recommended_window: row.recommended_window ?? undefined,
    early_closure_risk: row.early_closure_risk,
    operational_status: row.operational_status ?? undefined,
    counts_toward_completion: row.counts_toward_completion ?? undefined,
    participant_status: row.participant_status,
    plan_b: row.plan_b ?? undefined,
    time_is_estimated: row.time_is_estimated,
    show_block_start: truncarHora(row.show_block_start),
    show_block_end: truncarHora(row.show_block_end),
    recommended_arrival_min_before: row.recommended_arrival_min_before ?? undefined,
    last_showtime_of_day: row.last_showtime_of_day,
  };
}

export function itineraryToInsert(item: ItineraryItem): ItineraryItemRow {
  return {
    id: item.id,
    trip_id: item.trip_id,
    date: item.date,
    time_start: item.time_start,
    time_end: item.time_end ?? null,
    city: item.city,
    title: item.title,
    category: item.category,
    description: item.description ?? null,
    location: item.location ?? null,
    participant_ids: item.participant_ids,
    estimated_cost: item.estimated_cost ?? null,
    currency: item.currency ?? null,
    payment_method_id: item.payment_method_id ?? null,
    status: item.status,
    min_height_cm: item.min_height_cm ?? null,
    min_age_years: item.min_age_years ?? null,
    child_friendly: item.child_friendly,
    notes: item.notes ?? null,
    park: item.park ?? null,
    area: item.area ?? null,
    base_order: item.base_order ?? null,
    item_type: item.item_type ?? null,
    priority_tier: item.priority_tier ?? null,
    lightning_lane: item.lightning_lane ?? null,
    lightning_lane_priority_rank: item.lightning_lane_priority_rank ?? null,
    single_rider: item.single_rider ?? false,
    child_switch: item.child_switch ?? false,
    recommended_window: item.recommended_window ?? null,
    early_closure_risk: item.early_closure_risk ?? false,
    operational_status: item.operational_status ?? null,
    counts_toward_completion: item.counts_toward_completion ?? null,
    participant_status: item.participant_status ?? {},
    plan_b: item.plan_b ?? null,
    time_is_estimated: item.time_is_estimated ?? false,
    show_block_start: item.show_block_start ?? null,
    show_block_end: item.show_block_end ?? null,
    recommended_arrival_min_before: item.recommended_arrival_min_before ?? null,
    last_showtime_of_day: item.last_showtime_of_day ?? false,
  };
}
