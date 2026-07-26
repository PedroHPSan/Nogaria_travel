# Motor de Decisão de Compras — EUA x Brasil

**Data:** 2026-07-26
**Status:** aprovado para planejamento
**Escopo:** Fase 1 do módulo de compras — motor determinístico de decisão, com pesquisa de preços assistida por IA.

---

## 1. Objetivo

Transformar o módulo de compras de uma lista de desejos em um motor que responde, item a item, com número e justificativa: **vale comprar nos EUA ou esperar e comprar no Brasil?**

Hoje o módulo captura `price_found_usd` e `brl_equivalent_price` e não faz nada com eles. `estimated_savings_pct` existe apenas no seed — nenhuma linha de código o calcula. A decisão que mais pesa financeiramente na viagem é tomada fora do sistema.

O motor precisa considerar o que uma comparação ingênua de preços ignora: sales tax americano, IOF e spread do cartão, benefício efetivo de gift cards, cashback, frete, e — o fator de maior impacto — **o imposto de 50% sobre o excedente da cota alfandegária**.

---

## 2. Escopo

### Entra

- Cálculo determinístico de custo desembarcado em BRL para o lado EUA
- Custo de referência líquido para o lado Brasil
- Rateio de cota alfandegária entre os participantes, com itens indivisíveis
- Veredito por item com decomposição auditável linha a linha
- Histórico de cotações de preço como série temporal (append-only)
- Parâmetros de cálculo editáveis por viagem, com fonte declarada
- Edge Function de pesquisa de preços via Gemini com grounding no Google Search
- Congelamento da decisão (snapshot imutável) no momento da compra
- Testes unitários das funções de cálculo (Vitest)

### Não entra nesta fase

- Migração do `TripContext` para Supabase — compras seguem em `localStorage`
- Persistência de cotações e parâmetros no Postgres (Fase 2)
- Provedores de IA além do Gemini (a interface fica plugável)
- Upload real de comprovantes via Supabase Storage
- Rateio de despesas entre participantes (módulo 3.16, fase própria)
- Otimização automática de alocação de cota (o motor sugere, não realoca)

---

## 3. Regras de negócio

### 3.1 Cadeia de custo desembarcado (EUA)

```
  base          = price_us × quantity
− desconto      = coupon_amount_usd  ou  base × coupon_pct
= subtotal
+ sales_tax     = subtotal × alíquota(us_store_state)     -- 0 se estado sem sales tax
+ frete         = freight_usd                             -- só em purchase_channel = 'online_us'
= bruto_usd
− gift_card     = min(bruto_usd, saldo_gc) × gc.effective_savings_pct / 100
− cashback      = (bruto_usd − parcela_paga_com_gift_card) × cashback_pct
= liquido_usd
+ imposto_cota  = parcela_de_excedente × customs_excess_tax_pct / 100
= desembarcado_usd
× câmbio        × usd_brl_rate × (1 + card_iof_pct/100 + card_spread_pct/100)
= desembarcado_brl
```

**RN-01** — O benefício do gift card **reusa** `effective_savings_pct` produzido por `giftCardCalculator.ts`. O motor não recalcula desconto de gift card. Fonte de verdade única.

**RN-02** — Cashback **não** incide sobre a parcela paga com gift card. Premissa conservadora: portais de cashback normalmente não remuneram compras com gift card.

**RN-03** — IOF e spread incidem sobre o `liquido_usd` inteiro. Premissa declarada: na prática o gift card foi adquirido antes, com IOF próprio e outro câmbio. Modelar isso exigiria rastrear o câmbio de aquisição de cada gift card, o que fica para fase posterior. O efeito é **superestimar levemente o custo EUA**, empurrando o veredito para o lado cauteloso. A premissa aparece na tela.

**RN-04** — Se o saldo do gift card for menor que o `bruto_usd`, aplica-se o benefício apenas sobre o saldo real e emite-se alerta de cobertura parcial.

### 3.2 Custo de referência (Brasil)

```
  br_price (com impostos, à vista)
− br_cashback = br_price × br_cashback_pct
= br_liquido_brl
```

**RN-05** — Preços BR são registrados já com impostos (`includes_tax = true`). Preços US são registrados sem (`includes_tax = false`). O motor respeita a flag e não aplica sales tax duas vezes.

