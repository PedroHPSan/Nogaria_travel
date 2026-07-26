import { describe, expect, it } from 'vitest';
import type { GiftCard, Participant, PriceQuote, PurchaseItem } from '../../types/database.types';
import { makeDefaultAssumptions } from './purchaseAssumptions';
import { decidePurchases } from './purchaseDecisionEngine';
import type { DecisionInput } from './purchaseDecisionEngine';

const TODAY = '2026-07-26';
const assumptions = makeDefaultAssumptions('trip-1', TODAY);

const pedro: Participant = {
  id: 'p-pedro',
  trip_id: 'trip-1',
  full_name: 'Pedro Palheta',
  nickname: 'Pedro',
  birth_date: '1992-03-05',
  age: 34,
  is_minor: false,
  relationship: 'organizador',
  budget_limit_usd: 2000,
  avatar_color: 'blue',
};

const appleGiftCard: GiftCard = {
  id: 'gc-apple-01',
  trip_id: 'trip-1',
  store_brand: 'Apple Store',
  nominal_value: 300,
  paid_amount: 255,
  cashback_pct: 4,
  cashback_amount: 10.2,
  net_cost: 244.8,
  effective_savings: 55.2,
  effective_savings_pct: 18.4,
  currency: 'USD',
  purchased_by_id: 'p-pedro',
  card_code_masked: '•••• 4410',
  current_balance: 300,
  status: 'active',
  purchase_date: '2026-07-01',
};

function purchase(overrides: Partial<PurchaseItem>): PurchaseItem {
  return {
    id: 'pur-iphone',
    trip_id: 'trip-1',
    product_name: 'iPhone Pro Max 512GB',
    category: 'electronics',
    target_participant_id: 'p-pedro',
    beneficiary_id: 'p-pedro',
    priority: 'high',
    quantity: 1,
    target_price_usd: 1399,
    gift_card_eligible: true,
    status: 'planned',
    us_store_state: 'FL',
    cashback_pct: 4,
    ...overrides,
  };
}

function quote(overrides: Partial<PriceQuote>): PriceQuote {
  return {
    id: 'q-us',
    trip_id: 'trip-1',
    purchase_item_id: 'pur-iphone',
    market: 'US',
    store_name: 'Apple Store Millenia',
    price: 1399,
    currency: 'USD',
    price_kind: 'list',
    includes_tax: false,
    observed_at: TODAY,
    source: 'manual',
    is_active: true,
    created_at: `${TODAY}T10:00:00Z`,
    ...overrides,
  };
}

/** Cesta do Pedro: iPhone com gift card Apple + Apple Watch Ultra. */
function cestaDoPedro(): DecisionInput {
  return {
    items: [
      purchase({ gift_card_id: 'gc-apple-01' }),
      purchase({
        id: 'pur-watch',
        product_name: 'Apple Watch Ultra',
        priority: 'medium',
        target_price_usd: 799,
        gift_card_id: undefined,
      }),
    ],
    quotes: [
      quote({}),
      quote({ id: 'q-br', market: 'BR', price: 11499, currency: 'BRL', includes_tax: true }),
      quote({ id: 'q-us-watch', purchase_item_id: 'pur-watch', price: 799 }),
      quote({
        id: 'q-br-watch',
        purchase_item_id: 'pur-watch',
        market: 'BR',
        price: 6800,
        currency: 'BRL',
        includes_tax: true,
      }),
    ],
    participants: [pedro],
    giftCards: [appleGiftCard],
    assumptions,
    today: TODAY,
  };
}

function find(decisions: ReturnType<typeof decidePurchases>, id: string) {
  const d = decisions.find(x => x.purchase_item_id === id);
  if (!d) throw new Error(`decisão não encontrada: ${id}`);
  return d;
}

