import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type {
  Trip,
  Tenant,
  Participant,
  Flight,
  Accommodation,
  TransportReservation,
  ItineraryItem,
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

import {
  INITIAL_TRIP,
  INITIAL_PARTICIPANTS,
  INITIAL_FLIGHTS,
  INITIAL_ACCOMMODATIONS,
  INITIAL_TRANSPORTS,
  INITIAL_ITINERARY,
  INITIAL_GIFT_CARDS,
  INITIAL_PURCHASES,
  INITIAL_TASKS,
  INITIAL_DECISIONS,
  INITIAL_AI_PROVIDERS,
  INITIAL_AI_LOGS
} from '../services/initialMockData';

import { runFullTripAudit } from '../services/auditEngine';
import { calculateGiftCardNetCost } from '../services/giftCardCalculator';
import { formatCurrencyValue, convertCurrency } from '../services/exchangeRateService';
import { useAuth } from './AuthContext';
import { newId } from '../services/ids';
import { usePurchasesState } from '../features/purchases/usePurchasesState';
import { decidePurchases } from '../services/purchase/purchaseDecisionEngine';

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
  setExchangeRate: (rate: number) => void;
  formatAmount: (amountUSD: number) => string;
  convertAmount: (amountUSD: number) => number;

  setActiveTripId: (id: string) => void;
  createTrip: (tripData: Omit<Trip, 'id' | 'created_at' | 'updated_at'>) => void;

  participants: Participant[];
  addParticipant: (p: Omit<Participant, 'id'>) => void;
  updateParticipant: (id: string, p: Partial<Participant>) => void;
  deleteParticipant: (id: string) => void;

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

const INITIAL_DOCUMENTS: DocumentFile[] = [
  {
    id: 'doc-01',
    trip_id: 'trip-miami-orlando-2026',
    title: 'Voucher Disney All-Star Movies',
    category: 'hotel',
    file_url: 'https://example.com/vouchers/disney-movies.pdf',
    uploaded_at: '2026-07-20T10:00:00Z',
    file_size: '1.2 MB',
    notes: 'Reserva confirmada DSNY-994821'
  },
  {
    id: 'doc-02',
    trip_id: 'trip-miami-orlando-2026',
    title: 'Bilhetes Voo AD 8702 Campinas -> Orlando',
    category: 'flight',
    file_url: 'https://example.com/vouchers/azul-ad8702.pdf',
    uploaded_at: '2026-07-22T14:30:00Z',
    file_size: '850 KB',
    notes: 'Passagens de Pedro e Gabi'
  },
  {
    id: 'doc-03',
    trip_id: 'trip-miami-orlando-2026',
    title: 'Confirmação Aluguel SUV Hertz FLL',
    category: 'car',
    file_url: 'https://example.com/vouchers/hertz-suv.pdf',
    uploaded_at: '2026-07-23T09:15:00Z',
    file_size: '420 KB',
    notes: 'Devolução imprenterível em 19/09 às 17h30'
  }
];

const INITIAL_LOYALTY: LoyaltyAccount[] = [
  {
    id: 'loy-01',
    trip_id: 'trip-miami-orlando-2026',
    program_name: 'Azul Fidelidade',
    holder_id: 'p-pedro',
    balance_points: 185000,
    cpm_usd: 3.20,
    cash_equivalent_usd: 592.00,
    notes: 'Utilizado para emissão VCP -> MCO'
  },
  {
    id: 'loy-02',
    trip_id: 'trip-miami-orlando-2026',
    program_name: 'LATAM Pass',
    holder_id: 'p-barbara',
    balance_points: 92000,
    cpm_usd: 3.50,
    cash_equivalent_usd: 322.00,
    notes: 'Passagens GRU -> MIA'
  },
  {
    id: 'loy-03',
    trip_id: 'trip-miami-orlando-2026',
    program_name: 'Marriott Bonvoy',
    holder_id: 'p-barbara',
    balance_points: 45000,
    cpm_usd: 7.00,
    cash_equivalent_usd: 315.00,
    notes: 'Usado na hospedagem Four Points FLL'
  }
];

const INITIAL_LUGGAGE: Luggage[] = [
  {
    id: 'lug-barbara-01',
    trip_id: 'trip-miami-orlando-2026',
    participant_id: 'p-barbara',
    type: 'checked',
    bag_identifier: 'Mala Grande Bárbara #1',
    max_weight_kg: 23,
    current_weight_kg: 14,
    description: 'Roupas pessoais e produtos de higiene',
    shopping_space_reserved_pct: 40
  },
  {
    id: 'lug-barbara-02',
    trip_id: 'trip-miami-orlando-2026',
    participant_id: 'p-barbara',
    type: 'checked',
    bag_identifier: 'Mala Grande Bárbara #2 (Vazia para Compras)',
    max_weight_kg: 23,
    current_weight_kg: 3,
    description: 'Mala expansível para compras de roupas e presentes',
    shopping_space_reserved_pct: 90
  },
  {
    id: 'lug-pedro-01',
    trip_id: 'trip-miami-orlando-2026',
    participant_id: 'p-pedro',
    type: 'checked',
    bag_identifier: 'Mala Rígida Pedro #1',
    max_weight_kg: 23,
    current_weight_kg: 16,
    description: 'Equipamentos, roupas e itens de Gabi',
    shopping_space_reserved_pct: 30
  },
  {
    id: 'lug-gabi-01',
    trip_id: 'trip-miami-orlando-2026',
    participant_id: 'p-gabriela',
    type: 'carry_on',
    bag_identifier: 'Mala Infantil Gabi',
    max_weight_kg: 10,
    current_weight_kg: 6,
    description: 'Brinquedos, troca de roupa e fraldas para o voo',
    shopping_space_reserved_pct: 10
  }
];

const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-01',
    trip_id: 'trip-miami-orlando-2026',
    description: 'Depósito Reserva Disney All-Star Movies',
    amount: 500,
    currency: 'USD',
    amount_usd: 500,
    amount_brl: 2810,
    exchange_rate: 5.62,
    category: 'accommodation',
    paid_by_id: 'p-barbara',
    beneficiary_ids: ['p-barbara', 'p-debora', 'p-pedro', 'p-gabriela'],
    date: '2026-06-10',
    status: 'paid'
  },
  {
    id: 'exp-02',
    trip_id: 'trip-miami-orlando-2026',
    description: 'Taxas de Embarque Voo Azul (Pedro & Gabi)',
    amount: 145.50,
    currency: 'USD',
    amount_usd: 145.50,
    amount_brl: 817.71,
    exchange_rate: 5.62,
    category: 'flight',
    paid_by_id: 'p-pedro',
    beneficiary_ids: ['p-pedro', 'p-gabriela'],
    date: '2026-07-01',
    status: 'paid'
  }
];