### 3.3 Cota alfandegária

**RN-06** — A cota é **individual e não cumulativa**. Um bem único de valor superior à cota não pode ser fracionado entre viajantes. Cada item pertence a exatamente um `quota_owner_id`.

**RN-07** — Cálculo por participante elegível:

```
itens        = compras cujo quota_owner_id é o participante
total_pessoa = Σ liquido_usd dos itens
excedente    = max(0, total_pessoa − customs_quota_usd_per_person)

para cada item:
    share           = liquido_usd(item) / total_pessoa
    imposto_do_item = excedente × share × customs_excess_tax_pct / 100
```

**RN-07a** — Guardas de divisão por zero. Se `total_pessoa = 0`, então `share = 0` e `imposto_do_item = 0`. Se `br_liquido_brl = 0`, então `economia_pct = 0` e o veredito é `DADOS_INSUFICIENTES` — não se calcula percentual sobre base zero.

**RN-08** — `quota_owner_id` tem default `beneficiary_id ?? target_participant_id`, e é editável.

**RN-09** — Menores são titulares de cota própria por default (`quota_eligible: true`, editável por participante). Bens de uso pessoal ficam fora da conta.

**RN-10** — Nenhum valor legal fica hardcoded. Cota, alíquota de excedente e alíquotas de sales tax são parâmetros com `legal_reference` (fonte + data da consulta).

**RN-11** — Quando um participante estoura e outro tem folga, o motor **sugere** rebalanceamento, exibindo a folga disponível. Não realoca automaticamente: o `quota_owner_id` deve refletir de quem o bem realmente é.

### 3.4 Veredito

Ordem de precedência, avaliada de cima para baixo — a primeira que casar decide:

1. `verdict_override` preenchido → usa o override
2. Falta cotação ativa de qualquer mercado → `DADOS_INSUFICIENTES`
3. Condição de queda de preço satisfeita (RN-13) → `AGUARDAR_PRECO`
4. Régua de economia abaixo

```
economia_brl = br_liquido_brl − desembarcado_brl
economia_pct = economia_brl / br_liquido_brl
m            = safety_margin_pct    (default 5)

economia_pct >  m/100   → COMPRAR_EUA
economia_pct < −m/100   → COMPRAR_BRASIL
|economia_pct| ≤ m/100  → INDIFERENTE
```

**RN-12** — `DADOS_INSUFICIENTES` sempre que faltar cotação ativa de qualquer um dos dois mercados. O motor não estima preço ausente.

**RN-13** — `AGUARDAR_PRECO` quando a série de cotações US ativa+históricas mostrar queda superior a 8% nos últimos 45 dias **e** `priority !== 'high'`.

**RN-14** — Em `INDIFERENTE`, o desempate é apresentado (não automático): `warranty_risk` alto favorece Brasil; ausência de espaço em mala favorece Brasil.

**RN-15** — `verdict_override` permite sobrepor o motor, e exige `override_reason` preenchida.

### 3.5 Alertas (acompanham o veredito, não o alteram)

| Código | Condição |
|---|---|
| `QUOTE_STALE` | cotação ativa com `observed_at` > 30 dias |
| `WARRANTY_RISK` | `warranty_risk === 'high'` |
| `LUGGAGE_NO_SPACE` | `expected_weight_kg` sem mala com `shopping_space_reserved_pct` suficiente |
| `QUOTA_EXCEEDED` | o `quota_owner_id` do item estourou a cota |
| `GIFT_CARD_PARTIAL` | saldo do gift card cobre menos que o `bruto_usd` |
| `REBALANCE_AVAILABLE` | outro participante tem folga de cota |

### 3.6 Histórico

**RN-16** — `PriceQuote` é append-only. Registrar cotação nova marca a anterior `is_active: false` e preenche `superseded_by_id`. Nada é apagado.

**RN-17** — Nenhuma cotação vinda da IA se torna ativa sem `validated_by` preenchido por um humano.

**RN-18** — Ao marcar um item como `bought`, o motor grava `decision_snapshot` — cópia imutável do `PurchaseDecision` no momento da decisão. A partir daí a UI exibe o snapshot, não o recálculo.

