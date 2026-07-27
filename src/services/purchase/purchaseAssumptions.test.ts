import { describe, expect, it } from 'vitest';
import {
  makeDefaultAssumptions,
  salesTaxPct,
  validateAssumptions,
} from './purchaseAssumptions';

const base = makeDefaultAssumptions('trip-1', '2026-07-26', 5.62);

describe('makeDefaultAssumptions', () => {
  it('aplica os defaults acordados no spec', () => {
    expect(base.usd_brl_rate).toBe(5.62);
    expect(base.default_sales_tax_pct).toBe(7);
    expect(base.card_iof_pct).toBe(3.38);
    expect(base.card_spread_pct).toBe(0);
    expect(base.customs_quota_usd_per_person).toBe(1000);
    expect(base.customs_excess_tax_pct).toBe(50);
    expect(base.safety_margin_pct).toBe(5);
  });

  it('usa a taxa recebida por parâmetro, não um valor fixo no código', () => {
    expect(makeDefaultAssumptions('trip-1', '2026-07-26', 6.0).usd_brl_rate).toBe(6.0);
  });

  it('declara a referência legal, para que a premissa nunca fique implícita', () => {
    expect(base.legal_reference).toBeTruthy();
  });
});

describe('salesTaxPct', () => {
  it('usa a alíquota do estado quando conhecida', () => {
    expect(salesTaxPct(base, 'FL')).toBe(7);
  });

  it('devolve zero em estado sem sales tax', () => {
    expect(salesTaxPct(base, 'DE')).toBe(0);
    expect(salesTaxPct(base, 'OR')).toBe(0);
  });

  it('cai no default quando o estado é desconhecido ou ausente', () => {
    expect(salesTaxPct(base, 'ZZ')).toBe(7);
    expect(salesTaxPct(base)).toBe(7);
  });
});

describe('validateAssumptions', () => {
  it('aceita os defaults', () => {
    expect(validateAssumptions(base)).toEqual([]);
  });

  it('rejeita câmbio zero ou negativo', () => {
    expect(validateAssumptions({ ...base, usd_brl_rate: 0 })).toHaveLength(1);
    expect(validateAssumptions({ ...base, usd_brl_rate: -1 })).toHaveLength(1);
  });

  it('rejeita percentual fora de 0 a 100', () => {
    expect(validateAssumptions({ ...base, card_iof_pct: 101 })).toHaveLength(1);
    expect(validateAssumptions({ ...base, safety_margin_pct: -1 })).toHaveLength(1);
  });

  it('rejeita cota negativa', () => {
    expect(validateAssumptions({ ...base, customs_quota_usd_per_person: -5 })).toHaveLength(1);
  });

  it('acumula múltiplos erros', () => {
    expect(
      validateAssumptions({ ...base, usd_brl_rate: 0, card_iof_pct: 200 }),
    ).toHaveLength(2);
  });
});
