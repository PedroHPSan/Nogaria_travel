# Roteiro dos 7 parques — Fatia 1: modelo de dados + ingestão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender `ItineraryItem` com os campos do roteiro-mestre dos 7 parques (prioridade, status operacional, Lightning Lane, cobertura por participante, etc.) e substituir as 7 linhas genéricas de "dia no parque" do seed por ~195 linhas granulares (uma por atração/show/experiência/personagem), visíveis na `ItineraryView` já existente.

**Architecture:** Um módulo novo `src/services/roteiro/` com um builder compartilhado (`shared.ts`) que converte linhas compactas (`RoteiroRow` tuples) em `ItineraryItem[]` completos, mais um arquivo por parque. `initialMockData.ts` importa os 7 arrays e substitui as linhas `b0000000-...-005` a `011` por eles.

**Tech Stack:** TypeScript 6, sem framework de teste (ver Global Constraints).

## Global Constraints

- Sem framework de teste no projeto — verificação é `npm run build` (typecheck + build) e checagem manual no navegador. Não inventar `pytest`/`vitest`/etc.
- `verbatimModuleSyntax` exige `import type` (ou `import { type X }`) para importações somente-de-tipo, ou o build falha.
- `noUnusedLocals` e `noUnusedParameters` — variáveis/parâmetros não usados quebram `npm run build` (não aparecem em `npm run dev`).
- `erasableSyntaxOnly` proíbe `enum` — usar union types de string literais.
- IDs de seed são strings literais explícitas, nunca `` `prefix-${Date.now()}` `` (colisão documentada no CLAUDE.md) — este é dado estático, não passa pelo `add*` do `TripContext`.
- Convenção de nomes de campo: `snake_case`, igual ao resto de `database.types.ts`.
- Trip ativa: `trip_id: '9a8b7c6d-5e4f-4321-8765-4321fedcba09'`. Participantes: `'11111111-1111-4111-8111-111111111111'` (Bárbara), `'22222222-2222-4222-8222-222222222222'` (Pedro), `'33333333-3333-4333-8333-333333333333'` (Débora), `'44444444-4444-4444-8444-444444444444'` (Gabi).
- Datas/horários dos 7 dias de parque já existem no seed atual e devem ser reaproveitados exatamente:
  - Magic Kingdom: `2026-09-07`, `08:30`–`21:00`, `city: 'Lake Buena Vista'`
  - EPCOT: `2026-09-08`, `09:00`–`21:00`, `city: 'Lake Buena Vista'`
  - Hollywood Studios: `2026-09-10`, `07:15`–`21:30`, `city: 'Lake Buena Vista'`
  - Animal Kingdom: `2026-09-11`, `07:10`–`16:00`, `city: 'Lake Buena Vista'`
  - Universal Studios Florida: `2026-09-13`, `10:00`–`19:00`, `city: 'Orlando'`
  - Epic Universe: `2026-09-14`, `07:00`–`20:00`, `city: 'Orlando'`
  - Islands of Adventure: `2026-09-15`, `07:00`–`19:00`, `city: 'Orlando'`

---

## Task 1: Estender o tipo `ItineraryItem`

**Files:**
- Modify: `src/types/database.types.ts:129-149`

**Interfaces:**
- Produces: os 19 campos novos abaixo em `ItineraryItem`, usados por todas as tarefas seguintes.

- [ ] **Step 1: Adicionar os campos novos à interface**

Substituir o bloco atual (`src/types/database.types.ts:129-149`):

```ts
export interface ItineraryItem {
  id: string;
  trip_id: string;
  date: string;
  time_start: string;
  time_end?: string;
  city: string;
  title: string;
  category: 'flight' | 'hotel' | 'park' | 'restaurant' | 'shopping' | 'tour' | 'rest' | 'transit' | 'event';
  description?: string;
  location?: string;
  participant_ids: string[];
  estimated_cost?: number;
  currency?: Currency;
  payment_method_id?: string;
  status: 'planned' | 'confirmed' | 'optional' | 'completed' | 'cancelled';
  min_height_cm?: number;
  min_age_years?: number;
  child_friendly: boolean;
  notes?: string;
}
```

por:

```ts
export interface ItineraryItem {
  id: string;
  trip_id: string;
  date: string;
  time_start: string;
  time_end?: string;
  city: string;
  title: string;
  category: 'flight' | 'hotel' | 'park' | 'restaurant' | 'shopping' | 'tour' | 'rest' | 'transit' | 'event';
  description?: string;
  location?: string;
  participant_ids: string[];
  estimated_cost?: number;
  currency?: Currency;
  payment_method_id?: string;
  status: 'planned' | 'confirmed' | 'optional' | 'completed' | 'cancelled';
  min_height_cm?: number;
  min_age_years?: number;
  child_friendly: boolean;
  notes?: string;
  park?: string;
  area?: string;
  base_order?: number;
  item_type?: 'attraction' | 'show' | 'experience' | 'character';
  priority_tier?: 'S' | 'A' | 'B' | 'C';
  lightning_lane?: 'none' | 'genie_plus' | 'individual' | 'express';
  lightning_lane_priority_rank?: number;
  single_rider?: boolean;
  child_switch?: boolean;
  recommended_window?: string;
  early_closure_risk?: boolean;
  operational_status?: 'operating' | 'scheduled_closure' | 'temporarily_closed' | 'refurbishment';
  counts_toward_completion?: boolean;
  participant_status?: Record<string, 'pending' | 'done' | 'skipped' | 'height_restricted' | 'not_applicable'>;
  plan_b?: string;
  time_is_estimated?: boolean;
  show_block_start?: string;
  show_block_end?: string;
  recommended_arrival_min_before?: number;
  last_showtime_of_day?: boolean;
}
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: sucesso, sem erros de tipo (todos os campos novos são opcionais — nenhum código existente que constrói `ItineraryItem` deveria quebrar).

- [ ] **Step 3: Commit**

```bash
git add src/types/database.types.ts
git commit -m "Add roteiro fields to ItineraryItem (priority tier, operational status, lightning lane, participant coverage)"
```

---

## Task 2: Criar o builder compartilhado do roteiro

**Files:**
- Create: `src/services/roteiro/shared.ts`

**Interfaces:**
- Consumes: `ItineraryItem` (Task 1).
- Produces: `RoteiroRow` (tuple type), `RoteiroRowExtra`, `ParkDayConfig`, `buildParkDay(config, rows): ItineraryItem[]` — usados por todas as tarefas de parque (3-9).

- [ ] **Step 1: Criar o arquivo**

```ts
import type { ItineraryItem } from '../../types/database.types';

