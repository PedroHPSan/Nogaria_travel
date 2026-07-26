# Motor de Decisão de Compras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o módulo de compras responder, item a item, com número auditável: vale comprar nos EUA ou no Brasil?

**Architecture:** Funções puras em `src/services/purchase/` calculam custo desembarcado, rateio de cota alfandegária e veredito. Nenhuma delas importa React. A UI consome via `useMemo` no `TripContext`. Uma Edge Function stateless faz pesquisa de preços com Gemini, e nada que ela devolve vira dado sem validação humana.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind v4, Vitest (novo), Supabase Edge Functions (Deno), Gemini com Google Search grounding.

**Spec:** `docs/superpowers/specs/2026-07-26-motor-decisao-compras-design.md`

## Global Constraints

- **Node ≥ 20** — `crypto.randomUUID()` precisa existir no ambiente de teste.
- **`verbatimModuleSyntax` está ligado** — todo import de tipo usa `import type { X } from '...'`. Import normal de um tipo quebra o build.
- **`noUnusedLocals` e `noUnusedParameters` estão ligados** — variável ou parâmetro não usado **falha o `npm run build`**, e o `npm run dev` não avisa. Rode `npm run build` antes de cada commit.
- **`erasableSyntaxOnly` está ligado** — proibido `enum` e propriedades de parâmetro em construtor. Use uniões de string literal.
- **Arredondamento (RN-07c):** toda linha nomeada usa `round2` = `Math.round(n * 100) / 100`. `share` nunca é arredondado.
- **Moeda:** todo valor monetário guardado é USD, exceto os campos explicitamente BRL. Convenção do repositório, não negociável.
- **Sem lib de formulário:** validação manual, seguindo o padrão dos modais existentes. Nada de Zod ou React Hook Form nesta fase.
- **Estilo:** classes cruas do Tailwind (`slate-*`, `emerald-*`, `rose-*`, `amber-*`, `purple-*`) sobre fundo escuro, mais `.glass-card` / `.glass-panel`. Não usar os tokens de `tailwind.config.js` — esse arquivo está morto sob Tailwind v4.
- **Ícones:** `lucide-react`.
- **UI em português (pt-BR).**
- **`npm run lint`** deve terminar com exatamente 2 warnings conhecidos (`react/only-export-components` em `TripContext.tsx` e `AuthContext.tsx`). Mais que isso é regressão.
- **Chave de API jamais no frontend.** `GEMINI_API_KEY` só existe como secret da Edge Function.

---

### Task 1: Vitest e helpers de arredondamento

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/services/money.ts`
- Create: `src/services/ids.ts`
- Test: `src/services/money.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `round2(n: number): number`, `fxMultiplier(rate: number, iofPct: number, spreadPct: number): number`, `newId(): string`

- [ ] **Step 1: Instalar o Vitest**

```bash
npm install -D vitest@^3
```

- [ ] **Step 2: Configurar o Vitest no Vite**

Substitua `vite.config.ts` inteiro. A troca do import de `vite` para `vitest/config` é o que habilita a chave `test` com tipagem.

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Adicionar o script de teste**

Em `package.json`, dentro de `"scripts"`, adicione a linha `test` logo após `"lint"`:

```json
    "test": "vitest run",
```

- [ ] **Step 4: Escrever o teste que falha**

Crie `src/services/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fxMultiplier, round2 } from './money';
import { newId } from './ids';

describe('round2', () => {
  it('arredonda para duas casas', () => {
    expect(round2(97.929999)).toBe(97.93);
    expect(round2(47.8772)).toBe(47.88);
  });

  it('arredonda meio centavo para cima', () => {
    expect(round2(382.225)).toBe(382.23);
  });

  it('preserva zero e negativos', () => {
    expect(round2(0)).toBe(0);
    expect(round2(-1.234)).toBe(-1.23);
  });
});

describe('fxMultiplier', () => {
  it('soma IOF e spread ao câmbio', () => {
    expect(fxMultiplier(5.62, 3.38, 0)).toBeCloseTo(5.809956, 6);
  });

  it('devolve o câmbio puro quando não há IOF nem spread', () => {
    expect(fxMultiplier(5.62, 0, 0)).toBeCloseTo(5.62, 6);
  });
});

describe('newId', () => {
  it('gera identificadores distintos em chamadas consecutivas', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()));
    expect(ids.size).toBe(100);
  });

  it('gera um UUID válido', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./money"`.

- [ ] **Step 6: Implementar**

Crie `src/services/money.ts`:

```ts
/**
 * Arredonda para duas casas decimais (RN-07c).
 * Mesma convenção do giftCardCalculator.ts, para que os dois módulos
 * nunca divirjam em centavos.
 */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Multiplicador de conversão USD -> BRL, já incluindo IOF e spread do cartão.
 * Ex.: câmbio 5.62 com IOF 3.38% e spread 0 => 5.809956
 */
export const fxMultiplier = (rate: number, iofPct: number, spreadPct: number): number =>
  rate * (1 + iofPct / 100 + spreadPct / 100);
```

Crie `src/services/ids.ts`:

```ts
/**
 * Identificador único para entidades novas.
 * Substitui o padrão `prefix-${Date.now()}`, que colide quando vários
 * registros nascem no mesmo milissegundo — o que acontece toda vez que a
 * pesquisa de preços devolve vários candidatos de uma só chamada.
 */
export const newId = (): string => crypto.randomUUID();
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS — 7 testes.

- [ ] **Step 8: Confirmar que o build segue limpo**

Run: `npm run build`
Expected: sucesso, sem erro de TypeScript.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/services/money.ts src/services/ids.ts src/services/money.test.ts
git commit -m "Add Vitest and rounding/id helpers for the purchase engine"
```

---

### Task 2: Tipos e parâmetros de cálculo

**Files:**
- Modify: `src/types/database.types.ts`
- Create: `src/types/purchase.types.ts`
- Create: `src/services/purchase/purchaseAssumptions.ts`
- Test: `src/services/purchase/purchaseAssumptions.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: tipos `Market`, `PriceQuote`, `PurchaseAssumptions`, `PurchaseVerdict`, `CostLine`, `UsCostBreakdown`, `BrCostBreakdown`, `QuotaShare`, `OwnerQuota`, `RebalanceHint`, `QuotaResult`, `Premise`, `DecisionAlert`, `PurchaseDecision`; funções `makeDefaultAssumptions(tripId: string, today: string): PurchaseAssumptions`, `salesTaxPct(a: PurchaseAssumptions, state?: string): number`, `validateAssumptions(a: PurchaseAssumptions): string[]`

- [ ] **Step 1: Adicionar as entidades novas aos tipos do banco**

Em `src/types/database.types.ts`, acrescente ao final do arquivo:

```ts
export type Market = 'US' | 'BR';

export interface PriceQuote {
  id: string;
  trip_id: string;
  purchase_item_id: string;
  market: Market;
  store_name: string;
  url?: string;
  price: number;
  currency: Currency;
  price_kind: 'list' | 'promo' | 'used' | 'refurbished';
  includes_tax: boolean;
  observed_at: string;
  source: 'manual' | 'ai_search';
  source_note?: string;
  confidence?: 'high' | 'medium' | 'low';
  validated_by?: string;
  validated_at?: string;
  is_active: boolean;
  superseded_by_id?: string;
  created_at: string;
}

export interface PurchaseAssumptions {
  trip_id: string;
  usd_brl_rate: number;
  rate_source: string;
  rate_date: string;
  default_sales_tax_pct: number;
  sales_tax_pct_by_state?: Record<string, number>;
  card_iof_pct: number;
  card_spread_pct: number;
  customs_quota_usd_per_person: number;
  customs_excess_tax_pct: number;
  safety_margin_pct: number;
  legal_reference?: string;
  updated_at: string;
}
```

- [ ] **Step 2: Estender `PurchaseItem` e `Participant`**

Em `src/types/database.types.ts`, dentro de `interface PurchaseItem`, logo antes da linha `notes?: string;`, insira:

```ts
  purchase_channel?: 'in_store' | 'online_us' | 'online_br';
  us_store_state?: string;
  freight_usd?: number;
  coupon_pct?: number;
  coupon_amount_usd?: number;
  cashback_pct?: number;
  gift_card_id?: string;
  br_cashback_pct?: number;
  warranty_risk?: 'none' | 'low' | 'medium' | 'high';
  expected_weight_kg?: number;
  quota_owner_id?: string;
  decision_id?: string;
  verdict_override?: PurchaseVerdict;
  override_reason?: string;
  actual_paid_usd?: number;
  decision_snapshot?: PurchaseDecision;
```

E no topo do arquivo, na primeira linha, adicione o import dos tipos derivados:

```ts
import type { PurchaseDecision, PurchaseVerdict } from './purchase.types';
```

Dentro de `interface Participant`, logo antes de `avatar_color: string;`, insira:

```ts
  quota_eligible?: boolean;
```

- [ ] **Step 3: Criar os tipos derivados**

Crie `src/types/purchase.types.ts`:

```ts
export type PurchaseVerdict =
  | 'COMPRAR_EUA'
  | 'COMPRAR_BRASIL'
  | 'INDIFERENTE'
  | 'AGUARDAR_PRECO'
  | 'DADOS_INSUFICIENTES';

/** Uma linha nomeada do cálculo, com o parâmetro que a produziu. */
export interface CostLine {
  label: string;
  amount_usd: number;
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
```

- [ ] **Step 4: Escrever o teste que falha**

Crie `src/services/purchase/purchaseAssumptions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  makeDefaultAssumptions,
  salesTaxPct,
  validateAssumptions,
} from './purchaseAssumptions';

const base = makeDefaultAssumptions('trip-1', '2026-07-26');

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
```

- [ ] **Step 5: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./purchaseAssumptions"`.

- [ ] **Step 6: Implementar**

Crie `src/services/purchase/purchaseAssumptions.ts`:

