import { useCallback, useEffect, useState } from 'react';
import type { Trip } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import { newId } from '../services/ids';
import { tripFromRow, tripToInsert, type TripRow } from './mappers/tripMapper';

/**
 * Tipo estrutural mínimo do cliente Supabase — só o que este hook usa.
 * Existe para o teste poder injetar um cliente sem rede.
 */
export interface SupabaseLike {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
    insert: (values: unknown) => Promise<{ error: { message: string } | null }>;
    update: (values: unknown) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
}

export interface TripsDataDeps {
  client: SupabaseLike;
  tenantId: string | null;
  /** Injetado para o teste controlar o tempo. */
  nowIso: () => string;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
}

export function useTripsData({ client, tenantId, nowIso, recordFailure }: TripsDataDeps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tenantId) {
      setTrips([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('trips')
      .select('*')
      .eq('tenant_id', tenantId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data) setTrips((data as TripRow[]).map(tripFromRow));
        setLoading(false);
      });

    return () => { cancelado = true; };
  }, [client, tenantId]);

  const createTrip = useCallback(
    (data: Omit<Trip, 'id' | 'created_at' | 'updated_at'>): string => {
      const agora = nowIso();
      const trip: Trip = { ...data, id: newId(), created_at: agora, updated_at: agora };

      const escrever = () => {
        setTrips(prev => [...prev, trip]);
        client
          .from('trips')
          .insert(tripToInsert(trip))
          .then(({ error }) => {
            if (!error) return;
            setTrips(prev => prev.filter(t => t.id !== trip.id));
            recordFailure({
              entity: 'Viagem',
              operation: 'criar',
              label: trip.title,
              retry: escrever,
            });
          });
      };

      escrever();
      return trip.id;
    },
    [client, nowIso, recordFailure],
  );

  return { trips, loading, createTrip };
}
