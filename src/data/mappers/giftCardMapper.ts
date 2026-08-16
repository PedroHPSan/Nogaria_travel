import type { GiftCard, Currency } from '../../types/database.types';

export interface GiftCardRow {
  id: string;
  trip_id: string;
  store_brand: string;
  nominal_value: number | string;
  paid_amount: number | string;
  cashback_pct: number | string;
  cashback_amount?: number | string | null;
  net_cost?: number | string | null;
  effective_savings?: number | string | null;
  effective_savings_pct?: number | string | null;
  currency: 'USD' | 'BRL';
  purchased_by_id: string;
  beneficiary_id: string | null;
  card_code_masked: string;
  current_balance: number | string;
  expiry_date: string | null;
  status: GiftCard['status'];
  purchase_date: string;
  notes: string | null;
  created_at?: string;
}

export interface GiftCardInsertRow {
  id: string;
  trip_id: string;
  store_brand: string;
  nominal_value: number;
  paid_amount: number;
  cashback_pct: number;
  currency: 'USD' | 'BRL';
  purchased_by_id: string;
  beneficiary_id: string | null;
  card_code_masked: string;
  current_balance: number;
  expiry_date: string | null;
  status: GiftCard['status'];
  purchase_date: string;
  notes: string | null;
}

export function giftCardFromRow(row: GiftCardRow): GiftCard {
  const nominal = Number(row.nominal_value) || 0;
  const paid = Number(row.paid_amount) || 0;
  const cbPct = Number(row.cashback_pct) || 0;

  const cbAmount = row.cashback_amount !== undefined && row.cashback_amount !== null
    ? Number(row.cashback_amount)
    : Math.round(paid * (cbPct / 100) * 100) / 100;

  const net = row.net_cost !== undefined && row.net_cost !== null
    ? Number(row.net_cost)
    : Math.round((paid - cbAmount) * 100) / 100;

  const effSavings = row.effective_savings !== undefined && row.effective_savings !== null
    ? Number(row.effective_savings)
    : Math.round((nominal - net) * 100) / 100;

  const effSavingsPct = row.effective_savings_pct !== undefined && row.effective_savings_pct !== null
    ? Number(row.effective_savings_pct)
    : nominal > 0 ? Math.round(((nominal - net) / nominal) * 10000) / 100 : 0;

  return {
    id: row.id,
    trip_id: row.trip_id,
    store_brand: row.store_brand,
    nominal_value: nominal,
    paid_amount: paid,
    cashback_pct: cbPct,
    cashback_amount: cbAmount,
    net_cost: net,
    effective_savings: effSavings,
    effective_savings_pct: effSavingsPct,
    currency: (row.currency as Currency) || 'USD',
    purchased_by_id: row.purchased_by_id,
    beneficiary_id: row.beneficiary_id ?? undefined,
    card_code_masked: row.card_code_masked,
    current_balance: Number(row.current_balance) || 0,
    expiry_date: row.expiry_date ?? undefined,
    status: row.status,
    purchase_date: row.purchase_date,
    notes: row.notes ?? undefined,
  };
}

export function giftCardToInsert(card: GiftCard): GiftCardInsertRow {
  return {
    id: card.id,
    trip_id: card.trip_id,
    store_brand: card.store_brand,
    nominal_value: card.nominal_value,
    paid_amount: card.paid_amount,
    cashback_pct: card.cashback_pct,
    currency: card.currency,
    purchased_by_id: card.purchased_by_id,
    beneficiary_id: card.beneficiary_id ?? null,
    card_code_masked: card.card_code_masked,
    current_balance: card.current_balance,
    expiry_date: card.expiry_date ?? null,
    status: card.status,
    purchase_date: card.purchase_date,
    notes: card.notes ?? null,
  };
}