```ts
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

export function makeDefaultAssumptions(tripId: string, today: string): PurchaseAssumptions {
  return {
    trip_id: tripId,
    usd_brl_rate: 5.62,
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
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Confirmar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 9: Commit**

```bash
git add src/types/database.types.ts src/types/purchase.types.ts src/services/purchase/purchaseAssumptions.ts src/services/purchase/purchaseAssumptions.test.ts
git commit -m "Add purchase decision types and calculation assumptions"
```

---

### Task 3: Cotações de preço como série append-only

**Files:**
- Create: `src/services/purchase/priceQuotes.ts`
- Test: `src/services/purchase/priceQuotes.test.ts`

**Interfaces:**
- Consumes: `PriceQuote`, `Market` (Task 2)
- Produces: `activeQuote(quotes, itemId, market): PriceQuote | undefined`, `supersede(quotes, incoming): PriceQuote[]`, `quoteAgeDays(observedAt: string, today: string): number`, `priceTrend(quotes, itemId, market, today, windowDays): { dropPct: number; samples: number }`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/services/purchase/priceQuotes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { PriceQuote } from '../../types/database.types';
import { activeQuote, priceTrend, quoteAgeDays, supersede } from './priceQuotes';

function quote(overrides: Partial<PriceQuote>): PriceQuote {
  return {
    id: 'q1',
    trip_id: 'trip-1',
    purchase_item_id: 'item-1',
    market: 'US',
    store_name: 'Apple Store',
    price: 1399,
    currency: 'USD',
    price_kind: 'list',
    includes_tax: false,
    observed_at: '2026-07-20',
    source: 'manual',
    is_active: true,
    created_at: '2026-07-20T10:00:00Z',
    ...overrides,
  };
}

describe('activeQuote', () => {
  it('devolve a cotação ativa do mercado pedido', () => {
    const quotes = [
      quote({ id: 'a', market: 'US' }),
      quote({ id: 'b', market: 'BR', price: 11499, currency: 'BRL' }),
    ];
    expect(activeQuote(quotes, 'item-1', 'US')?.id).toBe('a');
    expect(activeQuote(quotes, 'item-1', 'BR')?.id).toBe('b');
  });

  it('ignora cotações inativas', () => {
    const quotes = [quote({ id: 'a', is_active: false })];
    expect(activeQuote(quotes, 'item-1', 'US')).toBeUndefined();
  });

  it('ignora cotações de outro item', () => {
    const quotes = [quote({ id: 'a', purchase_item_id: 'item-2' })];
    expect(activeQuote(quotes, 'item-1', 'US')).toBeUndefined();
  });
});

describe('supersede', () => {
  it('desativa a anterior e aponta para a nova, sem apagar nada', () => {
    const antiga = quote({ id: 'a', price: 1399 });
    const nova = quote({ id: 'b', price: 1299, observed_at: '2026-07-25' });

    const result = supersede([antiga], nova);

    expect(result).toHaveLength(2);
    const anterior = result.find(q => q.id === 'a');
    expect(anterior?.is_active).toBe(false);
    expect(anterior?.superseded_by_id).toBe('b');
    expect(result.find(q => q.id === 'b')?.is_active).toBe(true);
  });

  it('não mexe em cotações de outro mercado', () => {
    const brl = quote({ id: 'br', market: 'BR', price: 11499, currency: 'BRL' });
    const nova = quote({ id: 'b', market: 'US' });

    const result = supersede([brl], nova);

    expect(result.find(q => q.id === 'br')?.is_active).toBe(true);
  });
});

describe('quoteAgeDays', () => {
  it('conta a diferença em dias', () => {
    expect(quoteAgeDays('2026-07-20', '2026-07-26')).toBe(6);
    expect(quoteAgeDays('2026-07-26', '2026-07-26')).toBe(0);
  });

  it('não devolve idade negativa para data futura', () => {
    expect(quoteAgeDays('2026-08-01', '2026-07-26')).toBe(0);
  });
});

describe('priceTrend', () => {
  it('mede a queda percentual dentro da janela', () => {
    const quotes = [
      quote({ id: 'a', price: 1500, observed_at: '2026-07-01', is_active: false }),
      quote({ id: 'b', price: 1350, observed_at: '2026-07-25' }),
    ];
    const trend = priceTrend(quotes, 'item-1', 'US', '2026-07-26', 45);
    expect(trend.dropPct).toBeCloseTo(10, 5);
    expect(trend.samples).toBe(2);
  });

  it('devolve queda negativa quando o preço subiu', () => {
    const quotes = [
      quote({ id: 'a', price: 1000, observed_at: '2026-07-01', is_active: false }),
      quote({ id: 'b', price: 1100, observed_at: '2026-07-25' }),
    ];
    expect(priceTrend(quotes, 'item-1', 'US', '2026-07-26', 45).dropPct).toBeCloseTo(-10, 5);
  });

  it('ignora cotações fora da janela', () => {
    const quotes = [
      quote({ id: 'a', price: 1500, observed_at: '2026-01-01', is_active: false }),
      quote({ id: 'b', price: 1350, observed_at: '2026-07-25' }),
    ];
    const trend = priceTrend(quotes, 'item-1', 'US', '2026-07-26', 45);
    expect(trend.samples).toBe(1);
    expect(trend.dropPct).toBe(0);
  });

  it('devolve zero quando não há amostra', () => {
    expect(priceTrend([], 'item-1', 'US', '2026-07-26', 45)).toEqual({ dropPct: 0, samples: 0 });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./priceQuotes"`.

- [ ] **Step 3: Implementar**

Crie `src/services/purchase/priceQuotes.ts`:

```ts
import type { Market, PriceQuote } from '../../types/database.types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** A cotação vigente de um item num mercado. */
export function activeQuote(
  quotes: PriceQuote[],
  itemId: string,
  market: Market,
): PriceQuote | undefined {
  return quotes.find(q => q.purchase_item_id === itemId && q.market === market && q.is_active);
}

/**
 * Registra uma cotação nova sem apagar a anterior (RN-16): a antiga vira
 * inativa e passa a apontar para quem a substituiu.
 */
export function supersede(quotes: PriceQuote[], incoming: PriceQuote): PriceQuote[] {
  const updated = quotes.map(q =>
    q.purchase_item_id === incoming.purchase_item_id &&
    q.market === incoming.market &&
    q.is_active
      ? { ...q, is_active: false, superseded_by_id: incoming.id }
      : q,
  );
  return [...updated, { ...incoming, is_active: true }];
}

/** Idade da cotação em dias inteiros. Datas futuras contam como zero. */
export function quoteAgeDays(observedAt: string, today: string): number {
  const diff = Date.parse(today) - Date.parse(observedAt);
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Tendência de preço na janela. dropPct positivo significa queda.
 * Considera cotações ativas e superadas — a série inteira é o histórico.
 */
export function priceTrend(
  quotes: PriceQuote[],
  itemId: string,
  market: Market,
  today: string,
  windowDays: number,
): { dropPct: number; samples: number } {
  const window = quotes
    .filter(
      q =>
        q.purchase_item_id === itemId &&
        q.market === market &&
        quoteAgeDays(q.observed_at, today) <= windowDays,
    )
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));

  if (window.length < 2) {
    return { dropPct: 0, samples: window.length };
  }

  const first = window[0].price;
  const last = window[window.length - 1].price;
  if (first <= 0) {
    return { dropPct: 0, samples: window.length };
  }

  return { dropPct: ((first - last) / first) * 100, samples: window.length };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/purchase/priceQuotes.ts src/services/purchase/priceQuotes.test.ts
git commit -m "Add append-only price quote series with supersede and trend"
```

---

### Task 4: Rateio da cota alfandegária

**Files:**
- Create: `src/services/purchase/customsQuota.ts`
- Test: `src/services/purchase/customsQuota.test.ts`

**Interfaces:**
- Consumes: `round2` (Task 1); `Participant`, `PurchaseAssumptions`, `PurchaseItem` (Task 2); `QuotaResult`, `QuotaShare`, `OwnerQuota`, `RebalanceHint` (Task 2)
- Produces: `resolveQuotaOwner(item: PurchaseItem): string`, `QuotaItemInput` (`{ id: string; quota_owner_id: string; liquido_usd: number }`), `allocateCustomsQuota(items: QuotaItemInput[], participants: Participant[], a: PurchaseAssumptions): QuotaResult`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/services/purchase/customsQuota.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Participant, PurchaseItem } from '../../types/database.types';
import { makeDefaultAssumptions } from './purchaseAssumptions';
import { allocateCustomsQuota, resolveQuotaOwner } from './customsQuota';
import type { QuotaItemInput } from './customsQuota';

const a = makeDefaultAssumptions('trip-1', '2026-07-26');

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
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./customsQuota"`.

- [ ] **Step 3: Implementar**

Crie `src/services/purchase/customsQuota.ts`:

```ts
import type { Participant, PurchaseAssumptions, PurchaseItem } from '../../types/database.types';
import type { OwnerQuota, QuotaResult, QuotaShare, RebalanceHint } from '../../types/purchase.types';
import { round2 } from '../money';

export interface QuotaItemInput {
  id: string;
  quota_owner_id: string;
  liquido_usd: number;
}

/** De quem é a cota que este item consome (RN-08). */
export function resolveQuotaOwner(item: PurchaseItem): string {
  return item.quota_owner_id ?? item.beneficiary_id ?? item.target_participant_id;
}

/**
 * A cota é individual e não cumulativa (RN-06): cada item pertence a
 * exatamente um titular, e um bem acima da cota gera excedente ainda que
 * outro viajante tenha folga.
 */
export function allocateCustomsQuota(
  items: QuotaItemInput[],
  participants: Participant[],
  a: PurchaseAssumptions,
): QuotaResult {
  const byItem: Record<string, QuotaShare> = {};
  const byOwner: Record<string, OwnerQuota> = {};

  const grouped = new Map<string, QuotaItemInput[]>();
  for (const item of items) {
    const list = grouped.get(item.quota_owner_id);
    if (list) list.push(item);
    else grouped.set(item.quota_owner_id, [item]);
  }

  for (const [ownerId, ownerItems] of grouped) {
    const participant = participants.find(p => p.id === ownerId);
    // Default é elegível (RN-09). Titular desconhecido também recebe a cota
    // padrão — a alternativa (zero) inventaria um imposto que não existe.
    const eligible = participant ? participant.quota_eligible !== false : true;
    const quota = eligible ? a.customs_quota_usd_per_person : 0;

    const total = round2(ownerItems.reduce((sum, i) => sum + i.liquido_usd, 0));
    const excedente = round2(Math.max(0, total - quota));
    const impostoTotal = round2((excedente * a.customs_excess_tax_pct) / 100);

    byOwner[ownerId] = {
      owner_id: ownerId,
      total_usd: total,
      quota_usd: quota,
      excedente_usd: excedente,
      folga_usd: round2(Math.max(0, quota - total)),
      imposto_total_usd: impostoTotal,
    };

    let somaImpostos = 0;
    let maiorShare = -1;
    let itemDeMaiorShare = '';

    for (const item of ownerItems) {
      const share = total > 0 ? item.liquido_usd / total : 0;
      const imposto = round2((excedente * share * a.customs_excess_tax_pct) / 100);
      somaImpostos = round2(somaImpostos + imposto);

      if (share > maiorShare) {
        maiorShare = share;
        itemDeMaiorShare = item.id;
      }

      byItem[item.id] = {
        quota_owner_id: ownerId,
        total_pessoa_usd: total,
        quota_usd: quota,
        excedente_usd: excedente,
        share_pct: round2(share * 100),
        imposto_do_item_usd: imposto,
      };
    }

    // O arredondamento por item desvia do total em centavos. O resíduo vai
    // para o item de maior share, de modo que a soma feche exatamente (RN-07b).
    const residuo = round2(impostoTotal - somaImpostos);
    if (residuo !== 0 && itemDeMaiorShare) {
      const alvo = byItem[itemDeMaiorShare];
      alvo.imposto_do_item_usd = round2(alvo.imposto_do_item_usd + residuo);
    }
  }

  const rebalance: RebalanceHint[] = [];
  for (const estourado of Object.values(byOwner)) {
    if (estourado.excedente_usd <= 0) continue;
    for (const folgado of Object.values(byOwner)) {
      if (folgado.owner_id === estourado.owner_id || folgado.folga_usd <= 0) continue;
      rebalance.push({
        from_owner_id: estourado.owner_id,
        to_owner_id: folgado.owner_id,
        folga_usd: folgado.folga_usd,
      });
    }
  }

  return { byItem, byOwner, rebalance };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/purchase/customsQuota.ts src/services/purchase/customsQuota.test.ts
git commit -m "Add customs quota allocation with exact rounding residual"
```

