import { describe, expect, it } from 'vitest';
import { purchaseItemFromRow, purchaseItemToInsert, type PurchaseItemRow } from './purchaseMapper';
import type { PurchaseItem } from '../../types/database.types';

describe('purchaseMapper', () => {
  const mockRow: PurchaseItemRow = {
    id: 'item-123',
    trip_id: 'trip-456',
    product_name: 'iPhone 16 Pro',
    category: 'electronics',
    brand: 'Apple',
    store_name: 'Apple Store Millenia',
    target_participant_id: 'part-1',
    beneficiary_id: 'part-2',
    priority: 'high',
    quantity: 1,
    target_price_usd: '999.00',
    price_found_usd: '999.00',
    brl_equivalent_price: '8999.00',
    estimated_savings_pct: '35.5',
    gift_card_eligible: true,
    status: 'planned',
    delivery_location: 'Hotel',
    link_url: 'https://apple.com',
    notes: 'Comprar no primeiro dia',
  };

  it('converte PurchaseItemRow para PurchaseItem corretamente', () => {
    const item = purchaseItemFromRow(mockRow);
    expect(item.id).toBe('item-123');
    expect(item.product_name).toBe('iPhone 16 Pro');
    expect(item.target_price_usd).toBe(999);
    expect(item.price_found_usd).toBe(999);
    expect(item.brl_equivalent_price).toBe(8999);
    expect(item.estimated_savings_pct).toBe(35.5);
    expect(item.gift_card_eligible).toBe(true);
    expect(item.brand).toBe('Apple');
  });

  it('lida com campos opcionais nulos', () => {
    const rowWithNulls: PurchaseItemRow = {
      id: 'item-2',
      trip_id: 'trip-1',
      product_name: 'Camiseta',
      category: 'clothing',
      brand: null,
      store_name: null,
      target_participant_id: 'part-1',
      beneficiary_id: null,
      priority: 'low',
      quantity: 2,
      target_price_usd: 25,
      price_found_usd: null,
      brl_equivalent_price: null,
      estimated_savings_pct: null,
      gift_card_eligible: false,
      status: 'planned',
      delivery_location: null,
      link_url: null,
      notes: null,
    };

    const item = purchaseItemFromRow(rowWithNulls);
    expect(item.brand).toBeUndefined();
    expect(item.store_name).toBeUndefined();
    expect(item.beneficiary_id).toBeUndefined();
    expect(item.price_found_usd).toBeUndefined();
    expect(item.brl_equivalent_price).toBeUndefined();
  });

  it('serializa PurchaseItem para PurchaseItemRow sem perda', () => {
    const item: PurchaseItem = {
      id: 'item-123',
      trip_id: 'trip-456',
      product_name: 'iPhone 16 Pro',
      category: 'electronics',
      brand: 'Apple',
      store_name: 'Apple Store',
      target_participant_id: 'part-1',
      priority: 'high',
      quantity: 1,
      target_price_usd: 999,
      gift_card_eligible: true,
      status: 'planned',
    };

    const row = purchaseItemToInsert(item);
    expect(row.id).toBe('item-123');
    expect(row.product_name).toBe('iPhone 16 Pro');
    expect(row.target_price_usd).toBe(999);
    expect(row.brand).toBe('Apple');
    expect(row.beneficiary_id).toBeNull();
    expect(row.price_found_usd).toBeNull();
  });
});
