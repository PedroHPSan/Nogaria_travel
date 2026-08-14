import { describe, it, expect } from 'vitest';
import { expenseFromRow, expenseToInsert, type ExpenseRow } from './expenseMapper';
import type { Expense } from '../../types/database.types';

describe('expenseMapper', () => {
  it('converts row from postgres to domain Expense object', () => {
    const row: ExpenseRow = {
      id: 'exp-1',
      trip_id: 'trip-1',
      description: 'Passagem Aérea FLL',
      amount: '1859.00',
      currency: 'BRL',
      amount_usd: '330.00',
      amount_brl: '1859.00',
      exchange_rate: '5.62',
      category: 'flight',
      paid_by_id: 'p-pedro',
      beneficiary_ids: ['p-barbara'],
      gift_card_id: null,
      payment_method_id: null,
      date: '2026-09-04',
      status: 'paid',
    };

    const expense = expenseFromRow(row);

    expect(expense.id).toBe('exp-1');
    expect(expense.amount).toBe(1859);
    expect(expense.amount_usd).toBe(330);
    expect(expense.amount_brl).toBe(1859);
    expect(expense.exchange_rate).toBe(5.62);
    expect(expense.category).toBe('flight');
    expect(expense.beneficiary_ids).toEqual(['p-barbara']);
    expect(expense.gift_card_id).toBeUndefined();
  });

  it('converts domain Expense object to insertable row', () => {
    const expense: Expense = {
      id: 'exp-2',
      trip_id: 'trip-1',
      description: 'Celebration Suites',
      amount: 4310,
      currency: 'BRL',
      amount_usd: 766.90,
      amount_brl: 4310,
      exchange_rate: 5.62,
      category: 'accommodation',
      paid_by_id: 'p-pedro',
      beneficiary_ids: ['p-1', 'p-2'],
      date: '2026-09-07',
      status: 'paid',
    };

    const row = expenseToInsert(expense);

    expect(row.id).toBe('exp-2');
    expect(row.amount).toBe(4310);
    expect(row.gift_card_id).toBeNull();
    expect(row.payment_method_id).toBeNull();
    expect(row.category).toBe('accommodation');
  });
});