---

### Task 5: Motor de decisão

**Files:**
- Create: `src/services/purchase/purchaseDecisionEngine.ts`
- Test: `src/services/purchase/purchaseDecisionEngine.test.ts`

**Interfaces:**
- Consumes: `round2`, `fxMultiplier` (Task 1); `salesTaxPct` (Task 2); `activeQuote`, `priceTrend`, `quoteAgeDays` (Task 3); `allocateCustomsQuota`, `resolveQuotaOwner` (Task 4)
- Produces: `DecisionInput`, `decidePurchases(input: DecisionInput): PurchaseDecision[]`, `computeUsNet(...)`, `computeBr(...)`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/services/purchase/purchaseDecisionEngine.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./purchaseDecisionEngine"`.

- [ ] **Step 3: Implementar**

Crie `src/services/purchase/purchaseDecisionEngine.ts`:

```ts
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
}

const EMPTY_US_NET: UsNet = {
  lines: [],
  bruto_usd: 0,
  gift_card_covered_usd: 0,
  liquido_usd: 0,
};

/** Cadeia de custo do lado americano, até o líquido — antes da cota. */
export function computeUsNet(
  item: PurchaseItem,
  quote: PriceQuote,
  a: PurchaseAssumptions,
  giftCard?: GiftCard,
): UsNet {
  const lines: CostLine[] = [];

  const unit = Math.max(0, quote.price);
  const qty = Math.max(0, item.quantity);
  const base = round2(unit * qty);
  lines.push({
    label: `Preço ${quote.store_name} (x${qty})`,
    amount_usd: base,
    parameter: `cotação de ${quote.observed_at}`,
  });

  const coupon = item.coupon_amount_usd
    ? round2(item.coupon_amount_usd)
    : round2((base * (item.coupon_pct ?? 0)) / 100);
  if (coupon > 0) {
    lines.push({ label: 'Cupom/desconto', amount_usd: -coupon, parameter: 'cupom do item' });
  }

  const subtotal = round2(Math.max(0, base - coupon));

  const taxPct = quote.includes_tax ? 0 : salesTaxPct(a, item.us_store_state);
  const tax = round2((subtotal * taxPct) / 100);
  if (tax > 0) {
    lines.push({
      label: `Sales tax (${item.us_store_state ?? 'padrão'} ${taxPct}%)`,
      amount_usd: tax,
      parameter: 'sales_tax_pct_by_state',
    });
  }

  const freight = item.purchase_channel === 'online_us' ? round2(item.freight_usd ?? 0) : 0;
  if (freight > 0) {
    lines.push({ label: 'Frete', amount_usd: freight, parameter: 'freight_usd' });
  }

  const bruto = round2(subtotal + tax + freight);

  const balance = giftCard?.current_balance ?? 0;
  const covered = round2(Math.min(bruto, Math.max(0, balance)));
  const gcBenefit = giftCard
    ? round2((covered * giftCard.effective_savings_pct) / 100)
    : 0;
  if (gcBenefit > 0 && giftCard) {
    lines.push({
      label: `Gift card ${giftCard.store_brand} (${giftCard.effective_savings_pct}% efetivo)`,
      amount_usd: -gcBenefit,
      parameter: 'giftCardCalculator.effective_savings_pct',
    });
  }

  // Cashback não incide sobre a parcela paga com gift card (RN-02).
  const cashbackBase = round2(Math.max(0, bruto - covered));
  const cashback = round2((cashbackBase * (item.cashback_pct ?? 0)) / 100);
  if (cashback > 0) {
    lines.push({
      label: `Cashback (${item.cashback_pct}%)`,
      amount_usd: -cashback,
      parameter: 'cashback_pct',
    });
  }

  return {
    lines,
    bruto_usd: bruto,
    gift_card_covered_usd: covered,
    liquido_usd: round2(bruto - gcBenefit - cashback),
  };
}

/** Custo de referência no Brasil, líquido de cashback local. */
export function computeBr(item: PurchaseItem, quote: PriceQuote): BrCostBreakdown {
  const lines: CostLine[] = [];

  const qty = Math.max(0, item.quantity);
  const base = round2(Math.max(0, quote.price) * qty);
  lines.push({
    label: `Preço Brasil ${quote.store_name} (x${qty})`,
    amount_usd: base,
    parameter: `cotação de ${quote.observed_at}`,
  });

  const cashback = round2((base * (item.br_cashback_pct ?? 0)) / 100);
  if (cashback > 0) {
    lines.push({ label: 'Cashback Brasil', amount_usd: -cashback, parameter: 'br_cashback_pct' });
  }

  return { lines, br_liquido_brl: round2(base - cashback) };
}

function buildPremises(a: PurchaseAssumptions, item: PurchaseItem, taxPct: number): Premise[] {
  return [
    { label: 'Câmbio USD/BRL', value: a.usd_brl_rate.toFixed(2), source: `${a.rate_source} — ${a.rate_date}` },
    { label: 'IOF do cartão', value: `${a.card_iof_pct}%`, source: 'parâmetros da viagem' },
    { label: 'Spread do cartão', value: `${a.card_spread_pct}%`, source: 'parâmetros da viagem' },
    {
      label: 'Sales tax aplicada',
      value: `${taxPct}%`,
      source: item.us_store_state ? `estado ${item.us_store_state}` : 'alíquota padrão',
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

  for (const item of items) {
    const usQuote = activeQuote(quotes, item.id, 'US');
    if (!usQuote) continue;
    usQuoteByItem.set(item.id, usQuote);
    const giftCard = item.gift_card_id
      ? giftCards.find(g => g.id === item.gift_card_id)
      : undefined;
    usNetByItem.set(item.id, computeUsNet(item, usQuote, a, giftCard));
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
        amount_usd: impostoCota,
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
      alerts.push({
        code: 'QUOTA_EXCEEDED',
        severity: 'critical',
        message: `A cota de ${quotaShare.quota_owner_id} está US$ ${quotaShare.excedente_usd.toFixed(2)} acima do limite.`,
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
      alerts.push({
        code: 'REBALANCE_AVAILABLE',
        severity: 'info',
        message: `${hint.to_owner_id} tem US$ ${hint.folga_usd.toFixed(2)} de cota livre.`,
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

    const taxPct = usQuote?.includes_tax ? 0 : salesTaxPct(a, item.us_store_state);

    return {
      purchase_item_id: item.id,
      verdict,
      economia_brl: economiaBrl,
      economia_pct: economiaPct,
      us,
      br,
      quota: quotaShare,
      alerts,
      premises: buildPremises(a, item, taxPct),
      computed_at: today,
    };
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS — inclusive os dois testes de regressão CA-02 e CA-03.

- [ ] **Step 5: Confirmar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 6: Commit**

```bash
git add src/services/purchase/purchaseDecisionEngine.ts src/services/purchase/purchaseDecisionEngine.test.ts
git commit -m "Add the US-vs-Brazil purchase decision engine"
```

---

### Task 6: Estado de compras no contexto e migração de IDs

**Files:**
- Create: `src/features/purchases/usePurchasesState.ts`
- Modify: `src/context/TripContext.tsx`
- Modify: `src/services/initialMockData.ts`

**Interfaces:**
- Consumes: `newId` (Task 1); `makeDefaultAssumptions` (Task 2); `supersede` (Task 3); `decidePurchases`, `DecisionInput` (Task 5)
- Produces: no `useTrip()` — `priceQuotes: PriceQuote[]`, `addPriceQuote(q: Omit<PriceQuote,'id'|'created_at'|'is_active'>): void`, `deactivateQuote(id: string): void`, `assumptions: PurchaseAssumptions`, `updateAssumptions(patch: Partial<PurchaseAssumptions>): void`, `purchaseDecisions: PurchaseDecision[]`

- [ ] **Step 1: Criar o hook de estado**

Crie `src/features/purchases/usePurchasesState.ts`:

```ts
import { useEffect, useMemo, useState } from 'react';
import type { PriceQuote, PurchaseAssumptions } from '../../types/database.types';
import { newId } from '../../services/ids';
import { makeDefaultAssumptions } from '../../services/purchase/purchaseAssumptions';
import { supersede } from '../../services/purchase/priceQuotes';