---

## 4. Fluxo do usuário

### 4.1 Cadastrar e decidir

1. Usuário abre **Compras** e cria um item (produto, categoria, prioridade, quantidade, beneficiário).
2. O card mostra `DADOS_INSUFICIENTES` — falta cotação.
3. Usuário registra cotação manual **ou** aciona **Pesquisar preços** (IA).
4. Se IA: modal lista candidatos com loja, preço, data e URL citada. Usuário aceita, edita ou descarta cada um.
5. Cotações aceitas viram `PriceQuote` ativas.
6. O card recalcula e exibe: **veredito + economia em R$ + %**.
7. Usuário toca em **Ver cálculo** e vê a decomposição linha a linha, com as premissas.

### 4.2 Ajustar parâmetros

1. Usuário abre **Parâmetros** na aba Compras.
2. Edita câmbio, alíquota, IOF, spread, cota, margem de segurança.
3. Todos os vereditos da viagem recalculam imediatamente.

### 4.3 Gerenciar cota

1. Painel de cota mostra uma barra por participante: consumido / US$ 1.000.
2. Quem estourou aparece em vermelho, com o imposto projetado.
3. Se houver folga em outro participante, aparece a sugestão de rebalanceamento.
4. Usuário edita o `quota_owner_id` do item, se o bem de fato for de outra pessoa.

### 4.4 Fechar a compra

1. Usuário marca o item como `bought` e informa o preço efetivamente pago.
2. O motor congela o `decision_snapshot`.
3. O card passa a exibir "decidido em DD/MM com câmbio X, economia realizada R$ Y".

---

## 5. Modelo de dados

### 5.1 `PriceQuote` (nova)

```ts
export type Market = 'US' | 'BR';

export interface PriceQuote {
  id: string;                    // crypto.randomUUID()
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
```

### 5.2 `PurchaseAssumptions` (nova)

```ts
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

Defaults: `default_sales_tax_pct: 7`, `card_iof_pct: 3.38`, `card_spread_pct: 0`, `customs_quota_usd_per_person: 1000`, `customs_excess_tax_pct: 50`, `safety_margin_pct: 5`.

### 5.3 Extensão de `PurchaseItem`

Todos opcionais, para não invalidar registros existentes:

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

### 5.4 Extensão de `Participant`

```ts
  quota_eligible?: boolean;   // default true
```

### 5.5 Tipos derivados (nunca armazenados, exceto no snapshot)

```ts
export type PurchaseVerdict =
  | 'COMPRAR_EUA' | 'COMPRAR_BRASIL' | 'INDIFERENTE'
  | 'AGUARDAR_PRECO' | 'DADOS_INSUFICIENTES';

export interface CostLine {
  label: string;       // "Sales tax (FL 7%)"
  amount_usd: number;
  parameter?: string;  // qual campo de PurchaseAssumptions gerou
}

