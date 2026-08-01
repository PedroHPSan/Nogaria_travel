import { useCallback, useEffect, useState } from 'react';
import type { ItineraryItem } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { itineraryFromRow, itineraryToInsert, type ItineraryItemRow } from './mappers/itineraryMapper';

export interface ItineraryDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
}

export function useItineraryData({ client, tripId, recordFailure }: ItineraryDataDeps) {
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setItinerary([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('itinerary_items')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data) setItinerary((data as ItineraryItemRow[]).map(itineraryFromRow));
        setLoading(false);
      });

    return () => { cancelado = true; };
  }, [client, tripId]);

  const addItineraryItem = useCallback(
    (data: Omit<ItineraryItem, 'id'>) => {
      const item: ItineraryItem = { ...data, id: newId() };

      const escrever = () => {
        setItinerary(prev => [...prev, item]);
        client
          .from('itinerary_items')
          .insert(itineraryToInsert(item))
          .then(({ error }) => {
            if (!error) return;
            setItinerary(prev => prev.filter(x => x.id !== item.id));
            recordFailure({
              entity: 'Item de roteiro',
              operation: 'criar',
              label: item.title,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateItineraryItem = useCallback(
    (id: string, patch: Partial<ItineraryItem>) => {
      const anterior = itinerary.find(x => x.id === id);
      if (!anterior) return;

      const atualizado: ItineraryItem = { ...anterior, ...patch };

      const escrever = () => {
        setItinerary(atual => atual.map(x => (x.id === id ? atualizado : x)));
        client
          .from('itinerary_items')
          .update(itineraryToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error) return;
            setItinerary(atual => atual.map(x => (x.id === id ? anterior : x)));
            recordFailure({
              entity: 'Item de roteiro',
              operation: 'atualizar',
              label: anterior.title,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure, itinerary],
  );

  const deleteItineraryItem = useCallback(
    (id: string) => {
      const removido = itinerary.find(x => x.id === id);
      if (!removido) return;

      const escrever = () => {
        setItinerary(atual => atual.filter(x => x.id !== id));
        client
          .from('itinerary_items')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error) return;
            setItinerary(atual => [...atual, removido]);
            recordFailure({
              entity: 'Item de roteiro',
              operation: 'excluir',
              label: removido.title,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure, itinerary],
  );

  return { itinerary, loading, addItineraryItem, updateItineraryItem, deleteItineraryItem };
}
