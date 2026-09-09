import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type {
  Trip,
  Tenant,
  Participant,
  Flight,
  Accommodation,
  TransportReservation,
  ItineraryItem,
  TripIdea,
  GiftCard,
  PurchaseItem,
  Luggage,
  Expense,
  Task,
  Decision,
  AuditFinding,
  AiProviderConfig,
  AiUsageLog,
  Currency,
  PriceQuote,
  PurchaseAssumptions
} from '../types/database.types';
import type { PurchaseDecision } from '../types/purchase.types';

import { runFullTripAudit } from '../services/auditEngine';
import { formatCurrencyValue, convertCurrency, fetchLiveExchangeRate, DEFAULT_EXCHANGE_RATE } from '../services/exchangeRateService';
import type { ExchangeRateClient, ExchangeRateSource } from '../services/exchangeRateService';
import { useAuth } from './AuthContext';
import { newId } from '../services/ids';
import { usePurchasesState } from '../features/purchases/usePurchasesState';
import { decidePurchases } from '../services/purchase/purchaseDecisionEngine';
import type { DecisionInput } from '../services/purchase/purchaseDecisionEngine';
import { useWriteFailures } from '../data/useWriteFailures';
import type { WriteFailure } from '../data/useWriteFailures';
import { useTripsData } from '../data/useTripsData';
import { useParticipantsData } from '../data/useParticipantsData';
import { useItineraryData } from '../data/useItineraryData';
import { useTripIdeasData } from '../data/useTripIdeasData';
import { useExpensesData } from '../data/useExpensesData';
import { usePurchasesData } from '../data/usePurchasesData';
import { useGiftCardsData } from '../data/useGiftCardsData';
import { useFlightsData } from '../data/useFlightsData';
import { useAccommodationsData } from '../data/useAccommodationsData';
import { useTransportsData } from '../data/useTransportsData';
import { useLuggagesData } from '../data/useLuggagesData';
import { useTasksData } from '../data/useTasksData';
import { useDecisionsData } from '../data/useDecisionsData';
import { useLoyaltyData } from '../data/useLoyaltyData';
import { useAiData } from '../data/useAiData';
import { useAuditResolutionsData } from '../data/useAuditResolutionsData';
import { useDocumentsData } from '../data/useDocumentsData';
import { supabase } from '../services/supabaseClient';
import type { SupabaseLike } from '../data/useTripsData';

export interface DocumentFile {
  id: string;
  trip_id: string;
  title: string;
  category: 'flight' | 'hotel' | 'car' | 'ticket' | 'insurance' | 'personal';
  file_url: string;
  linked_entity_type?: 'participant' | 'flight' | 'accommodation' | 'transport';
  linked_entity_id?: string;
  uploaded_at: string;
  file_size?: string;
  notes?: string;
}

export interface LoyaltyAccount {
  id: string;
  trip_id: string;
  program_name: string;
  holder_id: string;
  balance_points: number;
  cpm_usd: number; // cost per 1000 miles
  cash_equivalent_usd: number;
  notes?: string;
}

interface TripContextType {
  tenants: Tenant[];
  activeTenant: Tenant;
  trips: Trip[];
  activeTrip: Trip;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  exchangeRate: number;
  exchangeRateDate: string;
  /** De onde veio a taxa exibida: PTAX (tabela), mercado ao vivo, cache, ajuste manual ou default. */
  exchangeRateSource: ExchangeRateSource;
  setExchangeRate: (rate: number) => void;
  formatAmount: (amountUSD: number) => string;
  convertAmount: (amountUSD: number) => number;

  setActiveTripId: (id: string) => void;
  createTrip: (tripData: Omit<Trip, 'id' | 'created_at' | 'updated_at'>) => Promise<string>;

  participants: Participant[];
  addParticipant: (data: Omit<Participant, 'id' | 'age' | 'is_minor'>) => void;
  updateParticipant: (id: string, p: Partial<Participant>) => void;
  deleteParticipant: (id: string) => void;

  tripDataLoading: boolean;
  failures: WriteFailure[];
  dismissFailure: (id: string) => void;
  retryFailure: (id: string) => void;

