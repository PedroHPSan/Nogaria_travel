export type PurchaseVerdict =
  | 'COMPRAR_EUA'
  | 'COMPRAR_BRASIL'
  | 'INDIFERENTE'
  | 'AGUARDAR_PRECO'
  | 'DADOS_INSUFICIENTES';

/** Uma linha nomeada do cálculo, com o parâmetro que a produziu. A moeda é a do container (UsCostBreakdown = USD, BrCostBreakdown = BRL). */
export interface CostLine {
  label: string;
  amount: number;
  parameter?: string;
}

export interface UsCostBreakdown {
  lines: CostLine[];
  bruto_usd: number;
  gift_card_covered_usd: number;
  liquido_usd: number;
  imposto_cota_usd: number;
  desembarcado_usd: number;
  desembarcado_brl: number;
}

export interface BrCostBreakdown {
  lines: CostLine[];
  br_liquido_brl: number;
}

export interface QuotaShare {
  quota_owner_id: string;
  total_pessoa_usd: number;
  quota_usd: number;
  excedente_usd: number;
  share_pct: number;
  imposto_do_item_usd: number;
}

export interface OwnerQuota {
  owner_id: string;
  total_usd: number;
  quota_usd: number;
  excedente_usd: number;
  folga_usd: number;
  imposto_total_usd: number;
}

export interface RebalanceHint {
  from_owner_id: string;
  to_owner_id: string;
  folga_usd: number;
}

export interface QuotaResult {
  byItem: Record<string, QuotaShare>;
  byOwner: Record<string, OwnerQuota>;
  rebalance: RebalanceHint[];
}

export interface Premise {
  label: string;
  value: string;
  source: string;
}

export interface DecisionAlert {
  code:
    | 'QUOTE_STALE'
    | 'WARRANTY_RISK'
    | 'LUGGAGE_NO_SPACE'
    | 'QUOTA_EXCEEDED'
    | 'GIFT_CARD_PARTIAL'
    | 'REBALANCE_AVAILABLE';
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export interface PurchaseDecision {
  purchase_item_id: string;
  verdict: PurchaseVerdict;
  economia_brl: number;
  economia_pct: number;
  us: UsCostBreakdown;
  br: BrCostBreakdown;
  quota: QuotaShare;
  alerts: DecisionAlert[];
  premises: Premise[];
  computed_at: string;
}