export function usePurchasesState(storageKey: string, tripId: string) {
  const today = new Date().toISOString().split('T')[0];

  const [priceQuotes, setPriceQuotes] = useState<PriceQuote[]>(() => {
    const saved = localStorage.getItem(`${storageKey}_price_quotes`);
    return saved ? JSON.parse(saved) : [];
  });

  const [assumptions, setAssumptions] = useState<PurchaseAssumptions>(() => {
    const saved = localStorage.getItem(`${storageKey}_purchase_assumptions`);
    return saved ? JSON.parse(saved) : makeDefaultAssumptions(tripId, today);
  });

  useEffect(() => {
    localStorage.setItem(`${storageKey}_price_quotes`, JSON.stringify(priceQuotes));
  }, [priceQuotes, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}_purchase_assumptions`, JSON.stringify(assumptions));
  }, [assumptions, storageKey]);

  const addPriceQuote = (q: Omit<PriceQuote, 'id' | 'created_at' | 'is_active'>) => {
    const quote: PriceQuote = {
      ...q,
      id: newId(),
      created_at: new Date().toISOString(),
      is_active: true,
    };
    setPriceQuotes(prev => supersede(prev, quote));
  };

  const deactivateQuote = (id: string) => {
    setPriceQuotes(prev => prev.map(q => (q.id === id ? { ...q, is_active: false } : q)));
  };

  const updateAssumptions = (patch: Partial<PurchaseAssumptions>) => {
    setAssumptions(prev => ({ ...prev, ...patch, updated_at: new Date().toISOString() }));
  };

  return useMemo(
    () => ({ priceQuotes, addPriceQuote, deactivateQuote, assumptions, updateAssumptions, today }),
    [priceQuotes, assumptions, today],
  );
}
```

- [ ] **Step 2: Trocar os IDs por UUID em todo o `TripContext`**

Em `src/context/TripContext.tsx`, importe o helper logo abaixo do import de `useAuth`:

```ts
import { newId } from '../services/ids';
```

Depois substitua **todas** as ocorrências do padrão `` id: `xx-${Date.now()}` `` por `id: newId()`. São 14 ocorrências (participantes, voos, hospedagens, transportes, roteiro, gift cards, compras, bagagens, despesas, tarefas, decisões, documentos, fidelidade e viagens). Localize-as com:

```bash
grep -n 'Date.now()' src/context/TripContext.tsx
```

Nenhuma outra mudança de comportamento: só a origem do identificador.

- [ ] **Step 3: Ligar o hook ao contexto**

Em `src/context/TripContext.tsx`:

1. Adicione o import: `import { usePurchasesState } from '../features/purchases/usePurchasesState';`
2. Adicione o import do motor: `import { decidePurchases } from '../services/purchase/purchaseDecisionEngine';`
3. Importe os tipos: `import type { PriceQuote, PurchaseAssumptions } from '../types/database.types';` (some ao bloco de `import type` já existente) e `import type { PurchaseDecision } from '../types/purchase.types';`
4. Em `interface TripContextType`, logo abaixo do bloco `purchases`, acrescente:

```ts
  priceQuotes: PriceQuote[];
  addPriceQuote: (q: Omit<PriceQuote, 'id' | 'created_at' | 'is_active'>) => void;
  deactivateQuote: (id: string) => void;
  assumptions: PurchaseAssumptions;
  updateAssumptions: (patch: Partial<PurchaseAssumptions>) => void;
  purchaseDecisions: PurchaseDecision[];
```

5. Dentro do provider, depois da declaração de `purchases`, chame o hook:

```ts
  const purchaseState = usePurchasesState(STORAGE_KEY, activeTrip.id);
```

6. Calcule as decisões com `useMemo`, junto do `useMemo` da auditoria:

```ts
  const purchaseDecisions = useMemo(
    () =>
      decidePurchases({
        items: purchases.filter(p => p.trip_id === activeTrip.id),
        quotes: purchaseState.priceQuotes,
        participants: participants.filter(p => p.trip_id === activeTrip.id),
        giftCards: giftCards.filter(g => g.trip_id === activeTrip.id),
        assumptions: purchaseState.assumptions,
        today: purchaseState.today,
        luggages: luggages.filter(l => l.trip_id === activeTrip.id),
      }),
    [purchases, purchaseState, participants, giftCards, luggages, activeTrip.id],
  );
```

7. No objeto passado ao `Provider`, logo depois de `deletePurchase,`, acrescente:

```ts
        priceQuotes: purchaseState.priceQuotes,
        addPriceQuote: purchaseState.addPriceQuote,
        deactivateQuote: purchaseState.deactivateQuote,
        assumptions: purchaseState.assumptions,
        updateAssumptions: purchaseState.updateAssumptions,
        purchaseDecisions,
```

- [ ] **Step 4: Semear cotações para os itens existentes**

Em `src/services/initialMockData.ts`, ao final do arquivo, exporte a série inicial — assim o motor tem o que calcular na primeira abertura:

```ts
export const INITIAL_PRICE_QUOTES: PriceQuote[] = [
  {
    id: 'q-iphone-us',
    trip_id: 'trip-miami-orlando-2026',
    purchase_item_id: 'pur-iphone-16',
    market: 'US',
    store_name: 'Apple Store Millenia Orlando',
    price: 1399.0,
    currency: 'USD',
    price_kind: 'list',
    includes_tax: false,
    observed_at: '2026-07-20',
    source: 'manual',
    is_active: true,
    created_at: '2026-07-20T12:00:00Z',
  },
  {
    id: 'q-iphone-br',
    trip_id: 'trip-miami-orlando-2026',
    purchase_item_id: 'pur-iphone-16',
    market: 'BR',
    store_name: 'Apple Store Brasil',
    price: 11499.0,
    currency: 'BRL',
    price_kind: 'list',
    includes_tax: true,
    observed_at: '2026-07-20',
    source: 'manual',
    is_active: true,
    created_at: '2026-07-20T12:00:00Z',
  },
  {
    id: 'q-watch-us',
    trip_id: 'trip-miami-orlando-2026',
    purchase_item_id: 'pur-apple-watch-ultra',
    market: 'US',
    store_name: 'Best Buy',
    price: 799.0,
    currency: 'USD',
    price_kind: 'list',
    includes_tax: false,
    observed_at: '2026-07-20',
    source: 'manual',
    is_active: true,
    created_at: '2026-07-20T12:00:00Z',
  },
  {
    id: 'q-watch-br',
    trip_id: 'trip-miami-orlando-2026',
    purchase_item_id: 'pur-apple-watch-ultra',
    market: 'BR',
    store_name: 'Apple Store Brasil',
    price: 6800.0,
    currency: 'BRL',
    price_kind: 'list',
    includes_tax: true,
    observed_at: '2026-07-20',
    source: 'manual',
    is_active: true,
    created_at: '2026-07-20T12:00:00Z',
  },
];
```

Adicione `PriceQuote` ao `import type` do topo do arquivo. Em `usePurchasesState.ts`, troque o fallback de `priceQuotes` de `[]` para `INITIAL_PRICE_QUOTES` (importando de `../../services/initialMockData`).

Ainda em `initialMockData.ts`, dê aos dois itens Apple os campos que o motor usa. No item `pur-iphone-16` acrescente `us_store_state: 'FL'`, `cashback_pct: 4`, `gift_card_id: 'gc-apple-01'`, `purchase_channel: 'in_store'`, `warranty_risk: 'medium'`. No `pur-apple-watch-ultra` acrescente `us_store_state: 'FL'`, `cashback_pct: 4`, `purchase_channel: 'in_store'`, `warranty_risk: 'medium'`.

- [ ] **Step 5: Verificar que os testes seguem verdes e o build passa**

Run: `npm test && npm run build && npm run lint`
Expected: testes PASS, build sem erro, lint com exatamente 2 warnings conhecidos.

- [ ] **Step 6: Verificar no navegador**

Run: `npm run dev`

Abra o app, faça login, e no console do navegador rode:

```js
localStorage.getItem('ANTIGRAVITY_TRAVEL_PLATFORM_V1_price_quotes')
```

Expected: JSON com as 4 cotações. Se vier `null`, limpe o localStorage e recarregue — as seeds só são lidas quando a chave não existe.

- [ ] **Step 7: Commit**

```bash
git add src/features/purchases/usePurchasesState.ts src/context/TripContext.tsx src/services/initialMockData.ts
git commit -m "Wire purchase quotes, assumptions and decisions into TripContext; switch IDs to UUID"
```

---

### Task 7: Card de veredito e decomposição auditável

**Files:**
- Create: `src/features/purchases/PurchaseDecisionCard.tsx`
- Create: `src/features/purchases/PurchaseBreakdown.tsx`
- Modify: `src/features/purchases/PurchasesView.tsx:122-197`

**Interfaces:**
- Consumes: `purchaseDecisions` do `useTrip()` (Task 6); tipos `PurchaseDecision`, `PurchaseVerdict` (Task 2)
- Produces: componentes `PurchaseDecisionCard` e `PurchaseBreakdown`

- [ ] **Step 1: Criar o componente de decomposição**

Crie `src/features/purchases/PurchaseBreakdown.tsx`:

```tsx
import React from 'react';
import type { PurchaseDecision } from '../../types/purchase.types';

const usd = (n: number) => `US$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const PurchaseBreakdown: React.FC<{ decision: PurchaseDecision }> = ({ decision }) => (
  <div className="space-y-4 text-xs">
    <div className="space-y-1.5">
      <h5 className="font-bold text-slate-200 uppercase text-[10px] tracking-wide">Custo nos EUA</h5>
      {decision.us.lines.map((line, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 py-1 border-b border-slate-800/60">
          <span className="text-slate-400">
            {line.label}
            {line.parameter && <span className="block text-[10px] text-slate-600">{line.parameter}</span>}
          </span>
          <span className={line.amount_usd < 0 ? 'text-emerald-400 font-semibold' : 'text-slate-200 font-semibold'}>
            {usd(line.amount_usd)}
          </span>
        </div>
      ))}
      <div className="flex justify-between pt-1.5 font-bold text-white">
        <span>Desembarcado</span>
        <span>{usd(decision.us.desembarcado_usd)} = {brl(decision.us.desembarcado_brl)}</span>
      </div>
    </div>

    <div className="space-y-1.5">
      <h5 className="font-bold text-slate-200 uppercase text-[10px] tracking-wide">Referência no Brasil</h5>
      {decision.br.lines.map((line, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 py-1 border-b border-slate-800/60">
          <span className="text-slate-400">{line.label}</span>
          <span className="text-slate-200 font-semibold">{brl(line.amount_usd)}</span>
        </div>
      ))}
      <div className="flex justify-between pt-1.5 font-bold text-white">
        <span>Líquido Brasil</span>
        <span>{brl(decision.br.br_liquido_brl)}</span>
      </div>
    </div>

    <div className="space-y-1.5">
      <h5 className="font-bold text-slate-200 uppercase text-[10px] tracking-wide">Premissas</h5>
      {decision.premises.map((p, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 text-[11px]">
          <span className="text-slate-400">{p.label}</span>
          <span className="text-right text-slate-300">
            {p.value}
            <span className="block text-[10px] text-slate-600">{p.source}</span>
          </span>
        </div>
      ))}
    </div>
  </div>
);
```

- [ ] **Step 2: Criar o card de veredito**

Crie `src/features/purchases/PurchaseDecisionCard.tsx`:

```tsx
import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react';
import type { PurchaseItem } from '../../types/database.types';
import type { PurchaseDecision, PurchaseVerdict } from '../../types/purchase.types';
import { PurchaseBreakdown } from './PurchaseBreakdown';

const VERDICT_STYLE: Record<PurchaseVerdict, { label: string; className: string }> = {
  COMPRAR_EUA: { label: 'Comprar nos EUA', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  COMPRAR_BRASIL: { label: 'Comprar no Brasil', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  INDIFERENTE: { label: 'Indiferente', className: 'bg-slate-700/40 text-slate-300 border-slate-600/40' },
  AGUARDAR_PRECO: { label: 'Aguardar preço', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  DADOS_INSUFICIENTES: { label: 'Dados insuficientes', className: 'bg-slate-800 text-slate-500 border-slate-700' },
};

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  item: PurchaseItem;
  decision: PurchaseDecision;
  onEdit: (item: PurchaseItem) => void;
  onDelete: (id: string) => void;
  onResearch: (item: PurchaseItem) => void;
}

export const PurchaseDecisionCard: React.FC<Props> = ({ item, decision, onEdit, onDelete, onResearch }) => {
  const [expanded, setExpanded] = useState(false);
  const style = VERDICT_STYLE[decision.verdict];
  const positiva = decision.economia_brl > 0;

  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-bold text-base text-white truncate">{item.product_name}</h4>
          <p className="text-xs text-slate-400">{item.brand || 'Marca'} • {item.store_name || 'Loja EUA'}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { if (confirm(`Deseja excluir "${item.product_name}"?`)) onDelete(item.id); }}
            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase border ${style.className}`}>
          {style.label}
        </span>
        {item.verdict_override && (
          <span className="text-[10px] text-slate-500 italic">manual: {item.override_reason}</span>
        )}
      </div>

      {decision.verdict === 'DADOS_INSUFICIENTES' ? (
        <button
          onClick={() => onResearch(item)}
          className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition"
        >
          Registrar preço
        </button>
      ) : (
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] text-slate-400">Economia líquida comprando nos EUA</div>
          <div className={`text-lg font-bold ${positiva ? 'text-emerald-400' : 'text-rose-400'}`}>
            {brl(decision.economia_brl)}
            <span className="text-xs font-semibold ml-2">({decision.economia_pct.toFixed(2)}%)</span>
          </div>
        </div>
      )}

      {decision.alerts.length > 0 && (
        <ul className="space-y-1">
          {decision.alerts.map((alert, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{alert.message}</span>
            </li>
          ))}
        </ul>
      )}

      {decision.verdict !== 'DADOS_INSUFICIENTES' && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-white transition"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Ocultar cálculo' : 'Ver cálculo'}
          </button>
          {expanded && (
            <div className="pt-3 border-t border-slate-800">
              <PurchaseBreakdown decision={decision} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Trocar a grade de cards na view**

Em `src/features/purchases/PurchasesView.tsx`, substitua todo o bloco `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">` da sub-aba de compras (linhas 122 a 197, do `<div className="grid...` até o `</div>` que fecha a grade) por:

```tsx
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripPurchases.map(p => {
              const decision = purchaseDecisions.find(d => d.purchase_item_id === p.id);
              if (!decision) return null;
              return (
                <PurchaseDecisionCard
                  key={p.id}
                  item={p}
                  decision={decision}
                  onEdit={handleOpenEditPurchase}
                  onDelete={deletePurchase}
                  onResearch={handleOpenEditPurchase}
                />
              );
            })}
          </div>
```

Adicione ao topo do arquivo: `import { PurchaseDecisionCard } from './PurchaseDecisionCard';` e inclua `purchaseDecisions` na desestruturação de `useTrip()`. Remova `participants` da desestruturação **se** ele deixar de ser usado no arquivo — `noUnusedLocals` falha o build com variável órfã.

- [ ] **Step 4: Verificar no navegador**

Run: `npm run dev`

Abra a aba Compras. Expected: o card do iPhone mostra badge verde **Comprar nos EUA** com economia **R$ 1.180,05 (10,26%)**, e "Ver cálculo" abre a decomposição com a linha de imposto de cota de US$ 382,23.

- [ ] **Step 5: Confirmar build e lint**

Run: `npm run build && npm run lint`
Expected: build sem erro; lint com exatamente 2 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/features/purchases/PurchaseDecisionCard.tsx src/features/purchases/PurchaseBreakdown.tsx src/features/purchases/PurchasesView.tsx
git commit -m "Show purchase verdict and auditable breakdown on each item card"
```

---

### Task 8: Registro manual de cotações e histórico de preços

**Files:**
- Create: `src/components/modals/PriceQuoteModal.tsx`
- Create: `src/features/purchases/PriceQuoteHistory.tsx`
- Modify: `src/features/purchases/PurchasesView.tsx`
- Modify: `src/features/purchases/PurchaseDecisionCard.tsx`

**Interfaces:**
- Consumes: `addPriceQuote`, `priceQuotes` do `useTrip()` (Task 6); `BaseModal` (existente)
- Produces: `PriceQuoteModal`, `PriceQuoteHistory`

- [ ] **Step 1: Criar o modal de cotação**

Crie `src/components/modals/PriceQuoteModal.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { BaseModal } from './BaseModal';
import type { Market, PriceQuote, PurchaseItem } from '../../types/database.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (q: Omit<PriceQuote, 'id' | 'created_at' | 'is_active'>) => void;
  item: PurchaseItem | null;
  tripId: string;
}

export const PriceQuoteModal: React.FC<Props> = ({ isOpen, onClose, onSave, item, tripId }) => {
  const [market, setMarket] = useState<Market>('US');
  const [storeName, setStoreName] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [priceKind, setPriceKind] = useState<PriceQuote['price_kind']>('list');
  const [url, setUrl] = useState('');
  const [observedAt, setObservedAt] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMarket('US');
      setStoreName('');
      setPrice('');
      setPriceKind('list');
      setUrl('');
      setObservedAt(new Date().toISOString().split('T')[0]);
      setError('');
    }
  }, [isOpen]);

  if (!item) return null;

  const handleSubmit = () => {
    if (!storeName.trim()) return setError('Informe a loja.');
    if (price === '' || Number(price) <= 0) return setError('Preço deve ser maior que zero.');
    if (observedAt > new Date().toISOString().split('T')[0]) return setError('Data não pode ser futura.');

    onSave({
      trip_id: tripId,
      purchase_item_id: item.id,
      market,
      store_name: storeName.trim(),
      url: url.trim() || undefined,
      price: Number(price),
      currency: market === 'US' ? 'USD' : 'BRL',
      price_kind: priceKind,
      includes_tax: market === 'BR',
      observed_at: observedAt,
      source: 'manual',
    });
    onClose();
  };

  const field = 'w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white';

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={`Cotação — ${item.product_name}`}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['US', 'BR'] as Market[]).map(m => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                market === m ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {m === 'US' ? 'Preço EUA (sem imposto)' : 'Preço Brasil (com imposto)'}
            </button>
          ))}
        </div>

        <input className={field} placeholder="Loja" value={storeName} onChange={e => setStoreName(e.target.value)} />
        <input
          className={field}
          type="number"
          step="0.01"
          placeholder={market === 'US' ? 'Preço em US$' : 'Preço em R$'}
          value={price}
          onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
        />
        <select className={field} value={priceKind} onChange={e => setPriceKind(e.target.value as PriceQuote['price_kind'])}>
          <option value="list">Preço de tabela</option>
          <option value="promo">Promoção</option>
          <option value="used">Usado</option>
          <option value="refurbished">Recondicionado</option>
        </select>
        <input className={field} placeholder="Link (opcional)" value={url} onChange={e => setUrl(e.target.value)} />
        <input className={field} type="date" value={observedAt} onChange={e => setObservedAt(e.target.value)} />

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <button onClick={handleSubmit} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition">
          Salvar cotação
        </button>
        <p className="text-[11px] text-slate-500">
          A cotação anterior deste mercado fica arquivada, não é apagada.
        </p>
      </div>
    </BaseModal>
  );
};
```

Antes de escrever, confirme a assinatura de `BaseModal` com `grep -n "interface\|Props" src/components/modals/BaseModal.tsx` e ajuste os nomes das props se divergirem de `isOpen`/`onClose`/`title`.

- [ ] **Step 2: Criar o histórico de preços**

Crie `src/features/purchases/PriceQuoteHistory.tsx`:

```tsx
import React from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Market, PriceQuote } from '../../types/database.types';

interface Props {
  quotes: PriceQuote[];
  itemId: string;
  market: Market;
}

export const PriceQuoteHistory: React.FC<Props> = ({ quotes, itemId, market }) => {
  const series = quotes
    .filter(q => q.purchase_item_id === itemId && q.market === market)
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at))
    .map(q => ({ data: q.observed_at.slice(5), preco: q.price, loja: q.store_name }));

  if (series.length < 2) {
    return <p className="text-[11px] text-slate-500">Registre ao menos duas cotações para ver a tendência.</p>;
  }

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series}>
          <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11 }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Line type="monotone" dataKey="preco" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

- [ ] **Step 3: Ligar o modal e o histórico na view**

Em `src/features/purchases/PurchasesView.tsx`:

1. Importe `PriceQuoteModal` e adicione o estado `const [quoteItem, setQuoteItem] = useState<PurchaseItem | null>(null);`
2. Troque o `onResearch={handleOpenEditPurchase}` do card por `onResearch={setQuoteItem}`
3. Renderize o modal ao lado dos outros:

```tsx
      <PriceQuoteModal
        isOpen={quoteItem !== null}
        onClose={() => setQuoteItem(null)}
        onSave={addPriceQuote}
        item={quoteItem}
        tripId={activeTrip.id}
      />
```

4. Inclua `addPriceQuote` e `priceQuotes` na desestruturação de `useTrip()`.

Em `PurchaseDecisionCard.tsx`, dentro do bloco expandido, acima de `<PurchaseBreakdown …/>`, adicione o histórico e um botão de nova cotação. A prop `quotes: PriceQuote[]` entra na interface `Props`, e a view passa `quotes={priceQuotes}`:

```tsx
              <PriceQuoteHistory quotes={quotes} itemId={item.id} market="US" />
              <button
                onClick={() => onResearch(item)}
                className="w-full mt-2 mb-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] transition"
              >
                Registrar nova cotação
              </button>
```

- [ ] **Step 4: Verificar no navegador**

Run: `npm run dev`

Registre uma cotação US de US$ 1.299 para o iPhone. Expected: o card recalcula e a economia sobe; ao expandir, o gráfico mostra dois pontos (1399 → 1299).

- [ ] **Step 5: Confirmar build, lint e testes**

Run: `npm test && npm run build && npm run lint`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/PriceQuoteModal.tsx src/features/purchases/PriceQuoteHistory.tsx src/features/purchases/PurchasesView.tsx src/features/purchases/PurchaseDecisionCard.tsx
git commit -m "Add manual price quote entry and price history chart"
```

---

### Task 9: Parâmetros e painel de cota

**Files:**
- Create: `src/components/modals/AssumptionsModal.tsx`
- Create: `src/features/purchases/QuotaAllocationPanel.tsx`
- Modify: `src/features/purchases/PurchasesView.tsx`

**Interfaces:**
- Consumes: `assumptions`, `updateAssumptions`, `purchaseDecisions`, `participants` do `useTrip()` (Task 6); `validateAssumptions` (Task 2)
- Produces: `AssumptionsModal`, `QuotaAllocationPanel`

- [ ] **Step 1: Criar o modal de parâmetros**

Crie `src/components/modals/AssumptionsModal.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { BaseModal } from './BaseModal';
import type { PurchaseAssumptions } from '../../types/database.types';
import { validateAssumptions } from '../../services/purchase/purchaseAssumptions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  assumptions: PurchaseAssumptions;
  onSave: (patch: Partial<PurchaseAssumptions>) => void;
}

const FIELDS: Array<{ key: keyof PurchaseAssumptions; label: string; hint: string }> = [
  { key: 'usd_brl_rate', label: 'Câmbio USD/BRL', hint: 'cotação usada em toda conversão' },
  { key: 'default_sales_tax_pct', label: 'Sales tax padrão (%)', hint: 'usada quando o estado é desconhecido' },
  { key: 'card_iof_pct', label: 'IOF do cartão (%)', hint: '3,38 no crédito internacional' },
  { key: 'card_spread_pct', label: 'Spread do cartão (%)', hint: '0 em Wise/Inter, ~4 em banco tradicional' },
  { key: 'customs_quota_usd_per_person', label: 'Cota por pessoa (US$)', hint: 'US$ 1.000 na chegada aérea' },
  { key: 'customs_excess_tax_pct', label: 'Imposto sobre excedente (%)', hint: '50% sobre o que passa da cota' },
  { key: 'safety_margin_pct', label: 'Margem de segurança (%)', hint: 'abaixo disso o veredito é indiferente' },
];

export const AssumptionsModal: React.FC<Props> = ({ isOpen, onClose, assumptions, onSave }) => {
  const [draft, setDraft] = useState<PurchaseAssumptions>(assumptions);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDraft(assumptions);
      setErrors([]);
    }
  }, [isOpen, assumptions]);

  const handleSubmit = () => {
    const found = validateAssumptions(draft);
    if (found.length > 0) return setErrors(found);
    onSave(draft);
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Parâmetros de cálculo">
      <div className="space-y-3">
        {FIELDS.map(f => (
          <div key={String(f.key)}>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">{f.label}</label>
            <input
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
              type="number"
              step="0.01"
              value={String(draft[f.key] ?? '')}
              onChange={e => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
            />
            <p className="text-[10px] text-slate-500 mt-0.5">{f.hint}</p>
          </div>
        ))}

        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Fonte do câmbio</label>
          <input
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
            value={draft.rate_source}
            onChange={e => setDraft({ ...draft, rate_source: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Referência legal da cota</label>
          <textarea
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
            rows={2}
            value={draft.legal_reference ?? ''}
            onChange={e => setDraft({ ...draft, legal_reference: e.target.value })}
          />
          <p className="text-[10px] text-slate-500 mt-0.5">
            Anote a norma e a data em que você conferiu — ela aparece nas premissas de cada decisão.
          </p>
        </div>

        {errors.length > 0 && (
          <ul className="space-y-1">
            {errors.map((e, i) => <li key={i} className="text-xs text-rose-400">{e}</li>)}
          </ul>
        )}

        <button onClick={handleSubmit} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition">
          Salvar parâmetros
        </button>
      </div>
    </BaseModal>
  );
};
```

- [ ] **Step 2: Criar o painel de cota**

Crie `src/features/purchases/QuotaAllocationPanel.tsx`:

```tsx
import React from 'react';
import type { Participant } from '../../types/database.types';
import type { PurchaseDecision } from '../../types/purchase.types';

interface Props {
  decisions: PurchaseDecision[];
  participants: Participant[];
}

export const QuotaAllocationPanel: React.FC<Props> = ({ decisions, participants }) => {
  const owners = new Map<string, { total: number; quota: number; excedente: number; imposto: number }>();

  for (const d of decisions) {
    const q = d.quota;
    if (q.total_pessoa_usd === 0 && q.imposto_do_item_usd === 0) continue;
    const current = owners.get(q.quota_owner_id) ?? {
      total: q.total_pessoa_usd,
      quota: q.quota_usd,
      excedente: q.excedente_usd,
      imposto: 0,
    };
    current.imposto += q.imposto_do_item_usd;
    owners.set(q.quota_owner_id, current);
  }

  if (owners.size === 0) return null;

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">Cota alfandegária por participante</h3>
        <p className="text-[11px] text-slate-500">
          A cota é individual e não se soma entre viajantes. Um bem acima do limite gera excedente
          mesmo que outra pessoa tenha folga.
        </p>
      </div>

      {[...owners.entries()].map(([ownerId, o]) => {
        const nome = participants.find(p => p.id === ownerId)?.full_name ?? ownerId;
        const pct = o.quota > 0 ? Math.min(100, Math.round((o.total / o.quota) * 100)) : 100;
        const estourou = o.excedente > 0;

        return (
          <div key={ownerId} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold text-slate-200">{nome}</span>
              <span className={estourou ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                US$ {o.total.toFixed(2)} / US$ {o.quota.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${estourou ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
            </div>
            {estourou && (
              <p className="text-[11px] text-rose-400">
                Excedente de US$ {o.excedente.toFixed(2)} — imposto projetado US$ {o.imposto.toFixed(2)}
              </p>
            )}
            {!estourou && (
              <p className="text-[11px] text-emerald-400">Folga de US$ {(o.quota - o.total).toFixed(2)}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 3: Ligar os dois na view**

Em `src/features/purchases/PurchasesView.tsx`:

1. Adicione o estado e inclua `assumptions` e `updateAssumptions` na desestruturação de `useTrip()`:

```tsx
  const [isAssumptionsOpen, setIsAssumptionsOpen] = useState(false);
```

2. No cabeçalho da sub-aba de compras, envolva o botão "Nova Compra" para que os dois fiquem lado a lado:

```tsx
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAssumptionsOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Parâmetros
              </button>
              <button
                onClick={handleOpenAddPurchase}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Nova Compra
              </button>
            </div>
```

Adicione `SlidersHorizontal` ao import de `lucide-react`.

3. Acima da grade de cards, insira o painel de cota:

```tsx
          <QuotaAllocationPanel decisions={purchaseDecisions} participants={participants} />
```

4. Renderize o modal junto dos outros:

```tsx
      <AssumptionsModal
        isOpen={isAssumptionsOpen}
        onClose={() => setIsAssumptionsOpen(false)}
        assumptions={assumptions}
        onSave={updateAssumptions}
      />
```

- [ ] **Step 4: Verificar no navegador**

Run: `npm run dev`

Expected: o painel mostra Pedro em vermelho, US$ 2.214,58 / US$ 1.000, com excedente US$ 1.214,58 e imposto US$ 607,29. Alterar o câmbio para 6,00 nos Parâmetros recalcula todos os cards na hora.

- [ ] **Step 5: Confirmar build e lint**

Run: `npm test && npm run build && npm run lint`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/AssumptionsModal.tsx src/features/purchases/QuotaAllocationPanel.tsx src/features/purchases/PurchasesView.tsx
git commit -m "Add calculation parameters modal and customs quota panel"
```

---

### Task 10: Edge Function de pesquisa de preços

**Files:**
- Create: `supabase/functions/price-research/index.ts`
- Create: `supabase/functions/price-research/gemini.ts`
- Create: `supabase/functions/price-research/types.ts`

**Interfaces:**
- Consumes: tabelas `ai_provider_configs`, `ai_usage_logs`, função `is_tenant_member` (já no banco)
- Produces: endpoint `POST /functions/v1/price-research`; tipo `PriceQuoteCandidate` = `{ market, store_name, price, currency, price_kind, url, observed_at, confidence, source_note }`

- [ ] **Step 1: Definir o contrato**

Crie `supabase/functions/price-research/types.ts`:

```ts
export interface PriceResearchRequest {
  trip_id: string;
  purchase_item_id: string;
  product_name: string;
  brand?: string;
  model_hint?: string;
  markets: Array<'US' | 'BR'>;
}

export interface PriceQuoteCandidate {
  market: 'US' | 'BR';
  store_name: string;
  price: number;
  currency: 'USD' | 'BRL';
  price_kind: 'list' | 'promo' | 'used' | 'refurbished';
  url?: string;
  observed_at: string;
  confidence: 'high' | 'medium' | 'low';
  source_note?: string;
}

export interface PriceResearchResponse {
  candidates: PriceQuoteCandidate[];
  usage: { tokens_in: number; tokens_out: number; cost_usd: number };
}
```

- [ ] **Step 2: Escrever o adaptador do Gemini**

Crie `supabase/functions/price-research/gemini.ts`:

```ts
import type { PriceQuoteCandidate, PriceResearchRequest } from './types.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          market: { type: 'string', enum: ['US', 'BR'] },
          store_name: { type: 'string' },
          price: { type: 'number' },
          currency: { type: 'string', enum: ['USD', 'BRL'] },
          price_kind: { type: 'string', enum: ['list', 'promo', 'used', 'refurbished'] },
          url: { type: 'string' },
          observed_at: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          source_note: { type: 'string' },
        },
        required: ['market', 'store_name', 'price', 'currency', 'price_kind', 'confidence'],
      },
    },
  },
  required: ['candidates'],
};

export async function searchPrices(
  req: PriceResearchRequest,
  apiKey: string,
  model: string,
  temperature: number,
): Promise<{ candidates: PriceQuoteCandidate[]; tokensIn: number; tokensOut: number }> {
  const today = new Date().toISOString().split('T')[0];
  const produto = [req.brand, req.product_name, req.model_hint].filter(Boolean).join(' ');

  const prompt = [
    `Pesquise o preço atual de: ${produto}.`,
    `Mercados: ${req.markets.join(' e ')}. US = varejo nos Estados Unidos, preço SEM sales tax.`,
    `BR = varejo no Brasil, preço COM impostos, em reais.`,
    `Devolva até 3 candidatos por mercado, de lojas reconhecidas, com a URL da fonte.`,
    `Use ${today} como observed_at quando a fonte não informar a data.`,
    `Não invente preço: se não encontrar, devolva a lista vazia.`,
  ].join('\n');

  const response = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini respondeu ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"candidates":[]}';

  let parsed: { candidates?: PriceQuoteCandidate[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Resposta do Gemini não é JSON válido: ${text.slice(0, 200)}`);
  }

  return {
    candidates: (parsed.candidates ?? []).map(c => ({ ...c, observed_at: c.observed_at || today })),
    tokensIn: data?.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
```

- [ ] **Step 3: Escrever a função**

Crie `supabase/functions/price-research/index.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { searchPrices } from './gemini.ts';
import type { PriceResearchRequest } from './types.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sessão ausente.' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Sessão inválida.' }, 401);

    const body = (await request.json()) as PriceResearchRequest;
    if (!body.trip_id || !body.product_name || !body.markets?.length) {
      return json({ error: 'Requisição incompleta.' }, 400);
    }

    // O trip_id só é visível se o usuário for membro do tenant — a própria RLS decide.
    const { data: trip } = await supabase
      .from('trips')
      .select('id, tenant_id')
      .eq('id', body.trip_id)
      .maybeSingle();
    if (!trip) return json({ error: 'Viagem não encontrada ou sem acesso.' }, 403);

    const { data: config } = await supabase
      .from('ai_provider_configs')
      .select('*')
      .eq('tenant_id', trip.tenant_id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!config) return json({ error: 'Nenhum provedor de IA ativo configurado.' }, 400);

    const today = new Date().toISOString().split('T')[0];
    const monthStart = `${today.slice(0, 7)}-01`;

    const { data: usage } = await supabase
      .from('ai_usage_logs')
      .select('tokens_input, tokens_output, estimated_cost_usd, timestamp')
      .eq('tenant_id', trip.tenant_id)
      .gte('timestamp', monthStart);

    const rows = usage ?? [];
    const tokensHoje = rows
      .filter(r => String(r.timestamp).startsWith(today))
      .reduce((s, r) => s + (r.tokens_input ?? 0) + (r.tokens_output ?? 0), 0);
    const custoMes = rows.reduce((s, r) => s + Number(r.estimated_cost_usd ?? 0), 0);

    if (config.daily_token_limit && tokensHoje >= config.daily_token_limit) {
      return json(
        { error: `Limite diário de ${config.daily_token_limit} tokens atingido. Reseta amanhã.` },
        429,
      );
    }
    if (config.monthly_budget_usd && custoMes >= Number(config.monthly_budget_usd)) {
      return json(
        { error: `Orçamento mensal de US$ ${config.monthly_budget_usd} esgotado. Reseta no dia 1º.` },
        429,
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'GEMINI_API_KEY não configurada.' }, 500);

    const started = Date.now();
    const result = await searchPrices(body, apiKey, config.model_name, Number(config.temperature ?? 0.2));
    const elapsed = Date.now() - started;

    // Gemini Flash: US$ 0,075 por 1M de entrada, US$ 0,30 por 1M de saída.
    const cost = (result.tokensIn / 1_000_000) * 0.075 + (result.tokensOut / 1_000_000) * 0.3;

    await supabase.from('ai_usage_logs').insert({
      tenant_id: trip.tenant_id,
      user_name: user.email ?? user.id,
      function_name: 'price_research',
      provider: 'gemini',
      model: config.model_name,
      tokens_input: result.tokensIn,
      tokens_output: result.tokensOut,
      estimated_cost_usd: Number(cost.toFixed(6)),
      timestamp: new Date().toISOString(),
    });

    return json({
      candidates: result.candidates,
      usage: {
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        cost_usd: Number(cost.toFixed(6)),
        elapsed_ms: elapsed,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, 500);
  }
});
```

- [ ] **Step 4: Configurar o segredo e publicar**

```bash
supabase secrets set GEMINI_API_KEY=<sua-chave> --project-ref bkrqhividgljticgjrem
supabase functions deploy price-research --project-ref bkrqhividgljticgjrem
```

- [ ] **Step 5: Testar o caminho de erro primeiro**

```bash
curl -i -X POST \
  https://bkrqhividgljticgjrem.supabase.co/functions/v1/price-research \
  -H 'Content-Type: application/json' \
  -d '{"trip_id":"x","product_name":"y","markets":["US"]}'
```

Expected: `401` com `{"error":"Sessão ausente."}` — confirma que a função não responde sem JWT.

- [ ] **Step 6: Testar o caminho feliz**

Pegue um token válido no console do navegador com o app logado:

```js
(await window.supabase?.auth.getSession())?.data.session?.access_token
```

Se `window.supabase` não existir, exponha temporariamente o client em `supabaseClient.ts` ou copie o token de `localStorage` (chave que começa com `sb-`). Então:

```bash
curl -s -X POST \
  https://bkrqhividgljticgjrem.supabase.co/functions/v1/price-research \
  -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{"trip_id":"<UUID_DA_VIAGEM>","purchase_item_id":"pur-iphone-16","product_name":"iPhone 17 Pro Max 512GB","brand":"Apple","markets":["US","BR"]}' | jq
```

Expected: JSON com `candidates` preenchido e `usage.cost_usd` maior que zero. Confirme que a linha entrou:

```bash
supabase db query --linked "select function_name, tokens_input, tokens_output, estimated_cost_usd from ai_usage_logs order by timestamp desc limit 1"
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/price-research
git commit -m "Add price-research Edge Function backed by Gemini with search grounding"
```

---

### Task 11: Revisão humana dos candidatos da IA

**Files:**
- Create: `src/services/purchase/priceResearchClient.ts`
- Create: `src/components/modals/PriceResearchModal.tsx`
- Modify: `src/features/purchases/PurchasesView.tsx`
- Modify: `src/features/purchases/PurchaseDecisionCard.tsx`

**Interfaces:**
- Consumes: Edge Function (Task 10); `addPriceQuote` (Task 6); `supabase` de `src/services/supabaseClient.ts`
- Produces: `researchPrices(input): Promise<PriceResearchResult>`, componente `PriceResearchModal`

- [ ] **Step 1: Criar o cliente**

Crie `src/services/purchase/priceResearchClient.ts`:

```ts
import { supabase } from '../supabaseClient';
import type { Market } from '../../types/database.types';

export interface PriceQuoteCandidate {
  market: Market;
  store_name: string;
  price: number;
  currency: 'USD' | 'BRL';
  price_kind: 'list' | 'promo' | 'used' | 'refurbished';
  url?: string;
  observed_at: string;
  confidence: 'high' | 'medium' | 'low';
  source_note?: string;
}

export interface PriceResearchResult {
  candidates: PriceQuoteCandidate[];
  error?: string;
}

export async function researchPrices(input: {
  trip_id: string;
  purchase_item_id: string;
  product_name: string;
  brand?: string;
  markets: Market[];
}): Promise<PriceResearchResult> {
  try {
    const { data, error } = await supabase.functions.invoke('price-research', { body: input });

    if (error) {
      return { candidates: [], error: 'Pesquisa automática indisponível. Registre o preço manualmente.' };
    }
    if (data?.error) {
      return { candidates: [], error: data.error };
    }
    return { candidates: data?.candidates ?? [] };
  } catch {
    return { candidates: [], error: 'Não foi possível falar com a pesquisa automática.' };
  }
}
```

- [ ] **Step 2: Criar o modal de revisão**

Crie `src/components/modals/PriceResearchModal.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { BaseModal } from './BaseModal';
import type { PriceQuote, PurchaseItem } from '../../types/database.types';
import { researchPrices } from '../../services/purchase/priceResearchClient';
import type { PriceQuoteCandidate } from '../../services/purchase/priceResearchClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: PurchaseItem | null;
  tripId: string;
  userId: string;
  onAccept: (q: Omit<PriceQuote, 'id' | 'created_at' | 'is_active'>) => void;
}

