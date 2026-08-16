import type { Decision } from '../../types/database.types';

export interface DecisionRow {
  id: string;
  trip_id: string;
  topic: string;
  alternatives_considered: string[];
  chosen_decision: string;
  reason: string;
  decided_by_id: string | null;
  date: string;
  financial_impact_usd: number | string | null;
  is_active: boolean;
  created_at?: string;
}

export function decisionFromRow(row: DecisionRow): Decision {
  return {
    id: row.id,
    trip_id: row.trip_id,
    topic: row.topic,
    alternatives_considered: Array.isArray(row.alternatives_considered) ? row.alternatives_considered : [],
    chosen_decision: row.chosen_decision,
    reason: row.reason,
    decided_by_id: row.decided_by_id ?? '',
    date: row.date,
    financial_impact_usd: row.financial_impact_usd !== null && row.financial_impact_usd !== undefined ? Number(row.financial_impact_usd) : undefined,
    is_active: Boolean(row.is_active),
  };
}

export function decisionToInsert(d: Decision): DecisionRow {
  return {
    id: d.id,
    trip_id: d.trip_id,
    topic: d.topic,
    alternatives_considered: d.alternatives_considered,
    chosen_decision: d.chosen_decision,
    reason: d.reason,
    decided_by_id: d.decided_by_id || null,
    date: d.date,
    financial_impact_usd: d.financial_impact_usd ?? null,
    is_active: d.is_active,
  };
}
