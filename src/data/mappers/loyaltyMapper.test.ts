import { describe, expect, it } from 'vitest';
import { loyaltyFromRow, loyaltyToInsert, type LoyaltyAccountRow } from './loyaltyMapper';
import type { LoyaltyAccount } from '../../types/database.types';

describe('loyaltyMapper', () => {
  const mockRow: LoyaltyAccountRow = {
    id: 'loy-1',
    trip_id: 'trip-1',
    program_name: 'LATAM Pass',
    holder_id: 'p-1',
    balance_points: '120000',
    cpm_usd: '14.50',
    cash_equivalent_usd: '1740.00',
    notes: 'Pontos acumulados no cartão',
  };

  it('converte LoyaltyAccountRow para LoyaltyAccount', () => {
    const acc = loyaltyFromRow(mockRow);
    expect(acc.id).toBe('loy-1');
    expect(acc.program_name).toBe('LATAM Pass');
    expect(acc.balance_points).toBe(120000);
    expect(acc.cpm_usd).toBe(14.5);
    expect(acc.cash_equivalent_usd).toBe(1740);
  });

  it('serializa LoyaltyAccount para LoyaltyAccountRow sem perda', () => {
    const acc: LoyaltyAccount = {
      id: 'loy-1',
      trip_id: 'trip-1',
      program_name: 'Smiles',
      holder_id: 'p-1',
      balance_points: 50000,
      cpm_usd: 12.0,
      cash_equivalent_usd: 600,
    };

    const row = loyaltyToInsert(acc);
    expect(row.id).toBe('loy-1');
    expect(row.notes).toBeNull();
  });
});