export const PriceResearchModal: React.FC<Props> = ({ isOpen, onClose, item, tripId, userId, onAccept }) => {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<PriceQuoteCandidate[]>([]);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isOpen || !item) return;

    setLoading(true);
    setError('');
    setCandidates([]);
    setAccepted(new Set());

    researchPrices({
      trip_id: tripId,
      purchase_item_id: item.id,
      product_name: item.product_name,
      brand: item.brand,
      markets: ['US', 'BR'],
    }).then(result => {
      setLoading(false);
      if (result.error) setError(result.error);
      else setCandidates(result.candidates);
    });
  }, [isOpen, item, tripId]);

  if (!item) return null;

  const handleAccept = (candidate: PriceQuoteCandidate, index: number) => {
    onAccept({
      trip_id: tripId,
      purchase_item_id: item.id,
      market: candidate.market,
      store_name: candidate.store_name,
      url: candidate.url,
      price: candidate.price,
      currency: candidate.currency,
      price_kind: candidate.price_kind,
      includes_tax: candidate.market === 'BR',
      observed_at: candidate.observed_at,
      source: 'ai_search',
      source_note: candidate.source_note ?? candidate.url,
      confidence: candidate.confidence,
      validated_by: userId,
      validated_at: new Date().toISOString(),
    });
    setAccepted(prev => new Set(prev).add(index));
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={`Pesquisa de preços — ${item.product_name}`}>
      <div className="space-y-3">
        <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-px" />
          Resultados sugeridos pela IA. Nada é salvo até você aceitar — confira a loja, o preço e a fonte.
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Pesquisando…
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
            {error}
          </div>
        )}

        {!loading && !error && candidates.length === 0 && (
          <p className="text-xs text-slate-500 py-6 text-center">
            Nenhum preço encontrado. Registre manualmente.
          </p>
        )}

        {candidates.map((c, i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{c.store_name}</div>
                <div className="text-[11px] text-slate-500">
                  {c.market === 'US' ? 'EUA' : 'Brasil'} • {c.price_kind} • {c.observed_at} • confiança {c.confidence}
                </div>
              </div>
              <div className="text-sm font-bold text-emerald-400 shrink-0">
                {c.currency === 'USD' ? 'US$' : 'R$'} {c.price.toFixed(2)}
              </div>
            </div>

            {c.url && (
              <a href={c.url} target="_blank" rel="noreferrer" className="block text-[10px] text-blue-400 truncate hover:underline">
                {c.url}
              </a>
            )}

            <button
              onClick={() => handleAccept(c, i)}
              disabled={accepted.has(i)}
              className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition ${
                accepted.has(i)
                  ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {accepted.has(i) ? 'Aceita ✓' : 'Aceitar como cotação'}
            </button>
          </div>
        ))}
      </div>
    </BaseModal>
  );
};
```

- [ ] **Step 3: Ligar na view**

Em `PurchasesView.tsx`, adicione `const [researchItem, setResearchItem] = useState<PurchaseItem | null>(null);`, importe `useAuth` de `../../context/AuthContext` para obter o `user.id`, e renderize:

```tsx
      <PriceResearchModal
        isOpen={researchItem !== null}
        onClose={() => setResearchItem(null)}
        item={researchItem}
        tripId={activeTrip.id}
        userId={user?.id ?? ''}
        onAccept={addPriceQuote}
      />
