# Nogaria Travel — Plano de Negócios e Go-to-Market

**Revisão de produto (papel: Product Owner) — 10/09/2026**

Convenção usada em todo o documento:

- **[verificado]** — fato confirmado no código deste repositório ou em fonte externa citada na seção 12.
- **[premissa]** — número ou hipótese que precisa ser validada antes de virar decisão. Nunca usar como fato.

O documento é deliberadamente curto onde o assunto é opinião e longo onde o assunto é risco jurídico ou custo. Onde a ideia original tem fraqueza, ela está apontada, não suavizada.

---

## 1. Resumo executivo

A ideia é transformar a plataforma (hoje uma ferramenta de gestão de viagem em família, com bot de WhatsApp e IA) no serviço digital de uma empresa de turismo que vende hospedagem (via resorts/timeshare em Orlando), passagens (via pontos de cartão, operação da Bárbara) e outros ativos da viagem, com a plataforma como diferencial e canal de controle.

Conclusões principais desta revisão:

1. **O modelo que fecha a conta é B2B2C, não SaaS puro.** Uma família vai a Orlando uma vez a cada vários anos; assinatura mensal para família tem churn estrutural. A plataforma deve vir **incluída no pacote de viagem** vendido pela agência, e ser vendida como assinatura só para **outras agências/agentes** (issue #45 já prevê isso).
2. **A hospedagem via RCI, como descrita, não pode ser revendida.** Os termos do RCI proíbem expressamente uso comercial (aluguel ou venda) de trocas confirmadas e de Guest Certificates, com cancelamento da associação **[verificado]**. O que é permitido, com ressalvas, é alugar semanas reservadas com pontos **próprios** no resort de origem, e mesmo isso os desenvolvedores (ex.: Wyndham) policiam como "uso comercial" **[verificado]**. Isso muda a estratégia de suprimento de hospedagem (seção 5).
3. **A venda de passagens com pontos de terceiros está em zona cinzenta legal até o PL 3083/2026 virar lei.** Aprovado na Câmara em 13/08/2026, ainda precisa passar pelo Senado e sanção **[verificado]**. Hoje os regulamentos dos programas proíbem a comercialização. Uma empresa formal não deve carregar esse risco no CNPJ principal (seção 5).
4. **A plataforma está tecnicamente mais pronta do que parece para virar produto** (multi-tenant com RLS, planos e franquia por plano já no schema, LGPD, bot com function calling, 397 testes passando) **[verificado]**, mas **não tem nenhuma linha de billing, catálogo de ofertas ou fluxo de pedido** **[verificado]**. Isso é o P0 (seção 7).
5. **Custo de infraestrutura é irrelevante frente ao custo de desenvolvimento e jurídico.** Infra fixa fica na casa de US$ 45/mês; variável por família é de poucos dólares por viagem (seção 9). O que custa é gente e advogado.

---

## 2. O que existe hoje (auditoria do sistema)

Tudo nesta seção é **[verificado]** no repositório (commit `b97be0e`, branch `main`).

### 2.1 Produto

| Área | Estado real |
|---|---|
| Telas | 12 abas: Visão Geral, Briefing (voz), Roteiro & Atrações (lista/cronologia/calendário), Logística, Grupo, DRE & Orçamento, Gift Cards & Milhas, Compras & Malas, Pendências, Auditoria, Vouchers & PDF, Brainstorm |
| Entidades | 19 tabelas de negócio + `whatsapp_configs`, `whatsapp_messages`, `activity_reminders`, `exchange_rates`, `tenant_invites`, `audit_finding_resolutions` |
| Multi-tenant | `tenants` → `memberships` → `trips`, RLS em todas as tabelas, sem acesso `anon`, teste E2E de isolamento no CI (`npm run test:isolation`) |
| Papéis | `admin`, `organizer`, `participant`, `viewer`, `developer` |
| Planos | `tenants.plan` ∈ `free / family / pro / enterprise`, com franquia de mensagens do bot por plano (50 / 300 / 1500 / ilimitado) e override por tenant |
| Bot WhatsApp | Meta Cloud API (1:1, sem grupos), Gemini 3.5 Flash com function calling (roteiro, tarefas, voo, concluir item, lembrete, mapas/ETA, reagendar), digest diário e noturno, avisos por horário com horário de silêncio, franquia mensal, retenção e anonimização (LGPD) |
| Motores puros | Auditoria (conflitos, altura mínima, documentos), cobertura do roteiro, DRE (previsto × realizado, câmbio PTAX congelado por despesa), decisão de compra US × BR (imposto, cota, IOF), calculadora de gift card |
| LGPD | Consentimento de responsável para menores, aceite de termos versionado, `delete_tenant` em cascata, retenção configurável. **Os textos jurídicos estão em rascunho** (`LEGAL_IS_DRAFT = true`) |
| Qualidade | 53 arquivos de teste, 397 testes passando, build de produção OK, CI (lint/build/test/isolamento) |
| Deploy | Vercel (`nogaria-travel.vercel.app`), Supabase (`bkrqhividgljticgjrem`), domínio `nogaria.store` quebrado (DNS/registrar) |

### 2.2 O que **não** existe (lacunas para virar negócio)

| Lacuna | Evidência |
|---|---|
| Cobrança / pagamento | Nenhuma referência a Stripe, gateway, checkout ou assinatura no código |
| Catálogo de produtos e pedidos | `accommodations`/`transports`/`flights` registram o que a família **já comprou**; não há oferta, cotação, pedido ou comissão |
| Visão de operador (agência vê várias famílias) | RLS isola por tenant; um operador teria de ser membro de cada tenant. Não há painel consolidado |
| Copiloto real no app | `AiCopilotView.tsx` ainda é `setTimeout` + palavras-chave; PR #47 (aberto) troca por edge function Gemini |
| Templates Meta aprovados | Necessários para mensagem iniciada pela empresa fora da janela de 24 h; issue #43 aberta |
| PWA / push / exportação / realtime | Issues #38–#41 abertas |
| Observabilidade | Sem Sentry/analytics de produto |
| Textos jurídicos finais | Política e termos em rascunho com campos do controlador entre colchetes |

### 2.3 Trabalho em voo que o plano depende

PRs abertos: #47 (copiloto real), #48 (remoção de relíquias de localStorage), #49 (avisos em excesso), #50 (reconciliação do roteiro + pendências). Os quatro devem ser fechados **antes** de qualquer feature nova desta lista, senão o P0 nasce em cima de conflito.

---

## 3. Mercado (só o que é verificável)

- Orlando recebeu **76,7 milhões** de visitantes em 2025, recorde; **6,3 milhões** internacionais **[verificado]**.
- O Brasil é o **3º mercado internacional** de Orlando, com **736.300 visitantes em 2025, +5,6 %** sobre 2024, enquanto o total internacional caiu 2,4 % (queda do Canadá) **[verificado]**.
- Diária média de hotel na região em 2025: **US$ 202,71** (Visit Orlando, citado por blog brasileiro) **[verificado, fonte secundária]**.
- Custo total de uma viagem de família de 4 pessoas, segundo blogs de nicho brasileiros: **R$ 25 mil a R$ 55 mil** (econômica/intermediária), acima de R$ 90 mil com hotéis melhores e compras pesadas **[verificado, fontes secundárias; usar como ordem de grandeza, não como média oficial]**.

O que **não** foi encontrado em fonte confiável e portanto não entra no plano: tamanho do mercado de agências brasileiras especializadas em Orlando, ticket médio de comissão dessas agências, e taxa de recompra. Tratar como pesquisa a fazer nas entrevistas da fase 1.

**Leitura de PO:** o mercado existe e cresce; o problema não é demanda, é (a) suprimento legal de hospedagem e (b) diferenciação frente a centenas de agências que já vendem "pacote Orlando". A diferenciação candidata é exatamente o que ninguém dessas agências tem: **controle financeiro em real com câmbio real, decisão de compra US × BR, auditoria de segurança de menores e bot que responde no WhatsApp durante a viagem.**

---

## 4. Proposta de valor e posicionamento

**Para quem:** famílias brasileiras (com crianças) indo a Orlando pela primeira ou segunda vez, ticket alto, ansiedade alta, que hoje planejam em planilha + WhatsApp + blogs.

**Promessa:** "Você compra a viagem conosco e ganha um copiloto que organiza, audita e acompanha a família do planejamento até a volta, em português, no WhatsApp."

**Por que a plataforma é vantagem e não custo:**

1. Reduz o trabalho humano da agência (o bot responde "o que a gente faz hoje?", o digest substitui a mensagem manual da manhã, a auditoria pega passaporte vencido antes do cliente).
2. Aumenta a retenção de dados: todo custo, decisão e reserva do cliente fica na plataforma da empresa, não no WhatsApp pessoal da vendedora.
3. Gera upsell contextual: o bot sabe quando a família não tem carro reservado, ou tem um dia sem hospedagem, e pode oferecer.

**Onde a ideia original é fraca:**

- "Controle total das aquisições pela plataforma" pressupõe motor de reservas com inventário e pagamento. Isso é um OTA. Não construir. A plataforma deve registrar **pedidos** e a agência executa a compra no canal B2B (seção 5); o cliente vê status e documentos na plataforma.
- "Vantagem extra" só é vantagem se o cliente usar. Métrica de adoção do bot (mensagens/família/viagem) precisa ser medida desde o piloto. Se ficar abaixo de ~1 mensagem/dia por família **[premissa de corte]**, o bot é custo de marketing, não produto.
- O produto está fortemente moldado pela viagem do autor (parques, gift cards, compras de eletrônicos). Isso é bom para o nicho Orlando e ruim para qualquer outro destino. Não prometer "qualquer destino" no lançamento.

---

## 5. Suprimento: hospedagem, passagens, carro, ingressos, seguro

Esta é a seção mais importante e a mais desconfortável. Cada linha é fato citado ou está marcada como premissa.

### 5.1 Hospedagem via RCI / timeshare

**Fatos [verificado]:**

- Os termos do RCI dizem que o programa "may not be used by a Member or guest for commercial purposes, including without limitation, auction, rental or sale of a Confirmed Exchange, Deposited Vacation Time, and/or Guest Certificate", e que tal uso é motivo de **cancelamento imediato da associação**.
- Guest Certificates são intransferíveis e não podem ser usados para "rental, sale or onward exchange to a third party".
- Semanas reservadas com pontos **próprios** no resort de origem podem, em geral, ser alugadas pelo proprietário, mas desenvolvedores como Wyndham emitem cartas de violação por "uso comercial" quando veem anúncios recorrentes com lucro.

**Consequência:** a frase "compramos o RCI resorts de Orlando" precisa ser traduzida no contrato real. Há três cenários:

| Cenário | O que foi comprado | Pode vender a clientes? |
|---|---|---|
| A | Semanas/pontos deeded em resort específico de Orlando (ex.: afiliado ao RCI) | Aluguel de semana reservada com pontos próprios: **possível com risco**, sujeito à declaração do resort/desenvolvedor. Exige parecer jurídico na Flórida e leitura do "commercial use" do contrato. |
| B | Assinatura RCI (Weeks/Points) para trocar por outros resorts | **Não.** Troca confirmada e Guest Certificate não podem ser alugados nem vendidos. |
| C | Pacote promocional / "Extra Vacations" do RCI | **Não** para revenda; é para uso do membro e convidados. |

**Recomendação:**

1. Antes de qualquer promessa comercial, obter cópia do contrato de compra e das regras do resort, e um parecer de advogado da Flórida sobre aluguel a terceiros. Custo a orçar.
2. Se cair no cenário A, usar o inventário próprio como **produto de margem alta e volume limitado** (algumas semanas por ano), nunca como base do negócio.
3. A base de hospedagem para clientes deve vir de canal B2B legítimo. **Expedia TAAP** (programa para agentes) paga comissão tipicamente na faixa de **10–12 % em hotéis** em 2026, calculada sobre o valor com impostos **[verificado, fontes secundárias; sem taxa garantida]**. Alternativas a cotar: bed banks (Hotelbeds, etc.) e contratos diretos com casas de temporada em Kissimmee **[premissa]**.
4. Registrar no sistema **de onde veio** cada hospedagem (`booked_via`) e a comissão, para a DRE da empresa (seção 7, item P0-4).

### 5.2 Passagens com pontos de cartão (operação da Bárbara)

**Fatos [verificado]:**

- O PL 3083/2026 foi aprovado na Câmara em 13/08/2026 e segue para o Senado. Ele cria dois regimes: programas **com liquidez** (conversão oficial em dinheiro) podem definir regras próprias de comércio de pontos; programas **sem liquidez** ficam proibidos de restringir venda/transferência e de punir usuários. **Ainda não é lei.**
- Até lá, o mercado opera sem regulação específica, com os regulamentos dos programas proibindo comercialização e gerando bloqueios de conta.

**Consequência:** vender passagem emitida com pontos de terceiros, em nome de uma empresa formal com CADASTUR, transfere o risco de bloqueio/cancelamento para o **cliente** (ele viaja com o bilhete) e o risco reputacional/jurídico para a **empresa** (CDC: responsabilidade solidária da agência é entendimento consolidado do STJ em falhas do fornecedor **[verificado como entendimento jurisprudencial geral; confirmar com advogado o caso específico de bilhete cancelado por fraude de milhas]**).

**Recomendação:**

1. Modelo seguro hoje: **emissão assistida com pontos do próprio cliente**, cobrando taxa de serviço fixa (ex.: R$ X por bilhete **[premissa]**). A empresa não compra nem vende pontos.
2. Modelo intermediário: passagem em dinheiro via consolidador/GDS ou site da cia, com markup ou fee. Margem baixa, risco baixo.
3. O modelo atual da Bárbara (pontos de terceiros) fica **fora do CNPJ da plataforma/agência** até o PL 3083 ser sancionado e o regime do programa ficar claro. Revisitar em 2027.

### 5.3 Carro, ingressos, seguro, transfer

- **Carro:** afiliação a locadoras/agregadores (Rentalcars, Discover Cars, etc.). Taxas de comissão **não verificadas** neste documento; cotar. Já existe `transport_reservations` com `type: 'rental_car'`.
- **Ingressos Disney/Universal:** revenda exige credenciamento como ticket seller autorizado; margens **não verificadas**. Existe a alternativa de ser afiliado de revendedores autorizados. Cotar.
- **Seguro-viagem:** no Brasil, intermediação de seguro é atividade de corretor registrado na SUSEP. **Não vender diretamente**; usar link de afiliado ou parceria com corretora **[verificado como regra geral; validar com contador/corretor]**.
- **Afiliados em geral:** a issue #44 já registra a leitura correta: comissão líquida de hotel via afiliado (Booking) é fração da comissão do Booking, não do valor da reserva **[verificado]**; vale mais como preenchimento automático de dados do que como receita.

---

## 6. Modelo de monetização

### 6.1 Três linhas de receita, em ordem de importância

| # | Linha | Mecanismo | Ordem de grandeza por família | Verificação |
|---|---|---|---|---|
| 1 | **Serviço de viagem (agência/concierge)** | Comissão de hospedagem (TAAP 10–12 %), markup/fee em carro, ingresso, transfer; taxa de planejamento e concierge | Sobre uma viagem de R$ 25–55 mil, um take-rate de 5–8 % sobre a parte intermediada dá **R$ 1.250 a R$ 4.400** | take-rate é **[premissa]**; faixas de custo da viagem e TAAP são **[verificado]** |
| 2 | **Plataforma incluída no pacote + assinatura B2B** | Cliente final: incluída (custo de aquisição/retensão). Agências terceiras: assinatura mensal por agente com N famílias ativas (issue #45 sugere a partir de R$ 249/mês) | R$ 249+/mês por agência **[premissa da issue #45]** | — |
| 3 | **Afiliados** | Deep links de reserva a partir do roteiro (issue #44) | Baixo; dezenas de reais por família | **[verificado]** que é baixo |

### 6.2 Por que não cobrar assinatura mensal da família

- Frequência: uma família repete Orlando a cada 2–5 anos **[premissa razoável, sem fonte]**. Assinatura mensal gera cancelamento no dia seguinte à volta.
- Se for cobrar do consumidor final sem pacote, cobrar **por viagem** (licença de 12 meses, ex.: R$ 149–299 **[premissa]**), nunca por mês. O schema atual (`tenants.plan`) comporta isso sem mudança: `family` = licença por viagem.

### 6.3 Tiers propostos (mapeados no schema existente)

| Plano (`tenants.plan`) | Quem | Inclui | Bot (franquia já no código) |
|---|---|---|---|
| `free` | Lead / trial | Planejamento, DRE, auditoria; sem WhatsApp | 50 msg/mês (hoje) → **propor 0** para forçar conversão |
| `family` | Cliente que comprou pacote, ou licença por viagem | Tudo + bot + digest + avisos | 300 msg/mês |
| `pro` | Agente de viagem individual (B2B) | Painel de operador, N famílias, branding leve | 1.500 msg/mês |
| `enterprise` | Agência com equipe | White-label, SLA, cotas custom | ilimitado |

### 6.4 Custo variável por família (para precificar com margem)

Ver seção 9.2. Resumo: **≈ US$ 5–10 por viagem de 15 dias com 4 participantes** entre WhatsApp e Gemini. É desprezível frente ao take-rate; o bot pode ser incluído em qualquer pacote sem preocupação de custo.

---

## 7. Roadmap de produto para o lançamento

Esforço em **semanas de 1 desenvolvedor sênior** dedicado. Não é estimativa de calendário (paralelismo, revisão e testes E2E não estão contados). Cada item aponta o que já existe para ser reaproveitado.

### P0 — Sem isso não se vende para o primeiro cliente externo

| # | Item | O que fazer | Reaproveita | Esforço |
|---|---|---|---|---|
| P0-1 | Fechar PRs #47, #48, #49, #50 | Revisar, resolver conflitos, mergear | — | 1 sem |
| P0-2 | Textos jurídicos finais | Advogado revisa política/termos; preencher controlador; `LEGAL_IS_DRAFT = false`; subir `LEGAL_VERSION` | `legalTexts.ts`, `ConsentScreen` | 0,5 sem (dev) + jurídico |
| P0-3 | **Papel de operador e painel da agência** | O operador entra como `organizer` em cada tenant-cliente via `tenant_invites` (já existe). Nova tela "Minhas famílias": lista os tenants onde o usuário tem papel `organizer`/`admin`, com status da viagem, pendências e alertas de auditoria. Trocar `activeTenantId` já existe em `AuthContext` | `memberships`, `tenant_invites`, `TeamModal`, `AuthContext` | 2 sem |
| P0-4 | **Catálogo de ofertas + pedidos** | Novas tabelas `offers` (tipo: hospedagem/carro/ingresso/transfer/seguro; preço; fornecedor; validade) e `orders` (tenant, trip, offer, status `requested → quoted → accepted → paid → confirmed → cancelled`, valor, comissão, `booked_via`). Ao confirmar, cria/atualiza `accommodation`/`transport`/`flight` correspondente. Coluna `booked_via` (`nogaria` / `self`) nas três tabelas de reserva. Tela "Ofertas Nogaria" no app da família; fila de pedidos no painel do operador | Padrão `use<X>Data` + mapper + modal; `Accommodation.status` já tem `planning`/`confirmed` | 3 sem |
| P0-5 | **Billing** | Gateway com Pix e cartão. **Stripe no Brasil: Pix é invite-only para empresas brasileiras** **[verificado]**; taxas citadas por fonte secundária: 3,99 % nacional + 0,4 % em recorrência **[verificado, secundária]**. Cotar também Pagar.me, Asaas, Mercado Pago **[premissa]**. Tabela `subscriptions` (tenant, plano, status, período), edge function de webhook que atualiza `tenants.plan`, gates de feature na UI (bot só em plano pago) | `tenants.plan`, `plan_message_quota`, `quota.ts` | 2 sem |
| P0-6 | **Templates Meta aprovados** (issue #43) | Templates de utilidade para digest, aviso e "seu pedido foi confirmado". Sem isso, mensagem iniciada pela empresa fora da janela de 24 h não sai | `daily-digest`, `activity-reminders`, `whatsappClient.ts` | 1 sem + prazo de aprovação Meta |
| P0-7 | Onboarding feito pelo operador | Operador cria tenant do cliente, viagem e participantes, e convida por e-mail. Hoje o fluxo é self-service (`OnboardingScreen`) | `create_tenant_with_owner`, `TripWizard`, `tenant_invites` | 1 sem |
| P0-8 | Observabilidade e suporte | Sentry no front e nas edge functions; evento de produto mínimo (login, mensagem do bot, pedido criado); tela de admin para ver `ai_usage_logs`/`tenant_monthly_ai_costs` por tenant | view `tenant_monthly_ai_costs` já existe | 1 sem |
| P0-9 | Domínio | Resolver `nogaria.store` (Locaweb) ou registrar outro e atualizar Supabase Auth URL Configuration | — | 0 dev, operacional |

**Total P0: ~12 semanas de dev** + jurídico + aprovações externas (Meta, gateway).

### P1 — Primeiros 90 dias após o lançamento

| # | Item | Motivo | Esforço |
|---|---|---|---|
| P1-1 | **Tools do bot para pedidos e finanças** | "quanto já gastamos?", "quero um carro para o dia 12" → `get_budget_summary`, `request_quote` (cria `order`), `get_order_status`. É o que torna "avaliar tudo conversando com a IA" verdade | 1,5 sem |
| P1-2 | **Handoff para humano** | Tool `escalate_to_agent`: bot marca a conversa e o operador responde pelo painel (a janela de 24 h da Meta continua aberta, resposta gratuita). Hoje o bot só fala com Gemini | 2 sem |
| P1-3 | PWA + push (#38, #39) | Cliente instala no celular; push é grátis frente a template Meta | 2 sem |
| P1-4 | Exportação PDF/.ics (#40) | Voucher consolidado do pacote é entregável da agência | 1 sem |
| P1-5 | Ingestão de voucher por foto/e-mail (#28) | Reduz digitação do operador | 2 sem |
| P1-6 | Divisão de despesas (#37) | Pedido recorrente de família grande | 1,5 sem |
| P1-7 | Status de voo (#42) | Aviso de atraso pelo bot; depende de API paga a cotar | 1 sem |

### P2 — Escala B2B

| # | Item | Esforço |
|---|---|---|
| P2-1 | White-label e plano Agência (#45): logo, cor, domínio por tenant-agência, número de WhatsApp próprio (a Meta exige número por empresa) | 4 sem |
| P2-2 | Afiliados (#44) | 2 sem |
| P2-3 | Realtime colaborativo (#41) | 2 sem |
| P2-4 | Sugestões de roteiro com LLM + Places (#29) | 3 sem |
| — | Grupos de WhatsApp (#46): **a Meta Cloud API não suporta grupos** **[verificado no código/CLAUDE.md]**. Manter 1:1. Fechar a issue como "não fazer" ou deixar como pesquisa sem prazo | 0 |

### 7.1 Mudanças em features existentes (não são novas telas)

- **Copiloto no app**: substituir simulação por edge function (PR #47). Sem isso a demo mente.
- **Gift Cards & Milhas**: hoje registra pontos e cartões do cliente. Para a agência, adicionar campo "emissão assistida por Nogaria" no `Flight` e fee cobrado. Não registrar nem transacionar pontos de terceiros na plataforma (seção 5.2).
- **DRE**: adicionar visão de **margem da empresa** por viagem (soma das comissões dos `orders`) separada da DRE da família. Reaproveita `dreEngine.ts`.
- **Auditoria**: regras novas orientadas a venda: "dia sem hospedagem", "sem carro entre aeroporto e hotel", "sem seguro". Cada regra vira gatilho de oferta.
- **Franquia do bot**: `free` passar de 50 para 0 mensagens (forçar conversão) ou manter 50 como trial de 7 dias. Decisão de negócio, 1 linha em `plan_message_quota` + `quota.ts`.
- **`participants.whatsapp_phone`**: hoje é campo livre. Para a Meta, validar E.164 e exigir opt-in explícito registrado (data/versão), porque template de utilidade exige consentimento.

---

## 8. Go-to-market

### Fase 0 — Piloto próprio (em curso: 05–20/09/2026)

- A viagem da família do autor é o piloto. Registrar: mensagens/dia por participante, falhas do bot, custo real em `ai_usage_logs`, o que a família perguntou e o bot não soube.
- Entregável: estudo de caso com números reais (custo, economia com gift cards, alertas que evitaram problema).

### Fase 1 — Beta fechado (out–dez 2026)

- 5 a 10 famílias da carteira atual da Bárbara **[premissa: ela tem essa carteira]**, com viagem entre dez/2026 e mar/2027.
- Vender **pacote com plataforma incluída**; operar pedidos à mão (planilha) enquanto P0-4 não existe. Objetivo é aprender o fluxo, não escalar.
- Contratos: só depois de P0-2 (termos reais) e CNPJ.
- Métricas de corte para seguir à fase 2: NPS ≥ 50 **[premissa]**, ≥ 1 mensagem/dia/família no bot **[premissa]**, zero incidente de dado de menor, margem por família medida.

### Fase 2 — Lançamento (Q1 2027)

- Empresa formalizada: CNPJ com CNAE de agência de viagens, **CADASTUR** (obrigatório para agências pela Lei 11.771/2008 e Decreto 7.381/2010; gratuito; validade 2 anos) **[verificado]**, contador, contrato de prestação de serviço revisado.
- P0 completo. Landing page com o estudo de caso. Canal: Instagram/YouTube de nicho Orlando (onde as famílias já pesquisam), parcerias com criadores de conteúdo, indicação com crédito no próximo pacote.
- Produto: "Pacote Orlando Nogaria" (hospedagem B2B + carro + concierge + plataforma + bot). Hospedagem própria (cenário A da 5.1) só se o parecer permitir.

### Fase 3 — B2B (Q2–Q3 2027)

- Plano `pro`/`enterprise` para agentes independentes de Orlando (issue #45). Eles trazem famílias; a Nogaria cobra assinatura e, opcionalmente, participa da comissão de hospedagem se o agente comprar pelo canal da Nogaria.
- Pré-requisito: P2-1 (white-label e número de WhatsApp por agência).

### KPIs por fase

| KPI | Fase 1 | Fase 2 | Fase 3 |
|---|---|---|---|
| Famílias ativas | 5–10 | 30–60 | 100+ (via agentes) |
| Margem média por família | medir | > custo de aquisição | — |
| Mensagens do bot / família / dia | medir | ≥ 1 | ≥ 1 |
| Custo variável por família | medir | < US$ 15 | < US$ 15 |
| Agências pagantes | 0 | 0–3 | 10+ |

Todos os alvos numéricos acima são **[premissa]** a calibrar com os dados da fase 1.

---

## 9. Custos

### 9.1 Infraestrutura fixa mensal [verificado]

| Item | Valor | Observação |
|---|---|---|
| Supabase Pro | US$ 25/mês | inclui crédito de compute de US$ 10 (instância Micro). Subir para Small custa +US$ 5 |
| Vercel Pro | US$ 20/seat/mês | inclui US$ 20 de crédito de uso |
| Meta WhatsApp Cloud API | US$ 0 fixo | uso direto sem BSP não tem mensalidade; só por mensagem |
| Gemini API | US$ 0 fixo | só por token |
| CADASTUR | R$ 0 | gratuito |
| **Total fixo** | **≈ US$ 45/mês** | antes de Sentry, domínio, Google Maps/Places (variável, não cotado aqui) |

### 9.2 Custo variável por família (viagem de 15 dias, 4 participantes)

Preços unitários **[verificado, fontes secundárias; página oficial da Meta e do Google bloqueadas pelo proxy desta sessão]**:

- WhatsApp Brasil 2026: utilidade ≈ **US$ 0,0068**/mensagem; marketing ≈ **US$ 0,0625**; resposta dentro da janela de 24 h de atendimento: **grátis**.
- Gemini 3.5 Flash: **US$ 1,50** / 1M tokens de entrada, **US$ 9,00** / 1M de saída. Gemini 3.5 Flash-Lite: **US$ 0,30** / **US$ 2,50**.

Cálculo (as quantidades são **[premissa]** derivadas do comportamento do bot no código):

| Componente | Quantidade | Custo |
|---|---|---|
| Digest manhã + noite (template utilidade) | 2 × 4 pessoas × 15 dias = 120 | US$ 0,82 |
| Avisos por horário (≈ 9/dia, default do dia operacional) | 9 × 4 × 15 = 540 | US$ 3,67 |
| Respostas do bot a perguntas | dentro da janela de 24 h | US$ 0 |
| Gemini, 300 mensagens/mês, ~4 k tokens de entrada e ~300 de saída cada (Flash) | — | ≈ US$ 2,60 |
| Gemini, mesmo volume em Flash-Lite | — | ≈ US$ 0,60 |
| **Total por viagem** | | **≈ US$ 5–8** |

Conclusão: o bot custa menos de R$ 50 por família por viagem. Não é variável de precificação; é argumento de venda.

### 9.3 Desenvolvimento [premissa]

Esforço do P0 é ~12 semanas de dev sênior (seção 7). O custo em reais depende de quem faz:

- Se o autor faz sozinho: custo de oportunidade + ~3 meses de calendário sem outras features.
- Se contratar: custo de mercado de um dev sênior React/Postgres no Brasil, PJ. **Não há número verificado neste documento; cotar 2–3 profissionais.** Qualquer valor aqui seria chute.

### 9.4 Jurídico e regulatório [a orçar, sem número]

- Parecer sobre aluguel do inventário de timeshare (advogado na Flórida).
- Revisão de política/termos LGPD e contrato de prestação de serviços de turismo (advogado no Brasil).
- Contador para estrutura societária (ver 10.2), CNAE, regime tributário e tratamento de receita em dólar.

### 9.5 Pagamentos [verificado, fonte secundária]

Stripe Brasil: 3,99 % nacional, 5,49 % internacional, 0,4 % em assinatura recorrente; Pix invite-only para empresas brasileiras. Isso pesa: numa comissão de R$ 2.000, 4 % são R$ 80. Cotar gateways nacionais antes de decidir.

---

## 10. Riscos e fraquezas da ideia (sem suavizar)

### 10.1 Jurídicos / regulatórios

1. **Inventário RCI não é revendável** (5.1). Se o plano de hospedagem depende disso, o plano não fecha.
2. **Milhas de terceiros** (5.2): risco de bilhete cancelado + responsabilidade solidária da agência. Fora do CNPJ até a lei.
3. **Dados de menores**: já tratado no código, mas os textos jurídicos ainda são rascunho. Vender antes de P0-2 é infração da LGPD.
4. **Seguro-viagem**: não intermediar sem corretor SUSEP.

### 10.2 Estruturais

5. **Separar as empresas.** A agência (que responde solidariamente por fornecedor) e a plataforma (SaaS, ativo de software) devem ser CNPJs diferentes, com contrato de licença entre elas. Protege o software de passivo da operação e facilita vender o SaaS a outras agências sem conflito **[recomendação de PO; validar com contador/advogado]**.
6. **Bus factor 1.** Um único desenvolvedor conhece o sistema. Antes de ter cliente pagante, documentar runbooks de incidente (bot mudo, Meta rotacionou token, Gemini fora) e ter um segundo par de mãos, mesmo que parcial.
7. **Dependência de fornecedores**: Meta (política de templates muda e cobrança mudou para por mensagem em 2025/2026 **[verificado]**), Google (Gemini 3.5 Flash-Lite ficou **mais caro** que a geração anterior **[verificado]**). Abstrair o provedor de LLM já é parcialmente feito (`resolveGeminiModel`); manter.
8. **Produto sobreajustado a Orlando/parques.** Bom para o nicho, ruim para diversificar. Não prometer outros destinos no lançamento.

### 10.3 De mercado

9. **Concorrência é de canal, não de software.** Centenas de agências e influenciadores vendem Orlando; nenhum vende com bot + DRE + auditoria, mas o cliente compra primeiro pela confiança na pessoa. A Bárbara é o canal; a plataforma é o argumento. Se a carteira dela for menor do que se supõe, a fase 1 não tem cliente.
10. **Adoção do bot é incerta.** Se a família não usa, o diferencial vira slide. Por isso a métrica de corte na fase 1.

---

## 11. Ideias adicionais (não estavam no pedido)

1. **Auditoria como gatilho de oferta** (7.1): cada finding de "falta X" vira botão "pedir cotação". Custo baixo, converte no momento de dor.
2. **Handoff bot → humano dentro da janela de 24 h** (P1-2): a Meta não cobra respostas nessa janela; o operador responde grátis pelo painel em vez do celular pessoal.
3. **Relatório de fim de viagem** gerado pela plataforma (economia com gift cards, câmbio médio pago, o que deu certo). Vira material de indicação e de venda do próximo pacote.
4. **Programa de indicação com crédito no próximo pacote**, registrado em `tenants` (campo `referred_by`).
5. **Dados agregados e anônimos de preços** (`price_quotes` já existe): conteúdo de marketing ("quanto custa um iPhone em Orlando hoje") com custo zero de produção.
6. **Licença por viagem para quem não compra pacote** (6.2): captura quem já comprou tudo por fora, a preço baixo, e vira lead da agência no próximo ano.

---

## 12. Fontes

Externas (acessadas em 10/09/2026):

- RCI, termos e condições (uso comercial proibido): https://www.rci.com/static/docs/namer/en_US/rci-points-disclosure-guide.pdf ; https://www.rci.com/RCIW_TermsEnglish2004.pdf ; https://www.rci.com/static-pages/eu-all-terms/rental-terms ; discussão de proprietários: https://www.redweek.com/forums/messages?thread_id=18104
- Política de aluguel/uso comercial em Wyndham: https://clubwyndham.wyndhamdestinations.com/us/en/owner-guide/resources/renting-points-standard-booking ; https://tugbbs.com/forums/threads/wyndham-violation-letter-re-commercial-use.322010/
- PL 3083/2026 (milhas), aprovação na Câmara em 13/08/2026: https://movimentoeconomico.com.br/turismo-3/2026/08/13/passagens-aereas-programas-de-fidelidade-terao-novas-regras-para-venda-de-milhas/ ; https://aeroportos.org/nova-regra-das-milhas-avanca-na-camara-e-pode-garantir-conversao-de-pontos-em-dinheiro-veja-como-funcionara/ ; https://www.maismilhas.com.br/blog/compra-e-venda-de-milhas-e-legal-o-que-diz-a-lei
- CADASTUR / Lei 11.771/2008: https://www.gov.br/pt-br/servicos/cadastrar-prestadora-de-servico-turistico ; https://www.airland.com.br/blog/cadastur-agencia-turismo
- Visit Orlando 2025 (76,7 M; Brasil 3º, 736.300, +5,6 %): https://www.visitorlando.org/media/press-releases/post/orlando-welcomed-record-767-million-visitors-in-2025-remaining-most-visited-destination-in-the-us/ ; https://brasilturis.com.br/2026/05/08/orlando-atinge-767-milhoes-de-visitantes-e-brasil-cresce-56/
- Custo de viagem de família a Orlando (blogs de nicho): https://viajandoparaorlando.com/quanto-custa-viajar-para-orlando-orcamento-para-casal-e-familia-em-2026/ ; https://orlandoparabrasileiros.com/quanto-custa-viajar-para-orlando/ ; https://www.cnnbrasil.com.br/viagemegastronomia/viagem/quanto-custa-viajar-para-orlando-do-visto-aos-ingressos-dos-parques/
- Expedia TAAP (comissão 10–12 % em hotéis, 2026): https://partner.expediagroup.com/en-us/resources/blog/travel-agent-commission-what-you-should-know ; https://mainstreetagencytravel.com/news/expedia-taap-the-smart-complete-guide-for-travel-agents-in-2026
- Booking.com afiliados (fração da comissão): https://track360.io/blog/booking-com-affiliate-partner-program-operator-teardown-2026
- WhatsApp Business Platform, preços Brasil 2026 (fontes secundárias; página oficial bloqueada nesta sessão): https://www.messagecentral.com/blog/whatsapp-business-api-pricing-brazil ; https://whautomate.com/whatsapp-business-api-pricing-brazil ; https://www.engagelab.com/blog/whatsapp-business-api-pricing
- Gemini 3.5 Flash / Flash-Lite (fontes secundárias; ai.google.dev bloqueado nesta sessão): https://pricepertoken.com/pricing-page/model/google-gemini-3.5-flash ; https://artificialanalysis.ai/models/gemini-3-5-flash-lite ; https://tokencost.app/blog/gemini-3-5-flash-lite-price-increase
- Supabase Pro: https://makerkit.dev/blog/saas/supabase-pricing ; https://flexprice.io/blog/supabase-pricing-breakdown
- Vercel Pro: https://costbench.com/software/developer-tools/vercel/ ; https://flexprice.io/blog/vercel-pricing-breakdown
- Stripe Brasil (Pix invite-only; taxas via fonte secundária): https://stripe.com/br/payment-method/pix ; https://www.socialhub.pro/blog/cobranca-whatsapp-pagar-me-stripe-brasil-subscription-recorrencia-internacional-pme-2026/

Internas: `CLAUDE.md`, `src/types/database.types.ts`, `src/components/Navigation.tsx`, `supabase/migrations/*`, `supabase/functions/_shared/quota.ts`, issues #37–#46 e PRs #47–#50 do repositório.