export const ROTEIRO_TRIP_ID = '9a8b7c6d-5e4f-4321-8765-4321fedcba09';

export const ROTEIRO_ALL_PARTICIPANT_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
];

export type RoteiroItemType = 'attraction' | 'show' | 'experience' | 'character';
export type RoteiroPriority = 'S' | 'A' | 'B' | 'C';
export type RoteiroLightningLane = 'none' | 'genie_plus' | 'individual' | 'express';
export type RoteiroOperationalStatus = 'operating' | 'scheduled_closure' | 'temporarily_closed' | 'refurbishment';

export interface RoteiroRowExtra {
  lightningLane?: RoteiroLightningLane;
  lightningLaneRank?: number;
  earlyClosureRisk?: boolean;
  lastShowtimeOfDay?: boolean;
  operationalStatus?: RoteiroOperationalStatus;
  countsTowardCompletion?: boolean;
  description?: string;
  timeStartOverride?: string;
  timeIsEstimated?: boolean;
}

export type RoteiroRow = [
  order: number,
  name: string,
  area: string,
  type: RoteiroItemType,
  priority?: RoteiroPriority,
  extra?: RoteiroRowExtra
];

export interface ParkDayConfig {
  parkKey: string;
  parkName: string;
  city: string;
  date: string;
  openTime: string;
  closeTime: string;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const rounded = Math.round(minutes / 5) * 5;
  const hours = Math.floor(rounded / 60) % 24;
  const mins = rounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function buildParkDay(config: ParkDayConfig, rows: RoteiroRow[]): ItineraryItem[] {
  const openMinutes = timeToMinutes(config.openTime);
  const closeMinutes = timeToMinutes(config.closeTime);
  const spacing = (closeMinutes - openMinutes) / rows.length;

  return rows.map(([order, name, area, type, priority, extra = {}]) => {
    const operationalStatus = extra.operationalStatus ?? 'operating';
    const timeStart = extra.timeStartOverride ?? minutesToTime(openMinutes + spacing * (order - 0.5));
    const timeIsEstimated = extra.timeIsEstimated ?? extra.timeStartOverride === undefined;

    const item: ItineraryItem = {
      id: `${config.parkKey}-${String(order).padStart(3, '0')}`,
      trip_id: ROTEIRO_TRIP_ID,
      date: config.date,
      time_start: timeStart,
      city: config.city,
      title: name,
      category: 'park',
      description: extra.description,
      location: config.parkName,
      participant_ids: ROTEIRO_ALL_PARTICIPANT_IDS,
      status: 'planned',
      child_friendly: true,
      park: config.parkName,
      area,
      base_order: order,
      item_type: type,
      priority_tier: priority,
      lightning_lane: extra.lightningLane ?? 'none',
      lightning_lane_priority_rank: extra.lightningLaneRank,
      single_rider: false,
      child_switch: false,
      early_closure_risk: extra.earlyClosureRisk ?? false,
      operational_status: operationalStatus,
      counts_toward_completion: extra.countsTowardCompletion ?? (operationalStatus === 'operating'),
      participant_status: {},
      time_is_estimated: timeIsEstimated,
      last_showtime_of_day: extra.lastShowtimeOfDay ?? false,
    };

    return item;
  });
}
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: sucesso — o arquivo não é importado por ninguém ainda, mas deve compilar isoladamente sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add src/services/roteiro/shared.ts
git commit -m "Add shared builder for roteiro park-day itinerary items"
```

---

## Task 3: Dados do Magic Kingdom

**Files:**
- Create: `src/services/roteiro/magicKingdom.ts`

**Interfaces:**
- Consumes: `buildParkDay`, `RoteiroRow` (Task 2).
- Produces: `MAGIC_KINGDOM_ITEMS: ItineraryItem[]` (40 itens), consumido pela Task 10.

- [ ] **Step 1: Criar o arquivo**

```ts
import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, 'Seven Dwarfs Mine Train', 'Fantasyland', 'attraction', 'S', { lightningLane: 'individual' }],
  [2, "Peter Pan's Flight", 'Fantasyland', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 2 }],
  [3, 'The Many Adventures of Winnie the Pooh', 'Fantasyland', 'attraction', 'A', { lightningLane: 'genie_plus', lightningLaneRank: 5 }],
  [4, 'Mad Tea Party', 'Fantasyland', 'attraction', 'B'],
  [5, 'Prince Charming Regal Carrousel', 'Fantasyland', 'attraction', 'B'],
  [6, "it's a small world", 'Fantasyland', 'attraction', 'A'],
  [7, "Mickey's PhilharMagic", 'Fantasyland', 'attraction', 'A'],
  [8, 'Dumbo the Flying Elephant', 'Storybook Circus', 'attraction', 'A'],
  [9, 'The Barnstormer', 'Storybook Circus', 'attraction', 'B'],
  [10, "Casey Jr. Splash 'N' Soak Station", 'Storybook Circus', 'experience', 'C'],
  [11, 'Smellephants on Parade', 'Storybook Circus', 'experience', 'C'],
  [12, 'Under the Sea – Journey of the Little Mermaid', 'Fantasyland', 'attraction', 'A'],
  [13, 'Enchanted Tales with Belle', 'Fantasyland', 'experience', 'B'],
  [14, 'Meet Ariel at Her Grotto', 'Fantasyland', 'character', undefined, { description: 'Encontro opcional de personagem, com métrica de cobertura própria.' }],
  [15, 'Tomorrowland Speedway', 'Tomorrowland', 'attraction', 'B'],
  [16, 'TRON Lightcycle / Run', 'Tomorrowland', 'attraction', 'S', { lightningLane: 'individual' }],
  [17, 'Space Mountain', 'Tomorrowland', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 4 }],
  [18, 'Astro Orbiter', 'Tomorrowland', 'attraction', 'B'],
  [19, 'Tomorrowland Transit Authority PeopleMover', 'Tomorrowland', 'attraction', 'A'],
  [20, "Walt Disney's Carousel of Progress", 'Tomorrowland', 'attraction', 'B'],
  [21, 'Monsters, Inc. Laugh Floor', 'Tomorrowland', 'attraction', 'A'],
  [22, "Buzz Lightyear's Space Ranger Spin", 'Tomorrowland', 'attraction', 'A'],
  [23, 'Haunted Mansion', 'Liberty Square', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 6 }],
  [24, 'The Hall of Presidents', 'Liberty Square', 'attraction', 'B'],
  [25, 'Country Bear Musical Jamboree', 'Frontierland', 'attraction', 'A'],
  [26, "Tiana's Bayou Adventure", 'Frontierland', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 1 }],
  [27, 'Big Thunder Mountain Railroad', 'Frontierland', 'attraction', 'S'],
  [28, 'Pirates of the Caribbean', 'Adventureland', 'attraction', 'S'],
  [29, "A Pirate's Adventure – Treasures of the Seven Seas", 'Adventureland', 'experience', 'C'],
  [30, 'Jungle Cruise', 'Adventureland', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 3 }],
  [31, 'The Magic Carpets of Aladdin', 'Adventureland', 'attraction', 'B'],
  [32, "Walt Disney's Enchanted Tiki Room", 'Adventureland', 'attraction', 'B'],
  [33, 'Swiss Family Treehouse', 'Adventureland', 'attraction', 'C'],
  [34, 'Walt Disney World Railroad', 'Main Street, U.S.A.', 'attraction', 'B', { earlyClosureRisk: true }],
  [35, 'Main Street Vehicles', 'Main Street, U.S.A.', 'attraction', 'C', { earlyClosureRisk: true, description: 'Rodar somente se estiver operando no dia.' }],
  [36, 'Disney Adventure Friends Cavalcade', 'Castelo / rota do desfile', 'show'],
  [37, "Mickey's Magical Friendship Faire", 'Castelo / rota do desfile', 'show'],
  [38, 'Disney Festival of Fantasy Parade', 'Castelo / rota do desfile', 'show'],
  [39, 'Disney Starlight: Dream the Night Away', 'Castelo / rota do desfile', 'show'],
  [40, 'Happily Ever After', 'Castelo / rota do desfile', 'show', undefined, { lastShowtimeOfDay: true, description: 'Show final obrigatório de fogos.' }],
];