```

Em `PurchaseDecisionCard.tsx`, adicione a prop `onAiResearch: (item: PurchaseItem) => void` e um botão "Pesquisar com IA" ao lado de "Registrar nova cotação", com `onClick={() => onAiResearch(item)}`.

- [ ] **Step 4: Verificar o caminho degradado**

Run: `npm run dev`

Desligue a rede (DevTools → Network → Offline) e clique em "Pesquisar com IA". Expected: banner âmbar "Pesquisa automática indisponível. Registre o preço manualmente.", e o modal de cotação manual segue funcionando normalmente.

- [ ] **Step 5: Verificar o caminho feliz**

Religue a rede e repita. Expected: candidatos listados; aceitar um cria a cotação e o card recalcula o veredito.

- [ ] **Step 6: Confirmar build, lint e testes**

Run: `npm test && npm run build && npm run lint`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
git add src/services/purchase/priceResearchClient.ts src/components/modals/PriceResearchModal.tsx src/features/purchases/PurchasesView.tsx src/features/purchases/PurchaseDecisionCard.tsx
git commit -m "Add AI price research with mandatory human validation"
```

---

### Task 12: Congelar a decisão na compra

**Files:**
- Modify: `src/context/TripContext.tsx`
- Modify: `src/features/purchases/PurchaseDecisionCard.tsx`
- Modify: `src/components/modals/PurchaseModal.tsx`
- Test: `src/services/purchase/purchaseDecisionEngine.test.ts`

