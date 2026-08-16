import { useCallback, useEffect, useState } from 'react';
import type { Luggage } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { luggageFromRow, luggageToInsert, type LuggageRow } from './mappers/luggageMapper';

export interface LuggagesDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  fallbackLuggages?: Luggage[];
}

export function useLuggagesData({ client, tripId, recordFailure, fallbackLuggages = [] }: LuggagesDataDeps) {
  const [luggages, setLuggages] = useState<Luggage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setLuggages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('luggages')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data && data.length > 0) {
          setLuggages((data as LuggageRow[]).map(luggageFromRow));
        } else if (fallbackLuggages.length > 0) {
          setLuggages(fallbackLuggages.filter(l => l.trip_id === tripId));
        } else {
          setLuggages([]);
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  const addLuggage = useCallback(
    (data: Omit<Luggage, 'id'>) => {
      const luggage: Luggage = { ...data, id: newId() };

      const escrever = () => {
        setLuggages(prev => [...prev, luggage]);
        client
          .from('luggages')
          .insert(luggageToInsert(luggage))
          .then(({ error }) => {
            if (!error) return;
            setLuggages(prev => prev.filter(x => x.id !== luggage.id));
            recordFailure({
              entity: 'Bagagem',
              operation: 'criar',
              label: luggage.bag_identifier,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateLuggage = useCallback(
    (id: string, patch: Partial<Luggage>) => {
      let anterior: Luggage | undefined;

      const escrever = () => {
        setLuggages(prev => {
          anterior = prev.find(x => x.id === id);
          if (!anterior) return prev;
          return prev.map(x => (x.id === id ? { ...x, ...patch } : x));
        });

        if (!anterior) return;
        const atualizado = { ...anterior, ...patch };

        client
          .from('luggages')
          .update(luggageToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !anterior) return;
            setLuggages(prev => prev.map(x => (x.id === id ? anterior! : x)));
            recordFailure({
              entity: 'Bagagem',
              operation: 'atualizar',
              label: anterior.bag_identifier,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const deleteLuggage = useCallback(
    (id: string) => {
      let removido: Luggage | undefined;

      const escrever = () => {
        setLuggages(prev => {
          removido = prev.find(x => x.id === id);
          return prev.filter(x => x.id !== id);
        });

        if (!removido) return;

        client
          .from('luggages')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !removido) return;
            setLuggages(prev => [...prev, removido!]);
            recordFailure({
              entity: 'Bagagem',
              operation: 'excluir',
              label: removido.bag_identifier,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  return {
    luggages,
    loading,
    addLuggage,
    updateLuggage,
    deleteLuggage,
  };
}
