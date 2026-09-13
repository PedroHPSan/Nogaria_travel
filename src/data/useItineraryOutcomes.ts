import { useEffect, useState } from 'react';
import type { SupabaseLike } from './useTripsData';
import type { RealtimeClientLike } from './useRealtimeTable';
import { useRealtimeTable } from './useRealtimeTable';
import { outcomesFromRows, type ItineraryOutcome, type ItineraryOutcomeRow } from './mappers/itineraryOutcomeMapper';

export interface ItineraryOutcomesDeps {
  client: SupabaseLike;
  tripId: string | null;
  realtime?: RealtimeClientLike | null;
}

/**
 * Leitura de itinerary_item_outcomes — o "banco de atividades não realizadas"
 * que o check-in do WhatsApp já preenche (skipped/cancelled), mas que até
 * aqui era invisível no app (gap documentado no CLAUDE.md). Só leitura: quem
 * escreve é o bot (confirm_itinerary_outcome/cancel_itinerary_item) e a RPC
 * apply_itinerary_changes (que limpa a pendência ao reagendar/replanejar).
 */
export function useItineraryOutcomes({ client, tripId, realtime }: ItineraryOutcomesDeps) {
  const [outcomes, setOutcomes] = useState<Record<string, ItineraryOutcome>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setOutcomes({});
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('itinerary_item_outcomes')
      .select('id, itinerary_item_id, status, note')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data) {
          setOutcomes(outcomesFromRows(data as ItineraryOutcomeRow[]));
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  useRealtimeTable<ItineraryOutcomeRow>({
    client: realtime ?? null,
    table: 'itinerary_item_outcomes',
    filter: tripId ? `trip_id=eq.${tripId}` : null,
    onInsert: row => setOutcomes(prev => ({ ...prev, [row.itinerary_item_id]: { status: row.status, note: row.note } })),
    onUpdate: row => setOutcomes(prev => ({ ...prev, [row.itinerary_item_id]: { status: row.status, note: row.note } })),
    // O evento DELETE só traz o id da linha apagada, não itinerary_item_id —
    // sem isso não dá pra saber qual chave remover do índice. A única causa
    // de delete é reagendar/replanejar o item (RPC apply_itinerary_changes ou
    // reschedule_itinerary_item), que resolve a pendência; refaz o fetch
    // completo em vez de tentar adivinhar a chave por um id que não temos.
    onDelete: () => {
      if (!tripId) return;
      client
        .from('itinerary_item_outcomes')
        .select('id, itinerary_item_id, status, note')
        .eq('trip_id', tripId)
        .then(({ data, error }) => {
          if (!error && data) setOutcomes(outcomesFromRows(data as ItineraryOutcomeRow[]));
        });
    },
  });

  return { outcomes, loading };
}
