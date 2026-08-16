import type { LoyaltyAccount } from '../../types/database.types';

export interface LoyaltyAccountRow {
  id: string;
  trip_id: string;
  program_name: string;
  holder_id: string;
  balance_points: number | string;
  cpm_usd: number | string;
  cash_equivalent_usd: number | string;
  notes: string | null;
  created_at?: string;
}

export function loyaltyFromRow(row: LoyaltyAccountRow): LoyaltyAccount {
  return {
    id: row.id,
    trip_id: row.trip_id,
    program_name: row.program_name,
    holder_id: row.holder_id,
    balance_points: Number(row.balance_points) || 0,
    cpm_usd: Number(row.cpm_usd) || 0,
    cash_equivalent_usd: Number(row.cash_equivalent_usd) || 0,
    notes: row.notes ?? undefined,
  };
}

export function loyaltyToInsert(acc: LoyaltyAccount): LoyaltyAccountRow {
  return {
    id: acc.id,
    trip_id: acc.trip_id,
    program_name: acc.program_name,
    holder_id: acc.holder_id,
    balance_points: acc.balance_points,
    cpm_usd: acc.cpm_usd,
    cash_equivalent_usd: acc.cash_equivalent_usd,
    notes: acc.notes ?? null,
  };
}
