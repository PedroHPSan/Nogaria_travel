import { describe, expect, it } from 'vitest';
import { giftCardFromRow, giftCardToInsert, type GiftCardRow } from './giftCardMapper';
import type { GiftCard } from '../../types/database.types';

describe('giftCardMapper', () => {
  const mockRow: GiftCardRow = {
    id: 'gc-1',
    trip_id: 'trip-1',
    store_brand: 'Apple',
    nominal_value: '500.00',
    paid_amount: '450.00',
    cashback_pct: '2.00',
    cashback_amount: '9.00',
    net_cost: '441.00',
    effective_savings: '59.00',
    effective_savings_pct: '11.80',
    currency: 'USD',
    purchased_by_id: 'p-1',
    beneficiary_id: 'p-2',
    card_code_masked: '•••• 1234',
    current_balance: '500.00',
    expiry_date: '2028-12-31',
    status: 'active',
    purchase_date: '2026-08-01',
    notes: 'Comprado no MyGiftCardSupply',
  };

  it('converte GiftCardRow com colunas calculadas', () => {
    const card = giftCardFromRow(mockRow);
    expect(card.id).toBe('gc-1');
    expect(card.nominal_value).toBe(500);
    expect(card.paid_amount).toBe(450);
    expect(card.cashback_amount).toBe(9);
    expect(card.net_cost).toBe(441);
    expect(card.effective_savings).toBe(59);
    expect(card.effective_savings_pct).toBe(11.8);
    expect(card.store_brand).toBe('Apple');
  });

  it('calcula colunas se vierem nulas da consulta', () => {
    const rowWithoutComputed: GiftCardRow = {
      id: 'gc-2',
      trip_id: 'trip-1',
      store_brand: 'Target',
      nominal_value: 100,
      paid_amount: 90,
      cashback_pct: 5,
      cashback_amount: null,
      net_cost: null,
      effective_savings: null,
      effective_savings_pct: null,
      currency: 'USD',
      purchased_by_id: 'p-1',
      beneficiary_id: null,
      card_code_masked: '•••• 9999',
      current_balance: 100,
      expiry_date: null,
      status: 'active',
      purchase_date: '2026-08-01',
      notes: null,
    };

    const card = giftCardFromRow(rowWithoutComputed);
    expect(card.cashback_amount).toBe(4.5);
    expect(card.net_cost).toBe(85.5);
    expect(card.effective_savings).toBe(14.5);
    expect(card.effective_savings_pct).toBe(14.5);
  });

  it('serializa para insert sem colunas calculadas do postgres', () => {
    const card: GiftCard = {
      id: 'gc-1',
      trip_id: 'trip-1',
      store_brand: 'Apple',
      nominal_value: 500,
      paid_amount: 450,
      cashback_pct: 2,
      cashback_amount: 9,
      net_cost: 441,
      effective_savings: 59,
      effective_savings_pct: 11.8,
      currency: 'USD',
      purchased_by_id: 'p-1',
      card_code_masked: '•••• 1234',
      current_balance: 500,
      status: 'active',
      purchase_date: '2026-08-01',
    };

    const insert = giftCardToInsert(card);
    expect(insert.id).toBe('gc-1');
    expect(insert.nominal_value).toBe(500);
    expect((insert as any).cashback_amount).toBeUndefined();
    expect((insert as any).net_cost).toBeUndefined();
  });
});
