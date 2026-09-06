import type {
  GiftCard,
  Luggage,
  Participant,
  PriceQuote,
  PurchaseAssumptions,
  PurchaseItem,
} from '../../types/database.types';
import type {
  BrCostBreakdown,
  CostLine,
  DecisionAlert,
  Premise,
  PurchaseDecision,
  QuotaShare,
  UsCostBreakdown,
} from '../../types/purchase.types';
import { fxMultiplier, round2 } from '../money';
import { salesTaxPct } from './purchaseAssumptions';
import { activeQuote, priceTrend, quoteAgeDays } from './priceQuotes';
import { allocateCustomsQuota, resolveQuotaOwner } from './customsQuota';
import type { QuotaItemInput } from './customsQuota';

const AGUARDAR_DROP_PCT = 8;
const AGUARDAR_WINDOW_DAYS = 45;
const STALE_QUOTE_DAYS = 30;

export interface DecisionInput {
  items: PurchaseItem[];
  quotes: PriceQuote[];
  participants: Participant[];
  giftCards: GiftCard[];
  assumptions: PurchaseAssumptions;
  today: string;
  /** Opcional: sem malas, o alerta de espaço simplesmente não é emitido. */
  luggages?: Luggage[];
}

interface UsNet {
  lines: CostLine[];
  bruto_usd: number;
  gift_card_covered_usd: number;
  liquido_usd: number;
  tax_pct: number;
}

const EMPTY_US_NET: UsNet = {
  lines: [],
  bruto_usd: 0,
  gift_card_covered_usd: 0,
  liquido_usd: 0,
  tax_pct: 0,
};

/**
 * Cadeia de custo do lado americano, até o líquido — antes da cota.
 *
 * `availableGiftCardBalance`, quando informado, substitui `giftCard.current_balance`
 * como teto de cobertura — usado por `decidePurchases` para ratear um mesmo gift card
 * entre vários itens (RN-04), decrementando o saldo restante a cada item processado.
 * Sem esse parâmetro, cai no saldo integral do cartão (uso avulso da função).
 */
export function computeUsNet(
  item: PurchaseItem,
  quote: PriceQuote,
  a: PurchaseAssumptions,
  giftCard?: GiftCard,
  availableGiftCardBalance?: number,
): UsNet {
  const lines: CostLine[] = [];

  const unit = Math.max(0, quote.price);
  const qty = Math.max(0, item.quantity);
  const base = round2(unit * qty);
  lines.push({
    label: `Preço ${quote.store_name} (x${qty})`,
    amount: base,
    parameter: `cotação de ${quote.observed_at}`,
  });

  const coupon = item.coupon_amount_usd
    ? round2(item.coupon_amount_usd)
    : round2((base * (item.coupon_pct ?? 0)) / 100);
  if (coupon > 0) {
    lines.push({ label: 'Cupom/desconto', amount: -coupon, parameter: 'cupom do item' });
  }

  const subtotal = round2(Math.max(0, base - coupon));

  const taxPct = quote.includes_tax ? 0 : salesTaxPct(a, item.us_store_state);
  const tax = round2((subtotal * taxPct) / 100);
  if (tax > 0) {
    lines.push({
      label: `Sales tax (${item.us_store_state ?? 'padrão'} ${taxPct}%)`,
      amount: tax,
      parameter: 'sales_tax_pct_by_state',
    });
  }

  const freight = item.purchase_channel === 'online_us' ? round2(item.freight_usd ?? 0) : 0;
  if (freight > 0) {
    lines.push({ label: 'Frete', amount: freight, parameter: 'freight_usd' });
  }

  const bruto = round2(subtotal + tax + freight);

  const balance = availableGiftCardBalance ?? giftCard?.current_balance ?? 0;
  const covered = round2(Math.min(bruto, Math.max(0, balance)));
  const gcBenefit = giftCard
    ? round2((covered * giftCard.effective_savings_pct) / 100)
    : 0;
  if (gcBenefit > 0 && giftCard) {
    lines.push({
      label: `Gift card ${giftCard.store_brand} (${giftCard.effective_savings_pct}% efetivo)`,
      amount: -gcBenefit,
      parameter: 'giftCardCalculator.effective_savings_pct',
    });
  }

  // Cashback não incide sobre a parcela paga com gift card (RN-02).
  const cashbackBase = round2(Math.max(0, bruto - covered));
  const cashback = round2((cashbackBase * (item.cashback_pct ?? 0)) / 100);
  if (cashback > 0) {
    lines.push({
      label: `Cashback (${item.cashback_pct}%)`,
      amount: -cashback,
      parameter: 'cashback_pct',
    });
  }

  return {
    lines,
    bruto_usd: bruto,
    gift_card_covered_usd: covered,
    liquido_usd: round2(bruto - gcBenefit - cashback),
    tax_pct: taxPct,
  };
}

