import type {
  Expense,
  Participant,
  Flight,
  Accommodation,
  TransportReservation,
  PurchaseItem,
  ItineraryItem,
  GiftCard,
  Currency
} from '../types/database.types';

export interface CategoryBudgetGoal {
  category: Expense['category'];
  planned_amount_usd: number;
  planned_amount_brl: number;
  label: string;
  icon: string;
  description: string;
}

export interface DreCategorySummary {
  category: Expense['category'];
  label: string;
  icon: string;
  description: string;
  planned_usd: number;
  planned_brl: number;
  actual_usd: number;
  actual_brl: number;
  pending_usd: number;
  pending_brl: number;
  to_provision_usd: number;
  to_provision_brl: number;
  variance_usd: number;
  variance_brl: number;
  variance_pct: number;
  execution_rate_pct: number;
  expenses: Expense[];
  item_count: number;
  is_over_budget: boolean;
}

export interface ParticipantDreSummary {
  participant_id: string;
  full_name: string;
  nickname?: string;
  avatar_preset_id?: string | null;
  avatar_emoji?: string | null;
  avatar_color?: string | null;
  budget_limit_usd: number;
  budget_limit_brl: number;
  total_consumed_usd: number;
  total_consumed_brl: number;
  total_paid_usd: number;
  total_paid_brl: number;
  net_balance_usd: number;
  net_balance_brl: number;
  status: 'creditor' | 'debtor' | 'balanced';
  individual_purchases_usd: number;
  shared_expenses_usd: number;
  expenses_involved: Expense[];
}

export interface DebtSettlement {
  from_id: string;
  from_name: string;
  to_id: string;
  to_name: string;
  amount_usd: number;
  amount_brl: number;
}

export interface DreGlobalResult {
  currency: Currency;
  exchange_rate: number;
  // Totais Consolidados
  total_planned_usd: number;
  total_planned_brl: number;
  total_actual_usd: number;
  total_actual_brl: number;
  total_pending_usd: number;
  total_pending_brl: number;
  total_to_provision_usd: number;
  total_to_provision_brl: number;
  total_variance_usd: number;
  total_variance_brl: number;
  global_execution_rate_pct: number;
  is_global_over_budget: boolean;

  // Breakdown por Categorias
  categories: DreCategorySummary[];

  // Breakdown por Participantes
  participants: ParticipantDreSummary[];

  // Matriz de Acerto de Contas
  settlements: DebtSettlement[];

  // Fluxo Pré-Viagem vs Durante a Viagem
  pre_trip_actual_usd: number;
  pre_trip_actual_brl: number;
  pre_trip_planned_usd: number;
  pre_trip_planned_brl: number;
  in_trip_actual_usd: number;
  in_trip_actual_brl: number;
  in_trip_planned_usd: number;
  in_trip_planned_brl: number;

  // Gift Card Savings
  gift_card_savings_usd: number;
  gift_card_savings_brl: number;
}

export const DEFAULT_CATEGORY_META: Record<Expense['category'], { label: string; icon: string; description: string }> = {
  flight: {
    label: 'Passagens Aéreas',
    icon: 'Plane',
    description: 'Voos internacionais e domésticos, taxas de embarque e marcação de assentos'
  },
  accommodation: {
    label: 'Hospedagens & Resorts',
    icon: 'Building2',
    description: 'Hotéis em Miami, Orlando, resorts Disney/Universal, taxas de resort e estacionamento'
  },
  tickets: {
    label: 'Ingressos & Parques',
    icon: 'Ticket',
    description: 'Passes Disney 4-Park Magic, Universal 3-Park, Express Pass e atrações'
  },
  transport: {
    label: 'Transporte & Aluguel de Carro',
    icon: 'Car',
    description: 'Locação SUV/Van, seguros adicionais, pedágios SunPass, combustível e Uber'
  },
  food: {
    label: 'Alimentação & Gastronomia',
    icon: 'Utensils',
    description: 'Refeições em parques, restaurantes temáticos, cafés da manhã e compras no Walmart'
  },
  shopping: {
    label: 'Compras & Encomendas',
    icon: 'ShoppingBag',
    description: 'Eletrônicos Apple, roupas em outlets, cosméticos, brinquedos e souvenirs'
  },
  services: {
    label: 'Seguros & Documentação',
    icon: 'ShieldCheck',
    description: 'Seguro viagem internacional, emissão de passaportes, vistos e chip de celular'
  },
  other: {
    label: 'Outros & Contingência',
    icon: 'Layers',
    description: 'Reserva para imprevistos, gorjetas, taxas e despesas avulsas'
  }
};

