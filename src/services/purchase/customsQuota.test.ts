import { describe, expect, it } from 'vitest';
import type { Participant, PurchaseItem } from '../../types/database.types';
import { makeDefaultAssumptions } from './purchaseAssumptions';
import { allocateCustomsQuota, resolveQuotaOwner } from './customsQuota';
import type { QuotaItemInput } from './customsQuota';

const a = makeDefaultAssumptions('trip-1', '2026-07-26', 5.62);

function participant(id: string, overrides: Partial<Participant> = {}): Participant {
  return {
    id,
    trip_id: 'trip-1',
    full_name: id,
    birth_date: '1990-01-01',
    age: 36,
    is_minor: false,
    relationship: 'adulto',
    budget_limit_usd: 2000,
    avatar_color: 'blue',
    ...overrides,
  };
}

function item(id: string, owner: string, liquido: number): QuotaItemInput {
  return { id, quota_owner_id: owner, liquido_usd: liquido };
}

describe('resolveQuotaOwner', () => {
  const base = {
    id: 'i1',
    trip_id: 'trip-1',
    product_name: 'x',
    category: 'electronics',
    target_participant_id: 'p-target',
    priority: 'medium',
    quantity: 1,
    target_price_usd: 100,
    gift_card_eligible: false,
    status: 'planned',
  } as PurchaseItem;

  it('prefere quota_owner_id explícito', () => {
    expect(resolveQuotaOwner({ ...base, quota_owner_id: 'p-x', beneficiary_id: 'p-y' })).toBe('p-x');
  });

  it('cai no beneficiário quando não há owner explícito', () => {
    expect(resolveQuotaOwner({ ...base, beneficiary_id: 'p-y' })).toBe('p-y');
  });

  it('cai no responsável quando não há beneficiário', () => {
    expect(resolveQuotaOwner(base)).toBe('p-target');
  });
});

describe('allocateCustomsQuota', () => {
  it('não cobra imposto quando ninguém estoura', () => {
    const result = allocateCustomsQuota(
      [item('i1', 'p1', 400), item('i2', 'p1', 300)],
      [participant('p1')],
      a,
    );

    expect(result.byOwner.p1.excedente_usd).toBe(0);
    expect(result.byOwner.p1.folga_usd).toBe(300);
    expect(result.byItem.i1.imposto_do_item_usd).toBe(0);
    expect(result.byItem.i2.imposto_do_item_usd).toBe(0);
  });

  it('rateia o excedente e a soma bate exatamente com o total (RN-07b)', () => {
    const result = allocateCustomsQuota(
      [item('i1', 'p1', 1393.85), item('i2', 'p1', 820.73), item('i3', 'p1', 185.42)],
      [participant('p1')],
      a,
    );

    const impostoTotal = result.byOwner.p1.imposto_total_usd;
    const somaItens =
      result.byItem.i1.imposto_do_item_usd +
      result.byItem.i2.imposto_do_item_usd +
      result.byItem.i3.imposto_do_item_usd;

    expect(Math.round(somaItens * 100) / 100).toBe(impostoTotal);
  });

  it('cobra 50% do excedente — US$ 2.400 contra cota de US$ 1.000 dá US$ 700 (CA-05)', () => {
    const result = allocateCustomsQuota(
      [item('i1', 'p1', 1500), item('i2', 'p1', 900)],
      [participant('p1')],
      a,
    );

    expect(result.byOwner.p1.excedente_usd).toBe(1400);
    expect(result.byOwner.p1.imposto_total_usd).toBe(700);
    expect(
      Math.round(
        (result.byItem.i1.imposto_do_item_usd + result.byItem.i2.imposto_do_item_usd) * 100,
      ) / 100,
    ).toBe(700);
  });

  it('trata bem único acima da cota como indivisível (RN-06)', () => {
    const result = allocateCustomsQuota(
      [item('i1', 'p1', 1500)],
      [participant('p1'), participant('p2')],
      a,
    );

    expect(result.byOwner.p1.excedente_usd).toBe(500);
    expect(result.byItem.i1.imposto_do_item_usd).toBe(250);
    expect(result.byItem.i1.share_pct).toBeCloseTo(100, 5);
  });

  it('zera cota de participante marcado como não elegível (RN-09)', () => {
    const result = allocateCustomsQuota(
      [item('i1', 'p1', 300)],
      [participant('p1', { quota_eligible: false })],
      a,
    );

    expect(result.byOwner.p1.quota_usd).toBe(0);
    expect(result.byOwner.p1.excedente_usd).toBe(300);
    expect(result.byItem.i1.imposto_do_item_usd).toBe(150);
  });

  it('trata menor como titular de cota por default (RN-09)', () => {
    const result = allocateCustomsQuota(
      [item('i1', 'p-gabi', 300)],
      [participant('p-gabi', { age: 4, is_minor: true })],
      a,
    );

    expect(result.byOwner['p-gabi'].quota_usd).toBe(1000);
    expect(result.byItem.i1.imposto_do_item_usd).toBe(0);
  });

  it('ignora participante sem itens', () => {
    const result = allocateCustomsQuota([item('i1', 'p1', 300)], [participant('p1'), participant('p2')], a);
    expect(result.byOwner.p2).toBeUndefined();
  });

  it('sugere rebalanceamento de quem estourou para quem tem folga (RN-11)', () => {
    const result = allocateCustomsQuota(
      [item('i1', 'p1', 1800), item('i2', 'p2', 200)],
      [participant('p1'), participant('p2')],
      a,
    );

    expect(result.rebalance).toEqual([{ from_owner_id: 'p1', to_owner_id: 'p2', folga_usd: 800 }]);
  });

  it('não sugere rebalanceamento quando ninguém tem folga', () => {
    const result = allocateCustomsQuota(
      [item('i1', 'p1', 1800), item('i2', 'p2', 1200)],
      [participant('p1'), participant('p2')],
      a,
    );

    expect(result.rebalance).toEqual([]);
  });

  it('não divide por zero quando o total da pessoa é zero (RN-07a)', () => {
    const result = allocateCustomsQuota([item('i1', 'p1', 0)], [participant('p1')], a);

    expect(result.byItem.i1.share_pct).toBe(0);
    expect(result.byItem.i1.imposto_do_item_usd).toBe(0);
  });

  it('devolve resultado vazio para lista vazia', () => {
    const result = allocateCustomsQuota([], [participant('p1')], a);
    expect(result.byItem).toEqual({});
    expect(result.byOwner).toEqual({});
    expect(result.rebalance).toEqual([]);
  });
});
