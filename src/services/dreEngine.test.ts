import { describe, it, expect } from 'vitest';
import { computeDre } from './dreEngine';
import type { Expense, Participant } from '../types/database.types';

describe('dreEngine', () => {
  const mockParticipants: Participant[] = [
    {
      id: 'p-pedro',
      trip_id: 'trip-1',
      full_name: 'Pedro Henrique',
      nickname: 'Pedro',
      birth_date: '1990-01-01',
      age: 36,
      is_minor: false,
      relationship: 'Organizador',
      budget_limit_usd: 3000,
      avatar_color: 'bg-blue-600',
    },
    {
      id: 'p-barbara',
      trip_id: 'trip-1',
      full_name: 'Bárbara Nogueira',
      nickname: 'Bárbara',
      birth_date: '1992-05-10',
      age: 34,
      is_minor: false,
      relationship: 'Esposa',
      budget_limit_usd: 2500,
      avatar_color: 'bg-pink-600',
    }
  ];

  const mockExpenses: Expense[] = [
    {
      id: 'exp-1',
      trip_id: 'trip-1',
      description: 'Passagens Aéreas',
      amount: 5000,
      currency: 'BRL',
      amount_usd: 1000,
      amount_brl: 5000,
      exchange_rate: 5,
      category: 'flight',
      paid_by_id: 'p-pedro',
      beneficiary_ids: ['p-pedro', 'p-barbara'],
      date: '2026-09-04',
      status: 'paid'
    },
    {
      id: 'exp-2',
      trip_id: 'trip-1',
      description: 'Hotel Disney',
      amount: 4000,
      currency: 'BRL',
      amount_usd: 800,
      amount_brl: 4000,
      exchange_rate: 5,
      category: 'accommodation',
      paid_by_id: 'p-pedro',
      beneficiary_ids: ['p-pedro', 'p-barbara'],
      date: '2026-09-06',
      status: 'paid'
    }
  ];

  it('computes DRE totals correctly', () => {
    const result = computeDre({
      expenses: mockExpenses,
      participants: mockParticipants,
      exchangeRate: 5,
      currency: 'BRL',
      customGoals: {
        flight: 1200,
        accommodation: 1000,
      }
    });

    expect(result.total_actual_brl).toBe(9000);
    expect(result.total_planned_usd).toBeGreaterThanOrEqual(1800);
    expect(result.categories.find(c => c.category === 'flight')?.actual_brl).toBe(5000);
    expect(result.categories.find(c => c.category === 'accommodation')?.actual_brl).toBe(4000);
  });

  it('computes participant settlement balance', () => {
    const result = computeDre({
      expenses: mockExpenses,
      participants: mockParticipants,
      exchangeRate: 5,
      currency: 'BRL'
    });

    const pedro = result.participants.find(p => p.participant_id === 'p-pedro');
    const barbara = result.participants.find(p => p.participant_id === 'p-barbara');

    expect(pedro?.total_paid_brl).toBe(9000);
    expect(pedro?.total_consumed_brl).toBe(4500);
    expect(pedro?.net_balance_brl).toBe(4500);
    expect(pedro?.status).toBe('creditor');

    expect(barbara?.total_paid_brl).toBe(0);
    expect(barbara?.total_consumed_brl).toBe(4500);
    expect(barbara?.net_balance_brl).toBe(-4500);
    expect(barbara?.status).toBe('debtor');

    // Settlement generated
    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0].from_name).toBe('Bárbara');
    expect(result.settlements[0].to_name).toBe('Pedro');
    expect(result.settlements[0].amount_brl).toBe(4500);
  });
});
