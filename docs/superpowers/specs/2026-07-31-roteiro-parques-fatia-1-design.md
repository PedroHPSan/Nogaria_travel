# Roteiro dos 7 parques — Fatia 1: modelo de dados + ingestão

**Data:** 2026-07-31
**Escopo:** primeira de cinco fatias do projeto "roteiro sempre cronológico" (timeline + calendário).

## Problema

O Pedro tem um roteiro-mestre detalhado dos 7 parques (Magic Kingdom, Hollywood Studios, EPCOT, Animal Kingdom, Universal Studios Florida, Islands of Adventure, Epic Universe) com ~250-300 itens (atrações, shows, experiências, personagens), cada um carregando prioridade (S/A/B/C), status operacional, plano B, regras de Lightning Lane/Express, restrição de altura, rider switch/child swap e janela recomendada. Ele quer isso vivo na viagem ativa do app, navegável como timeline e como calendário, com recálculo automático quando fila, clima ou fechamentos mudam.

Hoje `ItineraryItem` (`src/types/database.types.ts:129-149`) é uma linha achatada por evento (voo, hotel, restaurante, "dia no parque"...) sem nenhum desses campos. Não existe catálogo de parques/atrações em lugar nenhum do código — cada "dia de parque" é uma única linha genérica no seed (`INITIAL_ITINERARY`, `src/services/initialMockData.ts:502`). Ingerir o roteiro-mestre bruto nesse modelo perderia quase toda a estrutura do texto.

## Decomposição em cinco fatias

1. **Modelo de dados + ingestão** (este spec) — estende `ItineraryItem` e popula a viagem ativa com os itens reais dos 7 parques
2. **Timeline + calendário** — telas cronológicas sempre ativas, bloqueio de horário para shows, indicadores de cobertura
3. **Motor de recálculo** — reordena o restante do dia com base em sinais (fila, clima, fechamento, LL disponível)
4. **Integração com APIs externas ao vivo** — fila (ex.: queue-times.com) e clima, alimentando o motor da fatia 3
5. **(se necessário) ajustes finos pós-uso real** — datas exatas, horários de show, calendário oficial próximo à viagem (rule 6 do documento original)

Cada fatia tem seu próprio spec e plano. Esta fatia só entrega dado estruturado + visível na `ItineraryView` já existente (sem nova UI) — a timeline/calendário da fatia 2 e o motor das fatias 3-4 dependem deste modelo já existir.

## Decisões tomadas no brainstorm

| Questão | Decisão |
|---|---|
| Nova entidade ou estender `ItineraryItem`? | Estender — reaproveita `ItineraryView`/`ItineraryModal` existentes para verificação imediata no navegador, sem construir UI nova nesta fatia |
| Motor de recálculo automático (fila/clima) | Vai ser construído, mas como fatias 3-4 separadas — não faz parte desta fatia |
| Origem dos gatilhos do motor | APIs externas (fila + clima), não entrada manual — detalhado na fatia 4 |
| Cobertura (`cobertura_atracoes`, etc.) | Fica para a fatia 2, onde há UI para exibir — construir agora seria especulativo |
| Migração Supabase para as colunas novas | Fora de escopo — `TripContext` não fala com Supabase para dado de viagem ainda (ver CLAUDE.md); adicionar coluna ao schema remoto hoje seria schema morto |
| Atrações fechadas (Jurassic Park River Adventure, etc.) | Entram como linhas com `operational_status` e `counts_toward_completion: false`, não são omitidas |

## Modelo de dados

Campos novos em `ItineraryItem` (todos opcionais ou com default, aditivos — não quebram nada que já lê essa interface):