export interface DreEngineParams {
  expenses: Expense[];
  participants: Participant[];
  flights?: Flight[];
  accommodations?: Accommodation[];
  transports?: TransportReservation[];
  purchases?: PurchaseItem[];
  itinerary?: ItineraryItem[];
  giftCards?: GiftCard[];
  exchangeRate: number;
  currency: Currency;
  customGoals?: Partial<Record<Expense['category'], number>>; // valor em USD ou BRL
}

export function computeDre(params: DreEngineParams): DreGlobalResult {
  const {
    expenses,
    participants,
    flights = [],
    accommodations = [],
    transports = [],
    purchases = [],
    giftCards = [],
    exchangeRate,
    currency,
    customGoals = {}
  } = params;

  const rate = exchangeRate > 0 ? exchangeRate : 5.62;

  // 1. Agrupar despesas por categoria
  const categoriesList: Expense['category'][] = [
    'flight',
    'accommodation',
    'tickets',
    'transport',
    'food',
    'shopping',
    'services',
    'other'
  ];

  // Helper de conversão
  const toUsd = (val: number, curr: Currency) => (curr === 'USD' ? val : val / rate);
  const toBrl = (val: number, curr: Currency) => (curr === 'BRL' ? val : val * rate);

  // Calcular economia de Gift Cards
  const gcNominalUsd = giftCards.reduce((acc, g) => acc + (g.currency === 'USD' ? g.nominal_value : g.nominal_value / rate), 0);
  const gcNetCostUsd = giftCards.reduce((acc, g) => acc + (g.currency === 'USD' ? g.net_cost : g.net_cost / rate), 0);
  const giftCardSavingsUsd = Math.max(0, gcNominalUsd - gcNetCostUsd);
  const giftCardSavingsBrl = giftCardSavingsUsd * rate;

  const categorySummaries: DreCategorySummary[] = categoriesList.map(cat => {
    const meta = DEFAULT_CATEGORY_META[cat];
    const catExpenses = expenses.filter(e => e.category === cat);

    // Gastos realizados (pagos)
    const paidExpenses = catExpenses.filter(e => e.status === 'paid' || e.status === 'reimbursed');
    const actualUsd = paidExpenses.reduce((sum, e) => sum + (e.amount_usd || toUsd(e.amount, e.currency)), 0);
    const actualBrl = paidExpenses.reduce((sum, e) => sum + (e.amount_brl || toBrl(e.amount, e.currency)), 0);

    // Gastos pendentes (lançados mas não pagos)
    const pendingExpenses = catExpenses.filter(e => e.status === 'pending');
    const pendingUsd = pendingExpenses.reduce((sum, e) => sum + (e.amount_usd || toUsd(e.amount, e.currency)), 0);
    const pendingBrl = pendingExpenses.reduce((sum, e) => sum + (e.amount_brl || toBrl(e.amount, e.currency)), 0);

    // Planejado automático baseado em entidades do sistema
    let autoPlannedUsd = 0;

    if (cat === 'flight') {
      const flightsTotalUsd = flights.reduce((sum, f) => sum + (f.price_cash ? (f.currency === 'USD' ? f.price_cash : f.price_cash / rate) : 0), 0);
      autoPlannedUsd = Math.max(flightsTotalUsd, actualUsd + pendingUsd);
    } else if (cat === 'accommodation') {
      const hotelsTotalUsd = accommodations.reduce((sum, a) => sum + (a.currency === 'USD' ? a.price_total : a.price_total / rate), 0);
      autoPlannedUsd = Math.max(hotelsTotalUsd, actualUsd + pendingUsd);
    } else if (cat === 'transport') {
      const transportTotalUsd = transports.reduce((sum, t) => sum + (t.currency === 'USD' ? t.price_total : t.price_total / rate), 0);
      autoPlannedUsd = Math.max(transportTotalUsd, actualUsd + pendingUsd);
    } else if (cat === 'shopping') {
      const purchasesTotalUsd = purchases.reduce((sum, p) => sum + p.target_price_usd * (p.quantity || 1), 0);
      autoPlannedUsd = Math.max(purchasesTotalUsd, actualUsd + pendingUsd);
    } else if (cat === 'food') {
      // Média estimada para alimentação do grupo se não houver meta
      autoPlannedUsd = Math.max(1500, actualUsd + pendingUsd);
    } else {
      autoPlannedUsd = actualUsd + pendingUsd;
    }

    // Se houver customGoal definido pelo usuário para esta categoria, ele prevalece
    const customGoal = customGoals[cat];
    const finalPlannedUsd = customGoal !== undefined && customGoal > 0 ? customGoal : Math.max(autoPlannedUsd, actualUsd + pendingUsd);
    const finalPlannedBrl = finalPlannedUsd * rate;

    // Quanto ainda precisa ser provisionado (orçado - realizado)
    const toProvisionUsd = Math.max(0, finalPlannedUsd - actualUsd);
    const toProvisionBrl = toProvisionUsd * rate;

    // Variação = Planejado - Realizado (positivo = economia/dentro da meta, negativo = estourou)
    const varianceUsd = finalPlannedUsd - actualUsd;
    const varianceBrl = varianceUsd * rate;
    const variancePct = finalPlannedUsd > 0 ? (actualUsd / finalPlannedUsd) * 100 : 0;

    const executionRatePct = finalPlannedUsd > 0 ? Math.min(100, (actualUsd / finalPlannedUsd) * 100) : (actualUsd > 0 ? 100 : 0);
    const isOverBudget = actualUsd > finalPlannedUsd;

    return {
      category: cat,
      label: meta.label,
      icon: meta.icon,
      description: meta.description,
      planned_usd: Number(finalPlannedUsd.toFixed(2)),
      planned_brl: Number(finalPlannedBrl.toFixed(2)),
      actual_usd: Number(actualUsd.toFixed(2)),
      actual_brl: Number(actualBrl.toFixed(2)),
      pending_usd: Number(pendingUsd.toFixed(2)),
      pending_brl: Number(pendingBrl.toFixed(2)),
      to_provision_usd: Number(toProvisionUsd.toFixed(2)),
      to_provision_brl: Number(toProvisionBrl.toFixed(2)),
      variance_usd: Number(varianceUsd.toFixed(2)),
      variance_brl: Number(varianceBrl.toFixed(2)),
      variance_pct: Number(variancePct.toFixed(1)),
      execution_rate_pct: Number(executionRatePct.toFixed(1)),
      expenses: catExpenses,
      item_count: catExpenses.length,
      is_over_budget: isOverBudget
    };
  });

  // Totais Gerais Consolidados
  const totalPlannedUsd = categorySummaries.reduce((acc, c) => acc + c.planned_usd, 0);
  const totalPlannedBrl = totalPlannedUsd * rate;
  const totalActualUsd = categorySummaries.reduce((acc, c) => acc + c.actual_usd, 0);
  const totalActualBrl = totalActualUsd * rate;
  const totalPendingUsd = categorySummaries.reduce((acc, c) => acc + c.pending_usd, 0);
  const totalPendingBrl = totalPendingUsd * rate;
  const totalToProvisionUsd = Math.max(0, totalPlannedUsd - totalActualUsd);
  const totalToProvisionBrl = totalToProvisionUsd * rate;
  const totalVarianceUsd = totalPlannedUsd - totalActualUsd;
  const totalVarianceBrl = totalVarianceUsd * rate;
  const globalExecutionRatePct = totalPlannedUsd > 0 ? (totalActualUsd / totalPlannedUsd) * 100 : 0;
  const isGlobalOverBudget = totalActualUsd > totalPlannedUsd;

  // 2. DRE por Participante & Rateio
  const participantSummaries: ParticipantDreSummary[] = participants.map(p => {
    // Despesas pagas por este participante
    const paidByThisPerson = expenses.filter(e => e.paid_by_id === p.id && e.status === 'paid');
    const totalPaidUsd = paidByThisPerson.reduce((sum, e) => sum + (e.amount_usd || toUsd(e.amount, e.currency)), 0);
    const totalPaidBrl = totalPaidUsd * rate;

    // Despesas onde este participante é beneficiário
    const expensesAsBeneficiary = expenses.filter(e => {
      if (!e.beneficiary_ids || e.beneficiary_ids.length === 0) return true; // rateio geral
      return e.beneficiary_ids.includes(p.id);
    });

    let totalConsumedUsd = 0;
    expenses.forEach(e => {
      const isBeneficiary = !e.beneficiary_ids || e.beneficiary_ids.length === 0 || e.beneficiary_ids.includes(p.id);
      if (isBeneficiary) {
        const beneficiariesCount = e.beneficiary_ids && e.beneficiary_ids.length > 0 ? e.beneficiary_ids.length : participants.length || 1;
        const itemUsd = e.amount_usd || toUsd(e.amount, e.currency);
        totalConsumedUsd += itemUsd / beneficiariesCount;
      }
    });

    // Adicionar compras individuais destinadas a esta pessoa
    const individualPurchases = purchases.filter(purch => purch.target_participant_id === p.id);
    const individualPurchasesUsd = individualPurchases.reduce((sum, purch) => {
      const val = purch.actual_paid_usd !== undefined ? purch.actual_paid_usd : (purch.target_price_usd * (purch.quantity || 1));
      return sum + val;
    }, 0);

    const totalConsumedBrl = totalConsumedUsd * rate;
    const netBalanceUsd = totalPaidUsd - totalConsumedUsd;
    const netBalanceBrl = netBalanceUsd * rate;

    let status: 'creditor' | 'debtor' | 'balanced' = 'balanced';
    if (netBalanceUsd > 1) status = 'creditor';
    else if (netBalanceUsd < -1) status = 'debtor';

    return {
      participant_id: p.id,
      full_name: p.full_name,
      nickname: p.nickname,
      avatar_preset_id: p.avatar_preset_id,
      avatar_emoji: p.avatar_emoji,
      avatar_color: p.avatar_color,
      budget_limit_usd: p.budget_limit_usd || 0,
      budget_limit_brl: (p.budget_limit_usd || 0) * rate,
      total_consumed_usd: Number(totalConsumedUsd.toFixed(2)),
      total_consumed_brl: Number(totalConsumedBrl.toFixed(2)),
      total_paid_usd: Number(totalPaidUsd.toFixed(2)),
      total_paid_brl: Number(totalPaidBrl.toFixed(2)),
      net_balance_usd: Number(netBalanceUsd.toFixed(2)),
      net_balance_brl: Number(netBalanceBrl.toFixed(2)),
      status,
      individual_purchases_usd: Number(individualPurchasesUsd.toFixed(2)),
      shared_expenses_usd: Number((totalConsumedUsd - individualPurchasesUsd).toFixed(2)),
      expenses_involved: expensesAsBeneficiary
    };
  });

  // 3. Algoritmo de Acerto de Contas (Debt Settlement)
  const settlements: DebtSettlement[] = [];
  const creditors = participantSummaries
    .filter(p => p.net_balance_usd > 0.5)
    .map(p => ({ ...p, remaining: p.net_balance_usd }));
  const debtors = participantSummaries
    .filter(p => p.net_balance_usd < -0.5)
    .map(p => ({ ...p, remaining: Math.abs(p.net_balance_usd) }));

  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const cred = creditors[cIdx];
    const deb = debtors[dIdx];
    const amount = Math.min(cred.remaining, deb.remaining);

    if (amount > 0.05) {
      settlements.push({
        from_id: deb.participant_id,
        from_name: deb.nickname || deb.full_name.split(' ')[0],
        to_id: cred.participant_id,
        to_name: cred.nickname || cred.full_name.split(' ')[0],
        amount_usd: Number(amount.toFixed(2)),
        amount_brl: Number((amount * rate).toFixed(2))
      });
    }

    cred.remaining -= amount;
    deb.remaining -= amount;

    if (cred.remaining <= 0.05) cIdx++;
    if (deb.remaining <= 0.05) dIdx++;
  }

  // 4. Fluxo Pré-Viagem vs Durante a Viagem
  // Pré-viagem: flights, accommodation, tickets, services
  const preTripCategories = ['flight', 'accommodation', 'tickets', 'services'];
  const preTripSummary = categorySummaries.filter(c => preTripCategories.includes(c.category));
  const inTripSummary = categorySummaries.filter(c => !preTripCategories.includes(c.category));

  const preTripActualUsd = preTripSummary.reduce((sum, c) => sum + c.actual_usd, 0);
  const preTripPlannedUsd = preTripSummary.reduce((sum, c) => sum + c.planned_usd, 0);
  const inTripActualUsd = inTripSummary.reduce((sum, c) => sum + c.actual_usd, 0);
  const inTripPlannedUsd = inTripSummary.reduce((sum, c) => sum + c.planned_usd, 0);

  return {
    currency,
    exchange_rate: rate,
    total_planned_usd: Number(totalPlannedUsd.toFixed(2)),
    total_planned_brl: Number(totalPlannedBrl.toFixed(2)),
    total_actual_usd: Number(totalActualUsd.toFixed(2)),
    total_actual_brl: Number(totalActualBrl.toFixed(2)),
    total_pending_usd: Number(totalPendingUsd.toFixed(2)),
    total_pending_brl: Number(totalPendingBrl.toFixed(2)),
    total_to_provision_usd: Number(totalToProvisionUsd.toFixed(2)),
    total_to_provision_brl: Number(totalToProvisionBrl.toFixed(2)),
    total_variance_usd: Number(totalVarianceUsd.toFixed(2)),
    total_variance_brl: Number(totalVarianceBrl.toFixed(2)),
    global_execution_rate_pct: Number(globalExecutionRatePct.toFixed(1)),
    is_global_over_budget: isGlobalOverBudget,

    categories: categorySummaries,
    participants: participantSummaries,
    settlements,

    pre_trip_actual_usd: Number(preTripActualUsd.toFixed(2)),
    pre_trip_actual_brl: Number((preTripActualUsd * rate).toFixed(2)),
    pre_trip_planned_usd: Number(preTripPlannedUsd.toFixed(2)),
    pre_trip_planned_brl: Number((preTripPlannedUsd * rate).toFixed(2)),
    in_trip_actual_usd: Number(inTripActualUsd.toFixed(2)),
    in_trip_actual_brl: Number((inTripActualUsd * rate).toFixed(2)),
    in_trip_planned_usd: Number(inTripPlannedUsd.toFixed(2)),
    in_trip_planned_brl: Number((inTripPlannedUsd * rate).toFixed(2)),

    gift_card_savings_usd: Number(giftCardSavingsUsd.toFixed(2)),
    gift_card_savings_brl: Number(giftCardSavingsBrl.toFixed(2))
  };
}