describe('decidePurchases — regressão CA-02 com os dados do seed', () => {
  const decisions = decidePurchases(cestaDoPedro());
  const iphone = find(decisions, 'pur-iphone');

  it('calcula o líquido do iPhone em US$ 1.393,85', () => {
    expect(iphone.us.bruto_usd).toBe(1496.93);
    expect(iphone.us.liquido_usd).toBe(1393.85);
  });

  it('rateia US$ 382,23 de imposto de cota ao iPhone', () => {
    expect(iphone.quota.total_pessoa_usd).toBe(2214.58);
    expect(iphone.quota.excedente_usd).toBe(1214.58);
    expect(iphone.us.imposto_cota_usd).toBe(382.23);
  });

  it('chega a R$ 10.318,95 desembarcados e R$ 1.180,05 de economia', () => {
    expect(iphone.us.desembarcado_usd).toBe(1776.08);
    expect(iphone.us.desembarcado_brl).toBe(10318.95);
    expect(iphone.br.br_liquido_brl).toBe(11499);
    expect(iphone.economia_brl).toBe(1180.05);
    expect(iphone.economia_pct).toBe(10.26);
  });

  it('recomenda comprar nos EUA', () => {
    expect(iphone.verdict).toBe('COMPRAR_EUA');
  });
});

describe('decidePurchases — CA-03, sem excedente de cota', () => {
  it('sobe a economia para R$ 3.400,79 quando a cota comporta a cesta', () => {
    const input = cestaDoPedro();
    input.assumptions = { ...assumptions, customs_quota_usd_per_person: 100000 };

    const iphone = find(decidePurchases(input), 'pur-iphone');

    expect(iphone.us.imposto_cota_usd).toBe(0);
    expect(iphone.us.desembarcado_brl).toBe(8098.21);
    expect(iphone.economia_brl).toBe(3400.79);
    expect(iphone.economia_pct).toBe(29.57);
  });
});

describe('decidePurchases — cadeia de custo', () => {
  function soIphone(overrides: Partial<PurchaseItem> = {}, extraQuotes: PriceQuote[] = []) {
    return decidePurchases({
      items: [purchase({ cashback_pct: 0, ...overrides })],
      quotes: [
        quote({}),
        quote({ id: 'q-br', market: 'BR', price: 11499, currency: 'BRL', includes_tax: true }),
        ...extraQuotes,
      ],
      participants: [pedro],
      giftCards: [appleGiftCard],
      assumptions: { ...assumptions, customs_quota_usd_per_person: 100000 },
      today: TODAY,
    })[0];
  }

  it('não aplica sales tax em estado sem imposto', () => {
    expect(soIphone({ us_store_state: 'DE' }).us.bruto_usd).toBe(1399);
  });

  it('aplica desconto percentual antes do imposto', () => {
    // 1399 - 10% = 1259.10 ; +7% = 1347.24
    expect(soIphone({ coupon_pct: 10 }).us.bruto_usd).toBe(1347.24);
  });

  it('aplica desconto fixo antes do imposto', () => {
    // 1399 - 99 = 1300 ; +7% = 1391
    expect(soIphone({ coupon_amount_usd: 99 }).us.bruto_usd).toBe(1391);
  });

  it('soma frete em compra online nos EUA', () => {
    // 1496.93 + 25 = 1521.93
    expect(soIphone({ purchase_channel: 'online_us', freight_usd: 25 }).us.bruto_usd).toBe(1521.93);
  });

  it('ignora frete em compra presencial', () => {
    expect(soIphone({ purchase_channel: 'in_store', freight_usd: 25 }).us.bruto_usd).toBe(1496.93);
  });

  it('aplica o desconto efetivo do gift card sobre a parcela coberta', () => {
    const d = soIphone({ gift_card_id: 'gc-apple-01' });
    expect(d.us.gift_card_covered_usd).toBe(300);
    // 300 * 18.40% = 55.20
    expect(d.us.liquido_usd).toBe(1441.73);
  });

  it('não paga cashback sobre a parcela do gift card (RN-02)', () => {
    const d = soIphone({ gift_card_id: 'gc-apple-01', cashback_pct: 4 });
    // cashback sobre (1496.93 - 300) = 47.88
    expect(d.us.liquido_usd).toBe(1393.85);
  });

  it('limita o gift card ao saldo disponível e alerta cobertura parcial (RN-04)', () => {
    const d = soIphone({ gift_card_id: 'gc-apple-01' });
    expect(d.us.gift_card_covered_usd).toBe(300);
    expect(d.alerts.some(x => x.code === 'GIFT_CARD_PARTIAL')).toBe(true);
  });

  it('desconta cashback brasileiro do preço de referência', () => {
    const d = soIphone({ br_cashback_pct: 5 });
    // 11499 - 5% = 10924.05
    expect(d.br.br_liquido_brl).toBe(10924.05);
  });

  it('multiplica por quantidade', () => {
    const d = soIphone({ quantity: 2 });
    expect(d.us.bruto_usd).toBe(2993.86);
  });
});

