import { useEffect, useMemo, useState } from 'react';
import type { PriceQuote, PurchaseAssumptions } from '../../types/database.types';
import { newId } from '../../services/ids';
import { makeDefaultAssumptions } from '../../services/purchase/purchaseAssumptions';
import { supersede } from '../../services/purchase/priceQuotes';
import { INITIAL_PRICE_QUOTES } from '../../services/initialMockData';

export function usePurchasesState(storageKey: string, tripId: string) {
  const today = new Date().toISOString().split('T')[0];

  const [priceQuotes, setPriceQuotes] = useState<PriceQuote[]>(() => {
    const saved = localStorage.getItem(`${storageKey}_price_quotes`);
    return saved ? JSON.parse(saved) : INITIAL_PRICE_QUOTES;
  });

  const [assumptions, setAssumptions] = useState<PurchaseAssumptions>(() => {
    const saved = localStorage.getItem(`${storageKey}_purchase_assumptions`);
    return saved ? JSON.parse(saved) : makeDefaultAssumptions(tripId, today);
  });

  useEffect(() => {
    localStorage.setItem(`${storageKey}_price_quotes`, JSON.stringify(priceQuotes));
  }, [priceQuotes, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}_purchase_assumptions`, JSON.stringify(assumptions));
  }, [assumptions, storageKey]);

  const addPriceQuote = (q: Omit<PriceQuote, 'id' | 'created_at' | 'is_active'>) => {
    const quote: PriceQuote = {
      ...q,
      id: newId(),
      created_at: new Date().toISOString(),
      is_active: true,
    };
    setPriceQuotes(prev => supersede(prev, quote));
  };

  const deactivateQuote = (id: string) => {
    setPriceQuotes(prev => prev.map(q => (q.id === id ? { ...q, is_active: false } : q)));
  };

  const updateAssumptions = (patch: Partial<PurchaseAssumptions>) => {
    setAssumptions(prev => ({ ...prev, ...patch, updated_at: new Date().toISOString() }));
  };

  return useMemo(
    () => ({ priceQuotes, addPriceQuote, deactivateQuote, assumptions, updateAssumptions, today }),
    [priceQuotes, assumptions, today],
  );
}
