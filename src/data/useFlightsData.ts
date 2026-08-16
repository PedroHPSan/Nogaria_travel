import { useCallback, useEffect, useState } from 'react';
import type { Flight } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { flightFromRow, flightToInsert, type FlightRow } from './mappers/flightMapper';

export interface FlightsDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  fallbackFlights?: Flight[];
}

export function useFlightsData({ client, tripId, recordFailure, fallbackFlights = [] }: FlightsDataDeps) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setFlights([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('flights')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data && data.length > 0) {
          setFlights((data as FlightRow[]).map(flightFromRow));
        } else if (fallbackFlights.length > 0) {
          setFlights(fallbackFlights.filter(f => f.trip_id === tripId));
        } else {
          setFlights([]);
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  const addFlight = useCallback(
    (data: Omit<Flight, 'id'>) => {
      const flight: Flight = { ...data, id: newId() };

      const escrever = () => {
        setFlights(prev => [...prev, flight]);
        client
          .from('flights')
          .insert(flightToInsert(flight))
          .then(({ error }) => {
            if (!error) return;
            setFlights(prev => prev.filter(x => x.id !== flight.id));
            recordFailure({
              entity: 'Voo',
              operation: 'criar',
              label: `${flight.airline} ${flight.flight_number}`,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateFlight = useCallback(
    (id: string, patch: Partial<Flight>) => {
      let anterior: Flight | undefined;

      const escrever = () => {
        setFlights(prev => {
          anterior = prev.find(x => x.id === id);
          if (!anterior) return prev;
          return prev.map(x => (x.id === id ? { ...x, ...patch } : x));
        });

        if (!anterior) return;
        const atualizado = { ...anterior, ...patch };

        client
          .from('flights')
          .update(flightToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !anterior) return;
            setFlights(prev => prev.map(x => (x.id === id ? anterior! : x)));
            recordFailure({
              entity: 'Voo',
              operation: 'atualizar',
              label: `${anterior.airline} ${anterior.flight_number}`,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const deleteFlight = useCallback(
    (id: string) => {
      let removido: Flight | undefined;

      const escrever = () => {
        setFlights(prev => {
          removido = prev.find(x => x.id === id);
          return prev.filter(x => x.id !== id);
        });

        if (!removido) return;

        client
          .from('flights')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !removido) return;
            setFlights(prev => [...prev, removido!]);
            recordFailure({
              entity: 'Voo',
              operation: 'excluir',
              label: `${removido.airline} ${removido.flight_number}`,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  return {
    flights,
    loading,
    addFlight,
    updateFlight,
    deleteFlight,
  };
}