/** Custo de referência no Brasil, líquido de cashback local. */
export function computeBr(item: PurchaseItem, quote: PriceQuote): BrCostBreakdown {
  const lines: CostLine[] = [];

  const qty = Math.max(0, item.quantity);
  const base = round2(Math.max(0, quote.price) * qty);
  lines.push({
    label: `Preço Brasil ${quote.store_name} (x${qty})`,
    amount: base,
    parameter: `cotação de ${quote.observed_at}`,
  });

  const cashback = round2((base * (item.br_cashback_pct ?? 0)) / 100);
  if (cashback > 0) {
    lines.push({ label: 'Cashback Brasil', amount: -cashback, parameter: 'br_cashback_pct' });
  }

  return { lines, br_liquido_brl: round2(base - cashback) };
}

function buildPremises(
  a: PurchaseAssumptions,
  item: PurchaseItem,
  hasUsQuote: boolean,
  taxPct: number,
): Premise[] {
  return [
    { label: 'Câmbio USD/BRL', value: a.usd_brl_rate.toFixed(2), source: `${a.rate_source} — ${a.rate_date}` },
    { label: 'IOF do cartão', value: `${a.card_iof_pct}%`, source: 'parâmetros da viagem' },
    { label: 'Spread do cartão', value: `${a.card_spread_pct}%`, source: 'parâmetros da viagem' },
    hasUsQuote
      ? {
          label: 'Sales tax aplicada',
          value: `${taxPct}%`,
          source: item.us_store_state ? `estado ${item.us_store_state}` : 'alíquota padrão',
        }
      : {
          label: 'Sales tax aplicada',
          value: 'não aplicável',
          source: 'sem cotação americana ativa',
        },
    {
      label: 'Cota por pessoa',
      value: `US$ ${a.customs_quota_usd_per_person}`,
      source: a.legal_reference ?? 'parâmetros da viagem',
    },
    {
      label: 'Imposto sobre excedente',
      value: `${a.customs_excess_tax_pct}%`,
      source: a.legal_reference ?? 'parâmetros da viagem',
    },
    {
      label: 'Margem de segurança',
      value: `${a.safety_margin_pct}%`,
      source: 'parâmetros da viagem',
    },
    {
      label: 'Incidência do IOF',
      value: 'sobre o líquido inteiro, inclusive a parcela do gift card',
      source: 'premissa conservadora — RN-03 do spec',
    },
  ];
}