  flights: Flight[];
  addFlight: (f: Omit<Flight, 'id'>) => void;
  updateFlight: (id: string, f: Partial<Flight>) => void;
  deleteFlight: (id: string) => void;

  accommodations: Accommodation[];
  addAccommodation: (a: Omit<Accommodation, 'id'>) => void;
  updateAccommodation: (id: string, a: Partial<Accommodation>) => void;
  deleteAccommodation: (id: string) => void;

  transports: TransportReservation[];
  addTransport: (t: Omit<TransportReservation, 'id'>) => void;
  updateTransport: (id: string, t: Partial<TransportReservation>) => void;
  deleteTransport: (id: string) => void;

  itinerary: ItineraryItem[];
  addItineraryItem: (i: Omit<ItineraryItem, 'id'>) => void;
  updateItineraryItem: (id: string, i: Partial<ItineraryItem>) => void;
  deleteItineraryItem: (id: string) => void;

  ideas: TripIdea[];
  addIdea: (i: Omit<TripIdea, 'id' | 'created_at'>) => void;
  updateIdea: (id: string, i: Partial<TripIdea>) => void;
  deleteIdea: (id: string) => void;

  giftCards: GiftCard[];
  addGiftCard: (g: Omit<GiftCard, 'id' | 'net_cost' | 'cashback_amount' | 'effective_savings' | 'effective_savings_pct'>) => void;
  updateGiftCard: (id: string, g: Partial<GiftCard>) => void;
  deleteGiftCard: (id: string) => void;

  purchases: PurchaseItem[];
  addPurchase: (p: Omit<PurchaseItem, 'id'>) => void;
  updatePurchase: (id: string, p: Partial<PurchaseItem>) => void;
  deletePurchase: (id: string) => void;
  markPurchaseBought: (id: string, actualPaidUsd: number) => void;

  priceQuotes: PriceQuote[];
  addPriceQuote: (q: Omit<PriceQuote, 'id' | 'created_at' | 'is_active'>) => void;
  deactivateQuote: (id: string) => void;
  assumptions: PurchaseAssumptions;
  updateAssumptions: (patch: Partial<PurchaseAssumptions>) => void;
  purchaseDecisions: PurchaseDecision[];

  luggages: Luggage[];
  addLuggage: (l: Omit<Luggage, 'id'>) => void;
  updateLuggage: (id: string, l: Partial<Luggage>) => void;
  deleteLuggage: (id: string) => void;

