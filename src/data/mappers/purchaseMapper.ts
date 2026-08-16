import type { PurchaseItem } from '../../types/database.types';

export interface PurchaseItemRow {
  id: string;
  trip_id: string;
  product_name: string;
  category: PurchaseItem['category'];
  brand: string | null;
  store_name: string | null;
  target_participant_id: string;
  beneficiary_id: string | null;
  priority: PurchaseItem['priority'];
  quantity: number;
  target_price_usd: number | string;
  price_found_usd: number | string | null;
  brl_equivalent_price: number | string | null;
  estimated_savings_pct: number | string | null;
  gift_card_eligible: boolean;
  status: PurchaseItem['status'];
  delivery_location: string | null;
  link_url: string | null;
  notes: string | null;
  created_at?: string;
}

export function purchaseItemFromRow(row: PurchaseItemRow): PurchaseItem {
  return {
    id: row.id,
    trip_id: row.trip_id,
    product_name: row.product_name,
    category: row.category,
    brand: row.brand ?? undefined,
    store_name: row.store_name ?? undefined,
    target_participant_id: row.target_participant_id,
    beneficiary_id: row.beneficiary_id ?? undefined,
    priority: row.priority,
    quantity: row.quantity,
    target_price_usd: Number(row.target_price_usd) || 0,
    price_found_usd: row.price_found_usd !== null && row.price_found_usd !== undefined ? Number(row.price_found_usd) : undefined,
    brl_equivalent_price: row.brl_equivalent_price !== null && row.brl_equivalent_price !== undefined ? Number(row.brl_equivalent_price) : undefined,
    estimated_savings_pct: row.estimated_savings_pct !== null && row.estimated_savings_pct !== undefined ? Number(row.estimated_savings_pct) : undefined,
    gift_card_eligible: Boolean(row.gift_card_eligible),
    status: row.status,
    delivery_location: row.delivery_location ?? undefined,
    link_url: row.link_url ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function purchaseItemToInsert(item: PurchaseItem): PurchaseItemRow {
  return {
    id: item.id,
    trip_id: item.trip_id,
    product_name: item.product_name,
    category: item.category,
    brand: item.brand ?? null,
    store_name: item.store_name ?? null,
    target_participant_id: item.target_participant_id,
    beneficiary_id: item.beneficiary_id ?? null,
    priority: item.priority,
    quantity: item.quantity,
    target_price_usd: item.target_price_usd,
    price_found_usd: item.price_found_usd ?? null,
    brl_equivalent_price: item.brl_equivalent_price ?? null,
    estimated_savings_pct: item.estimated_savings_pct ?? null,
    gift_card_eligible: item.gift_card_eligible,
    status: item.status,
    delivery_location: item.delivery_location ?? null,
    link_url: item.link_url ?? null,
    notes: item.notes ?? null,
  };
}
