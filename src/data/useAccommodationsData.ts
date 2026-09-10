import { useCallback, useEffect, useState } from 'react';
import type { Accommodation } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import type { RealtimeClientLike } from './useRealtimeTable';
import { useRealtimeTable } from './useRealtimeTable';
import { newId } from '../services/ids';
import { accommodationFromRow, accommodationToInsert, type AccommodationRow } from './mappers/accommodationMapper';

export interface AccommodationsDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  realtime?: RealtimeClientLike | null;
}

export function useAccommodationsData({ client, tripId, recordFailure, realtime }: AccommodationsDataDeps) {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setAccommodations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('accommodations')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data && data.length > 0) {
          setAccommodations((data as AccommodationRow[]).map(accommodationFromRow));
        } else {
          setAccommodations([]);
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  useRealtimeTable<AccommodationRow>({
    client: realtime ?? null,
    table: 'accommodations',
    filter: tripId ? `trip_id=eq.${tripId}` : null,
    onInsert: row => {
      const acc = accommodationFromRow(row);
      setAccommodations(prev => (prev.some(x => x.id === acc.id) ? prev : [...prev, acc]));
    },
    onUpdate: row => {
      const acc = accommodationFromRow(row);
      setAccommodations(prev => prev.map(x => (x.id === acc.id ? acc : x)));
    },
    onDelete: old => {
      setAccommodations(prev => prev.filter(x => x.id !== old.id));
    },
  });

  const addAccommodation = useCallback(
    (data: Omit<Accommodation, 'id'>) => {
      const acc: Accommodation = { ...data, id: newId() };

      const escrever = () => {
        setAccommodations(prev => [...prev, acc]);
        client
          .from('accommodations')
          .insert(accommodationToInsert(acc))
          .then(({ error }) => {
            if (!error) return;
            setAccommodations(prev => prev.filter(x => x.id !== acc.id));
            recordFailure({
              entity: 'Hospedagem',
              operation: 'criar',
              label: acc.name,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateAccommodation = useCallback(
    (id: string, patch: Partial<Accommodation>) => {
      let anterior: Accommodation | undefined;

      const escrever = () => {
        setAccommodations(prev => {
          anterior = prev.find(x => x.id === id);
          if (!anterior) return prev;
          return prev.map(x => (x.id === id ? { ...x, ...patch } : x));
        });

        if (!anterior) return;
        const atualizado = { ...anterior, ...patch };

        client
          .from('accommodations')
          .update(accommodationToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !anterior) return;
            setAccommodations(prev => prev.map(x => (x.id === id ? anterior! : x)));
            recordFailure({
              entity: 'Hospedagem',
              operation: 'atualizar',
              label: anterior.name,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const deleteAccommodation = useCallback(
    (id: string) => {
      let removido: Accommodation | undefined;

      const escrever = () => {
        setAccommodations(prev => {
          removido = prev.find(x => x.id === id);
          return prev.filter(x => x.id !== id);
        });

        if (!removido) return;

        client
          .from('accommodations')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !removido) return;
            setAccommodations(prev => [...prev, removido!]);
            recordFailure({
              entity: 'Hospedagem',
              operation: 'excluir',
              label: removido.name,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  return {
    accommodations,
    loading,
    addAccommodation,
    updateAccommodation,
    deleteAccommodation,
  };
}