export const MAGIC_KINGDOM_ITEMS = buildParkDay(
  {
    parkKey: 'mk',
    parkName: 'Magic Kingdom',
    city: 'Lake Buena Vista',
    date: '2026-09-07',
    openTime: '08:30',
    closeTime: '21:00',
  },
  ROWS
);
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 3: Commit**

```bash
git add src/services/roteiro/magicKingdom.ts
git commit -m "Add Magic Kingdom roteiro data (40 items)"
```

---

## Task 4: Dados do EPCOT

**Files:**
- Create: `src/services/roteiro/epcot.ts`

**Interfaces:**
- Consumes: `buildParkDay`, `RoteiroRow` (Task 2).
- Produces: `EPCOT_ITEMS: ItineraryItem[]` (33 itens), consumido pela Task 10.

- [ ] **Step 1: Criar o arquivo**

```ts
import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, 'Guardians of the Galaxy: Cosmic Rewind', 'World Discovery', 'attraction', 'S', { lightningLane: 'individual', description: 'Estratégia própria conforme o sistema de acesso disponível na viagem.' }],
  [2, 'Test Track', 'World Discovery', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 3 }],
  [3, 'Mission: SPACE – Orange Mission', 'World Discovery', 'attraction', 'A', { lightningLane: 'genie_plus', lightningLaneRank: 6, description: 'Mesma atração-base da versão Green; registradas separadamente só para métrica de cobertura.' }],
  [4, 'Mission: SPACE – Green Mission', 'World Discovery', 'attraction', 'B'],
  [5, 'Advanced Training Lab', 'World Discovery', 'experience', 'C'],
  [6, "Soarin' Across America", 'World Nature', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 4, description: 'Versão de verão 2026 válida até 08/09 — confirmar no calendário oficial na data.' }],
  [7, 'Living with the Land', 'World Nature', 'attraction', 'A'],
  [8, 'Awesome Planet', 'World Nature', 'show', 'B'],
  [9, 'The Seas with Nemo & Friends', 'World Nature', 'attraction', 'A'],
  [10, 'SeaBase Aquarium', 'World Nature', 'experience', 'B'],
  [11, 'Turtle Talk with Crush', 'World Nature', 'attraction', 'A'],
  [12, 'Journey of Water, Inspired by Moana', 'World Nature', 'experience', 'B'],
  [13, 'Spaceship Earth', 'World Celebration', 'attraction', 'A', { lightningLane: 'genie_plus', lightningLaneRank: 5 }],
  [14, 'Project Tomorrow', 'World Celebration', 'experience', 'C'],
  [15, 'Journey Into Imagination with Figment', 'World Celebration', 'attraction', 'B'],
  [16, 'ImageWorks – The "What If" Labs', 'World Celebration', 'experience', 'C'],
  [17, 'Disney & Pixar Short Film Festival', 'World Celebration', 'attraction', 'B'],
  [18, 'Gran Fiesta Tour Starring The Three Caballeros', 'México', 'attraction', 'A'],
  [19, 'Exploração do Pavilhão do México', 'México', 'experience', 'C'],
  [20, 'Frozen Ever After', 'Noruega', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 2 }],
  [21, 'Akershus Royal Banquet Hall', 'Noruega', 'experience', undefined, { timeStartOverride: '15:15', timeIsEstimated: false, description: 'Reserva confirmada às 15h15.' }],
  [22, 'Reflections of China', 'China', 'show', 'B'],
  [23, 'Exploração da Alemanha', 'Alemanha', 'experience', 'C'],
  [24, 'Exploração da Itália', 'Itália', 'experience', 'C'],
  [25, 'The American Adventure', 'Estados Unidos', 'show', 'A'],
  [26, 'Voices of Liberty', 'Estados Unidos', 'show'],
  [27, 'Exploração do Japão', 'Japão', 'experience', 'C'],
  [28, 'Exploração do Marrocos', 'Marrocos', 'experience', 'C'],
  [29, "Remy's Ratatouille Adventure", 'França', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 1 }],
  [30, 'Beauty and the Beast Sing-Along', 'França', 'show', 'B'],
  [31, 'Exploração do Reino Unido', 'Reino Unido', 'experience', 'C'],
  [32, 'Canada Far and Wide in Circle-Vision 360', 'Canadá', 'show', 'B'],
  [33, 'Luminous: The Symphony of Us', 'Encerramento', 'show', undefined, { lastShowtimeOfDay: true, description: 'Conforme programação oficial da data.' }],
];

export const EPCOT_ITEMS = buildParkDay(
  {
    parkKey: 'ec',
    parkName: 'EPCOT',
    city: 'Lake Buena Vista',
    date: '2026-09-08',
    openTime: '09:00',
    closeTime: '21:00',
  },
  ROWS
);
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 3: Commit**

```bash
git add src/services/roteiro/epcot.ts
git commit -m "Add EPCOT roteiro data (33 items)"
```

---

## Task 5: Dados do Disney's Hollywood Studios

**Files:**
- Create: `src/services/roteiro/hollywoodStudios.ts`

**Interfaces:**
- Consumes: `buildParkDay`, `RoteiroRow` (Task 2).
- Produces: `HOLLYWOOD_STUDIOS_ITEMS: ItineraryItem[]` (19 itens), consumido pela Task 10.

- [ ] **Step 1: Criar o arquivo**

```ts
import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, 'Slinky Dog Dash', 'Toy Story Land', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 1 }],
  [2, 'Toy Story Mania!', 'Toy Story Land', 'attraction', 'A', { lightningLane: 'genie_plus', lightningLaneRank: 4 }],
  [3, 'Alien Swirling Saucers', 'Toy Story Land', 'attraction', 'B', { lightningLane: 'genie_plus', lightningLaneRank: 6 }],
  [4, 'Star Wars: Rise of the Resistance', "Galaxy's Edge", 'attraction', 'S', { description: 'Estratégia própria conforme o produto de fila disponível.' }],
  [5, 'Millennium Falcon: Smugglers Run', "Galaxy's Edge", 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 5 }],
  [6, "Exploração de Galaxy's Edge e Datapad", "Galaxy's Edge", 'experience', 'B'],
  [7, 'Star Tours – The Adventures Continue', 'Grand Avenue e Echo Lake', 'attraction', 'A'],
  [8, 'Indiana Jones Epic Stunt Spectacular!', 'Grand Avenue e Echo Lake', 'show'],
  [9, 'For the First Time in Forever: A Frozen Sing-Along Celebration', 'Grand Avenue e Echo Lake', 'show'],
  [10, 'Vacation Fun – An Original Animated Short with Mickey & Minnie', 'Grand Avenue e Echo Lake', 'experience', 'C'],
  [11, 'Disney Junior Play and Dance!', 'Grand Avenue e Echo Lake', 'show', 'C', { description: 'Especialmente indicado para a Gabriela.' }],
  [12, "Mickey & Minnie's Runaway Railway", 'Hollywood Boulevard', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 2 }],
  [13, 'The Twilight Zone Tower of Terror', 'Sunset Boulevard', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 3 }],
  [14, "Rock 'n' Roller Coaster Starring The Muppets", 'Sunset Boulevard', 'attraction', 'S'],
  [15, 'Beauty and the Beast – Live on Stage', 'Sunset Boulevard', 'show'],
  [16, 'The Little Mermaid – A Musical Adventure', 'Sunset Boulevard', 'show'],
  [17, 'Disney Villains: Unfairly Ever After', 'Sunset Boulevard', 'show'],
  [18, 'Wonderful World of Animation', 'Encerramento', 'show', undefined, { description: 'Se estiver programado no dia.' }],
  [19, 'Fantasmic!', 'Encerramento', 'show', undefined, { lastShowtimeOfDay: true, description: 'Show final obrigatório.' }],
];

