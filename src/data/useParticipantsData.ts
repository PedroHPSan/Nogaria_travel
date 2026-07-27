import { useCallback, useEffect, useState } from 'react';
import type { Participant } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import {
  deriveAge,
  participantFromRow,
  participantToInsert,
  type ParticipantRow,
} from './mappers/participantMapper';

export interface ParticipantsDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  /** Data de hoje em ISO `YYYY-MM-DD`, injetada para o cálculo de idade ser determinístico. */
  today: string;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
}

export function useParticipantsData({ client, tripId, today, recordFailure }: ParticipantsDataDeps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('participants')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data) {
          setParticipants((data as ParticipantRow[]).map(r => participantFromRow(r, today)));
        }
        setLoading(false);
      });

    return () => { cancelado = true; };
  }, [client, tripId, today]);

  const addParticipant = useCallback(
    (data: Omit<Participant, 'id' | 'age' | 'is_minor'>) => {
      const idade = deriveAge(data.birth_date, today);
      const p: Participant = { ...data, id: newId(), age: idade, is_minor: idade < 18 };

      const escrever = () => {
        setParticipants(prev => [...prev, p]);
        client
          .from('participants')
          .insert(participantToInsert(p, today))
          .then(({ error }) => {
            if (!error) return;
            setParticipants(prev => prev.filter(x => x.id !== p.id));
            recordFailure({
              entity: 'Participante',
              operation: 'criar',
              label: p.full_name,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, today, recordFailure],
  );

  const updateParticipant = useCallback(
    (id: string, patch: Partial<Participant>) => {
      setParticipants(prev => {
        const anterior = prev.find(x => x.id === id);
        if (!anterior) return prev;

        const bruto = { ...anterior, ...patch };
        const idade = deriveAge(bruto.birth_date, today);
        const atualizado: Participant = { ...bruto, age: idade, is_minor: idade < 18 };

        const escrever = () => {
          setParticipants(atual => atual.map(x => (x.id === id ? atualizado : x)));
          client
            .from('participants')
            .update(participantToInsert(atualizado, today))
            .eq('id', id)
            .then(({ error }) => {
              if (!error) return;
              // Reverte para o valor exato de antes, não para um valor recalculado.
              setParticipants(atual => atual.map(x => (x.id === id ? anterior : x)));
              recordFailure({
                entity: 'Participante',
                operation: 'atualizar',
                label: anterior.full_name,
                retry: escrever,
              });
            });
        };

        escrever();
        return prev.map(x => (x.id === id ? atualizado : x));
      });
    },
    [client, today, recordFailure],
  );

  const deleteParticipant = useCallback(
    (id: string) => {
      setParticipants(prev => {
        const removido = prev.find(x => x.id === id);
        if (!removido) return prev;

        const escrever = () => {
          setParticipants(atual => atual.filter(x => x.id !== id));
          client
            .from('participants')
            .delete()
            .eq('id', id)
            .then(({ error }) => {
              if (!error) return;
              // Devolve a linha inteira, não uma casca.
              setParticipants(atual => [...atual, removido]);
              recordFailure({
                entity: 'Participante',
                operation: 'excluir',
                label: removido.full_name,
                retry: escrever,
              });
            });
        };

        escrever();
        return prev.filter(x => x.id !== id);
      });
    },
    [client, recordFailure],
  );

  return { participants, loading, addParticipant, updateParticipant, deleteParticipant };
}
