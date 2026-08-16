import { useCallback, useEffect, useState } from 'react';
import type { TransportReservation } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { transportFromRow, transportToInsert, type TransportReservationRow } from './mappers/transportMapper';

export interface TransportsDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  fallbackTransports?: TransportReservation[];
}

export function useTransportsData({ client, tripId, recordFailure, fallbackTransports = [] }: TransportsDataDeps) {
  const [transports, setTransports] = useState<TransportReservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setTransports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('transport_reservations')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data && data.length > 0) {
          setTransports((data as TransportReservationRow[]).map(transportFromRow));
        } else if (fallbackTransports.length > 0) {
          setTransports(fallbackTransports.filter(t => t.trip_id === tripId));
        } else {
          setTransports([]);
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  const addTransport = useCallback(
    (data: Omit<TransportReservation, 'id'>) => {
      const transport: TransportReservation = { ...data, id: newId() };

      const escrever = () => {
        setTransports(prev => [...prev, transport]);
        client
          .from('transport_reservations')
          .insert(transportToInsert(transport))
          .then(({ error }) => {
            if (!error) return;
            setTransports(prev => prev.filter(x => x.id !== transport.id));
            recordFailure({
              entity: 'Transporte',
              operation: 'criar',
              label: `${transport.provider_company} (${transport.type})`,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateTransport = useCallback(
    (id: string, patch: Partial<TransportReservation>) => {
      let anterior: TransportReservation | undefined;

      const escrever = () => {
        setTransports(prev => {
          anterior = prev.find(x => x.id === id);
          if (!anterior) return prev;
          return prev.map(x => (x.id === id ? { ...x, ...patch } : x));
        });

        if (!anterior) return;
        const atualizado = { ...anterior, ...patch };

        client
          .from('transport_reservations')
          .update(transportToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !anterior) return;
            setTransports(prev => prev.map(x => (x.id === id ? anterior! : x)));
            recordFailure({
              entity: 'Transporte',
              operation: 'atualizar',
              label: `${anterior.provider_company} (${anterior.type})`,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const deleteTransport = useCallback(
    (id: string) => {
      let removido: TransportReservation | undefined;

      const escrever = () => {
        setTransports(prev => {
          removido = prev.find(x => x.id === id);
          return prev.filter(x => x.id !== id);
        });

        if (!removido) return;

        client
          .from('transport_reservations')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !removido) return;
            setTransports(prev => [...prev, removido!]);
            recordFailure({
              entity: 'Transporte',
              operation: 'excluir',
              label: `${removido.provider_company} (${removido.type})`,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  return {
    transports,
    loading,
    addTransport,
    updateTransport,
    deleteTransport,
  };
}
