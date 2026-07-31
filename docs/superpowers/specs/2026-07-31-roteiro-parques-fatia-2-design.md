# Roteiro dos 7 parques — Fatia 2: timeline + calendário + cobertura

**Data:** 2026-07-31
**Escopo:** segunda de cinco fatias do projeto "roteiro sempre cronológico" (ver `docs/superpowers/specs/2026-07-31-roteiro-parques-fatia-1-design.md` para a decomposição completa).

## Contexto

A fatia 1 estendeu `ItineraryItem` com os campos do roteiro-mestre (`park`, `area`, `item_type`, `priority_tier`, `lightning_lane`, `show_block_start/end`, `participant_status`, etc.) e populou a viagem ativa com os 195 itens granulares dos 7 parques, visíveis hoje apenas como uma lista filtrável genérica em `ItineraryView` (sem UI própria para os campos novos).

No início desta fatia, antecipou-se um item que a fatia 1 tinha deixado fora de escopo: os campos novos foram migrados para o Supabase remoto (`supabase/migrations/20260731160000_add_roteiro_fields_to_itinerary_items.sql`) e os 195 itens foram inseridos lá, substituindo as 7 linhas genéricas de "dia no parque" que ainda restavam. Isso não muda o escopo desta fatia: `TripContext` continua 100% localStorage (ver CLAUDE.md) e é isso que a UI abaixo consome — o dado remoto existe apenas como base para uma futura migração, ainda não iniciada.

Também se descobriu, nessa checagem, que a ingestão da fatia 1 nunca populou `show_block_start`/`show_block_end` para nenhum dos 39 shows (todos usavam o mesmo horário sintetizado por espaçamento das atrações, com `time_is_estimated: true`) — apesar do spec da fatia 1 prever horário real + bloqueio para shows. Corrigido antes de iniciar esta fatia: `buildParkDay` (`src/services/roteiro/shared.ts`) ganhou um campo `showDurationMin` por linha de show, e cada um dos 7 arquivos de parque recebeu uma duração plausível por show (mantendo o mesmo horário de início já sintetizado, sem inventar horários oficiais reais — vários shows já carregam nota pedindo confirmação no calendário oficial mais perto da viagem). Local e Supabase remoto foram re-sincronizados; o dado resultante tem 6 sobreposições reais entre item e bloco de show, suficientes para validar o alerta de conflito desta fatia.

## Objetivo desta fatia

Dar ao roteiro dos parques uma UI própria: uma timeline sempre cronológica por dia e uma view de calendário para navegar entre os dias da viagem, com os shows ocupando um bloco de horário fixo (com alerta se outro item colidir) e indicadores de cobertura (por tipo de item e por participante) que se atualizam conforme os itens são marcados como feitos/pulados.

## Decisões tomadas no brainstorm

| Questão | Decisão |
|---|---|
| Escopo desta fatia | Timeline + calendário juntos (não dividir em 2a/2b) |
| Encaixe na navegação | Nova `NavTab` dedicada, com toggle interno Timeline/Calendário — `ItineraryView` atual continua intacta para os outros tipos de item (voo, hotel, restaurante...) |
| Granularidade da cobertura | Contadores por tipo (atrações/shows/experiências/personagens) **e** por participante — não apenas um agregado único do dia |
| Bloqueio de horário dos shows | Visual (bloco ocupando `show_block_start`–`show_block_end`) **+** alerta de conflito se outro item do dia cair dentro desse intervalo — sem reordenar nada (isso é fatia 3) |
| Marcar status por participante | Entra nesta fatia — cada item ganha, por participante, um controle que cicla `pending → done → skipped`, gravando em `participant_status` via `updateItineraryItem` |
| Formato do calendário | Grid de mês (a viagem cabe inteira em Setembro/2026); célula do dia mostra o parque (se houver) e cobertura resumida; clique abre a timeline daquele dia |

## Arquitetura

### Navegação

Nova entrada em `NavTab` (`src/components/Navigation.tsx`), ex. `'timeline'`, rotulada "Cronologia". Branch correspondente em `App.tsx`. A `ItineraryView` existente não é alterada.

### Componentes (`src/features/timeline/`)

