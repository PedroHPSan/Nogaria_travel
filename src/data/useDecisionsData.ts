import { useCallback, useEffect, useState } from 'react';
import type { Decision } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { decisionFromRow, decisionToInsert, type DecisionRow } from './mappers/decisionMapper';

export interface DecisionsDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  fallbackDecisions?: Decision[];
}

export function useDecisionsData({ client, tripId, recordFailure, fallbackDecisions = [] }: DecisionsDataDeps) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setDecisions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('decisions')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data && data.length > 0) {
          setDecisions((data as DecisionRow[]).map(decisionFromRow));
        } else if (fallbackDecisions.length > 0) {
          setDecisions(fallbackDecisions.filter(d => d.trip_id === tripId));
        } else {
          setDecisions([]);
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  const addDecision = useCallback(
    (data: Omit<Decision, 'id'>) => {
      const decision: Decision = { ...data, id: newId() };

      const escrever = () => {
        setDecisions(prev => [...prev, decision]);
        client
          .from('decisions')
          .insert(decisionToInsert(decision))
          .then(({ error }) => {
            if (!error) return;
            setDecisions(prev => prev.filter(x => x.id !== decision.id));
            recordFailure({
              entity: 'Decisão',
              operation: 'criar',
              label: decision.topic,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateDecision = useCallback(
    (id: string, patch: Partial<Decision>) => {
      let anterior: Decision | undefined;

      const escrever = () => {
        setDecisions(prev => {
          anterior = prev.find(x => x.id === id);
          if (!anterior) return prev;
          return prev.map(x => (x.id === id ? { ...x, ...patch } : x));
        });

        if (!anterior) return;
        const atualizado = { ...anterior, ...patch };

        client
          .from('decisions')
          .update(decisionToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !anterior) return;
            setDecisions(prev => prev.map(x => (x.id === id ? anterior! : x)));
            recordFailure({
              entity: 'Decisão',
              operation: 'atualizar',
              label: anterior.topic,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const deleteDecision = useCallback(
    (id: string) => {
      let removido: Decision | undefined;

      const escrever = () => {
        setDecisions(prev => {
          removido = prev.find(x => x.id === id);
          return prev.filter(x => x.id !== id);
        });

        if (!removido) return;

        client
          .from('decisions')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !removido) return;
            setDecisions(prev => [...prev, removido!]);
            recordFailure({
              entity: 'Decisão',
              operation: 'excluir',
              label: removido.topic,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  return {
    decisions,
    loading,
    addDecision,
    updateDecision,
    deleteDecision,
  };
}
