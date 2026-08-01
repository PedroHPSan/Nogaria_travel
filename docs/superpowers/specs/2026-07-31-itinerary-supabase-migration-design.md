# Migrar `itinerary` de TripContext para Supabase

**Data:** 2026-07-31
**Escopo:** primeira fatia de uma migração maior de `TripContext.tsx` (hoje majoritariamente localStorage) para Supabase. Cobre só a entidade `itinerary_items`.

## Contexto

`TripContext.tsx` é a única camada de dados do app. Duas entidades já foram migradas pra Supabase em trabalho anterior a este: `trips` (`src/data/useTripsData.ts`) e `participants` (`src/data/useParticipantsData.ts`), ambas com o mesmo padrão — busca por `tenant_id`/`trip_id` no mount, escrita otimista local seguida de chamada Supabase, rollback exato + registro em `useWriteFailures` (com `retry`) se a chamada falhar. As ~14 entidades restantes (`flights`, `accommodations`, `transports`, `itinerary`, `gift_cards`, `purchase_items`, `luggages`, `expenses`, `tasks`, `decisions`, `documents`, `loyalty_accounts`, `ai_provider_configs`, `ai_usage_logs`) continuam 100% localStorage.

Nas fatias 1 e 2 do "roteiro dos 7 parques" (specs de 2026-07-31), a tabela `itinerary_items` ganhou os campos do roteiro-mestre e recebeu os 195 itens granulares de parque, além dos itens que já existiam (voos, transporte, restaurante, compras) — mas a UI (`ItineraryView`, e a nova aba "Cronologia" da fatia 2) continua lendo exclusivamente do `useState`+localStorage de `TripContext`. Qualquer edição feita na UI (inclusive marcar cobertura por participante na Cronologia) não persiste: some ao limpar o localStorage ou trocar de navegador.

Verificação direta no Supabase (via REST, service role) antes de escrever este spec confirmou que os 201 itens do `INITIAL_ITINERARY` local (195 de parque + 6 de voo/transporte/restaurante/compras) **já existem lá, com os mesmos IDs**. Não há nenhum dado local que precise ser levado pro banco — o trabalho é inteiramente sobre trocar a fonte de leitura/escrita.

## Objetivo desta fatia

Fazer `itinerary_items` seguir o mesmo padrão já usado por `trips`/`participants`: ler do Supabase, escrever no Supabase com otimismo e rollback, sem alterar a superfície pública que `ItineraryView`, `ItineraryModal`, `TimelineView`, `DayTimeline` e `MonthCalendar` já consomem.

## Decisões tomadas no brainstorm

| Questão | Decisão |
|---|---|
| Ordem de migração das ~14 entidades restantes | `itinerary_items` primeiro (dado já sincronizado no Supabase, destrava a Cronologia da fatia 2) |
| Escopo do backfill | Não há — os 201 itens locais já batem exatamente com o Supabase (confirmado por consulta direta antes deste spec) |
| Demais entidades (`flights`, `accommodations` etc.) | Fora de escopo, continuam localStorage |
| `activeTripId`, `currency`, `exchangeRate`, `resolvedAuditIds` | Fora de escopo — preferências de UI ou entidade separada (`audit_finding_resolutions`), ficam pra depois |

## Arquitetura

### `src/data/mappers/itineraryMapper.ts` (novo)

Segue o padrão de `tripMapper.ts`/`participantMapper.ts`: uma interface `ItineraryItemRow` espelhando a tabela Postgres literalmente, e duas funções puras `itineraryFromRow`/`itineraryToInsert`.

**Detalhe não-óbvio:** colunas Postgres do tipo `time` (`time_start`, `time_end`, `show_block_start`, `show_block_end`) voltam da API REST como `"HH:MM:SS"` (ex.: `"08:40:00"`), mas `ItineraryItem.time_start` e toda a lógica de conflito/ordenação em `DayTimeline.tsx` (`findConflictingShow`, `timeToMinutes`, a ordenação `a.time_start.localeCompare(b.time_start)`, e a exibição direta `{item.time_start}` no card) assumem `"HH:MM"`. `itineraryFromRow` trunca pra 5 caracteres (`row.time_start.slice(0, 5)`) nesses quatro campos. Não precisa reverter na escrita — Postgres aceita `"HH:MM"` como entrada válida pra `time`.

Os demais campos (incluindo os da fatia 1: `park`, `area`, `item_type`, `priority_tier`, `lightning_lane`, `participant_status` jsonb, etc.) passam direto — os tipos TS já foram desenhados para bater com as colunas.