| campo | origem no documento | tipo |
|---|---|---|
| `park` | `parque` | `string?` |
| `area` | `area` | `string?` |
| `base_order` | `ordem_base` | `number?` |
| `item_type` | `tipo` | `'attraction' \| 'show' \| 'experience' \| 'character'?` |
| `priority_tier` | `prioridade` | `'S' \| 'A' \| 'B' \| 'C'?` |
| `lightning_lane` | `express_ou_lightning_lane` | `'none' \| 'genie_plus' \| 'individual' \| 'express'?` |
| `lightning_lane_priority_rank` | listas "Prioridade das Lightning Lanes" por parque | `number?` |
| `single_rider` | `single_rider` | `boolean` (default `false`) |
| `child_switch` | `child_switch` | `boolean` (default `false`) |
| `recommended_window` | `janela_recomendada` | `string?` |
| `early_closure_risk` | `encerramento_antecipado` | `boolean` (default `false`) |
| `operational_status` | `status_operacional` | `'operating' \| 'scheduled_closure' \| 'temporarily_closed' \| 'refurbishment'` (default `'operating'`) |
| `counts_toward_completion` | `elegivel_para_percentual` | `boolean` (default derivado de `operational_status`, sobrescrevível) |
| `participant_status` | `status_usuario` | `Record<string, 'pending' \| 'done' \| 'skipped' \| 'height_restricted' \| 'not_applicable'>` (default `{}`, chave = `participant_id`) |
| `plan_b` | `plano_b` | `string?` (texto livre ou nome de outro item) |
| `time_is_estimated` | — (necessário para a regra de cronologia sempre) | `boolean` (default `false`) |
| `show_block_start` / `show_block_end` | `bloqueio_inicio` / `bloqueio_fim` | `string?` (`HH:MM`), só quando `item_type: 'show'` |
| `recommended_arrival_min_before` | `chegada_recomendada_min` | `number?` |
| `last_showtime_of_day` | `ultima_chance_do_dia` | `boolean` (default `false`) |

`min_height_cm` e `min_age_years` já existem na interface e são reaproveitados sem duplicação. `title` guarda o `nome`; `description` guarda observações que não cabem nos campos estruturados acima.

### Cronologia sem hora falsa

`time_start` continua obrigatório (nada mais no código depende disso mudar), mas para atrações/experiências sem horário fixo real, a ingestão sintetiza um horário espaçado dentro do horário de funcionamento do parque, seguindo a ordem de `base_order`, e marca `time_is_estimated: true`. Shows recebem horário real e `time_is_estimated: false`, mais `show_block_start/end`. Assim todo item sempre tem uma posição cronológica (satisfazendo "cronologia sempre" do documento original), mas a fatia 2 pode diferenciar visualmente "travado" de "reordenável" usando essa flag — sem precisar construir essa UI agora.

## Ingestão

- Substitui as linhas genéricas de "dia no parque" hoje em `INITIAL_ITINERARY` (Magic Kingdom, EPCOT, Hollywood Studios, Animal Kingdom, Universal Studios Florida, Epic Universe) pelas linhas granulares (uma por atração/show/experiência/personagem) do roteiro-mestre.
- Islands of Adventure não tem dia alocado no seed atual — a implementação confere as datas reais da viagem no seed e adiciona um dia para IOA; se não houver data livre, isso é levantado com o Pedro antes de inventar uma data.
- IDs são strings literais explícitas no seed (ex.: `mk-attr-001`), não geradas via `` `prefix-${Date.now()}` `` — evita a colisão de IDs documentada no CLAUDE.md, já que isso é dado estático de seed, não passa pelo caminho `add*` do `TripContext`.
- Itens de voo/hotel/restaurante/transporte já existentes no seed não são tocados.
- Atrações fechadas na viagem (Jurassic Park River Adventure, "It's Tough to Be a Bug!") entram como linhas com `operational_status` adequado e `counts_toward_completion: false`.
- As duas versões de Mission: SPACE (Orange/Green) entram como duas linhas distintas, conforme o próprio documento recomenda para fins de métrica.

## Fora de escopo nesta fatia

- Cálculo de cobertura (`cobertura_atracoes/shows/experiencias/personagens/familia/...`) — fatia 2, junto da UI que vai exibir.
- Qualquer mudança de UI — `ItineraryView`/`ItineraryModal` continuam como estão; os campos novos existem no dado mas não aparecem em tela nova nesta fatia.
- Migração de schema no Supabase remoto — sem wiring de dado de viagem ainda, adicionar coluna seria schema morto.
- Motor de recálculo e integração com APIs externas — fatias 3 e 4.

## Verificação

Sem framework de teste no projeto (ver CLAUDE.md). Verificação desta fatia:
- `npm run build` passa (typecheck + build) com os novos campos opcionais.
- `npm run dev`, abrir a `ItineraryView` da viagem ativa, filtrar por categoria "Parques" e conferir que os ~250-300 itens aparecem, um por atração/show, com título e horário — confirma que a ingestão populou o `localStorage` corretamente e que nada quebrou na renderização existente.
