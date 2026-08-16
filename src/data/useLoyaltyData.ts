import { useCallback, useEffect, useState } from 'react';
import type { LoyaltyAccount } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { loyaltyFromRow, loyaltyToInsert, type LoyaltyAccountRow } from './mappers/loyaltyMapper';

export interface LoyaltyDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  fallbackLoyalty?: LoyaltyAccount[];
}

export function useLoyaltyData({ client, tripId, recordFailure, fallbackLoyalty = [] }: LoyaltyDataDeps) {
  const [loyaltyAccounts, setLoyaltyAccounts] = useState<LoyaltyAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setLoyaltyAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('loyalty_accounts')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data && data.length > 0) {
          setLoyaltyAccounts((data as LoyaltyAccountRow[]).map(loyaltyFromRow));
        } else if (fallbackLoyalty.length > 0) {
          setLoyaltyAccounts(fallbackLoyalty.filter(l => l.trip_id === tripId));
        } else {
          setLoyaltyAccounts([]);
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  const addLoyaltyAccount = useCallback(
    (data: Omit<LoyaltyAccount, 'id'>) => {
      const acc: LoyaltyAccount = { ...data, id: newId() };

      const escrever = () => {
        setLoyaltyAccounts(prev => [...prev, acc]);
        client
          .from('loyalty_accounts')
          .insert(loyaltyToInsert(acc))
          .then(({ error }) => {
            if (!error) return;
            setLoyaltyAccounts(prev => prev.filter(x => x.id !== acc.id));
            recordFailure({
              entity: 'Conta de Fidelidade',
              operation: 'criar',
              label: acc.program_name,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateLoyaltyAccount = useCallback(
    (id: string, patch: Partial<LoyaltyAccount>) => {
      let anterior: LoyaltyAccount | undefined;

      const escrever = () => {
        setLoyaltyAccounts(prev => {
          anterior = prev.find(x => x.id === id);
          if (!anterior) return prev;
          return prev.map(x => (x.id === id ? { ...x, ...patch } : x));
        });

        if (!anterior) return;
        const atualizado = { ...anterior, ...patch };

        client
          .from('loyalty_accounts')
          .update(loyaltyToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !anterior) return;
            setLoyaltyAccounts(prev => prev.map(x => (x.id === id ? anterior! : x)));
            recordFailure({
              entity: 'Conta de Fidelidade',
              operation: 'atualizar',
              label: anterior.program_name,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const deleteLoyaltyAccount = useCallback(
    (id: string) => {
      let removido: LoyaltyAccount | undefined;

      const escrever = () => {
        setLoyaltyAccounts(prev => {
          removido = prev.find(x => x.id === id);
          return prev.filter(x => x.id !== id);
        });

        if (!removido) return;

        client
          .from('loyalty_accounts')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !removido) return;
            setLoyaltyAccounts(prev => [...prev, removido!]);
            recordFailure({
              entity: 'Conta de Fidelidade',
              operation: 'excluir',
              label: removido.program_name,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  return {
    loyaltyAccounts,
    loading,
    addLoyaltyAccount,
    updateLoyaltyAccount,
    deleteLoyaltyAccount,
  };
}
