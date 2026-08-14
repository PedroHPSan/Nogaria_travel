import type { Expense, Currency } from '../../types/database.types';

export interface ExpenseRow {
  id: string;
  trip_id: string;
  description: string;
  amount: number | string;
  currency: 'USD' | 'BRL';
  amount_usd: number | string;
  amount_brl: number | string;
  exchange_rate: number | string;
  category: Expense['category'];
  paid_by_id: string;
  beneficiary_ids: string[];
  gift_card_id?: string | null;
  payment_method_id?: string | null;
  date: string;
  status: Expense['status'];
  created_at?: string;
}

export function expenseFromRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    trip_id: row.trip_id,
    description: row.description,
    amount: Number(row.amount) || 0,
    currency: (row.currency as Currency) || 'USD',
    amount_usd: Number(row.amount_usd) || 0,
    amount_brl: Number(row.amount_brl) || 0,
    exchange_rate: Number(row.exchange_rate) || 1,
    category: row.category,
    paid_by_id: row.paid_by_id,
    beneficiary_ids: Array.isArray(row.beneficiary_ids) ? row.beneficiary_ids : [],
    gift_card_id: row.gift_card_id ?? undefined,
    payment_method_id: row.payment_method_id ?? undefined,
    date: row.date,
    status: row.status,
  };
}

export function expenseToInsert(e: Expense): ExpenseRow {
  return {
    id: e.id,
    trip_id: e.trip_id,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    amount_usd: e.amount_usd,
    amount_brl: e.amount_brl,
    exchange_rate: e.exchange_rate,
    category: e.category,
    paid_by_id: e.paid_by_id,
    beneficiary_ids: e.beneficiary_ids,
    gift_card_id: e.gift_card_id ?? null,
    payment_method_id: e.payment_method_id ?? null,
    date: e.date,
    status: e.status,
  };
}
