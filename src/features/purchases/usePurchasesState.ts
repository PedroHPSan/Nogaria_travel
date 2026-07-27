import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PriceQuote, PurchaseAssumptions } from '../../types/database.types';
import { newId } from '../../services/ids';
import { makeDefaultAssumptions } from '../../services/purchase/purchaseAssumptions';
import { supersede } from '../../services/purchase/priceQuotes';
import { INITIAL_PRICE_QUOTES } from '../../services/initialMockData';

function loadAssumptions(
  storageKey: string,
  tripId: string,
  today: string,
  usdBrlRate: number,
): PurchaseAssumptions {
  const saved = localStorage.getItem(`${storageKey}_purchase_assumptions_${tripId}`);
  return saved ? JSON.parse(saved) : makeDefaultAssumptions(tripId, today, usdBrlRate);
}

export function usePurchasesState(storageKey: string, tripId: string, usdBrlRate: number) {
  const today = new Date().toISOString().split('T')[0];

  const [priceQuotes, setPriceQuotes] = useState<PriceQuote[]>(() => {
    const saved = localStorage.getItem(`${storageKey}_price_quotes`);
    return saved ? JSON.parse(saved) : INITIAL_PRICE_QUOTES;
  });

  const [assumptions, setAssumptions] = useState<PurchaseAssumptions>(() =>
    loadAssumptions(storageKey, tripId, today, usdBrlRate),
  );
  // Tracks which trip `assumptions` currently belongs to. Assumptions are
  // seeded/loaded per trip_id (see Finding 1): when `tripId` changes we must
  // not render even one frame of the previous trip's assumptions, so the
  // re-derivation happens synchronously during render (React's documented
  // "adjust state when a prop changes" pattern) rather than in a `useEffect`,
  // which would only patch things in after that wrong frame already painted.
  // Note: `usdBrlRate` is only used here as the seed for a *new* trip's
  // stored assumptions — it intentionally does NOT appear in this branch's
  // condition, so editing the live exchange rate never re-seeds or resets
  // assumptions already persisted for the current trip.
  const [assumptionsTripId, setAssumptionsTripId] = useState(tripId);
  if (tripId !== assumptionsTripId) {
    setAssumptionsTripId(tripId);
    setAssumptions(loadAssumptions(storageKey, tripId, today, usdBrlRate));
  }

  useEffect(() => {
    localStorage.setItem(`${storageKey}_price_quotes`, JSON.stringify(priceQuotes));
  }, [priceQuotes, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}_purchase_assumptions_${tripId}`, JSON.stringify(assumptions));
  }, [assumptions, storageKey, tripId]);

  const addPriceQuote = useCallback((q: Omit<PriceQuote, 'id' | 'created_at' | 'is_active'>) => {
    const quote: PriceQuote = {
      ...q,
      id: newId(),
      created_at: new Date().toISOString(),
      is_active: true,
    };
    setPriceQuotes(prev => supersede(prev, quote));
  }, []);

  const deactivateQuote = useCallback((id: string) => {
    setPriceQuotes(prev => prev.map(q => (q.id === id ? { ...q, is_active: false } : q)));
  }, []);

  const updateAssumptions = useCallback((patch: Partial<PurchaseAssumptions>) => {
    setAssumptions(prev => ({ ...prev, ...patch, updated_at: new Date().toISOString() }));
  }, []);

  return useMemo(
    () => ({ priceQuotes, addPriceQuote, deactivateQuote, assumptions, updateAssumptions, today }),
    [priceQuotes, addPriceQuote, deactivateQuote, assumptions, updateAssumptions, today],
  );
}
