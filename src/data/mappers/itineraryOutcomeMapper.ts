export interface ItineraryOutcomeRow {
  id: string;
  itinerary_item_id: string;
  status: 'pending' | 'skipped' | 'cancelled';
  note: string | null;
}

export interface ItineraryOutcome {
  status: 'pending' | 'skipped' | 'cancelled';
  note: string | null;
}

/** Índice por itinerary_item_id — é assim que a UI consulta ("este cartão tem pendência?"). */
export function outcomesFromRows(rows: ItineraryOutcomeRow[]): Record<string, ItineraryOutcome> {
  const byItemId: Record<string, ItineraryOutcome> = {};
  for (const row of rows) {
    byItemId[row.itinerary_item_id] = { status: row.status, note: row.note };
  }
  return byItemId;
}