export const HOLLYWOOD_STUDIOS_ITEMS = buildParkDay(
  {
    parkKey: 'hs',
    parkName: "Disney's Hollywood Studios",
    city: 'Lake Buena Vista',
    date: '2026-09-10',
    openTime: '07:15',
    closeTime: '21:30',
  },
  ROWS
);
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 3: Commit**

```bash
git add src/services/roteiro/hollywoodStudios.ts
git commit -m "Add Hollywood Studios roteiro data (19 items)"
```

---

## Task 6: Dados do Disney's Animal Kingdom

**Files:**
- Create: `src/services/roteiro/animalKingdom.ts`

**Interfaces:**
- Consumes: `buildParkDay`, `RoteiroRow` (Task 2).
- Produces: `ANIMAL_KINGDOM_ITEMS: ItineraryItem[]` (19 itens), consumido pela Task 10.

- [ ] **Step 1: Criar o arquivo**

```ts
import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, 'Avatar Flight of Passage', 'Pandora', 'attraction', 'S', { description: 'Estratégia própria conforme o acesso disponível.' }],
  [2, "Na'vi River Journey", 'Pandora', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 1 }],
  [3, "Exploração de Pandora e Valley of Mo'ara", 'Pandora', 'experience', 'B'],
  [4, 'Kilimanjaro Safaris', 'Africa', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 2 }],
  [5, 'Gorilla Falls Exploration Trail', 'Africa', 'experience', 'A'],
  [6, 'Festival of the Lion King', 'Africa', 'show', 'S'],
  [7, 'Wildlife Express Train', "Rafiki's Planet Watch", 'experience', 'B', { description: 'Trajeto de ida; o retorno faz parte da mesma experiência.' }],
  [8, 'Affection Section', "Rafiki's Planet Watch", 'experience', 'B'],
  [9, 'Conservation Station', "Rafiki's Planet Watch", 'experience', 'B'],
  [10, 'Animation Experience at Conservation Station', "Rafiki's Planet Watch", 'experience', 'A'],
  [11, 'Expedition Everest – Legend of the Forbidden Mountain', 'Asia', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 3 }],
  [12, 'Maharajah Jungle Trek', 'Asia', 'experience', 'A'],
  [13, 'Kali River Rapids', 'Asia', 'attraction', 'A', { lightningLane: 'genie_plus', lightningLaneRank: 4 }],
  [14, 'Feathered Friends in Flight!', 'Asia', 'show', 'A'],
  [15, 'Zootopia: Better Zoogether!', 'Discovery Island', 'show', 'A'],
  [16, 'Discovery Island Trails', 'Discovery Island', 'experience', 'B'],
  [17, 'Tree of Life e caminhos dos animais', 'Discovery Island', 'experience', 'B'],
  [18, 'Adventures with Kevin', 'Discovery Island', 'character', undefined, { description: 'Somente se o encontro estiver ocorrendo no dia.' }],
  [19, 'Pandora à noite', 'Pandora', 'experience', 'C', { description: 'Somente se o parque permanecer aberto após escurecer.' }],
];

export const ANIMAL_KINGDOM_ITEMS = buildParkDay(
  {
    parkKey: 'ak',
    parkName: "Disney's Animal Kingdom",
    city: 'Lake Buena Vista',
    date: '2026-09-11',
    openTime: '07:10',
    closeTime: '16:00',
  },
  ROWS
);
```