export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantMemberships, activeTenant: authActiveTenant } = useAuth();
  const tenants = tenantMemberships.map(m => m.tenant);
  const activeTenant = authActiveTenant;
  if (!activeTenant) {
    throw new Error('TripProvider rendered without an active tenant — it must be wrapped by AuthGate');
  }

  // Currency & Live Exchange Rate State
  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_currency`);
    return (saved as Currency) || 'USD';
  });

  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_exchangeRate`);
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5.62;
  });

  const exchangeRateDate = new Date().toLocaleDateString('pt-BR');

  // Helper formatting & calculation functions
  const formatAmount = (amountUSD: number): string => {
    return formatCurrencyValue(amountUSD, currency, exchangeRate);
  };

  const convertAmount = (amountUSD: number): number => {
    return convertCurrency(amountUSD, currency, exchangeRate);
  };

  // Load from localStorage or fallback to defaults
  const [trips, setTrips] = useState<Trip[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_trips`);
    return saved ? JSON.parse(saved) : [INITIAL_TRIP];
  });

  const [activeTripId, setActiveTripId] = useState<string>(trips[0]?.id || INITIAL_TRIP.id);

  const [participants, setParticipants] = useState<Participant[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_participants`);
    return saved ? JSON.parse(saved) : INITIAL_PARTICIPANTS;
  });

  const [flights, setFlights] = useState<Flight[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_flights`);
    return saved ? JSON.parse(saved) : INITIAL_FLIGHTS;
  });

  const [accommodations, setAccommodations] = useState<Accommodation[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_accommodations`);
    return saved ? JSON.parse(saved) : INITIAL_ACCOMMODATIONS;
  });

  const [transports, setTransports] = useState<TransportReservation[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_transports`);
    return saved ? JSON.parse(saved) : INITIAL_TRANSPORTS;
  });

  const [itinerary, setItinerary] = useState<ItineraryItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_itinerary`);
    return saved ? JSON.parse(saved) : INITIAL_ITINERARY;
  });

  const [giftCards, setGiftCards] = useState<GiftCard[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_giftCards`);
    return saved ? JSON.parse(saved) : INITIAL_GIFT_CARDS;
  });

  const [purchases, setPurchases] = useState<PurchaseItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_purchases`);
    return saved ? JSON.parse(saved) : INITIAL_PURCHASES;
  });

  const [luggages, setLuggages] = useState<Luggage[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_luggages`);
    return saved ? JSON.parse(saved) : INITIAL_LUGGAGE;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_expenses`);
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_tasks`);
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [decisions, setDecisions] = useState<Decision[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_decisions`);
    return saved ? JSON.parse(saved) : INITIAL_DECISIONS;
  });

  const [documents, setDocuments] = useState<DocumentFile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_documents`);
    return saved ? JSON.parse(saved) : INITIAL_DOCUMENTS;
  });

  const [loyaltyAccounts, setLoyaltyAccounts] = useState<LoyaltyAccount[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_loyalty`);
    return saved ? JSON.parse(saved) : INITIAL_LOYALTY;
  });

  const [aiProviders, setAiProviders] = useState<AiProviderConfig[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_aiProviders`);
    return saved ? JSON.parse(saved) : INITIAL_AI_PROVIDERS;
  });

  const [aiLogs, setAiLogs] = useState<AiUsageLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_aiLogs`);
    return saved ? JSON.parse(saved) : INITIAL_AI_LOGS;
  });

  const [resolvedAuditIds, setResolvedAuditIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_resolvedAudits`);
    return saved ? JSON.parse(saved) : [];
  });

  // Active Trip
  const activeTrip = useMemo(() => {
    return trips.find(t => t.id === activeTripId) || trips[0] || INITIAL_TRIP;
  }, [trips, activeTripId]);

  const purchaseState = usePurchasesState(STORAGE_KEY, activeTrip.id, exchangeRate);

  // Persist State to LocalStorage on Change
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_currency`, currency);
  }, [currency]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_exchangeRate`, exchangeRate.toString());
  }, [exchangeRate]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_trips`, JSON.stringify(trips));
  }, [trips]);
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_participants`, JSON.stringify(participants));
  }, [participants]);
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
    localStorage.setItem(`${STORAGE_KEY}_itinerary`, JSON.stringify(itinerary));
  }, [itinerary]);
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

  const purchaseDecisions = useMemo(
    () =>
      decidePurchases({
        items: purchases.filter(p => p.trip_id === activeTrip.id),
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
    [purchases, purchaseState, participants, giftCards, luggages, activeTrip.id, exchangeRate],
  );

  const toggleResolveAudit = (id: string) => {
    setResolvedAuditIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const rerunAudit = () => {
    // Audit updates automatically through useMemo
  };

  // CRUD Implementations
  const createTrip = (tripData: Omit<Trip, 'id' | 'created_at' | 'updated_at'>) => {
    const newTrip: Trip = {
      ...tripData,
      id: newId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setTrips(prev => [...prev, newTrip]);
    setActiveTripId(newTrip.id);
  };

  const addParticipant = (p: Omit<Participant, 'id'>) => {
    const newP: Participant = { ...p, id: newId() };
    setParticipants(prev => [...prev, newP]);
  };

  const updateParticipant = (id: string, p: Partial<Participant>) => {
    setParticipants(prev => prev.map(item => (item.id === id ? { ...item, ...p } : item)));
  };

  const deleteParticipant = (id: string) => {
    setParticipants(prev => prev.filter(item => item.id !== id));
  };

  const addFlight = (f: Omit<Flight, 'id'>) => {
    const newF: Flight = { ...f, id: newId() };
    setFlights(prev => [...prev, newF]);
  };

  const updateFlight = (id: string, f: Partial<Flight>) => {
    setFlights(prev => prev.map(item => (item.id === id ? { ...item, ...f } : item)));
  };

  const deleteFlight = (id: string) => {
    setFlights(prev => prev.filter(item => item.id !== id));
  };

  const addAccommodation = (a: Omit<Accommodation, 'id'>) => {
    const newA: Accommodation = { ...a, id: newId() };
    setAccommodations(prev => [...prev, newA]);
  };

  const updateAccommodation = (id: string, a: Partial<Accommodation>) => {
    setAccommodations(prev => prev.map(item => (item.id === id ? { ...item, ...a } : item)));
  };

  const deleteAccommodation = (id: string) => {
    setAccommodations(prev => prev.filter(item => item.id !== id));
  };

  const addTransport = (t: Omit<TransportReservation, 'id'>) => {
    const newT: TransportReservation = { ...t, id: newId() };
    setTransports(prev => [...prev, newT]);
  };

  const updateTransport = (id: string, t: Partial<TransportReservation>) => {
    setTransports(prev => prev.map(item => (item.id === id ? { ...item, ...t } : item)));
  };

  const deleteTransport = (id: string) => {
    setTransports(prev => prev.filter(item => item.id !== id));
  };

  const addItineraryItem = (i: Omit<ItineraryItem, 'id'>) => {
    const newI: ItineraryItem = { ...i, id: newId() };
    setItinerary(prev => [...prev, newI]);
  };

  const updateItineraryItem = (id: string, i: Partial<ItineraryItem>) => {
    setItinerary(prev => prev.map(item => (item.id === id ? { ...item, ...i } : item)));
  };

  const deleteItineraryItem = (id: string) => {
    setItinerary(prev => prev.filter(item => item.id !== id));
  };

  const addGiftCard = (g: Omit<GiftCard, 'id' | 'net_cost' | 'cashback_amount' | 'effective_savings' | 'effective_savings_pct'>) => {
    const calc = calculateGiftCardNetCost(g.nominal_value, g.paid_amount, g.cashback_pct);
    const newG: GiftCard = {
      ...g,
      id: newId(),
      net_cost: calc.netCost,
      cashback_amount: calc.cashbackValue,
      effective_savings: calc.effectiveSavingsUSD,
      effective_savings_pct: calc.effectiveSavingsPct
    };
    setGiftCards(prev => [...prev, newG]);
  };

  const updateGiftCard = (id: string, g: Partial<GiftCard>) => {
    setGiftCards(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, ...g };
        const calc = calculateGiftCardNetCost(updated.nominal_value, updated.paid_amount, updated.cashback_pct);
        return {
          ...updated,
          net_cost: calc.netCost,
          cashback_amount: calc.cashbackValue,
          effective_savings: calc.effectiveSavingsUSD,
          effective_savings_pct: calc.effectiveSavingsPct
        };
      })
    );
  };

  const deleteGiftCard = (id: string) => {
    setGiftCards(prev => prev.filter(item => item.id !== id));
  };

  const addPurchase = (p: Omit<PurchaseItem, 'id'>) => {
    const newP: PurchaseItem = { ...p, id: newId() };
    setPurchases(prev => [...prev, newP]);
  };

  // Fecha a porta dos fundos do dropdown de Status (CA-11 / revisão Finding 2):
  // `updatePurchase` é o único ponto por onde TODA gravação de `purchases`
  // passa (inclusive o <select> do PurchaseModal, que nunca chama
  // markPurchaseBought), então a garantia do congelamento tem que morar aqui,
  // não na UI. Qualquer transição PARA 'bought' sem um snapshot já anexado ao
  // patch tira um agora — senão o item nunca congela e recalcula ao vivo para
  // sempre. Qualquer transição PARA FORA de 'bought' apaga o snapshot (e o
  // valor pago) — senão reverter para 'planned' e marcar 'bought' de novo
  // ressuscita o snapshot da compra anterior com os números de outra compra.
  const updatePurchase = (id: string, p: Partial<PurchaseItem>) => {
    setPurchases(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated: PurchaseItem = { ...item, ...p };

        if (updated.status === 'bought' && item.status !== 'bought' && !updated.decision_snapshot) {
          updated.decision_snapshot = purchaseDecisions.find(d => d.purchase_item_id === id);
        } else if (updated.status !== 'bought' && item.status === 'bought') {
          updated.decision_snapshot = undefined;
          updated.actual_paid_usd = undefined;
        }

        return updated;
      }),
    );
  };

  const deletePurchase = (id: string) => {
    setPurchases(prev => prev.filter(item => item.id !== id));
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

  const addLuggage = (l: Omit<Luggage, 'id'>) => {
    const newL: Luggage = { ...l, id: newId() };
    setLuggages(prev => [...prev, newL]);
  };

  const updateLuggage = (id: string, l: Partial<Luggage>) => {
    setLuggages(prev => prev.map(item => (item.id === id ? { ...item, ...l } : item)));
  };

  const deleteLuggage = (id: string) => {
    setLuggages(prev => prev.filter(item => item.id !== id));
  };

  const addExpense = (e: Omit<Expense, 'id'>) => {
    const newE: Expense = { ...e, id: newId() };
    setExpenses(prev => [...prev, newE]);
  };

  const updateExpense = (id: string, e: Partial<Expense>) => {
    setExpenses(prev => prev.map(item => (item.id === id ? { ...item, ...e } : item)));
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(item => item.id !== id));
  };

  const addTask = (t: Omit<Task, 'id' | 'created_at'>) => {
    const newT: Task = { ...t, id: newId(), created_at: new Date().toISOString() };
    setTasks(prev => [...prev, newT]);
  };

  const updateTask = (id: string, t: Partial<Task>) => {
    setTasks(prev => prev.map(item => (item.id === id ? { ...item, ...t } : item)));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(item => item.id !== id));
  };

  const toggleTaskStatus = (id: string) => {
    setTasks(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const newStatus = item.status === 'completed' ? 'pending' : 'completed';
        return { ...item, status: newStatus };
      })
    );
  };

  const addDecision = (d: Omit<Decision, 'id'>) => {
    const newD: Decision = { ...d, id: newId() };
    setDecisions(prev => [...prev, newD]);
  };

  const updateDecision = (id: string, d: Partial<Decision>) => {
    setDecisions(prev => prev.map(item => (item.id === id ? { ...item, ...d } : item)));
  };

  const deleteDecision = (id: string) => {
    setDecisions(prev => prev.filter(item => item.id !== id));
  };

  const addDocument = (doc: Omit<DocumentFile, 'id' | 'uploaded_at'>) => {
    const newDoc: DocumentFile = {
      ...doc,
      id: newId(),
      uploaded_at: new Date().toISOString()
    };
    setDocuments(prev => [...prev, newDoc]);
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(item => item.id !== id));
  };

  const addLoyaltyAccount = (acc: Omit<LoyaltyAccount, 'id'>) => {
    const newLoy: LoyaltyAccount = { ...acc, id: newId() };
    setLoyaltyAccounts(prev => [...prev, newLoy]);
  };

  const updateLoyaltyAccount = (id: string, acc: Partial<LoyaltyAccount>) => {
    setLoyaltyAccounts(prev => prev.map(item => (item.id === id ? { ...item, ...acc } : item)));
  };

  const deleteLoyaltyAccount = (id: string) => {
    setLoyaltyAccounts(prev => prev.filter(item => item.id !== id));
  };

  const updateAiProvider = (id: string, config: Partial<AiProviderConfig>) => {
    setAiProviders(prev => prev.map(item => (item.id === id ? { ...item, ...config } : item)));
  };

  const addAiLog = (log: Omit<AiUsageLog, 'id' | 'timestamp'>) => {
    const newLog: AiUsageLog = {
      ...log,
      id: newId(),
      timestamp: new Date().toISOString()
    };
    setAiLogs(prev => [newLog, ...prev]);
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
        setExchangeRate,
        formatAmount,
        convertAmount,

        setActiveTripId,
        createTrip,

        participants,
        addParticipant,
        updateParticipant,
        deleteParticipant,

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
