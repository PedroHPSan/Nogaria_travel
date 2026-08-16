import { useCallback, useEffect, useState } from 'react';
import type { PurchaseItem } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { purchaseItemFromRow, purchaseItemToInsert, type PurchaseItemRow } from './mappers/purchaseMapper';

export interface PurchasesDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  fallbackPurchases?: PurchaseItem[];
}

export function usePurchasesData({ client, tripId, recordFailure, fallbackPurchases = [] }: PurchasesDataDeps) {
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setPurchases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('purchase_items')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data && data.length > 0) {
          setPurchases((data as PurchaseItemRow[]).map(purchaseItemFromRow));
        } else if (fallbackPurchases.length > 0) {
          setPurchases(fallbackPurchases.filter(p => p.trip_id === tripId));
        } else {
          setPurchases([]);
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  const addPurchase = useCallback(
    (data: Omit<PurchaseItem, 'id'>) => {
      const item: PurchaseItem = { ...data, id: newId() };

      const escrever = () => {
        setPurchases(prev => [...prev, item]);
        client
          .from('purchase_items')
          .insert(purchaseItemToInsert(item))
          .then(({ error }) => {
            if (!error) return;
            setPurchases(prev => prev.filter(x => x.id !== item.id));
            recordFailure({
              entity: 'Item de compra',
              operation: 'criar',
              label: item.product_name,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updatePurchase = useCallback(
    (id: string, patch: Partial<PurchaseItem>) => {
      let anterior: PurchaseItem | undefined;

      const escrever = () => {
        setPurchases(prev => {
          anterior = prev.find(x => x.id === id);
          if (!anterior) return prev;
          return prev.map(x => (x.id === id ? { ...x, ...patch } : x));
        });

        if (!anterior) return;
        const atualizado = { ...anterior, ...patch };

        client
          .from('purchase_items')
          .update(purchaseItemToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !anterior) return;
            setPurchases(prev => prev.map(x => (x.id === id ? anterior! : x)));
            recordFailure({
              entity: 'Item de compra',
              operation: 'atualizar',
              label: anterior.product_name,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const deletePurchase = useCallback(
    (id: string) => {
      let removido: PurchaseItem | undefined;

      const escrever = () => {
        setPurchases(prev => {
          removido = prev.find(x => x.id === id);
          return prev.filter(x => x.id !== id);
        });

        if (!removido) return;

        client
          .from('purchase_items')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !removido) return;
            setPurchases(prev => [...prev, removido!]);
            recordFailure({
              entity: 'Item de compra',
              operation: 'excluir',
              label: removido.product_name,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const markPurchaseBought = useCallback(
    (id: string, actualPaidUsd: number) => {
      updatePurchase(id, {
        status: 'bought',
        actual_paid_usd: actualPaidUsd,
      });
    },
    [updatePurchase],
  );

  return {
    purchases,
    loading,
    addPurchase,
    updatePurchase,
    deletePurchase,
    markPurchaseBought,
  };
}