**Interfaces:**
- Consumes: `purchaseDecisions`, `updatePurchase` (Task 6)
- Produces: no `useTrip()` — `markPurchaseBought(id: string, actualPaidUsd: number): void`

- [ ] **Step 1: Escrever o teste que falha**

Acrescente ao final de `src/services/purchase/purchaseDecisionEngine.test.ts`:

```ts
describe('decidePurchases — snapshot congelado', () => {
  it('devolve o snapshot em vez de recalcular quando o item já foi comprado', () => {
    const snapshot = decidePurchases(cestaDoPedro())[0];

    const congelado = decidePurchases({
      ...cestaDoPedro(),
      items: [
        { ...purchase({ gift_card_id: 'gc-apple-01' }), status: 'bought', decision_snapshot: snapshot },
      ],
      // câmbio muito diferente: se recalculasse, o número mudaria
      assumptions: { ...assumptions, usd_brl_rate: 9.99 },
    })[0];

    expect(congelado.us.desembarcado_brl).toBe(snapshot.us.desembarcado_brl);
    expect(congelado.economia_brl).toBe(snapshot.economia_brl);
  });

  it('segue recalculando enquanto o item está planejado', () => {
    const original = decidePurchases(cestaDoPedro())[0];
    const recalculado = decidePurchases({
      ...cestaDoPedro(),
      assumptions: { ...assumptions, usd_brl_rate: 9.99 },
    })[0];

    expect(recalculado.us.desembarcado_brl).not.toBe(original.us.desembarcado_brl);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test`