Nota: "It's Tough to Be a Bug!" e áreas fechadas do antigo DinoLand não entram como linhas — o documento-fonte diz explicitamente para não incluir a primeira ("foi substituída") e não há atração nomeada para a segunda, só uma instrução genérica de exclusão do denominador.

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 3: Commit**

```bash
git add src/services/roteiro/animalKingdom.ts
git commit -m "Add Animal Kingdom roteiro data (19 items)"
```

---

## Task 7: Dados do Universal Studios Florida

**Files:**
- Create: `src/services/roteiro/universalStudiosFlorida.ts`

**Interfaces:**
- Consumes: `buildParkDay`, `RoteiroRow` (Task 2).
- Produces: `UNIVERSAL_STUDIOS_FLORIDA_ITEMS: ItineraryItem[]` (28 itens), consumido pela Task 10.

- [ ] **Step 1: Criar o arquivo**

```ts
import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, "Illumination's Villain-Con Minion Blast", 'Minion Land', 'attraction', 'A'],
  [2, 'Despicable Me Minion Mayhem', 'Minion Land', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 4 }],
  [3, 'Illumination Theater e encontros', 'Minion Land', 'experience', 'B'],
  [4, 'Revenge of the Mummy', 'New York', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 2 }],
  [5, 'The Blues Brothers Show', 'New York', 'show', 'B'],
  [6, 'Race Through New York Starring Jimmy Fallon', 'New York', 'attraction', 'B'],
  [7, 'Fast & Furious – Supercharged', 'San Francisco', 'attraction', 'C'],
  [8, 'Beat Builders', 'San Francisco', 'show', undefined, { description: 'Se programado no dia.' }],
  [9, 'Harry Potter and the Escape from Gringotts', 'Diagon Alley', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 1 }],
  [10, 'Ollivanders Wand Experience', 'Diagon Alley', 'experience', 'A'],
  [11, 'Knockturn Alley', 'Diagon Alley', 'experience', 'A'],
  [12, 'The Tales of Beedle the Bard', 'Diagon Alley', 'show'],
  [13, 'Celestina Warbeck and the Banshees', 'Diagon Alley', 'show'],
  [14, "Hogwarts Express – King's Cross Station", 'Diagon Alley', 'attraction', 'A', { description: 'Exige ingresso Park-to-Park.' }],
  [15, 'MEN IN BLACK Alien Attack', 'World Expo', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 5 }],
  [16, 'The Simpsons Ride', 'Springfield', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 3 }],
  [17, "Kang & Kodos' Twirl 'n' Hurl", 'Springfield', 'attraction', 'B'],
  [18, 'Exploração de Springfield', 'Springfield', 'experience', 'B'],
  [19, 'Trolls Trollercoaster', 'DreamWorks Land', 'attraction', 'B'],
  [20, "Po's Kung Fu Training Camp", 'DreamWorks Land', 'experience', 'C'],
  [21, "Shrek's Swamp for Little Ogres", 'DreamWorks Land', 'experience', 'C'],
  [22, 'DreamWorks Imagination Celebration', 'DreamWorks Land', 'show', 'B'],
  [23, 'Character Zone', 'DreamWorks Land', 'character', undefined],
  [24, 'E.T. Adventure', 'Hollywood', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 6 }],
  [25, "Universal Orlando's Horror Make-Up Show", 'Hollywood', 'show', 'A'],
  [26, '"Animal Actors" ou eventual substituta operacional', 'Hollywood', 'show', undefined, { description: 'Confirmar substituta no calendário oficial mais próximo da data.' }],
  [27, 'The Bourne Stuntacular', 'Hollywood', 'show', 'S'],
  [28, 'CineSational: A Symphonic Spectacular', 'Encerramento', 'show', undefined, { lastShowtimeOfDay: true, description: 'Se programado no dia.' }],
];

export const UNIVERSAL_STUDIOS_FLORIDA_ITEMS = buildParkDay(
  {
    parkKey: 'usf',
    parkName: 'Universal Studios Florida',
    city: 'Orlando',
    date: '2026-09-13',
    openTime: '10:00',
    closeTime: '19:00',
  },
  ROWS
);
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 3: Commit**

```bash
git add src/services/roteiro/universalStudiosFlorida.ts
git commit -m "Add Universal Studios Florida roteiro data (28 items)"
```

---

## Task 8: Dados do Universal's Islands of Adventure

**Files:**
- Create: `src/services/roteiro/islandsOfAdventure.ts`

**Interfaces:**
- Consumes: `buildParkDay`, `RoteiroRow` (Task 2).
- Produces: `ISLANDS_OF_ADVENTURE_ITEMS: ItineraryItem[]` (30 itens), consumido pela Task 10.

- [ ] **Step 1: Criar o arquivo**

```ts
import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, "Hagrid's Magical Creatures Motorbike Adventure", 'Hogsmeade', 'attraction', 'S', { description: 'Estratégia própria — pode não aceitar Express na mesma modalidade das demais atrações.' }],
  [2, 'Harry Potter and the Forbidden Journey', 'Hogsmeade', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 2 }],
  [3, 'Flight of the Hippogriff', 'Hogsmeade', 'attraction', 'A'],
  [4, 'Ollivanders', 'Hogsmeade', 'experience', 'A'],
  [5, 'Frog Choir', 'Hogsmeade', 'show'],
  [6, 'Triwizard Spirit Rally', 'Hogsmeade', 'show'],
  [7, 'Hogwarts Express – Hogsmeade Station', 'Hogsmeade', 'attraction', 'A', { description: 'Exige ingresso Park-to-Park.' }],
  [8, 'Jurassic World VelociCoaster', 'Jurassic Park', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 1 }],
  [9, 'Pteranodon Flyers', 'Jurassic Park', 'attraction', 'B', { description: 'Restrições específicas para adultos sem criança acompanhante.' }],
  [10, 'Camp Jurassic', 'Jurassic Park', 'experience', 'B'],
  [11, 'Jurassic Park Discovery Center', 'Jurassic Park', 'experience', 'B'],
  [12, 'Raptor Encounter', 'Jurassic Park', 'character', 'A'],
  [13, 'Jurassic Park River Adventure', 'Jurassic Park', 'attraction', undefined, { operationalStatus: 'scheduled_closure', countsTowardCompletion: false, description: 'Fechamento programado de 5 de janeiro a 19 de novembro de 2026 — não conta no percentual de conclusão.' }],
  [14, 'Skull Island: Reign of Kong', 'Skull Island', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 7 }],
  [15, "Dudley Do-Right's Ripsaw Falls", 'Toon Lagoon', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 5 }],
  [16, "Popeye & Bluto's Bilge-Rat Barges", 'Toon Lagoon', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 6 }],
  [17, 'Me Ship, the Olive', 'Toon Lagoon', 'experience', 'C'],
  [18, 'The Incredible Hulk Coaster', 'Marvel Super Hero Island', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 4 }],
  [19, 'The Amazing Adventures of Spider-Man', 'Marvel Super Hero Island', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 3 }],
  [20, "Doctor Doom's Fearfall", 'Marvel Super Hero Island', 'attraction', 'A'],
  [21, 'Storm Force Accelatron', 'Marvel Super Hero Island', 'attraction', 'B'],
  [22, 'Encontro dos heróis Marvel', 'Marvel Super Hero Island', 'character', undefined],
  [23, 'The High in the Sky Seuss Trolley Train Ride!', 'Seuss Landing', 'attraction', 'A'],
  [24, 'The Cat in the Hat', 'Seuss Landing', 'attraction', 'A'],
  [25, 'One Fish, Two Fish, Red Fish, Blue Fish', 'Seuss Landing', 'attraction', 'B'],
  [26, 'Caro-Seuss-el', 'Seuss Landing', 'attraction', 'B'],
  [27, 'If I Ran the Zoo', 'Seuss Landing', 'experience', 'C'],
  [28, "Oh, the Stories You'll Hear", 'Seuss Landing', 'show', undefined, { description: 'Se programado no dia.' }],
  [29, 'Exploração temática da área', 'Lost Continent', 'experience', 'C'],
  [30, 'The Mystic Fountain', 'Lost Continent', 'experience', 'C'],
];