describe('decidePurchases — veredito', () => {
  function comPrecos(usPrice: number, brPrice: number, overrides: Partial<PurchaseItem> = {}) {
    return decidePurchases({
      items: [purchase({ cashback_pct: 0, us_store_state: 'DE', ...overrides })],
      quotes: [
        quote({ price: usPrice }),
        quote({ id: 'q-br', market: 'BR', price: brPrice, currency: 'BRL', includes_tax: true }),
      ],
      participants: [pedro],
      giftCards: [],
      assumptions: { ...assumptions, customs_quota_usd_per_person: 100000 },
      today: TODAY,
    })[0];
  }

  it('recomenda EUA quando a economia supera a margem', () => {
    expect(comPrecos(1000, 10000).verdict).toBe('COMPRAR_EUA');
  });

  it('recomenda Brasil quando os EUA saem mais caro', () => {
    expect(comPrecos(1000, 4000).verdict).toBe('COMPRAR_BRASIL');
  });

  it('devolve INDIFERENTE dentro da margem de segurança', () => {
    // 1000 USD * 5.809956 = 5809.96 ; preço BR igual => economia 0%
    expect(comPrecos(1000, 5809.96).verdict).toBe('INDIFERENTE');
  });

  it('trata a borda exata da margem como INDIFERENTE', () => {
    // economia de exatamente 5% => |economia_pct| <= m
    const brl = 5809.96 / 0.95;
    expect(comPrecos(1000, Math.round(brl * 100) / 100).verdict).toBe('INDIFERENTE');
  });

  it('devolve DADOS_INSUFICIENTES sem cotação americana', () => {
    const d = decidePurchases({
      items: [purchase({})],
      quotes: [quote({ id: 'q-br', market: 'BR', price: 11499, currency: 'BRL', includes_tax: true })],
      participants: [pedro],
      giftCards: [],
      assumptions,
      today: TODAY,
    })[0];

    expect(d.verdict).toBe('DADOS_INSUFICIENTES');
    expect(d.economia_brl).toBe(0);
  });

  it('devolve DADOS_INSUFICIENTES sem cotação brasileira', () => {
    const d = decidePurchases({
      items: [purchase({})],
      quotes: [quote({})],
      participants: [pedro],
      giftCards: [],
      assumptions,
      today: TODAY,
    })[0];

    expect(d.verdict).toBe('DADOS_INSUFICIENTES');
  });

  it('devolve DADOS_INSUFICIENTES quando o preço BR é zero (RN-07a)', () => {
    expect(comPrecos(1000, 0).verdict).toBe('DADOS_INSUFICIENTES');
    expect(comPrecos(1000, 0).economia_pct).toBe(0);
  });

  it('sugere aguardar quando o preço cai e a prioridade não é alta (RN-13)', () => {
    const d = decidePurchases({
      items: [purchase({ priority: 'medium', cashback_pct: 0, us_store_state: 'DE' })],
      quotes: [
        quote({ id: 'q-old', price: 1500, observed_at: '2026-07-01', is_active: false }),
        quote({ price: 1300 }),
        quote({ id: 'q-br', market: 'BR', price: 11499, currency: 'BRL', includes_tax: true }),
      ],
      participants: [pedro],
      giftCards: [],
      assumptions: { ...assumptions, customs_quota_usd_per_person: 100000 },
      today: TODAY,
    })[0];

    expect(d.verdict).toBe('AGUARDAR_PRECO');
  });

  it('não sugere aguardar em item de prioridade alta', () => {
    const d = decidePurchases({
      items: [purchase({ priority: 'high', cashback_pct: 0, us_store_state: 'DE' })],
      quotes: [
        quote({ id: 'q-old', price: 1500, observed_at: '2026-07-01', is_active: false }),
        quote({ price: 1300 }),
        quote({ id: 'q-br', market: 'BR', price: 11499, currency: 'BRL', includes_tax: true }),
      ],
      participants: [pedro],
      giftCards: [],
      assumptions: { ...assumptions, customs_quota_usd_per_person: 100000 },
      today: TODAY,
    })[0];

    expect(d.verdict).toBe('COMPRAR_EUA');
  });

  it('respeita o override manual acima de tudo (RN-15)', () => {
    const d = comPrecos(1000, 10000, {
      verdict_override: 'COMPRAR_BRASIL',
      override_reason: 'Prefiro garantia nacional',
    });
    expect(d.verdict).toBe('COMPRAR_BRASIL');
  });
});

