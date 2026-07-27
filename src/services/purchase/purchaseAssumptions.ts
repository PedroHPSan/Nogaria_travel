import type { PurchaseAssumptions } from '../../types/database.types';

/**
 * Alíquotas de sales tax por estado. Valores de partida, editáveis pelo
 * usuário — nenhum número legal fica preso ao código (RN-10).
 */
const DEFAULT_SALES_TAX_BY_STATE: Record<string, number> = {
  FL: 7,
  NY: 8.875,
  CA: 9.5,
  TX: 8.25,
  DE: 0,
  NH: 0,
  OR: 0,
  MT: 0,
};

export function makeDefaultAssumptions(
  tripId: string,
  today: string,
  usdBrlRate: number,
): PurchaseAssumptions {
  return {
    trip_id: tripId,
    usd_brl_rate: usdBrlRate,
    rate_source: 'manual',
    rate_date: today,
    default_sales_tax_pct: 7,
    sales_tax_pct_by_state: { ...DEFAULT_SALES_TAX_BY_STATE },
    card_iof_pct: 3.38,
    card_spread_pct: 0,
    customs_quota_usd_per_person: 1000,
    customs_excess_tax_pct: 50,
    safety_margin_pct: 5,
    legal_reference:
      'Cota de isenção US$ 1.000 (chegada aérea) e 50% de imposto sobre o excedente. Confirmar a norma vigente antes da viagem.',
    updated_at: today,
  };
}

export function salesTaxPct(a: PurchaseAssumptions, state?: string): number {
  if (state && a.sales_tax_pct_by_state && state in a.sales_tax_pct_by_state) {
    return a.sales_tax_pct_by_state[state];
  }
  return a.default_sales_tax_pct;
}

export function validateAssumptions(a: PurchaseAssumptions): string[] {
  const errors: string[] = [];

  if (!(a.usd_brl_rate > 0)) {
    errors.push('Câmbio deve ser maior que zero.');
  }

  const percentages: Array<[string, number]> = [
    ['IOF', a.card_iof_pct],
    ['Spread do cartão', a.card_spread_pct],
    ['Alíquota padrão de sales tax', a.default_sales_tax_pct],
    ['Imposto sobre excedente', a.customs_excess_tax_pct],
    ['Margem de segurança', a.safety_margin_pct],
  ];

  for (const [label, value] of percentages) {
    if (value < 0 || value > 100) {
      errors.push(`${label} deve estar entre 0 e 100.`);
    }
  }

  if (a.customs_quota_usd_per_person < 0) {
    errors.push('Cota por pessoa não pode ser negativa.');
  }

  return errors;
}
