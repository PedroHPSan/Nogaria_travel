# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
versionamento [SemVer](https://semver.org/lang/pt-BR/). Cada release em
produção (`vercel deploy --prod`) ganha uma entrada aqui e uma tag `vX.Y.Z`
no commit correspondente — ver "Versionamento" no `CLAUDE.md`.

> **Nota histórica:** o projeto rodou 161 commits sem versionamento formal
> antes desta entrada. `1.0.0` marca o início do controle de versão, não a
> "primeira versão" do produto — o app já estava em uso real pela família
> (issues #18–#59, ver `roadmap-ia-issues-2026-09` na memória do projeto).

## [1.4.0] - 2026-09-14

### Adicionado
- **Disparar o roteiro por WhatsApp para todos, a partir do repositório**: job
  `whatsapp` em `.github/workflows/supabase.yml`, com a entrada `digest`
  (`hoje`/`amanha`). Chama a edge function `daily-digest` com o header
  `x-force-send`, que é o que **ignora a checagem de `digest_time`** do tenant —
  sem ele, um disparo fora da hora configurada é respondido com `skipped` e
  ninguém recebe nada. Roda `needs: seed` de propósito: mandar o itinerário
  antes de aplicá-lo entregaria a versão velha para a família inteira. Exige o
  secret `CRON_SECRET` (o mesmo de `supabase secrets set`).

### Corrigido
- **Dia 14/09, quarta versão, ao vivo dentro do parque.** Hulk e Doctor Doom
  saíram antes do Homem-Aranha — a família chegou ao Marvel e foi direto nas
  duas atrações que barram a Gabi. Os blocos cumpridos (até o Doctor Doom) viram
  `completed` com o horário real, e o **Homem-Aranha assume o lugar deles** em
  vez de ser dado como perdido: é a única das três em que os 4 andam juntos, e
  vira a recompensa da Gabi logo depois de duas trocas seguidas. Nada depois das
  14h40 se move — o Ripsaw Falls continua abrindo o Toon Lagoon no mesmo
  horário.
- O teste do prefixo concluído deixou de depender de uma lista fixa de títulos
  (que envelhece a cada replanejamento) e passa a travar o que importa: o
  primeiro bloco pendente, e que todo `completed` venha antes dele. Um bloco
  concluído depois de um pendente é buraco na linha do tempo — é assim que o
  check-in do bot passa a cobrar item que já rolou.
- O plano B da retirada do Express deixou de ser exigido depois que o bloco está
  `completed`: fallback de fato consumado é ruído.

## [1.3.1] - 2026-09-14

### Corrigido
- **Dia 14/09, terceira versão — replanejado com a família já no Royal Pacific
  (11h52).** O check-out e a estrada passam a `status: 'completed'` em vez de
  sumirem do roteiro: o seed apaga e reinsere o dia inteiro, então sem essa
  marcação um replanejamento no meio do dia faria o app esquecer o que já
  aconteceu.
- **Registro no balcão e almoço rodam em paralelo**, num bloco só: um adulto na
  fila do check-in, o outro no Tuk Tuk Market com as meninas. Em série
  custavam 60 min; em paralelo custam 35, e é isso que põe a família dentro do
  parque às **13h** em vez de 13h35 — 7h de parque, contra as ~4h do plano
  original da manhã.

### Adicionado
- Os 35 min recuperados viraram duas coisas: o **Seuss Trolley Train** no bloco
  de abertura (a Gabi passa de três para quatro atrações próprias antes da
  sequência de 137/132/130cm que a barra) e uma **pausa real de 20 min** depois
  dos dois blocos molhados de Toon Lagoon — uma criança de 4 anos das 13h às
  20h15 sem intervalo é o jeito mais confiável de perder Hogsmeade às 18h. A
  pausa é `category: 'rest'`, então é a primeira coisa a encolher se o dia
  estourar o relógio.
- Testes: a lista de blocos `completed` fica travada e nenhum deles pode
  aparecer depois do primeiro bloco pendente; a entrada no parque às 13h vira
  invariante, junto com a instrução de paralelizar o balcão (se alguém
  reseparar os dois blocos, o teste quebra em vez de o dia escorregar em
  silêncio).

## [1.3.0] - 2026-09-14

### Adicionado
- **Deploy de produção automático a partir do repositório**
  (`.github/workflows/deploy.yml`). Push em `main` roda lint + build + testes e,
  só então, `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt
  --prod`, confirmando com `vercel inspect` e falhando o job se não ficar
  `READY`. O build acontece no CI, não na Vercel — é por isso que o `vercel
  pull` é necessário: ele baixa as variáveis de produção
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`), que moram no
  dashboard da Vercel e em nenhum arquivo do repo. Também roda sob demanda
  (*Actions → Run workflow*).
- **Escrita no Supabase sem CLI instalada** (`.github/workflows/supabase.yml`),
  com três jobs:
  - `migracoes` — `supabase db push --db-url`, disparado quando um push em
    `main` toca `supabase/migrations/**`;
  - `funcoes` — publica apenas as edge functions que o commit tocou; uma
    mudança em `_shared/` republica todas, porque todas importam de lá;
  - `seed` — aplica um arquivo de `supabase/seeds/` via `psql`, **só manual**.
    Um seed de roteiro apaga o dia inteiro de `itinerary_items` antes de
    inserir, então exige `confirmar_seed = sim`; aceita o nome do arquivo ou um
    pedaço dele (`09-14`) e recusa o que for ambíguo. Rodar com o campo vazio
    lista os seeds disponíveis no resumo do job — é o caminho de descoberta
    pelo celular.

  Entradas do `workflow_dispatch` entram nos scripts por `env`, nunca
  interpoladas direto: `${{ }}` é substituído como texto antes de o bash ver a
  linha, e uma aspa na entrada viraria comando.

### Alterado
- `vercel.json` mantém `git.deploymentEnabled: false` **de propósito**, agora
  com o motivo registrado: religar a integração Git da Vercel faria um push em
  `main` disparar dois deploys, e o da Vercel não passa por lint/build/test.
- `CLAUDE.md`: a seção de deployment deixa de descrever um processo manual e
  passa a documentar os dois workflows, a tabela de secrets necessários
  (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SUPABASE_DB_URL`,
  `SUPABASE_ACCESS_TOKEN`) e os comandos manuais como fallback. Todo job
  degrada para *warning* e pula quando falta o seu secret, então o repositório
  não fica vermelho antes de os segredos serem cadastrados.

## [1.2.1] - 2026-09-14

### Corrigido
- **Dia 14/09 replanejado a partir das 11h.** A família passou a manhã no
  hotel; o dia foi remontado do check-out do Celebration Suites em diante e,
  contra a intuição, *ganhou* tempo de parque — entrada no Islands of Adventure
  às 13h25 em vez de 14h25.
- **Premissa de fechamento do IOA corrigida de 18h/19h para 20h** em 14/09. A
  versão anterior encurtava Hogsmeade e punha o Hagrid's às 19h25 sem margem; o
  parque abre 9h e fecha 20h na data, o que transforma ~4h de parque em 6h30 e
  permite cobrir o Islands of Adventure inteiro. O Hagrid's (única atração
  forte sem Express) entra na fila às 19h30, com 30 min de folga.
- **TRANSFORMERS: The Ride-3D estava ausente** do roteiro do dia 16 e do
  catálogo do Universal Studios Florida. É atração S, aceita Express e tem
  barra de 102cm — os 4 andam juntos. Registrado no catálogo também o motivo
  de o Hollywood Rip Ride Rockit não entrar: fechou em definitivo em agosto de
  2025 (dá lugar ao Fast & Furious: Hollywood Drift, 2027).

### Adicionado
- Child Swap (rider switch) explícito nas quatro atrações do dia 14 que barram
  a Gabi (112cm) — Hulk 137, Doctor Doom 132, VelociCoaster 130 e Forbidden
  Journey 122 — com o procedimento real da fila Express descrito nas notas
  (~10 min por troca, não uma fila inteira).
- Dia 16 cobre o Universal Studios Florida inteiro num anel único sem repetir
  trecho, com Horror Make-Up Show e um bloco próprio de DreamWorks Land. Com o
  IOA fechado no dia 14, o Hogwarts Express volta a ser passeio, não resgate.
- Testes: horário de funcionamento vira invariante do dia 14 (nenhum bloco de
  parque fora de 9h-20h, exceto a fila do Hagrid's, que por desenho termina
  depois do fechamento) e a lista das quatro trocas fica travada.

> Deploy desta entrada é o `supabase/seeds/` aplicado ao Supabase, não um
> `vercel deploy` — os módulos de roteiro não são lidos pelo app em runtime.

## [1.2.0] - 2026-09-14

### Adicionado
- **Fase Universal reprogramada — dias operacionais 14, 15 e 16/09**
  (`islandsOfAdventureDia14.ts`, `epicUniverseDia15.ts`,
  `universalStudiosDia16.ts`), substituindo os dias de catálogo gerados por
  `buildParkDay`. Três restrições reais moldaram a alocação dos parques:
  - o **Universal Express Unlimited** incluso na diária do Loews Royal Pacific
    vale no Universal Studios Florida e no Islands of Adventure, mas **não no
    Epic Universe** — por isso o Epic fica com o único dia inteiro, com Early
    Park Admission às 9h, e os outros dois parques cabem em meio período e em
    um dia encurtado;
  - **16/09 é data do Halloween Horror Nights** (setembro: 2-6, 9-13, 16-20,
    23-27, 30), então o Universal Studios fecha às 17h para ingresso normal —
    o que resolve o check-out do Royal Pacific (11h) e as ~3h30 de estrada até
    o check-in do Casa Faena, em Miami Beach;
  - o dia 14 começa às **12h**, com a família ainda no hotel antigo: o bloco
    crítico do dia é a retirada dos cartões Express no balcão do Royal Pacific,
    não uma atração.
- `buildOperationalDay` passa a aceitar fila paga por bloco
  (`OperationalRow.lightningLane`) e por dia
  (`OperationalDayConfig.defaultLightningLane`), com default `'none'` — os dias
  Disney seguem inalterados. Marcar o dia inteiro como `'express'` seria falso:
  Hagrid's e Pteranodon Flyers não aceitam Express, e é justamente isso que põe
  o Hagrid's como último bloco do dia 14.
- `scripts/gerarSeedRoteiro.ts` gera os SQLs de `supabase/seeds/` a partir dos
  módulos TS. Os seeds anteriores pediam no cabeçalho "editar o TS e regerar",
  mas eram escritos à mão — sem gerador, a ordem das colunas do `insert` e a
  do `values` podiam divergir em silêncio.

### Notas
- Os três seeds foram validados contra um Postgres 16 real (migrations do
  projeto aplicadas, viagem e participantes semeados): inserem 20/28/26 blocos
  e são idempotentes na reexecução.

## [1.1.0] - 2026-09-13

### Adicionado
- **Controle de orçamento pelo bot**: nova flag `participants.can_manage_budget`
  (mesmo padrão de `can_manage_itinerary`) autoriza a tool `add_expense`
  (registra um gasto pelo WhatsApp conforme acontece, confirmação em duas
  etapas, câmbio via PTAX) e o recebimento do checkin diário de orçamento —
  mensagem separada do digest matinal, só para organizadores, com o custo
  estimado do roteiro do dia (`itinerary_items.estimated_cost`) e uma
  pergunta sobre o gasto real. Novo `kind` `budget_checkin` em
  `whatsapp_messages`. Checkbox correspondente no `ParticipantModal`.

## [1.0.1] - 2026-09-13

### Corrigido
- `buildGenerationConfig` mandava `thinking_level` solto em `generationConfig`;
  a API do Gemini 3.8 exige aninhado em `thinkingConfig.thinkingLevel`
  (HTTP 400 "Unknown name thinking_level" em toda chamada do Copiloto/bot).
- `chatWithTools` ecoava o id da function call como `call_id` no
  `FunctionResponse`; o campo correto é `id` (HTTP 400 "Unknown name call_id"
  sempre que o modelo chamava alguma tool).
- RPC `apply_itinerary_changes`: `select count(*) ... for update` é sintaxe
  inválida no Postgres (FOR UPDATE não permite agregação) — corrigido para
  `perform ... for update` + `get diagnostics`. Provavelmente quebrava todo
  "Aplicar" do ReplanBoard desde o v1.0.0.
- RPC `apply_itinerary_changes`: a checagem de período da viagem rejeitava o
  lote inteiro se qualquer item nele tivesse data fora do range, mesmo sem
  estar mudando de data — agora só bloqueia quem de fato está mudando para
  uma data inválida.

### Adicionado
- `reschedule_itinerary_item` habilitado no Copiloto web (antes só o bot do
  WhatsApp reagendava atividades por chat); o fan-out de notificação por
  WhatsApp vira no-op quando o chamador é o web.
- Auto-scroll do Copiloto web para a última mensagem.

## [1.0.0] - 2026-09-14

### Adicionado
- **Sistema de replanejamento facilitado** (bot WhatsApp + tela no app):
  - Tools `replan_day` (empurrar/trocar/mover um dia inteiro, confirmação em
    duas etapas, exige `participants.can_manage_itinerary`) e
    `get_day_conditions` (clima + horário de parque + atrações sinalizadas,
    via themeparks.wiki, sempre como dica) no bot.
  - Tela **Replanejar** em Roteiro: kanban por dia com drag-and-drop
    (`@dnd-kit`), menu não-drag equivalente (Empurrar/Trocar/Mover), rascunho
    local com "Aplicar"/"Descartar"/"Desfazer".
  - RPC transacional `apply_itinerary_changes` — aplica lotes de mudanças de
    horário/dia atomicamente, usada por bot e tela.
  - Motor puro `_shared/replanEngine.ts` (shift/swap/move/resequence),
    compartilhado entre bot e app via `src/services/replanEngine.ts`.
  - Cache de condições externas (`external_conditions`): horário de parque e
    status de atração (themeparks.wiki), previsão do tempo no digest diário.
  - Alerta proativo de condições (chuva, parque fechado, atração em
    manutenção) uma vez por dia, só para organizadores, pendurado no digest
    horário existente.
  - Leitura de `itinerary_item_outcomes` no app (badges "Não rolou"/
    "Cancelada" no roteiro e no board) — antes só existia no bot.

### Alterado
- Modelo padrão do bot migrado de `gemini-3.5-flash` para `gemini-3.8-flash`
  (allowlist de modelo, `thinking_level` no lugar de `temperature` no
  Gemini, preço atualizado na estimativa de custo).

### Infraestrutura
- Migrations: `participants.can_manage_itinerary`,
  `itinerary_items.external_entity_id`, tabela `external_conditions`,
  função `apply_itinerary_changes`.