describe('decidePurchases — alertas e premissas', () => {
  function comAlerta(overrides: Partial<PurchaseItem>, quoteOverrides: Partial<PriceQuote> = {}) {
    return decidePurchases({
      items: [purchase({ cashback_pct: 0, ...overrides })],
      quotes: [
        quote(quoteOverrides),
        quote({ id: 'q-br', market: 'BR', price: 11499, currency: 'BRL', includes_tax: true }),
      ],
      participants: [pedro],
      giftCards: [],
      assumptions,
      today: TODAY,
    })[0];
  }

  it('alerta cotação com mais de 30 dias', () => {
    const d = comAlerta({}, { observed_at: '2026-06-01' });
    expect(d.alerts.some(x => x.code === 'QUOTE_STALE')).toBe(true);
  });

  it('alerta risco de garantia alto', () => {
    const d = comAlerta({ warranty_risk: 'high' });
    expect(d.alerts.some(x => x.code === 'WARRANTY_RISK')).toBe(true);
  });

  it('alerta cota estourada', () => {
    const d = comAlerta({});
    expect(d.alerts.some(x => x.code === 'QUOTA_EXCEEDED')).toBe(true);
  });

  it('alerta falta de espaço em mala quando o item tem peso estimado', () => {
    const d = comAlerta({ expected_weight_kg: 1.2 });
    expect(d.alerts.some(x => x.code === 'LUGGAGE_NO_SPACE')).toBe(true);
  });

  it('não alerta espaço quando alguma mala do responsável reserva percentual para compras', () => {
    const d = decidePurchases({
      items: [purchase({ cashback_pct: 0, expected_weight_kg: 1.2 })],
      quotes: [
        quote({}),
        quote({ id: 'q-br', market: 'BR', price: 11499, currency: 'BRL', includes_tax: true }),
      ],
      participants: [pedro],
      giftCards: [],
      assumptions,
      today: TODAY,
      luggages: [
        {
          id: 'l1',
          trip_id: 'trip-1',
          participant_id: 'p-pedro',
          type: 'checked',
          bag_identifier: 'Mala grande',
          max_weight_kg: 23,
          shopping_space_reserved_pct: 30,
        },
      ],
    })[0];

    expect(d.alerts.some(x => x.code === 'LUGGAGE_NO_SPACE')).toBe(false);
  });

  it('declara câmbio, IOF e cota como premissas rastreáveis', () => {
    const labels = comAlerta({}).premises.map(p => p.label);
    expect(labels).toContain('Câmbio USD/BRL');
    expect(labels).toContain('IOF do cartão');
    expect(labels).toContain('Cota por pessoa');
  });

  it('declara a premissa de que o IOF incide sobre o valor todo (RN-03)', () => {
    const d = comAlerta({});
    expect(d.premises.some(p => p.label === 'Incidência do IOF')).toBe(true);
  });
});

describe('decidePurchases — degenerados', () => {
  function degenerado(overrides: Partial<PurchaseItem>, usPrice = 1399) {
    return decidePurchases({
      items: [purchase({ cashback_pct: 0, us_store_state: 'DE', ...overrides })],
      quotes: [
        quote({ price: usPrice }),
        quote({ id: 'q-br', market: 'BR', price: 11499, currency: 'BRL', includes_tax: true }),
      ],
      participants: [pedro],
      giftCards: [],
      assumptions: { ...assumptions, customs_quota_usd_per_person: 100000 },
      today: TODAY,
    })[0];
  }

  it('trata quantidade zero sem quebrar', () => {
    const d = degenerado({ quantity: 0 });
    expect(d.us.bruto_usd).toBe(0);
    expect(Number.isFinite(d.economia_brl)).toBe(true);
  });

  it('trata preço negativo como zero', () => {
    expect(degenerado({}, -50).us.bruto_usd).toBe(0);
  });

  it('devolve lista vazia quando não há itens', () => {
    expect(
      decidePurchases({
        items: [],
        quotes: [],
        participants: [pedro],
        giftCards: [],
        assumptions,
        today: TODAY,
      }),
    ).toEqual([]);
  });
});