### `src/data/useItineraryData.ts` (novo)

Mesmo formato de `useParticipantsData.ts`:

```ts
export interface ItineraryDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
}

export function useItineraryData({ client, tripId, recordFailure }: ItineraryDataDeps) {
  // useState<ItineraryItem[]>, useState<boolean> loading
  // useEffect: busca `itinerary_items` filtrado por `trip_id`, roda de novo quando `tripId` muda
  // addItineraryItem(data: Omit<ItineraryItem, 'id'>): void — otimista, insert, rollback+recordFailure em erro
  // updateItineraryItem(id: string, patch: Partial<ItineraryItem>): void — otimista, update, rollback pro valor anterior exato + recordFailure em erro
  // deleteItineraryItem(id: string): void — otimista, delete, devolve a linha inteira removida + recordFailure em erro
  return { itinerary, loading, addItineraryItem, updateItineraryItem, deleteItineraryItem };
}
```

Reusa o `SupabaseLike` já exportado por `useTripsData.ts` — mesmo tipo estrutural mínimo, mesmo padrão de injeção pra teste sem rede.

`participant_status` (usado pelo chip de cobertura em `DayTimeline.tsx`) é sempre mandado como objeto completo — o merge parcial (`{ ...item.participant_status, [participantId]: next }`) já acontece no client antes de chamar `updateItineraryItem`, então o hook só precisa persistir o que recebe, sem lógica de merge própria.

### `TripContext.tsx`

Troca:
- O `useState<ItineraryItem[]>` inicializado de `localStorage.getItem('${STORAGE_KEY}_itinerary')` e seu `useEffect` de persistência (linhas ~418-421, ~520) saem.
- `addItineraryItem`/`updateItineraryItem`/`deleteItineraryItem` (linhas ~678-690) saem — substituídas pelas do hook.
- Chama `useItineraryData({ client: supabase, tripId: activeTrip.id, recordFailure })`, igual ao padrão de `useParticipantsData` (linha ~396).
- `tripDataLoading` passa a ser `tripsLoading || participantsLoading || itineraryLoading`.

Nenhuma mudança de assinatura pública em `TripContextType` — `itinerary`, `addItineraryItem`, `updateItineraryItem`, `deleteItineraryItem` continuam com os mesmos tipos. `ItineraryView.tsx`, `ItineraryModal.tsx`, `TimelineView.tsx`, `DayTimeline.tsx`, `MonthCalendar.tsx` não precisam de nenhuma alteração.

**Nota sobre escopo do fetch:** hoje `TripContext` guarda itens de itinerário de *todas* as viagens (cada view filtra por `activeTrip.id` sozinha, conforme documentado no `CLAUDE.md`). O novo hook busca só os itens da viagem ativa (`trip_id` no filtro do `select`), igual `useParticipantsData` já faz para participantes — uma mudança de comportamento consistente com o padrão já adotado, não uma regressão: os filtros `itinerary.filter(i => i.trip_id === activeTrip.id)` que já existem nas views continuam funcionando (viram um no-op inofensivo, já que a lista chega pré-filtrada).

## Fora de escopo

- Qualquer outra entidade de `TripContext` além de `itinerary_items`.
- Migração/backfill de dados — confirmado que não é necessário.
- `activeTripId`, `currency`, `exchangeRate`, `resolvedAuditIds`.
- Mudança de comportamento em `ItineraryView`, `ItineraryModal`, `TimelineView`, `DayTimeline`, `MonthCalendar` além da troca de fonte de dados por baixo.

## Verificação

- **Testes unitários** (Vitest, já configurado): `itineraryMapper.test.ts` (round-trip linha↔`ItineraryItem`, cobrindo o truncamento `HH:MM:SS`→`HH:MM` nos quatro campos de horário) e `useItineraryData.test.tsx` (fetch inicial, add/update/delete otimista, rollback exato em erro, `recordFailure` chamado com `retry` funcional) — seguindo literalmente o padrão de `participantMapper.test.ts`/`useParticipantsData.test.tsx`.
- `npm run build` — typecheck completo.
- `npm run lint` — só os dois warnings pré-existentes.
- **QA manual no navegador**: abrir a aba Cronologia, marcar um item como `done` num participante, recarregar a página — a mudança deve persistir (prova de que não é mais localStorage). Conferir na aba Network que a chamada ao Supabase (`PATCH .../itinerary_items`) acontece. Simular falha de rede, marcar um item, confirmar que o `WriteFailureBanner` aparece, e que "tentar novamente" reaplica a chamada com sucesso ao restaurar a rede.