  expenses: Expense[];
  addExpense: (e: Omit<Expense, 'id'>) => void;
  updateExpense: (id: string, e: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  tasks: Task[];
  addTask: (t: Omit<Task, 'id' | 'created_at'>) => void;
  updateTask: (id: string, t: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;

  decisions: Decision[];
  addDecision: (d: Omit<Decision, 'id'>) => void;
  updateDecision: (id: string, d: Partial<Decision>) => void;
  deleteDecision: (id: string) => void;

  documents: DocumentFile[];
  addDocument: (doc: Omit<DocumentFile, 'id' | 'uploaded_at'>) => void;
  deleteDocument: (id: string) => void;

  loyaltyAccounts: LoyaltyAccount[];
  addLoyaltyAccount: (acc: Omit<LoyaltyAccount, 'id'>) => void;
  updateLoyaltyAccount: (id: string, acc: Partial<LoyaltyAccount>) => void;
  deleteLoyaltyAccount: (id: string) => void;

  aiProviders: AiProviderConfig[];
  updateAiProvider: (id: string, config: Partial<AiProviderConfig>) => void;

  aiLogs: AiUsageLog[];
  addAiLog: (log: Omit<AiUsageLog, 'id' | 'timestamp'>) => void;

  auditFindings: AuditFinding[];
  toggleResolveAudit: (id: string) => void;
  rerunAudit: () => void;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

const STORAGE_KEY = 'ANTIGRAVITY_TRAVEL_PLATFORM_V1';
// A chave `${STORAGE_KEY}_itinerary` é órfã desde a migração do itinerário para o Supabase
// (ver src/data/useItineraryData.ts) — nada mais lê ou escreve nela. Inofensiva (limpa no
// logout junto com o resto do prefixo), pode ser removida futuramente.

export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantMemberships, activeTenantId, activeTenant: authActiveTenant } = useAuth();
  const tenants = tenantMemberships.map(m => m.tenant);
  const activeTenant = authActiveTenant;
  if (!activeTenant) {
    throw new Error('TripProvider rendered without an active tenant — it must be wrapped by AuthGate');
  }

  const { failures, recordFailure, dismissFailure, retryFailure } = useWriteFailures();

  const client = supabase as unknown as SupabaseLike;
  const hoje = new Date().toISOString().split('T')[0];

  const { trips, loading: tripsLoading, createTrip } = useTripsData({
    client,
    tenantId: activeTenantId,
    nowIso: () => new Date().toISOString(),
    recordFailure,
  });

  // Currency & Live Exchange Rate State
  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_currency`);
    return (saved as Currency) || 'USD';
  });

  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_exchangeRate`);
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXCHANGE_RATE;
  });
  const [exchangeRateSource, setExchangeRateSource] = useState<ExchangeRateSource>('default');

  const [exchangeRateDate, setExchangeRateDate] = useState<string>(() =>
    new Date().toLocaleDateString('pt-BR'),
  );

  useEffect(() => {
    // O supabase-js real satisfaz o shape mínimo de ExchangeRateClient; o cast
    // existe porque SupabaseLike (dos hooks de dados) não declara order/limit.
    fetchLiveExchangeRate(exchangeRate, supabase as unknown as ExchangeRateClient).then(info => {
      if (info && Number.isFinite(info.rate) && info.rate > 0) {
        setExchangeRate(info.rate);
        setExchangeRateSource(info.source);
        const [y, m, d] = info.lastUpdated.split('-');
        if (y && m && d) {
          setExchangeRateDate(`${d}/${m}/${y}`);
        }
      }
    });
  }, []);

  /** Ajuste manual pelo Header: passa a valer até o próximo carregamento. */
  const setExchangeRateManual = (rate: number) => {
    setExchangeRate(rate);
    setExchangeRateSource('manual');
  };

  // Helper formatting & calculation functions
  const formatAmount = (amountUSD: number): string => {
    return formatCurrencyValue(amountUSD, currency, exchangeRate);
  };

  const convertAmount = (amountUSD: number): number => {
    return convertCurrency(amountUSD, currency, exchangeRate);
  };

  // Load from localStorage or fallback to defaults
  const [activeTripId, setActiveTripId] = useState<string | null>(() =>
    localStorage.getItem(`${STORAGE_KEY}_activeTripId`),
  );

  // Se a viagem guardada sumiu (ou nunca existiu), cai na primeira disponível.
  const activeTripIdResolvido =
    activeTripId && trips.some(t => t.id === activeTripId) ? activeTripId : trips[0]?.id ?? null;

  useEffect(() => {
    if (activeTripIdResolvido) {
      localStorage.setItem(`${STORAGE_KEY}_activeTripId`, activeTripIdResolvido);
    }
  }, [activeTripIdResolvido]);

  const {
    participants,
    loading: participantsLoading,
    addParticipant,
    updateParticipant,
    deleteParticipant,
  } = useParticipantsData({
    client,
    tripId: activeTripIdResolvido,
    today: hoje,
    recordFailure,
  });

  const {
    itinerary,
    loading: itineraryLoading,
    addItineraryItem,
    updateItineraryItem,
    deleteItineraryItem,
  } = useItineraryData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    ideas,
    addIdea,
    updateIdea,
    deleteIdea,
  } = useTripIdeasData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    flights,
    addFlight,
    updateFlight,
    deleteFlight,
  } = useFlightsData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    accommodations,
    addAccommodation,
    updateAccommodation,
    deleteAccommodation,
  } = useAccommodationsData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    transports,
    addTransport,
    updateTransport,
    deleteTransport,
  } = useTransportsData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    giftCards,
    addGiftCard,
    updateGiftCard,
    deleteGiftCard,
  } = useGiftCardsData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    purchases,
    addPurchase: addPurchaseRaw,
    updatePurchase: updatePurchaseRaw,
    deletePurchase,
  } = usePurchasesData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    luggages,
    addLuggage,
    updateLuggage,
    deleteLuggage,
  } = useLuggagesData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    expenses,
    loading: expensesLoading,
    addExpense,
    updateExpense,
    deleteExpense,
  } = useExpensesData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
  } = useTasksData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    decisions,
    addDecision,
    updateDecision,
    deleteDecision,
  } = useDecisionsData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    documents,
    addDocument,
    deleteDocument,
  } = useDocumentsData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    loyaltyAccounts,
    addLoyaltyAccount,
    updateLoyaltyAccount,
    deleteLoyaltyAccount,
  } = useLoyaltyData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });

  const {
    aiConfigs: aiProviders,
    aiLogs,
    updateAiConfig: updateAiProvider,
    addAiLog,
  } = useAiData({
    client,
    tenantId: activeTenantId,
    recordFailure,
  });

  const {
    resolvedAuditIds,
    toggleResolveAudit,
  } = useAuditResolutionsData({
    client,
    tripId: activeTripIdResolvido,
  });

  // Active Trip
  const activeTrip = useMemo(() => {
    const activeTripEncontrada = trips.find(t => t.id === activeTripIdResolvido) ?? trips[0] ?? null;

    // Sem viagem o contexto ainda precisa existir, porque é dele que o wizard tira
    // createTrip e addParticipant. Nenhuma view chega a renderizar com este objeto:
    // o AuthGate mostra o wizard enquanto trips.length === 0 (Task 9).
    return (
      activeTripEncontrada ?? {
        id: '',
        tenant_id: activeTenantId ?? '',
        title: '',
        destination_main: '',
        start_date: '',
        end_date: '',
        currency_base: 'USD' as const,
        status: 'planning' as const,
        created_at: '',
        updated_at: '',
      }
    );
  }, [trips, activeTripIdResolvido, activeTenantId]);

  const purchaseState = usePurchasesState(STORAGE_KEY, activeTrip.id, exchangeRate);

  // Persist State to LocalStorage on Change
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_currency`, currency);
  }, [currency]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_exchangeRate`, exchangeRate.toString());
  }, [exchangeRate]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_flights`, JSON.stringify(flights));
  }, [flights]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_accommodations`, JSON.stringify(accommodations));
  }, [accommodations]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_transports`, JSON.stringify(transports));
  }, [transports]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_giftCards`, JSON.stringify(giftCards));
  }, [giftCards]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_purchases`, JSON.stringify(purchases));
  }, [purchases]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_luggages`, JSON.stringify(luggages));
  }, [luggages]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_expenses`, JSON.stringify(expenses));
  }, [expenses]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_tasks`, JSON.stringify(tasks));
  }, [tasks]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_decisions`, JSON.stringify(decisions));
  }, [decisions]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_documents`, JSON.stringify(documents));
  }, [documents]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_loyalty`, JSON.stringify(loyaltyAccounts));
  }, [loyaltyAccounts]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_aiProviders`, JSON.stringify(aiProviders));
  }, [aiProviders]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_aiLogs`, JSON.stringify(aiLogs));
  }, [aiLogs]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_resolvedAudits`, JSON.stringify(resolvedAuditIds));
  }, [resolvedAuditIds]);

  // Audit recalculation
  const auditFindings = useMemo(() => {
    const findings = runFullTripAudit({
      trip: activeTrip,
      participants: participants.filter(p => p.trip_id === activeTrip.id),
      flights: flights.filter(f => f.trip_id === activeTrip.id),
      accommodations: accommodations.filter(a => a.trip_id === activeTrip.id),
      transports: transports.filter(t => t.trip_id === activeTrip.id),
      itinerary: itinerary.filter(i => i.trip_id === activeTrip.id),
      giftCards: giftCards.filter(g => g.trip_id === activeTrip.id),
      purchases: purchases.filter(p => p.trip_id === activeTrip.id),
      expenses: expenses.filter(e => e.trip_id === activeTrip.id)
    });

    return findings.map(f => ({
      ...f,
      resolved: resolvedAuditIds.includes(f.id)
    }));
  }, [activeTrip, participants, flights, accommodations, transports, itinerary, giftCards, purchases, expenses, resolvedAuditIds]);

  // Single input-assembly point for the decision engine (final-review Finding
  // 1): `purchaseDecisions`, `addPurchase`, and `updatePurchase` all funnel
  // through this instead of each carrying its own copy of the
  // quotes/participants/giftCards/assumptions/luggages assembly — that
  // duplication was exactly the seam where `updatePurchase` drifted from
  // `addPurchase`'s correct pattern. `itemSet` is the raw (unfiltered)
  // purchases array; the trip filter happens in here.
  //
  // Wrapped in `useCallback` (not a plain per-render function) specifically
  // so `purchaseDecisions` below can depend on this function's identity
  // instead of re-listing every underlying piece of state — this is what
  // lets the helper be shared without tripping `react-hooks/exhaustive-deps`
  // (a previous round duplicated the assembly to dodge that warning; this
  // is the "solve it properly" fix instead).
  const buildDecisionInput = useCallback(
    (itemSet: PurchaseItem[]): DecisionInput => ({
      items: itemSet.filter(p => p.trip_id === activeTrip.id),
      quotes: purchaseState.priceQuotes.filter(q => q.trip_id === activeTrip.id),
      participants: participants.filter(p => p.trip_id === activeTrip.id),
      giftCards: giftCards.filter(g => g.trip_id === activeTrip.id),
      // The stored assumptions' usd_brl_rate is only a seed (see
      // usePurchasesState) — TripContext's own `exchangeRate` is the single
      // source of truth for USD/BRL app-wide, so it always wins here. This
      // keeps the decision engine's BRL totals in sync with an edited rate
      // even though the persisted assumptions record is not rewritten.
      assumptions: {
        ...purchaseState.assumptions,
        usd_brl_rate: exchangeRate,
        rate_source: 'Câmbio do app (TripContext)',
        rate_date: purchaseState.today,
      },
      today: purchaseState.today,
      luggages: luggages.filter(l => l.trip_id === activeTrip.id),
    }),
    [activeTrip.id, purchaseState, participants, giftCards, exchangeRate, luggages],
  );

  const purchaseDecisions = useMemo(
    () => decidePurchases(buildDecisionInput(purchases)),
    [purchases, buildDecisionInput],
  );

  // Used by `addPurchase` and `updatePurchase` (final-review Finding 1): a
  // brand-new or just-edited item isn't reflected in `purchaseDecisions`
  // above (memoized off the pre-write `purchases` state), so freezing a
  // decision at write time needs to run the engine against an item set that
  // already substitutes the draft/updated record in place of the old one.
  const decisionsForItemSet = useCallback(
    (itemSet: PurchaseItem[]): PurchaseDecision[] => decidePurchases(buildDecisionInput(itemSet)),
    [buildDecisionInput],
  );

  const rerunAudit = () => {
    // Audit updates automatically through useMemo
  };



  // Ponto único da invariante do congelamento (RN-18/CA-11): TODA gravação de
  // PurchaseItem passa por aqui — criação (addPurchase) e edição
  // (updatePurchase), inclusive o <select> de Status do PurchaseModal em
  // ambos os fluxos, que nunca chama markPurchaseBought diretamente.
  const freezeBoughtStatus = (
    candidate: PurchaseItem,
    wasBought: boolean,
    getLiveDecision: () => PurchaseDecision | undefined,
  ): PurchaseItem => {
    if (candidate.status === 'bought' && !wasBought && !candidate.decision_snapshot) {
      return { ...candidate, decision_snapshot: getLiveDecision() };
    }
    if (candidate.status !== 'bought' && wasBought) {
      return { ...candidate, decision_snapshot: undefined, actual_paid_usd: undefined };
    }
    return candidate;
  };

  const addPurchase = (p: Omit<PurchaseItem, 'id'>) => {
    const draft: PurchaseItem = { ...p, id: newId() };
    const withDraft = [...purchases, draft];
    const frozenDraft = freezeBoughtStatus(draft, false, () =>
      decisionsForItemSet(withDraft).find(d => d.purchase_item_id === draft.id),
    );
    addPurchaseRaw(frozenDraft);
  };

  const updatePurchase = (id: string, p: Partial<PurchaseItem>) => {
    const item = purchases.find(i => i.id === id);
    if (!item) return;
    const updated: PurchaseItem = { ...item, ...p };
    const withUpdated = purchases.map(i => (i.id === id ? updated : i));
    const frozen = freezeBoughtStatus(updated, item.status === 'bought', () =>
      decisionsForItemSet(withUpdated).find(d => d.purchase_item_id === id),
    );
    updatePurchaseRaw(id, frozen);
  };

  // Congela a decisão vigente no momento da compra (RN-18/CA-11): o snapshot
  // gravado aqui deixa de participar de `purchaseDecisions` como cálculo ao
  // vivo — ver o early-return em decidePurchases — então mudar câmbio,
  // premissas ou cotações depois não reescreve o registro do que foi decidido.
  //
  // Esta é uma API pública de `useTrip()` — não confia só no único chamador
  // de UI atual (revisão Finding 3): valida aqui o valor pago e a existência
  // de uma decisão calculável, recusando a gravação (sem congelar nada) em
  // vez de aceitar um valor inválido ou um snapshot vazio.
  const markPurchaseBought = (id: string, actualPaidUsd: number) => {
    if (!Number.isFinite(actualPaidUsd) || actualPaidUsd < 0) {
      console.error(
        `markPurchaseBought: valor pago inválido (${actualPaidUsd}) para o item ${id}; nada foi gravado.`,
      );
      return;
    }
    const snapshot = purchaseDecisions.find(d => d.purchase_item_id === id);
    if (!snapshot) {
      console.error(
        `markPurchaseBought: nenhuma decisão calculada encontrada para o item ${id}; nada foi gravado.`,
      );
      return;
    }
    updatePurchase(id, {
      status: 'bought',
      actual_paid_usd: actualPaidUsd,
      decision_snapshot: snapshot,
    });
  };



  return (
    <TripContext.Provider
      value={{
        tenants,
        activeTenant,
        trips,
        activeTrip,
        currency,
        setCurrency,
        exchangeRate,
        exchangeRateDate,
        exchangeRateSource,
        setExchangeRate: setExchangeRateManual,
        formatAmount,
        convertAmount,

        setActiveTripId,
        createTrip,

        participants,
        addParticipant,
        updateParticipant,
        deleteParticipant,

        tripDataLoading: tripsLoading || participantsLoading || itineraryLoading || expensesLoading,
        failures,
        dismissFailure,
        retryFailure,

        flights,
        addFlight,
        updateFlight,
        deleteFlight,

        accommodations,
        addAccommodation,
        updateAccommodation,
        deleteAccommodation,

        transports,
        addTransport,
        updateTransport,
        deleteTransport,

        itinerary,
        addItineraryItem,
        updateItineraryItem,
        deleteItineraryItem,

        ideas,
        addIdea,
        updateIdea,
        deleteIdea,

        giftCards,
        addGiftCard,
        updateGiftCard,
        deleteGiftCard,

        purchases,
        addPurchase,
        updatePurchase,
        deletePurchase,
        markPurchaseBought,

        priceQuotes: purchaseState.priceQuotes,
        addPriceQuote: purchaseState.addPriceQuote,
        deactivateQuote: purchaseState.deactivateQuote,
        assumptions: purchaseState.assumptions,
        updateAssumptions: purchaseState.updateAssumptions,
        purchaseDecisions,

        luggages,
        addLuggage,
        updateLuggage,
        deleteLuggage,

        expenses,
        addExpense,
        updateExpense,
        deleteExpense,

        tasks,
        addTask,
        updateTask,
        deleteTask,
        toggleTaskStatus,

        decisions,
        addDecision,
        updateDecision,
        deleteDecision,

        documents,
        addDocument,
        deleteDocument,

        loyaltyAccounts,
        addLoyaltyAccount,
        updateLoyaltyAccount,
        deleteLoyaltyAccount,

        aiProviders,
        updateAiProvider,

        aiLogs,
        addAiLog,

        auditFindings,
        toggleResolveAudit,
        rerunAudit
      }}
    >
      {children}
    </TripContext.Provider>
  );
};

export const useTrip = () => {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
};