export function decidePurchases(input: DecisionInput): PurchaseDecision[] {
  const { items, quotes, participants, giftCards, assumptions: a, today, luggages = [] } = input;

  const usNetByItem = new Map<string, UsNet>();
  const usQuoteByItem = new Map<string, PriceQuote>();
  // Ledger de saldo restante por gift card (RN-04): um mesmo cartão compartilhado
  // por vários itens não pode ser creditado integralmente em cada um deles.
  const giftCardRemainingBalance = new Map<string, number>(
    giftCards.map(g => [g.id, g.current_balance] as const),
  );

  for (const item of items) {
    // Item comprado e congelado contribui aos ledgers compartilhados (cota,
    // saldo de gift card) com as figuras já decididas no snapshot — nunca com
    // a cotação/gift card recalculados ao vivo (Finding 1 da revisão). Sem
    // isto, superar a cotação (ou o saldo de gift card) de um item já pago
    // desloca silenciosamente a cota/imposto de um irmão ainda planejado, já
    // que a cota é um pool por titular somado sobre `usNetByItem`.
    if (item.decision_snapshot && item.status === 'bought') {
      const frozenUs = item.decision_snapshot.us;
      usNetByItem.set(item.id, {
        lines: frozenUs.lines,
        bruto_usd: frozenUs.bruto_usd,
        gift_card_covered_usd: frozenUs.gift_card_covered_usd,
        liquido_usd: frozenUs.liquido_usd,
        tax_pct: 0, // não usado: itens congelados nunca chegam a buildPremises.
      });
      if (item.gift_card_id) {
        const giftCard = giftCards.find(g => g.id === item.gift_card_id);
        if (giftCard) {
          const availableBalance =
            giftCardRemainingBalance.get(giftCard.id) ?? giftCard.current_balance;
          giftCardRemainingBalance.set(
            giftCard.id,
            round2(availableBalance - frozenUs.gift_card_covered_usd),
          );
        }
      }
      continue;
    }

    const usQuote = activeQuote(quotes, item.id, 'US');
    if (!usQuote) continue;
    usQuoteByItem.set(item.id, usQuote);
    const giftCard = item.gift_card_id
      ? giftCards.find(g => g.id === item.gift_card_id)
      : undefined;
    const availableBalance = giftCard
      ? (giftCardRemainingBalance.get(giftCard.id) ?? giftCard.current_balance)
      : undefined;
    const usNet = computeUsNet(item, usQuote, a, giftCard, availableBalance);
    if (giftCard) {
      giftCardRemainingBalance.set(
        giftCard.id,
        round2((availableBalance ?? 0) - usNet.gift_card_covered_usd),
      );
    }
    usNetByItem.set(item.id, usNet);
  }

  const quotaItems: QuotaItemInput[] = items
    .filter(item => usNetByItem.has(item.id))
    .map(item => ({
      id: item.id,
      quota_owner_id: resolveQuotaOwner(item),
      liquido_usd: usNetByItem.get(item.id)!.liquido_usd,
    }));

  const quotaResult = allocateCustomsQuota(quotaItems, participants, a);
  const fx = fxMultiplier(a.usd_brl_rate, a.card_iof_pct, a.card_spread_pct);

  return items.map(item => {
    // Item comprado exibe o que foi decidido, não o recálculo de hoje (RN-18).
    if (item.decision_snapshot && item.status === 'bought') {
      return item.decision_snapshot;
    }

    const usQuote = usQuoteByItem.get(item.id);
    const brQuote = activeQuote(quotes, item.id, 'BR');
    const usNet = usNetByItem.get(item.id) ?? EMPTY_US_NET;
    const giftCard = item.gift_card_id
      ? giftCards.find(g => g.id === item.gift_card_id)
      : undefined;

    const quotaShare: QuotaShare = quotaResult.byItem[item.id] ?? {
      quota_owner_id: resolveQuotaOwner(item),
      total_pessoa_usd: 0,
      quota_usd: a.customs_quota_usd_per_person,
      excedente_usd: 0,
      share_pct: 0,
      imposto_do_item_usd: 0,
    };

    const impostoCota = quotaShare.imposto_do_item_usd;
    const desembarcadoUsd = round2(usNet.liquido_usd + impostoCota);
    const desembarcadoBrl = round2(desembarcadoUsd * fx);

    const usLines = [...usNet.lines];
    if (impostoCota > 0) {
      usLines.push({
        label: `Imposto de cota (${a.customs_excess_tax_pct}% sobre o excedente)`,
        amount: impostoCota,
        parameter: 'customs_excess_tax_pct',
      });
    }

    const us: UsCostBreakdown = {
      lines: usLines,
      bruto_usd: usNet.bruto_usd,
      gift_card_covered_usd: usNet.gift_card_covered_usd,
      liquido_usd: usNet.liquido_usd,
      imposto_cota_usd: impostoCota,
      desembarcado_usd: desembarcadoUsd,
      desembarcado_brl: desembarcadoBrl,
    };

    const br: BrCostBreakdown = brQuote
      ? computeBr(item, brQuote)
      : { lines: [], br_liquido_brl: 0 };

    const temAmbas = Boolean(usQuote && brQuote) && br.br_liquido_brl > 0;
    const economiaBrl = temAmbas ? round2(br.br_liquido_brl - desembarcadoBrl) : 0;
    const economiaPct = temAmbas ? round2((economiaBrl / br.br_liquido_brl) * 100) : 0;

    const alerts: DecisionAlert[] = [];

    if (usQuote && quoteAgeDays(usQuote.observed_at, today) > STALE_QUOTE_DAYS) {
      alerts.push({
        code: 'QUOTE_STALE',
        severity: 'warning',
        message: `Cotação americana de ${usQuote.observed_at}, com mais de ${STALE_QUOTE_DAYS} dias.`,
      });
    }
    if (brQuote && quoteAgeDays(brQuote.observed_at, today) > STALE_QUOTE_DAYS) {
      alerts.push({
        code: 'QUOTE_STALE',
        severity: 'warning',
        message: `Cotação brasileira de ${brQuote.observed_at}, com mais de ${STALE_QUOTE_DAYS} dias.`,
      });
    }
    if (item.warranty_risk === 'high') {
      alerts.push({
        code: 'WARRANTY_RISK',
        severity: 'warning',
        message: 'Risco de garantia alto: o produto pode não ter cobertura no Brasil.',
      });
    }
    if (quotaShare.excedente_usd > 0) {
      const owner = participants.find(p => p.id === quotaShare.quota_owner_id);
      const ownerLabel = owner?.nickname ?? owner?.full_name ?? quotaShare.quota_owner_id;
      alerts.push({
        code: 'QUOTA_EXCEEDED',
        severity: 'critical',
        message: `A cota de ${ownerLabel} está US$ ${quotaShare.excedente_usd.toFixed(2)} acima do limite.`,
      });
    }
    if (giftCard && usNet.gift_card_covered_usd > 0 && usNet.gift_card_covered_usd < usNet.bruto_usd) {
      alerts.push({
        code: 'GIFT_CARD_PARTIAL',
        severity: 'info',
        message: `O gift card cobre US$ ${usNet.gift_card_covered_usd.toFixed(2)} de US$ ${usNet.bruto_usd.toFixed(2)}.`,
      });
    }
    if ((item.expected_weight_kg ?? 0) > 0) {
      const temEspaco = luggages.some(
        l =>
          l.participant_id === quotaShare.quota_owner_id &&
          (l.shopping_space_reserved_pct ?? 0) > 0,
      );
      if (!temEspaco) {
        alerts.push({
          code: 'LUGGAGE_NO_SPACE',
          severity: 'warning',
          message: `Nenhuma mala do responsável tem espaço reservado para compras, e o item pesa ~${item.expected_weight_kg} kg.`,
        });
      }
    }
    for (const hint of quotaResult.rebalance) {
      if (hint.from_owner_id !== quotaShare.quota_owner_id) continue;
      const toOwner = participants.find(p => p.id === hint.to_owner_id);
      const toOwnerLabel = toOwner?.nickname ?? toOwner?.full_name ?? hint.to_owner_id;
      alerts.push({
        code: 'REBALANCE_AVAILABLE',
        severity: 'info',
        message: `${toOwnerLabel} tem US$ ${hint.folga_usd.toFixed(2)} de cota livre.`,
      });
    }

    const trend = priceTrend(quotes, item.id, 'US', today, AGUARDAR_WINDOW_DAYS);
    const m = a.safety_margin_pct;

    // Precedência do veredito, conforme a seção 3.4 do spec.
    let verdict: PurchaseDecision['verdict'];
    if (item.verdict_override) {
      verdict = item.verdict_override;
    } else if (!temAmbas) {
      verdict = 'DADOS_INSUFICIENTES';
    } else if (trend.dropPct > AGUARDAR_DROP_PCT && item.priority !== 'high') {
      verdict = 'AGUARDAR_PRECO';
    } else if (economiaPct > m) {
      verdict = 'COMPRAR_EUA';
    } else if (economiaPct < -m) {
      verdict = 'COMPRAR_BRASIL';
    } else {
      verdict = 'INDIFERENTE';
    }

    return {
      purchase_item_id: item.id,
      verdict,
      economia_brl: economiaBrl,
      economia_pct: economiaPct,
      us,
      br,
      quota: quotaShare,
      alerts,
      premises: buildPremises(a, item, Boolean(usQuote), usNet.tax_pct),
      computed_at: today,
    };
  });
}