export const ISLANDS_OF_ADVENTURE_ITEMS = buildParkDay(
  {
    parkKey: 'ioa',
    parkName: "Universal's Islands of Adventure",
    city: 'Orlando',
    date: '2026-09-15',
    openTime: '07:00',
    closeTime: '19:00',
  },
  ROWS
);
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 3: Commit**

```bash
git add src/services/roteiro/islandsOfAdventure.ts
git commit -m "Add Islands of Adventure roteiro data (30 items)"
```

---

## Task 9: Dados do Epic Universe

**Files:**
- Create: `src/services/roteiro/epicUniverse.ts`

**Interfaces:**
- Consumes: `buildParkDay`, `RoteiroRow` (Task 2).
- Produces: `EPIC_UNIVERSE_ITEMS: ItineraryItem[]` (26 itens), consumido pela Task 10.

- [ ] **Step 1: Criar o arquivo**

```ts
import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, 'Harry Potter and the Battle at the Ministry', 'Ministry of Magic', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 1, description: 'Se a fila estiver muito alta, comparar: entrar já, aguardar queda, usar Express (se aceito) ou retornar antes do fechamento da fila.' }],
  [2, "Mario Kart: Bowser's Challenge", 'Super Nintendo World', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 4 }],
  [3, 'Mine-Cart Madness', 'Super Nintendo World', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 2 }],
  [4, "Yoshi's Adventure", 'Super Nintendo World', 'attraction', 'A'],
  [5, 'Bowser Jr. Shadow Showdown', 'Super Nintendo World', 'experience', 'A', { description: 'Requer Power-Up Band.' }],
  [6, 'Key Challenges', 'Super Nintendo World', 'experience', 'A', { description: 'Requer Power-Up Band.' }],
  [7, 'Exploração interativa de Super Nintendo World', 'Super Nintendo World', 'experience', 'A'],
  [8, 'Monsters Unchained: The Frankenstein Experiment', 'Dark Universe', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 3 }],
  [9, 'Curse of the Werewolf', 'Dark Universe', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 7 }],
  [10, 'Darkmoor Monster Makeup Experience', 'Dark Universe', 'experience', 'B'],
  [11, 'Encontros com monstros', 'Dark Universe', 'character', undefined],
  [12, 'Le Cirque Arcanus', 'Ministry of Magic', 'show', 'S'],
  [13, 'Exploração da Paris bruxa', 'Ministry of Magic', 'experience', 'A'],
  [14, 'Interações com varinhas', 'Ministry of Magic', 'experience', 'B'],
  [15, "Hiccup's Wing Gliders", 'Isle of Berk', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 5 }],
  [16, "Dragon Racer's Rally", 'Isle of Berk', 'attraction', 'A'],
  [17, 'Fyre Drill', 'Isle of Berk', 'attraction', 'A'],
  [18, 'Viking Training Camp', 'Isle of Berk', 'experience', 'B'],
  [19, 'The Untrainable Dragon', 'Isle of Berk', 'show', 'S'],
  [20, 'Encontros com Soluço e Banguela', 'Isle of Berk', 'character', undefined],
  [21, 'Stardust Racers', 'Celestial Park', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 6 }],
  [22, 'Constellation Carousel', 'Celestial Park', 'attraction', 'A'],
  [23, 'Astronomica', 'Celestial Park', 'experience', 'B'],
  [24, 'Exploração dos jardins e fontes', 'Celestial Park', 'experience', 'B'],
  [25, 'The Cosmos Fountain Show', 'Encerramento', 'show'],
  [26, 'Show ou espetáculo noturno do Epic Universe', 'Encerramento', 'show', undefined, { lastShowtimeOfDay: true, description: 'Confirmar programação oficial da data.' }],
];

export const EPIC_UNIVERSE_ITEMS = buildParkDay(
  {
    parkKey: 'eu',
    parkName: 'Epic Universe',
    city: 'Orlando',
    date: '2026-09-14',
    openTime: '07:00',
    closeTime: '20:00',
  },
  ROWS
);
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 3: Commit**

```bash
git add src/services/roteiro/epicUniverse.ts
git commit -m "Add Epic Universe roteiro data (26 items)"
```

---

## Task 10: Ligar o roteiro ao seed da viagem ativa

**Files:**
- Create: `src/services/roteiro/index.ts`
- Modify: `src/services/initialMockData.ts:502-685` (bloco `INITIAL_ITINERARY`)

**Interfaces:**
- Consumes: os 7 arrays das Tasks 3-9.
- Produces: `INITIAL_ITINERARY` com as 6 linhas não-parque originais + ~195 linhas granulares dos 7 parques, substituindo as 7 linhas genéricas de "dia no parque".

- [ ] **Step 1: Criar o índice agregador**

```ts
export { MAGIC_KINGDOM_ITEMS } from './magicKingdom';
export { EPCOT_ITEMS } from './epcot';
export { HOLLYWOOD_STUDIOS_ITEMS } from './hollywoodStudios';
export { ANIMAL_KINGDOM_ITEMS } from './animalKingdom';
export { UNIVERSAL_STUDIOS_FLORIDA_ITEMS } from './universalStudiosFlorida';
export { ISLANDS_OF_ADVENTURE_ITEMS } from './islandsOfAdventure';
export { EPIC_UNIVERSE_ITEMS } from './epicUniverse';
```

- [ ] **Step 2: Importar os arrays em `initialMockData.ts`**

No topo de `src/services/initialMockData.ts`, logo após o bloco de `import type { ... } from '../types/database.types';` existente, adicionar:

```ts
import {
  MAGIC_KINGDOM_ITEMS,
  EPCOT_ITEMS,
  HOLLYWOOD_STUDIOS_ITEMS,
  ANIMAL_KINGDOM_ITEMS,
  UNIVERSAL_STUDIOS_FLORIDA_ITEMS,
  ISLANDS_OF_ADVENTURE_ITEMS,
  EPIC_UNIVERSE_ITEMS,
} from './roteiro';
```

- [ ] **Step 3: Substituir as 7 linhas genéricas de parque em `INITIAL_ITINERARY`**

Em `src/services/initialMockData.ts:502-685`, o array `INITIAL_ITINERARY` hoje tem 13 objetos: `b0000000-...-001` (voo), `002` (voo), `003` (transit), `004` (restaurant), `005` (Magic Kingdom genérico), `006` (EPCOT genérico), `007` (Hollywood Studios genérico), `008` (Animal Kingdom genérico), `009` (Universal Studios Florida genérico), `010` (Epic Universe genérico), `011` (Islands of Adventure genérico), `012` (shopping), `013` (voo de volta).

Substituir o array inteiro por (mantendo os objetos `001`–`004` e `012`–`013` idênticos ao que já existe hoje, e trocando `005`–`011` pelos arrays granulares, na mesma ordem cronológica de datas):

```ts
export const INITIAL_ITINERARY: ItineraryItem[] = [
  {
    id: 'b0000000-0000-4000-8000-000000000001',
    trip_id: '9a8b7c6d-5e4f-4321-8765-4321fedcba09',
    date: '2026-09-05',
    time_start: '05:05',
    city: 'Belém / Bogotá',
    title: 'Voo Avianca AV170 (Pedro & Gabriela)',
    category: 'flight',
    description: 'Saída de Belém (BEL) às 05:05 e chegada em Bogotá (BOG) às 07:15. Conexão para Miami.',
    participant_ids: ['22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444'],
    estimated_cost: 947.32,
    currency: 'BRL',
    status: 'confirmed',
    child_friendly: true
  },
  {
    id: 'b0000000-0000-4000-8000-000000000002',
    trip_id: '9a8b7c6d-5e4f-4321-8765-4321fedcba09',
    date: '2026-09-05',
    time_start: '16:55',
    city: 'Belém / Fort Lauderdale',
    title: 'Voo Azul AD2705 (Bárbara & Débora)',
    category: 'flight',
    description: 'Voo definitivo de Bárbara e Débora com 1 conexão. Código YGI6YL.',
    participant_ids: ['11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'],
    currency: 'BRL',
    status: 'confirmed',
    child_friendly: true
  },
  {
    id: 'b0000000-0000-4000-8000-000000000003',
    trip_id: '9a8b7c6d-5e4f-4321-8765-4321fedcba09',
    date: '2026-09-06',
    time_start: '08:00',
    time_end: '11:00',
    city: 'Fort Lauderdale',
    title: 'Retirada da Minivan Dollar em FLL e descanso Rodeway',
    category: 'transit',
    description: 'Retirada da Chrysler Pacifica. Apoio no hotel Rodeway para café da manhã e banho.',
    participant_ids: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'],
    status: 'confirmed',
    child_friendly: true
  },
  {
    id: 'b0000000-0000-4000-8000-000000000004',
    trip_id: '9a8b7c6d-5e4f-4321-8765-4321fedcba09',
    date: '2026-09-06',
    time_start: '12:30',
    time_end: '14:00',
    city: 'Hollywood, FL',
    title: 'Almoço no Hard Rock Cafe Hollywood',
    category: 'restaurant',
    description: 'Almoço comemorativo de boas-vindas com vouchers de alimentação inclusos.',
    participant_ids: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'],
    status: 'confirmed',
    child_friendly: true
  },
  ...MAGIC_KINGDOM_ITEMS,
  ...EPCOT_ITEMS,
  ...HOLLYWOOD_STUDIOS_ITEMS,
  ...ANIMAL_KINGDOM_ITEMS,
  ...UNIVERSAL_STUDIOS_FLORIDA_ITEMS,
  ...EPIC_UNIVERSE_ITEMS,
  ...ISLANDS_OF_ADVENTURE_ITEMS,
  {
    id: 'b0000000-0000-4000-8000-000000000012',
    trip_id: '9a8b7c6d-5e4f-4321-8765-4321fedcba09',
    date: '2026-09-17',
    time_start: '09:00',
    time_end: '18:00',
    city: 'Miami',
    title: 'Apple Store & Sawgrass Mills Outlet',
    category: 'shopping',
    description: 'Compra de iPhone 18 Pro, Studio Display e roupas no Sawgrass Mills com utilização dos gift cards.',
    participant_ids: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'],
    status: 'confirmed',
    child_friendly: true
  },
  {
    id: 'b0000000-0000-4000-8000-000000000013',
    trip_id: '9a8b7c6d-5e4f-4321-8765-4321fedcba09',
    date: '2026-09-20',
    time_start: '08:20',
    city: 'Fort Lauderdale / Belém',
    title: 'Voo de Retorno Azul AD8705 FLL -> BEL',
    category: 'flight',
    description: 'Saída de FLL às 08:20 e chegada a Belém dia 21/09 às 01:20.',
    participant_ids: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'],
    status: 'confirmed',
    child_friendly: true
  }
];
```

Note: os objetos `001`–`004` e `012`–`013` acima são idênticos ao conteúdo já existente no arquivo — nada muda neles, só a posição relativa dos 7 blocos de parque que são substituídos pelos spreads.

- [ ] **Step 4: Verificar o build**

Run: `npm run build`
Expected: sucesso — typecheck e build passam com o array `INITIAL_ITINERARY` agora tendo 201 itens (4 + 195 + 2).

- [ ] **Step 5: Commit**

```bash
git add src/services/roteiro/index.ts src/services/initialMockData.ts
git commit -m "Wire 7-park roteiro data into the active trip's seed itinerary"
```

---

## Task 11: Verificação manual no navegador

**Files:** nenhum (só verificação).

- [ ] **Step 1: Se houver estado antigo no navegador, limpar o localStorage da viagem**

Como documentado no CLAUDE.md, o seed só é lido quando a chave do `localStorage` está ausente — se o navegador já tiver rodado o app antes, a chave `ANTIGRAVITY_TRAVEL_PLATFORM_V1_itinerary` vai mascarar os dados novos. No DevTools do navegador (aba Application/Storage), remover essa chave (ou todas as chaves com prefixo `ANTIGRAVITY_TRAVEL_PLATFORM_V1_`) antes do próximo passo.

- [ ] **Step 2: Rodar o app e abrir a aba Roteiro**

Run: `npm run dev`

No navegador, abrir a viagem ativa, ir para a aba de Roteiro (`ItineraryView`), filtrar por categoria "🎡 Parques" e conferir:
- Aparecem itens de todos os 7 parques (Magic Kingdom, EPCOT, Hollywood Studios, Animal Kingdom, Universal Studios Florida, Epic Universe, Islands of Adventure) nas datas corretas (7, 8, 10, 11, 13, 14 e 15 de setembro de 2026).
- Cada item mostra um título de atração/show/experiência individual (não mais uma única linha "Dia completo no Magic Kingdom").
- Abrir um item (ex.: "Seven Dwarfs Mine Train") no modal de edição e confirmar que os campos padrão (data, horário, categoria) aparecem preenchidos sem erro — os campos novos (`park`, `priority_tier`, etc.) não têm UI própria ainda nesta fatia, então não vão aparecer no modal, apenas não devem quebrar a renderização.

- [ ] **Step 3: Reportar qualquer discrepância**

Se algum item não aparecer, ou o app quebrar ao abrir a aba Roteiro, comparar com a Task correspondente (o problema mais provável é um erro de digitação num dos arrays `ROWS`) e corrigir antes de considerar a fatia concluída.
