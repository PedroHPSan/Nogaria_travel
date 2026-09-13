# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
versionamento [SemVer](https://semver.org/lang/pt-BR/). Cada release em
produção (`vercel deploy --prod`) ganha uma entrada aqui e uma tag `vX.Y.Z`
no commit correspondente — ver "Versionamento" no `CLAUDE.md`.

> **Nota histórica:** o projeto rodou 161 commits sem versionamento formal
> antes desta entrada. `1.0.0` marca o início do controle de versão, não a
> "primeira versão" do produto — o app já estava em uso real pela família
> (issues #18–#59, ver `roadmap-ia-issues-2026-09` na memória do projeto).

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