export interface UsCostBreakdown {
  lines: CostLine[];
  bruto_usd: number;
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

export interface Premise { label: string; value: string; source: string; }
export interface DecisionAlert { code: string; severity: 'critical'|'warning'|'info'; message: string; }

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

### 5.6 Persistência

Duas chaves novas seguindo a convenção `ANTIGRAVITY_TRAVEL_PLATFORM_V1_<collection>`:

- `..._price_quotes`
- `..._purchase_assumptions`

`ai_usage_logs` vai direto ao Postgres — controle de consumo precisa ser server-side.

### 5.7 Correção de IDs

`crypto.randomUUID()` substitui `` `prefix-${Date.now()}` `` nas entidades novas **e** nas existentes do `TripContext`. A IA devolve vários candidatos no mesmo milissegundo; com o padrão atual todos colidiriam.

---

## 6. Backend

### 6.1 Edge Function `price-research`

```
POST /functions/v1/price-research
Authorization: Bearer <supabase jwt>

Request:  { trip_id, purchase_item_id, product_name, brand?, model_hint?,
            markets: ('US'|'BR')[] }
Response: { candidates: PriceQuoteCandidate[],
            usage: { tokens_in, tokens_out, cost_usd } }
```

Sequência:

1. `verify_jwt` (default) valida o token.
2. Confirma via `is_tenant_member` que o usuário pertence ao tenant da viagem.
3. Lê o `ai_provider_configs` ativo do tenant.
4. **Verifica limites antes de gastar**: soma `ai_usage_logs` do dia e do mês contra `daily_token_limit` e `monthly_budget_usd`. Estourou → 429 sem chamar o provedor.
5. Chama o Gemini com Google Search grounding e `responseSchema` estruturado.
6. Grava `ai_usage_logs` (tenant_id, trip_id, função, tokens, custo, duração).
7. Devolve candidatos **sem** `is_active` e **sem** `validated_by`.

### 6.2 Interface de provedor

```ts
export interface PriceResearchProvider {
  name: string;
  search(input: PriceResearchInput): Promise<PriceResearchResult>;
}
```

Gemini é o primeiro adaptador. Trocar de provedor é adicionar arquivo, não refatorar.

### 6.3 Segredos

`GEMINI_API_KEY` via `supabase secrets set`, lido apenas dentro da função. Nada de chave no bundle do frontend.

---

## 7. Frontend

### 7.1 Estrutura de arquivos

```
src/services/purchase/
  purchaseDecisionEngine.ts     -- cadeia de custo + veredito
  customsQuota.ts               -- rateio de cota
  purchaseAssumptions.ts        -- defaults + validação
  priceResearchClient.ts        -- chamada à Edge Function

src/features/purchases/
  PurchasesView.tsx             -- orquestra, sub-abas
  PurchaseDecisionCard.tsx      -- veredito + economia
  PurchaseBreakdown.tsx         -- decomposição auditável
  PriceQuoteHistory.tsx         -- série (recharts, já instalado)
  QuotaAllocationPanel.tsx      -- barras por participante
  PriceResearchModal.tsx        -- revisão humana dos candidatos
  AssumptionsModal.tsx          -- parâmetros
  usePurchasesState.ts          -- fatia extraída do TripContext
```

`PurchasesView.tsx` está em 308 linhas e cresceria muito além disso; a divisão acima mantém cada arquivo focado. A fatia de estado sai do `TripContext` (850 linhas) para `usePurchasesState.ts`, que o contexto compõe — o `useTrip()` continua sendo a única porta para as views.

### 7.2 Mobile-first

O veredito e a economia em R$ ficam visíveis **sem expandir**. A decomposição, as premissas e a série de preços vivem atrás de um toque. O painel de cota é uma lista vertical de barras, não uma tabela.

### 7.3 Estados de cada card

| Estado | Exibição |
|---|---|
| Sem cotação | badge cinza `DADOS_INSUFICIENTES` + CTA "registrar preço" |
| Com cotação | badge colorido + economia + "ver cálculo" |
| Cotação velha | badge + selo âmbar "preço de N dias atrás" |
| Comprado | selo "decidido em DD/MM" + snapshot congelado |
| Override | badge do veredito manual + razão + veredito original riscado |

### 7.4 Validação

Formulários mantêm o padrão manual do repositório (sem Zod nesta fase). Regras: preço > 0, quantidade ≥ 1, percentuais entre 0 e 100, `observed_at` não futura, `override_reason` obrigatória quando há override.

---

## 8. Segurança

- Chave do Gemini apenas na Edge Function, via `supabase secrets`.
- `verify_jwt` ativo; a função rejeita chamada sem sessão válida.
- Checagem de `is_tenant_member` antes de qualquer gasto de token — impede que um usuário autenticado consuma o orçamento de IA de outro tenant.
- Limites de token e orçamento verificados **antes** da chamada ao provedor.
- `ai_usage_logs` grava tenant, viagem, função e custo — consumo rastreável (requisito 3.24).
- Cotações vindas de IA nascem sem validação; só um humano as ativa (requisito 3.18).
- Códigos de gift card continuam mascarados; o motor lê apenas saldo e percentual efetivo, nunca o código.
- Dados de compras seguem em `localStorage` nesta fase — sem exposição de rede, mas também sem RLS. A migração para Postgres (Fase 2) traz a proteção por tenant.

---

## 9. Critérios de aceite

**CA-01** — Dado um item com cotação US e BR ativas, quando o card renderiza, então exibe veredito, economia em R$ e economia em %.

**CA-02** — Dado o iPhone 17 Pro Max do seed (US$ 1.399 / R$ 11.499), com US$ 600 em gift card Apple a 18% de economia efetiva, cashback 4%, sales tax 7%, IOF 3,38%, câmbio 5,62, e cesta do responsável em US$ 2.000 de líquido, então o desembarcado é R$ 9.826 e a economia é R$ 1.673 (14,5%), com veredito `COMPRAR_EUA`.

**CA-03** — Dado o mesmo item com `customs_quota_usd_per_person` alto o bastante para não gerar excedente, então o desembarcado é R$ 7.861 e a economia é R$ 3.638 (31,6%).

**CA-04** — Dado um item sem cotação de um dos mercados, então o veredito é `DADOS_INSUFICIENTES` e a tela nomeia qual cotação falta.

**CA-05** — Dado um participante com US$ 2.400 em itens e cota de US$ 1.000, então cada item recebe imposto proporcional ao seu share do excedente, e a soma dos impostos dos itens é igual a US$ 700.

**CA-06** — Dado um item único de US$ 1.500 pertencente a um participante, então ele gera excedente mesmo que outro participante tenha folga, e aparece a sugestão de rebalanceamento sem realocação automática.

**CA-07** — Dado que o usuário altera `usd_brl_rate`, então todos os vereditos da viagem recalculam sem recarregar a página.

**CA-08** — Dado que a Edge Function está indisponível, então o registro manual de cotações e o cálculo seguem funcionando, com banner informando a indisponibilidade.

**CA-09** — Dado que o limite diário de tokens foi atingido, então a chamada é bloqueada antes de atingir o provedor e a mensagem informa quando o limite reseta.

**CA-10** — Dado um candidato devolvido pela IA, então ele não se torna cotação ativa até um humano confirmar.

**CA-11** — Dado que o usuário marca um item como `bought`, então o `decision_snapshot` é gravado e alterações posteriores de parâmetros não mudam o que o card exibe.

**CA-12** — Dado um item com `verdict_override` sem `override_reason`, então o salvamento é bloqueado.

---

## 10. Testes

Vitest, apenas em funções puras — sem DOM, sem rede. Script `npm test`.

### `purchaseDecisionEngine.test.ts`

- Cadeia de custo: sem imposto; com imposto; com frete; cupom fixo; cupom percentual
- Gift card cobrindo parcial; cobrindo total; sem gift card
- Cashback excluindo a parcela do gift card (RN-02)
- Conversão com IOF e spread; com spread zero
- Veredito: cada uma das cinco saídas
- Bordas exatas da margem de segurança (`economia_pct` = ±m)
- `AGUARDAR_PRECO`: série em queda com prioridade baixa; mesma série com prioridade alta (não dispara)
- Regressão CA-02 e CA-03 com os números do seed
- Degenerados: quantidade zero, preço negativo, câmbio ausente, `br_liquido_brl` zero (divisão por zero em `economia_pct`)

### `customsQuota.test.ts`

- Ninguém estoura
- Uma pessoa estoura, soma dos impostos confere (CA-05)
- Item único acima da cota (indivisibilidade, RN-06)
- Participante sem itens
- `quota_eligible: false`
- Default de `quota_owner_id` (`beneficiary_id ?? target_participant_id`)
- Detecção de folga para sugestão de rebalanceamento

### `purchaseAssumptions.test.ts`

- Defaults aplicados quando o registro não existe
- Rejeição de câmbio zero ou negativo
- Percentuais fora de 0–100

---

## 11. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Regra de cota muda por norma | Cálculo errado silencioso | Valores são parâmetros com `legal_reference` e data de consulta; nunca hardcoded |
| Premissa do IOF sobre gift card superestima o custo EUA | Veredito conservador demais | Premissa exibida na tela; refinamento previsto quando o câmbio de aquisição do gift card for rastreado |
| Gemini devolve preço desatualizado ou de loja errada | Decisão sobre dado ruim | Validação humana obrigatória; URL da fonte exibida; alerta `QUOTE_STALE` |
| Custo de token cresce sem controle | Gasto inesperado | Limites verificados antes da chamada; log por tenant e viagem |
| Dados de compras só em `localStorage` | Bárbara não vê o que Pedro registrou | Aceito nesta fase; Fase 2 migra para Postgres. Formatos já são DB-ready |
| Dois padrões de dados convivendo após a Fase 2 | Confusão de manutenção | A fatia de compras é a primeira a migrar e serve de referência para as demais |
| `TripContext` continua crescendo | Arquivo difícil de manter | Fatia de compras extraída para `usePurchasesState.ts` |

---

## 12. Próxima execução

Invocar a skill `writing-plans` para converter este spec em plano de implementação, com a seguinte ordem de trabalho:

1. Tipos, parâmetros e correção de IDs (`crypto.randomUUID()`)
2. `customsQuota.ts` + testes
3. `purchaseDecisionEngine.ts` + testes (inclui regressão CA-02/CA-03)
4. `usePurchasesState.ts` — extração da fatia do `TripContext`
5. UI: `PurchaseDecisionCard`, `PurchaseBreakdown`, `AssumptionsModal`
6. `QuotaAllocationPanel` + `PriceQuoteHistory`
7. Edge Function `price-research` + adaptador Gemini + `PriceResearchModal`
8. Snapshot de decisão e estados de item comprado

---

## Anexo A — Revisão do repositório (2026-07-26)

Estado encontrado antes deste trabalho, para referência das fases seguintes.

### Sólido

- Auth e multi-tenant reais: `AuthContext`, `AuthGate`, `create_tenant_with_owner`, `TeamModal`, RLS em todas as tabelas, sem acesso `anon`
- Schema Postgres completo para ~19 entidades, com colunas geradas em `gift_cards`
- 19 telas e modais cobrindo todos os módulos do prompt mestre
- Deploy contínuo na Vercel, wiring de Auth URLs documentado

### Lacunas, por impacto

| # | Problema | Evidência |
|---|---|---|
| 1 | Duas fontes de verdade: schema existe, `TripContext` é 100% `localStorage` | `TripContext.tsx` inteiro |
| 2 | Módulo de compras sem lógica: `estimated_savings_pct` só no seed, `price_found_usd` nunca usado em cálculo | `grep` em `src/` |
| 3 | Sem histórico de dados: zero `created_by`, `updated_by`, `deleted_at` no schema | migrations |
| 4 | Hardcode na auditoria: timestamp literal, `nickname === 'Gabi'`, `age === 12` | `auditEngine.ts:32,99,118` |
| 5 | IA é `setTimeout` + `if/else` com texto canned; nenhum provedor chamado | `AiCopilotView.tsx` |
| 6 | Câmbio fixo em código apesar do campo `exchangeRateDate` | `exchangeRateService.ts:10` |
| 7 | Stack diverge do contrato 6.1: sem shadcn/ui, RHF, Zod, TanStack Query, Storage, Edge Functions, Realtime | `package.json` |
| 8 | Entidades ausentes do mínimo 6.3: `stores`, `payment_methods`, `budgets`, `expense_splits`, `reimbursements`, `cashback_transactions`, `gift_card_transactions`, `loyalty_transactions`, `files`, `attractions`, `notifications`, `activity_logs`, `source_volumes` | migrations |
| 9 | IDs `` `prefix-${Date.now()}` `` colidem; `DocumentFile`/`LoyaltyAccount` duplicados; `Participant.age` armazenado; zero testes | `CLAUDE.md` já documenta |

### Roadmap sugerido para as fases seguintes

- **Fase 2** — Migrar `TripContext` para Supabase, começando pela fatia de compras. Adiciona `created_by`/`updated_by`/`deleted_at`, TanStack Query, e realtime seletivo em pendências e roteiro.
- **Fase 3** — Financeiro: `budgets`, `expense_splits`, `reimbursements`, `payment_methods`, câmbio com fonte real.
- **Fase 4** — Generalizar `auditEngine` (remover hardcode) e ligar a auditoria de bagagem às compras.
- **Fase 5** — IA transversal sobre a Edge Function já existente: chat contextual, extração de PDFs, geração de roteiro.
- **Fase 6** — Storage real para comprovantes, notificações, modo viagem.