- **`TimelineView.tsx`** — raiz da nova aba. Estado local: `viewMode: 'timeline' | 'calendar'` (default `'timeline'`, na data mais próxima do dia atual dentro do intervalo da viagem) e `selectedDate: string`. Filtra `itinerary` por `activeTrip.id` e por `category === 'park'` (o roteiro-mestre é sempre `category: 'park'`; outros tipos de evento continuam na `ItineraryView`).
- **`DayTimeline.tsx`** — recebe os itens do dia selecionado. Renderiza:
  - Header de cobertura (ver seção Cobertura abaixo).
  - Lista ordenada por `time_start`, um card por item. Itens com `item_type: 'show'` e `show_block_start`/`show_block_end` definidos renderizam como um bloco distinto (borda/cor própria, rótulo "horário fixo") cobrindo esse intervalo; os demais mostram `time_start` normalmente, com um indicador sutil quando `time_is_estimated` é `true` (herdado da fatia 1, hoje sem UI).
  - Conflito: para cada item do dia com `show_block_start`/`end`, calcula-se o intervalo `[time_start, time_end ?? time_start + 30min]` de todo item **não-show** do mesmo dia; havendo sobreposição com o bloco do show, o item não-show ganha um badge de alerta ("conflita com `<nome do show>`"). Cálculo local ao componente (função pura, sem novo serviço) — é `O(n)` por dia, ~30-40 itens no pior caso.
  - Cada card tem, por participante presente em `participant_ids`, um chip clicável (avatar) que cicla `participant_status[participant.id]`: ausente/`'pending'` → `'done'` → `'skipped'` → volta a `'pending'`. Ao clicar, chama `updateItineraryItem(item.id, { participant_status: { ...item.participant_status, [participantId]: next } })`. Itens `character` sem `min_height_cm`/`min_age_years` aplicável simplesmente não usam o estado `'height_restricted'` (não há lógica de restrição nova nesta fatia — isso já existe em `ItineraryView` para altura e não é duplicado aqui).
- **`MonthCalendar.tsx`** — grid do mês da viagem (Setembro/2026, fixo — não precisa navegar entre meses porque a viagem cabe em um). Cada célula de dia com item de parque mostra o nome do parque e a cobertura agregada do dia (ex. "62%"); dias sem parque ficam neutros. Clique em um dia com parque muda `selectedDate` e `viewMode` para `'timeline'`.

### Cobertura (`src/services/coverageEngine.ts`)

Função pura nova, no mesmo espírito de `auditEngine.ts` (chamada dentro de `useMemo`, sem estado próprio):

```ts
computeCoverage(items: ItineraryItem[], participants: Participant[]): DayCoverage
```

Para um conjunto de itens de um dia (ou de um parque inteiro, reaproveitável para o resumo do calendário):
- Filtra por `counts_toward_completion !== false` (itens fechados/`scheduled_closure` não contam).
- Agrega por `item_type` (`attraction`/`show`/`experience`/`character`): `{ done, total }`, onde `done` é a contagem de itens cujo `participant_status[pid]` é `'done'` para **qualquer** participante elegível (cobertura "família": família cobre a atração se alguém cobriu).
- Agrega por participante: mesmo formato, mas só considerando participantes elegíveis por item (`min_height_cm`/`min_age_years` vs. os dados do participante — reaproveita a mesma comparação que `ItineraryView` já faz para o alerta de altura da Gabi, generalizada para todos os participantes e todos os itens, não só o alerta pontual existente). Participante inelegível não entra no denominador daquele item.
- Retorna também o percentual agregado do dia (soma de `done`/soma de `total` entre os quatro tipos), usado no resumo do calendário.

Sem memoização própria além do `useMemo` do componente que chama — o volume (até ~40 itens/dia) não justifica cache adicional.

### Sem novo estado no `TripContext`

Cobertura é sempre derivada. Nada novo é persistido além do que a fatia 1 já preparou (`participant_status` no próprio item, via `updateItineraryItem` já existente).

## Fora de escopo nesta fatia

- Motor de recálculo automático e reordenação por fila/clima/fechamento — fatias 3 e 4.
- Qualquer alteração na `ItineraryView` existente ou nos itens que não são `category: 'park'`.
- Migração do `TripContext` para Supabase — os dados remotos inseridos no início desta fatia servem de base futura, não são lidos pela UI construída aqui.
- Navegação de mês (anterior/próximo) no calendário — a viagem cabe inteira em Setembro/2026.
- Edição de `participant_status` fora da timeline (ex.: em massa, por atalho de teclado) — só o chip por item/participante.

## Verificação

Sem framework de teste no projeto (ver CLAUDE.md). Verificação desta fatia:
- `npm run build` passa (typecheck + build).
- `npm run dev`, abrir a nova aba "Cronologia":
  - No modo calendário, conferir que os dias 07, 08, 10, 11, 13, 14 e 15/09 mostram o parque certo e uma cobertura inicial de 0%.
  - Clicar em um dia (ex. Magic Kingdom, 07/09) e conferir que os 40 itens aparecem em ordem cronológica, que os shows aparecem destacados nos horários certos, e que marcar um item como "feito" para um participante atualiza a cobertura do header imediatamente.
  - Conferir que os dias com conflito real (existem 6 no dado atual — verificável com a query descrita na seção anterior) mostram o badge de alerta no item que cai dentro do bloco do show.
  - Voltar ao calendário e conferir que o percentual daquele dia mudou.
