import { describe, expect, it } from 'vitest';
import { decisionFromRow, decisionToInsert, type DecisionRow } from './decisionMapper';
import type { Decision } from '../../types/database.types';

describe('decisionMapper', () => {
  const mockRow: DecisionRow = {
    id: 'dec-1',
    trip_id: 'trip-1',
    topic: 'Aluguel de Carro vs Uber',
    alternatives_considered: ['Aluguel SUV', 'Uber diário'],
    chosen_decision: 'Aluguel SUV na Alamo',
    reason: 'Mais conforto com bagagens e compras',
    decided_by_id: 'p-1',
    date: '2026-07-20',
    financial_impact_usd: '650.00',
    is_active: true,
  };

  it('converte DecisionRow para Decision', () => {
    const dec = decisionFromRow(mockRow);
    expect(dec.id).toBe('dec-1');
    expect(dec.topic).toBe('Aluguel de Carro vs Uber');
    expect(dec.financial_impact_usd).toBe(650);
    expect(dec.alternatives_considered).toEqual(['Aluguel SUV', 'Uber diário']);
  });

  it('serializa Decision para DecisionRow sem perda', () => {
    const dec: Decision = {
      id: 'dec-1',
      trip_id: 'trip-1',
      topic: 'Hotel Universal',
      alternatives_considered: ['Endless Summer', 'Cabana Bay'],
      chosen_decision: 'Endless Summer',
      reason: 'Mais barato',
      decided_by_id: 'p-1',
      date: '2026-07-20',
      is_active: true,
    };

    const row = decisionToInsert(dec);
    expect(row.id).toBe('dec-1');
    expect(row.financial_impact_usd).toBeNull();
  });
});
