import { useCallback, useEffect, useState } from 'react';
import type { TripIdea } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { tripIdeaFromRow, tripIdeaToInsert, type TripIdeaRow } from './mappers/tripIdeaMapper';

export interface TripIdeasDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
}

export function useTripIdeasData({ client, tripId, recordFailure }: TripIdeasDataDeps) {
  const [ideas, setIdeas] = useState<TripIdea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setIdeas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('trip_ideas')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data) {
          setIdeas((data as TripIdeaRow[]).map(tripIdeaFromRow));
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  const addIdea = useCallback(
    (data: Omit<TripIdea, 'id' | 'created_at'>) => {
      const idea: TripIdea = { ...data, id: newId(), created_at: new Date().toISOString() };

      const escrever = () => {
        setIdeas(prev => [idea, ...prev]);
        client
          .from('trip_ideas')
          .insert(tripIdeaToInsert(idea))
          .then(({ error }) => {
            if (!error) return;
            setIdeas(prev => prev.filter(x => x.id !== idea.id));
            recordFailure({
              entity: 'Ideia',
              operation: 'criar',
              label: idea.content,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateIdea = useCallback(
    (id: string, patch: Partial<TripIdea>) => {
      let anterior: TripIdea | undefined;

      const escrever = () => {
        setIdeas(prev => {
          anterior = prev.find(x => x.id === id);
          if (!anterior) return prev;
          return prev.map(x => (x.id === id ? { ...x, ...patch } : x));
        });

        if (!anterior) return;
        const atualizado = { ...anterior, ...patch };

        client
          .from('trip_ideas')
          .update(tripIdeaToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !anterior) return;
            setIdeas(prev => prev.map(x => (x.id === id ? anterior! : x)));
            recordFailure({
              entity: 'Ideia',
              operation: 'atualizar',
              label: anterior.content,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const deleteIdea = useCallback(
    (id: string) => {
      let removido: TripIdea | undefined;

      const escrever = () => {
        setIdeas(prev => {
          removido = prev.find(x => x.id === id);
          return prev.filter(x => x.id !== id);
        });

        if (!removido) return;

        client
          .from('trip_ideas')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !removido) return;
            setIdeas(prev => [removido!, ...prev]);
            recordFailure({
              entity: 'Ideia',
              operation: 'excluir',
              label: removido.content,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  return { ideas, loading, addIdea, updateIdea, deleteIdea };
}
