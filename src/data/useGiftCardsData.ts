import { useCallback, useEffect, useState } from 'react';
import type { GiftCard } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { giftCardFromRow, giftCardToInsert, type GiftCardRow } from './mappers/giftCardMapper';
import { calculateGiftCardFinancials } from '../services/giftCardCalculator';

export interface GiftCardsDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  fallbackGiftCards?: GiftCard[];
}

export function useGiftCardsData({ client, tripId, recordFailure, fallbackGiftCards = [] }: GiftCardsDataDeps) {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setGiftCards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('gift_cards')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data && data.length > 0) {
          setGiftCards((data as GiftCardRow[]).map(giftCardFromRow));
        } else if (fallbackGiftCards.length > 0) {
          setGiftCards(fallbackGiftCards.filter(g => g.trip_id === tripId));
        } else {
          setGiftCards([]);
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  const addGiftCard = useCallback(
    (data: Omit<GiftCard, 'id' | 'cashback_amount' | 'net_cost' | 'effective_savings' | 'effective_savings_pct'>) => {
      const financials = calculateGiftCardFinancials(data.nominal_value, data.paid_amount, data.cashback_pct);
      const card: GiftCard = {
        ...data,
        id: newId(),
        cashback_amount: financials.cashbackAmount,
        net_cost: financials.netCost,
        effective_savings: financials.effectiveSavings,
        effective_savings_pct: financials.effectiveSavingsPct,
      };

      const escrever = () => {
        setGiftCards(prev => [...prev, card]);
        client
          .from('gift_cards')
          .insert(giftCardToInsert(card))
          .then(({ error }) => {
            if (!error) return;
            setGiftCards(prev => prev.filter(x => x.id !== card.id));
            recordFailure({
              entity: 'Gift Card',
              operation: 'criar',
              label: card.store_brand,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateGiftCard = useCallback(
    (id: string, patch: Partial<GiftCard>) => {
      let anterior: GiftCard | undefined;

      const escrever = () => {
        setGiftCards(prev => {
          anterior = prev.find(x => x.id === id);
          if (!anterior) return prev;

          const nominal = patch.nominal_value ?? anterior.nominal_value;
          const paid = patch.paid_amount ?? anterior.paid_amount;
          const cb = patch.cashback_pct ?? anterior.cashback_pct;
          const financials = calculateGiftCardFinancials(nominal, paid, cb);

          const atualizado: GiftCard = {
            ...anterior,
            ...patch,
            cashback_amount: financials.cashbackAmount,
            net_cost: financials.netCost,
            effective_savings: financials.effectiveSavings,
            effective_savings_pct: financials.effectiveSavingsPct,
          };

          return prev.map(x => (x.id === id ? atualizado : x));
        });

        if (!anterior) return;
        const nominal = patch.nominal_value ?? anterior.nominal_value;
        const paid = patch.paid_amount ?? anterior.paid_amount;
        const cb = patch.cashback_pct ?? anterior.cashback_pct;
        const financials = calculateGiftCardFinancials(nominal, paid, cb);

        const atualizado: GiftCard = {
          ...anterior,
          ...patch,
          cashback_amount: financials.cashbackAmount,
          net_cost: financials.netCost,
          effective_savings: financials.effectiveSavings,
          effective_savings_pct: financials.effectiveSavingsPct,
        };

        client
          .from('gift_cards')
          .update(giftCardToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !anterior) return;
            setGiftCards(prev => prev.map(x => (x.id === id ? anterior! : x)));
            recordFailure({
              entity: 'Gift Card',
              operation: 'atualizar',
              label: anterior.store_brand,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const deleteGiftCard = useCallback(
    (id: string) => {
      let removido: GiftCard | undefined;

      const escrever = () => {
        setGiftCards(prev => {
          removido = prev.find(x => x.id === id);
          return prev.filter(x => x.id !== id);
        });

        if (!removido) return;

        client
          .from('gift_cards')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !removido) return;
            setGiftCards(prev => [...prev, removido!]);
            recordFailure({
              entity: 'Gift Card',
              operation: 'excluir',
              label: removido.store_brand,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  return {
    giftCards,
    loading,
    addGiftCard,
    updateGiftCard,
    deleteGiftCard,
  };
}