Expected: FAIL no primeiro caso — o motor ainda recalcula tudo.

- [ ] **Step 3: Implementar no motor**

Em `src/services/purchase/purchaseDecisionEngine.ts`, dentro do `return items.map(item => {`, como primeira instrução do callback:

```ts
    // Item comprado exibe o que foi decidido, não o recálculo de hoje (RN-18).
    if (item.decision_snapshot && item.status === 'bought') {
      return item.decision_snapshot;
    }
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Gravar o snapshot no contexto**

Em `src/context/TripContext.tsx`, adicione à interface `TripContextType`:

```ts
  markPurchaseBought: (id: string, actualPaidUsd: number) => void;
```

E no provider, depois de `deletePurchase`:

```ts
  const markPurchaseBought = (id: string, actualPaidUsd: number) => {
    const snapshot = purchaseDecisions.find(d => d.purchase_item_id === id);
    updatePurchase(id, {
      status: 'bought',
      actual_paid_usd: actualPaidUsd,
      decision_snapshot: snapshot,
    });
  };
```

Inclua `markPurchaseBought,` no objeto do Provider.

- [ ] **Step 6: Expor na UI**

Em `PurchaseDecisionCard.tsx`, adicione a prop `onMarkBought: (id: string, paid: number) => void`. Quando `item.status === 'planned'`, mostre um botão "Marcar como comprado" que pergunta o valor pago:

```tsx
      {item.status === 'planned' && decision.verdict !== 'DADOS_INSUFICIENTES' && (
        <button
          onClick={() => {
            const entrada = prompt('Valor efetivamente pago, em US$:', String(decision.us.liquido_usd));
            if (entrada === null) return;
            const valor = Number(entrada);
            if (!Number.isFinite(valor) || valor < 0) return;
            onMarkBought(item.id, valor);
          }}
          className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
        >
          Marcar como comprado
        </button>
      )}

      {item.status === 'bought' && (
        <div className="text-[11px] text-emerald-400 font-semibold">
          Decidido em {decision.computed_at} • pago US$ {(item.actual_paid_usd ?? 0).toFixed(2)}
        </div>
      )}
```

Passe `onMarkBought={markPurchaseBought}` na view.

- [ ] **Step 7: Adicionar o override manual ao formulário (CA-12)**

Em `src/components/modals/PurchaseModal.tsx`, acrescente os dois campos e a validação que os liga.

Estado, junto dos demais `useState` do componente:

```tsx
  const [verdictOverride, setVerdictOverride] = useState<PurchaseVerdict | ''>('');
  const [overrideReason, setOverrideReason] = useState('');
```

No `useEffect` que carrega `initialData`, junto das outras atribuições:

```tsx
      setVerdictOverride(initialData.verdict_override ?? '');
      setOverrideReason(initialData.override_reason ?? '');
```

E no ramo de criação (quando `initialData` é `null`), limpe os dois:

```tsx
      setVerdictOverride('');
      setOverrideReason('');
```

Campos no formulário, antes do botão de salvar:

```tsx
        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Sobrepor o veredito do motor (opcional)
          </label>
          <select
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
            value={verdictOverride}
            onChange={e => setVerdictOverride(e.target.value as PurchaseVerdict | '')}
          >
            <option value="">Usar a recomendação do motor</option>
            <option value="COMPRAR_EUA">Comprar nos EUA</option>
            <option value="COMPRAR_BRASIL">Comprar no Brasil</option>
            <option value="AGUARDAR_PRECO">Aguardar preço</option>
          </select>
        </div>

        {verdictOverride !== '' && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Motivo da decisão manual
            </label>
            <textarea
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
              rows={2}
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="Ex.: prefiro garantia nacional"
            />
          </div>
        )}
```

Na função de submissão, antes de montar o objeto salvo:

```tsx
    if (verdictOverride !== '' && !overrideReason.trim()) {
      setError('Explique o motivo ao sobrepor a recomendação do motor.');
      return;
    }
```

E no objeto passado a `onSave`:

```tsx
      verdict_override: verdictOverride === '' ? undefined : verdictOverride,
      override_reason: verdictOverride === '' ? undefined : overrideReason.trim(),
```

Importe o tipo: `import type { PurchaseVerdict } from '../../types/purchase.types';`. Se o `PurchaseModal` ainda não tiver um estado `error` e um parágrafo que o exiba, adicione ambos seguindo o padrão do `PriceQuoteModal` da Task 8.

- [ ] **Step 8: Verificar o bloqueio no navegador**

Run: `npm run dev`

Edite um item, escolha "Comprar no Brasil" no override e deixe o motivo vazio. Expected: o salvamento é bloqueado com a mensagem "Explique o motivo ao sobrepor a recomendação do motor." Preencha o motivo, salve, e o card passa a exibir o badge âmbar com o texto do motivo ao lado.

- [ ] **Step 9: Verificar no navegador**

Run: `npm run dev`

Marque o iPhone como comprado. Depois abra Parâmetros e mude o câmbio para 7,00. Expected: os outros cards mudam de valor; o card do iPhone **não** muda — mostra o snapshot e a data da decisão.

- [ ] **Step 10: Confirmar tudo**

Run: `npm test && npm run build && npm run lint`
Expected: testes PASS, build limpo, lint com 2 warnings conhecidos.

- [ ] **Step 11: Commit**

```bash
git add src/context/TripContext.tsx src/features/purchases/PurchaseDecisionCard.tsx src/features/purchases/PurchasesView.tsx src/components/modals/PurchaseModal.tsx src/services/purchase/purchaseDecisionEngine.ts src/services/purchase/purchaseDecisionEngine.test.ts
git commit -m "Freeze the decision snapshot on purchase and add manual verdict override"
```

---

## Cobertura dos critérios de aceite

| Critério | Task |
|---|---|
| CA-01 veredito, economia R$ e % no card | 7 |
| CA-02 regressão do iPhone com cota | 5 |
| CA-03 mesma conta sem excedente | 5 |
| CA-04 `DADOS_INSUFICIENTES` nomeando o que falta | 5, 7 |
| CA-05 soma dos impostos exata | 4 |
| CA-06 bem indivisível + sugestão de rebalanceamento | 4 |
| CA-07 mudar câmbio recalcula tudo | 9 |
| CA-08 Edge Function fora do ar não derruba nada | 11 |
| CA-09 limite de token bloqueia antes de gastar | 10 |
| CA-10 candidato da IA exige validação humana | 11 |
| CA-11 snapshot congela a decisão | 12 |
| CA-12 override exige razão | 12, Steps 7-8 |

Além dos critérios de aceite, o alerta `LUGGAGE_NO_SPACE` da seção 3.5 do spec é emitido na Task 5 e recebe as malas da viagem na Task 6.
