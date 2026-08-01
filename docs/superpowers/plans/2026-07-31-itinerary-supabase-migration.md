# Migrar `itinerary` de TripContext para Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `itinerary_items` read from and write to Supabase instead of localStorage, following the exact pattern already established by `useTripsData`/`useParticipantsData` — no change to the public surface `ItineraryView`, `ItineraryModal`, `TimelineView`, `DayTimeline`, and `MonthCalendar` already consume.

**Architecture:** A new mapper (`src/data/mappers/itineraryMapper.ts`) converts between the Postgres row shape and the `ItineraryItem` TS type (including truncating `time`-typed columns from `"HH:MM:SS"` to `"HH:MM"`). A new hook (`src/data/useItineraryData.ts`) fetches by `trip_id` and exposes optimistic `add`/`update`/`delete` with exact-value rollback + `useWriteFailures` integration, mirroring `useParticipantsData.ts` line for line. `TripContext.tsx` swaps its `useState`+localStorage block and three inline CRUD functions for this hook — same exported names and types, so no consumer changes.

**Tech Stack:** React 19 + TypeScript 6, Vitest 2 + `@testing-library/react` (already configured — `npm test` runs 125 passing tests as of this plan), Supabase (`@supabase/supabase-js`), the project's existing `SupabaseLike` structural type for network-free hook tests.

## Global Constraints

- No backfill needed — verified directly against the live Supabase project (via REST + service role key) before writing this plan: all 201 `itinerary_items` rows the local `INITIAL_ITINERARY` seed would produce (195 park + 6 flight/transit/restaurant/shopping) already exist there, with matching IDs.
- `time`-typed Postgres columns (`time_start`, `time_end`, `show_block_start`, `show_block_end`) return `"HH:MM:SS"` over REST; `ItineraryItem`'s TS type and all consumers (`DayTimeline.tsx`'s `findConflictingShow`/`timeToMinutes`/sort/display) expect `"HH:MM"`. The mapper's read direction (`itineraryFromRow`) must truncate all four fields to 5 characters. The write direction does not need to reverse this — Postgres accepts `"HH:MM"` as valid `time` input.
- No change to `TripContextType`'s public shape (`itinerary`, `addItineraryItem`, `updateItineraryItem`, `deleteItineraryItem` keep their existing types) and no change to any file outside `src/data/`, `src/data/mappers/`, and `src/context/TripContext.tsx`.
- `verbatimModuleSyntax` is on — use `import type` for type-only imports.
- `tsconfig` has `noUnusedLocals`/`noUnusedParameters` on — removing the old `itinerary` `useState`/`useEffect`/CRUD block also means removing the now-unused `INITIAL_ITINERARY` import, or `npm run build` fails.
- Tests follow the project's established pattern exactly: `describe`/`it` blocks in Portuguese matching the style of `participantMapper.test.ts`/`useParticipantsData.test.tsx`, TDD (write the failing test, watch it fail, then implement).
- `npm run lint` must show only the two pre-existing `react/only-export-components` warnings (`TripContext.tsx`, `AuthContext.tsx`) — no new warnings.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/data/mappers/itineraryMapper.ts` | New. `ItineraryItemRow` (Postgres row shape), `itineraryFromRow`/`itineraryToInsert` — pure functions, including the time-truncation fix. |
| `src/data/mappers/itineraryMapper.test.ts` | New. Round-trip tests, null↔undefined conversion, time truncation. |
| `src/data/useItineraryData.ts` | New. Fetch-by-`trip_id` + optimistic add/update/delete with rollback, mirroring `useParticipantsData.ts`. |
| `src/data/useItineraryData.test.tsx` | New. Hook behavior tests with a fake `SupabaseLike` client. |
| `src/context/TripContext.tsx` | Modify. Replace the `itinerary` `useState`+localStorage+CRUD block with a call to `useItineraryData`; fold its `loading` into `tripDataLoading`. |

---

### Task 1: Itinerary mapper

**Files:**
- Create: `src/data/mappers/itineraryMapper.ts`
- Create: `src/data/mappers/itineraryMapper.test.ts`

**Interfaces:**
- Consumes: `ItineraryItem` from `src/types/database.types.ts` (existing).
- Produces: `ItineraryItemRow` (the Postgres row shape), `itineraryFromRow(row: ItineraryItemRow): ItineraryItem`, `itineraryToInsert(item: ItineraryItem): ItineraryItemRow`. Task 2 imports all three from this file.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/data/mappers/itineraryMapper.test.ts
import { describe, it, expect } from 'vitest';
import { itineraryFromRow, itineraryToInsert, type ItineraryItemRow } from './itineraryMapper';

const linhaAtracao: ItineraryItemRow = {
  id: '25ac18d6-1db3-4a35-9ac1-30397dc02b45',
  trip_id: '9a8b7c6d-5e4f-4321-8765-4321fedcba09',
  date: '2026-09-07',
  time_start: '08:40:00',
  time_end: null,
  city: 'Lake Buena Vista',
  title: 'Seven Dwarfs Mine Train',
  category: 'park',
  description: null,
  location: 'Magic Kingdom',
  participant_ids: ['11111111-1111-4111-8111-111111111111'],
  estimated_cost: null,
  currency: null,
  payment_method_id: null,
  status: 'planned',
  min_height_cm: null,
  min_age_years: null,
  child_friendly: true,
  notes: null,
  park: 'Magic Kingdom',
  area: 'Fantasyland',
  base_order: 1,
  item_type: 'attraction',
  priority_tier: 'S',
  lightning_lane: 'individual',
  lightning_lane_priority_rank: null,
  single_rider: false,
  child_switch: false,
  recommended_window: null,
  early_closure_risk: false,
  operational_status: 'operating',
  counts_toward_completion: true,
  participant_status: {},
  plan_b: null,
  time_is_estimated: true,
  show_block_start: null,
  show_block_end: null,
  recommended_arrival_min_before: null,
  last_showtime_of_day: false,
};

const linhaShow: ItineraryItemRow = {
  ...linhaAtracao,
  id: 'a1111111-1111-4111-8111-111111111111',
  title: 'Disney Adventure Friends Cavalcade',
  item_type: 'show',
  time_start: '19:35:00',
  time_end: '19:45:00',
  show_block_start: '19:35:00',
  show_block_end: '19:45:00',
};

describe('itineraryFromRow', () => {
  it('trunca time_start de HH:MM:SS para HH:MM', () => {
    expect(itineraryFromRow(linhaAtracao).time_start).toBe('08:40');
  });

  it('trunca time_end quando presente, e devolve undefined quando null', () => {
    expect(itineraryFromRow(linhaAtracao).time_end).toBeUndefined();
    expect(itineraryFromRow(linhaShow).time_end).toBe('19:45');
  });

  it('trunca show_block_start e show_block_end de HH:MM:SS para HH:MM', () => {
    const item = itineraryFromRow(linhaShow);
    expect(item.show_block_start).toBe('19:35');
    expect(item.show_block_end).toBe('19:45');
  });

  it('devolve show_block_start/end undefined quando null no banco', () => {
    const item = itineraryFromRow(linhaAtracao);
    expect(item.show_block_start).toBeUndefined();
    expect(item.show_block_end).toBeUndefined();
  });

  it('converte demais colunas null do banco em undefined do TS', () => {
    const item = itineraryFromRow(linhaAtracao);
    expect(item.description).toBeUndefined();
    expect(item.estimated_cost).toBeUndefined();
    expect(item.min_height_cm).toBeUndefined();
    expect(item.lightning_lane_priority_rank).toBeUndefined();
    expect(item.plan_b).toBeUndefined();
  });

  it('preserva os campos que atravessam sem tradução, incluindo os da fatia 1', () => {
    const item = itineraryFromRow(linhaAtracao);
    expect(item.id).toBe(linhaAtracao.id);
    expect(item.trip_id).toBe(linhaAtracao.trip_id);
    expect(item.title).toBe('Seven Dwarfs Mine Train');
    expect(item.park).toBe('Magic Kingdom');
    expect(item.area).toBe('Fantasyland');
    expect(item.item_type).toBe('attraction');
    expect(item.priority_tier).toBe('S');
    expect(item.lightning_lane).toBe('individual');
    expect(item.counts_toward_completion).toBe(true);
    expect(item.participant_status).toEqual({});
    expect(item.time_is_estimated).toBe(true);
    expect(item.participant_ids).toEqual(['11111111-1111-4111-8111-111111111111']);
  });
});

describe('itineraryToInsert', () => {
  it('não precisa reverter o truncamento — HH:MM é uma entrada válida para a coluna time', () => {
    const item = itineraryFromRow(linhaShow);
    const insert = itineraryToInsert(item);
    expect(insert.time_start).toBe('19:35');
    expect(insert.show_block_start).toBe('19:35');
    expect(insert.show_block_end).toBe('19:45');
  });

  it('converte undefined do TS em null do banco', () => {
    const item = itineraryFromRow(linhaAtracao);
    const insert = itineraryToInsert(item);
    expect(insert.description).toBeNull();
    expect(insert.estimated_cost).toBeNull();
    expect(insert.show_block_start).toBeNull();
    expect(insert.plan_b).toBeNull();
  });

  it('aplica os defaults not-null de booleanos quando o TS não os define', () => {
    const item = itineraryFromRow(linhaAtracao);
    const semBooleanosOpcionais = { ...item, single_rider: undefined, child_switch: undefined, early_closure_risk: undefined, time_is_estimated: undefined, last_showtime_of_day: undefined };
    const insert = itineraryToInsert(semBooleanosOpcionais);
    expect(insert.single_rider).toBe(false);
    expect(insert.child_switch).toBe(false);
    expect(insert.early_closure_risk).toBe(false);
    expect(insert.time_is_estimated).toBe(false);
    expect(insert.last_showtime_of_day).toBe(false);
  });

  it('round-trip preserva os valores', () => {
    const item = itineraryFromRow(linhaAtracao);
    const insert = itineraryToInsert(item);
    expect(insert.id).toBe(linhaAtracao.id);
    expect(insert.title).toBe(linhaAtracao.title);
    expect(insert.park).toBe(linhaAtracao.park);
    expect(insert.participant_ids).toEqual(linhaAtracao.participant_ids);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- itineraryMapper`
Expected: FAIL — `Cannot find module './itineraryMapper'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// src/data/mappers/itineraryMapper.ts
import type { ItineraryItem } from '../../types/database.types';

/** Linha da tabela public.itinerary_items exatamente como o Postgres devolve. */
export interface ItineraryItemRow {
  id: string;
  trip_id: string;
  date: string;
  time_start: string;
  time_end: string | null;
  city: string;
  title: string;
  category: 'flight' | 'hotel' | 'park' | 'restaurant' | 'shopping' | 'tour' | 'rest' | 'transit' | 'event';
  description: string | null;
  location: string | null;
  participant_ids: string[];
  estimated_cost: number | null;
  currency: 'USD' | 'BRL' | null;
  payment_method_id: string | null;
  status: 'planned' | 'confirmed' | 'optional' | 'completed' | 'cancelled';
  min_height_cm: number | null;
  min_age_years: number | null;
  child_friendly: boolean;
  notes: string | null;
  park: string | null;
  area: string | null;
  base_order: number | null;
  item_type: 'attraction' | 'show' | 'experience' | 'character' | null;
  priority_tier: 'S' | 'A' | 'B' | 'C' | null;
  lightning_lane: 'none' | 'genie_plus' | 'individual' | 'express' | null;
  lightning_lane_priority_rank: number | null;
  single_rider: boolean;
  child_switch: boolean;
  recommended_window: string | null;
  early_closure_risk: boolean;
  operational_status: 'operating' | 'scheduled_closure' | 'temporarily_closed' | 'refurbishment' | null;
  counts_toward_completion: boolean | null;
  participant_status: Record<string, 'pending' | 'done' | 'skipped' | 'height_restricted' | 'not_applicable'>;
  plan_b: string | null;
  time_is_estimated: boolean;
  show_block_start: string | null;
  show_block_end: string | null;
  recommended_arrival_min_before: number | null;
  last_showtime_of_day: boolean;
}

/** Colunas `time` do Postgres voltam como "HH:MM:SS" — trunca pros 5 primeiros caracteres. */
function truncarHora(valor: string | null): string | undefined {
  return valor ? valor.slice(0, 5) : undefined;
}

export function itineraryFromRow(row: ItineraryItemRow): ItineraryItem {
  return {
    id: row.id,
    trip_id: row.trip_id,
    date: row.date,
    time_start: row.time_start.slice(0, 5),
    time_end: truncarHora(row.time_end),
    city: row.city,
    title: row.title,
    category: row.category,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    participant_ids: row.participant_ids,
    estimated_cost: row.estimated_cost ?? undefined,
    currency: row.currency ?? undefined,
    payment_method_id: row.payment_method_id ?? undefined,
    status: row.status,
    min_height_cm: row.min_height_cm ?? undefined,
    min_age_years: row.min_age_years ?? undefined,
    child_friendly: row.child_friendly,
    notes: row.notes ?? undefined,
    park: row.park ?? undefined,
    area: row.area ?? undefined,
    base_order: row.base_order ?? undefined,
    item_type: row.item_type ?? undefined,
    priority_tier: row.priority_tier ?? undefined,
    lightning_lane: row.lightning_lane ?? undefined,
    lightning_lane_priority_rank: row.lightning_lane_priority_rank ?? undefined,
    single_rider: row.single_rider,
    child_switch: row.child_switch,
    recommended_window: row.recommended_window ?? undefined,
    early_closure_risk: row.early_closure_risk,
    operational_status: row.operational_status ?? undefined,
    counts_toward_completion: row.counts_toward_completion ?? undefined,
    participant_status: row.participant_status,
    plan_b: row.plan_b ?? undefined,
    time_is_estimated: row.time_is_estimated,
    show_block_start: truncarHora(row.show_block_start),
    show_block_end: truncarHora(row.show_block_end),
    recommended_arrival_min_before: row.recommended_arrival_min_before ?? undefined,
    last_showtime_of_day: row.last_showtime_of_day,
  };
}

export function itineraryToInsert(item: ItineraryItem): ItineraryItemRow {
  return {
    id: item.id,
    trip_id: item.trip_id,
    date: item.date,
    time_start: item.time_start,
    time_end: item.time_end ?? null,
    city: item.city,
    title: item.title,
    category: item.category,
    description: item.description ?? null,
    location: item.location ?? null,
    participant_ids: item.participant_ids,
    estimated_cost: item.estimated_cost ?? null,
    currency: item.currency ?? null,
    payment_method_id: item.payment_method_id ?? null,
    status: item.status,
    min_height_cm: item.min_height_cm ?? null,
    min_age_years: item.min_age_years ?? null,
    child_friendly: item.child_friendly,
    notes: item.notes ?? null,
    park: item.park ?? null,
    area: item.area ?? null,
    base_order: item.base_order ?? null,
    item_type: item.item_type ?? null,
    priority_tier: item.priority_tier ?? null,
    lightning_lane: item.lightning_lane ?? null,
    lightning_lane_priority_rank: item.lightning_lane_priority_rank ?? null,
    single_rider: item.single_rider ?? false,
    child_switch: item.child_switch ?? false,
    recommended_window: item.recommended_window ?? null,
    early_closure_risk: item.early_closure_risk ?? false,
    operational_status: item.operational_status ?? null,
    counts_toward_completion: item.counts_toward_completion ?? null,
    participant_status: item.participant_status ?? {},
    plan_b: item.plan_b ?? null,
    time_is_estimated: item.time_is_estimated ?? false,
    show_block_start: item.show_block_start ?? null,
    show_block_end: item.show_block_end ?? null,
    recommended_arrival_min_before: item.recommended_arrival_min_before ?? null,
    last_showtime_of_day: item.last_showtime_of_day ?? false,
  };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test -- itineraryMapper`
Expected: PASS — all cases in `itineraryMapper.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/data/mappers/itineraryMapper.ts src/data/mappers/itineraryMapper.test.ts
git commit -m "feat(data): add itinerary_items row mapper with time-column truncation"
```

---

### Task 2: Itinerary data hook

**Files:**
- Create: `src/data/useItineraryData.ts`
- Create: `src/data/useItineraryData.test.tsx`

**Interfaces:**
- Consumes: `itineraryFromRow`/`itineraryToInsert`/`ItineraryItemRow` from Task 1 (`./mappers/itineraryMapper`); `SupabaseLike` from `./useTripsData` (existing); `WriteFailure` from `./useWriteFailures` (existing); `newId` from `../services/ids` (existing).
- Produces: `useItineraryData({ client, tripId, recordFailure }): { itinerary: ItineraryItem[]; loading: boolean; addItineraryItem: (i: Omit<ItineraryItem, 'id'>) => void; updateItineraryItem: (id: string, patch: Partial<ItineraryItem>) => void; deleteItineraryItem: (id: string) => void }`. Task 3 calls this exact shape from `TripContext.tsx`, matching `TripContextType`'s existing `itinerary`/`addItineraryItem`/`updateItineraryItem`/`deleteItineraryItem` types.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/data/useItineraryData.test.tsx
// @vitest-environment jsdom
import { StrictMode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useItineraryData } from './useItineraryData';
import type { SupabaseLike } from './useTripsData';
import type { ItineraryItem } from '../types/database.types';

const TRIP = '9a8b7c6d-5e4f-4321-8765-4321fedcba09';

const linhaSevenDwarfs = {
  id: '25ac18d6-1db3-4a35-9ac1-30397dc02b45',
  trip_id: TRIP,
  date: '2026-09-07',
  time_start: '08:40:00',
  time_end: null,
  city: 'Lake Buena Vista',
  title: 'Seven Dwarfs Mine Train',
  category: 'park',
  description: null,
  location: 'Magic Kingdom',
  participant_ids: ['11111111-1111-4111-8111-111111111111'],
  estimated_cost: null,
  currency: null,
  payment_method_id: null,
  status: 'planned',
  min_height_cm: null,
  min_age_years: null,
  child_friendly: true,
  notes: null,
  park: 'Magic Kingdom',
  area: 'Fantasyland',
  base_order: 1,
  item_type: 'attraction',
  priority_tier: 'S',
  lightning_lane: 'individual',
  lightning_lane_priority_rank: null,
  single_rider: false,
  child_switch: false,
  recommended_window: null,
  early_closure_risk: false,
  operational_status: 'operating',
  counts_toward_completion: true,
  participant_status: {},
  plan_b: null,
  time_is_estimated: true,
  show_block_start: null,
  show_block_end: null,
  recommended_arrival_min_before: null,
  last_showtime_of_day: false,
};

const novoItem: Omit<ItineraryItem, 'id'> = {
  trip_id: TRIP,
  date: '2026-09-08',
  time_start: '09:00',
  city: 'Orlando',
  title: 'Café da manhã no hotel',
  category: 'restaurant',
  participant_ids: ['11111111-1111-4111-8111-111111111111'],
  status: 'planned',
  child_friendly: true,
};

function makeClient(opts: { rows?: unknown[]; error?: string } = {}): SupabaseLike {
  const err = opts.error ? { message: opts.error } : null;
  return {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: opts.rows ?? [], error: null }) }),
      insert: () => Promise.resolve({ error: err }),
      update: () => ({ eq: () => Promise.resolve({ error: err }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: err }) }),
    }),
  };
}

function deps(client: SupabaseLike, recordFailure = vi.fn()) {
  return { client, tripId: TRIP, recordFailure };
}

describe('useItineraryData', () => {
  afterEach(() => cleanup());

  it('carrega e trunca os campos de horário para HH:MM', async () => {
    const client = makeClient({ rows: [linhaSevenDwarfs] });
    const { result } = renderHook(() => useItineraryData(deps(client)));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.itinerary[0].time_start).toBe('08:40');
  });

  it('adiciona no estado local imediatamente', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useItineraryData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.addItineraryItem(novoItem); });

    expect(result.current.itinerary).toHaveLength(1);
    expect(result.current.itinerary[0].title).toBe('Café da manhã no hotel');
  });

  it('reverte a adição quando o insert falha e registra a falha', async () => {
    const recordFailure = vi.fn();
    const client = makeClient({ error: 'insert falhou' });
    const { result } = renderHook(() => useItineraryData(deps(client, recordFailure)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.addItineraryItem(novoItem); });

    await waitFor(() => expect(result.current.itinerary).toHaveLength(0));
    expect(recordFailure.mock.calls[0][0]).toMatchObject({
      entity: 'Item de roteiro',
      operation: 'criar',
      label: 'Café da manhã no hotel',
    });
  });

  it('aplica o update local na hora, ex.: marcar participant_status', async () => {
    const client = makeClient({ rows: [linhaSevenDwarfs] });
    const { result } = renderHook(() => useItineraryData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateItineraryItem(linhaSevenDwarfs.id, {
        participant_status: { '11111111-1111-4111-8111-111111111111': 'done' },
      });
    });

    expect(result.current.itinerary[0].participant_status).toEqual({
      '11111111-1111-4111-8111-111111111111': 'done',
    });
  });

  it('reverte o update para o valor ANTERIOR quando falha', async () => {
    const client = makeClient({ rows: [linhaSevenDwarfs], error: 'update falhou' });
    const { result } = renderHook(() => useItineraryData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.updateItineraryItem(linhaSevenDwarfs.id, { title: 'Título Errado' });
    });

    await waitFor(() => expect(result.current.itinerary[0].title).toBe('Seven Dwarfs Mine Train'));
  });

  it('remove na hora e, se o delete falhar, devolve a linha COMPLETA', async () => {
    const client = makeClient({ rows: [linhaSevenDwarfs], error: 'delete falhou' });
    const { result } = renderHook(() => useItineraryData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.deleteItineraryItem(linhaSevenDwarfs.id); });

    await waitFor(() => expect(result.current.itinerary).toHaveLength(1));
    const voltou = result.current.itinerary[0];
    expect(voltou.park).toBe('Magic Kingdom');
    expect(voltou.area).toBe('Fantasyland');
    expect(voltou.item_type).toBe('attraction');
    expect(voltou.priority_tier).toBe('S');
  });

  it('em StrictMode, updateItineraryItem chamado uma vez só dispara um update()', async () => {
    const updateSpy = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    const client: SupabaseLike = {
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: [linhaSevenDwarfs], error: null }) }),
        insert: () => Promise.resolve({ error: null }),
        update: updateSpy,
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    };

    const { result } = renderHook(() => useItineraryData(deps(client)), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.updateItineraryItem(linhaSevenDwarfs.id, { title: 'Título Novo' });
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('em StrictMode, deleteItineraryItem chamado uma vez só dispara um delete()', async () => {
    const deleteSpy = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    const client: SupabaseLike = {
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: [linhaSevenDwarfs], error: null }) }),
        insert: () => Promise.resolve({ error: null }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        delete: deleteSpy,
      }),
    };

    const { result } = renderHook(() => useItineraryData(deps(client)), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.deleteItineraryItem(linhaSevenDwarfs.id); });

    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('não consulta o banco sem viagem ativa', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseLike;

    const { result } = renderHook(() =>
      useItineraryData({ client, tripId: null, recordFailure: vi.fn() }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(from).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- useItineraryData`
Expected: FAIL — `Cannot find module './useItineraryData'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/data/useItineraryData.ts
import { useCallback, useEffect, useState } from 'react';
import type { ItineraryItem } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { itineraryFromRow, itineraryToInsert, type ItineraryItemRow } from './mappers/itineraryMapper';

export interface ItineraryDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
}

export function useItineraryData({ client, tripId, recordFailure }: ItineraryDataDeps) {
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setItinerary([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('itinerary_items')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data) setItinerary((data as ItineraryItemRow[]).map(itineraryFromRow));
        setLoading(false);
      });

    return () => { cancelado = true; };
  }, [client, tripId]);

  const addItineraryItem = useCallback(
    (data: Omit<ItineraryItem, 'id'>) => {
      const item: ItineraryItem = { ...data, id: newId() };

      const escrever = () => {
        setItinerary(prev => [...prev, item]);
        client
          .from('itinerary_items')
          .insert(itineraryToInsert(item))
          .then(({ error }) => {
            if (!error) return;
            setItinerary(prev => prev.filter(x => x.id !== item.id));
            recordFailure({
              entity: 'Item de roteiro',
              operation: 'criar',
              label: item.title,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateItineraryItem = useCallback(
    (id: string, patch: Partial<ItineraryItem>) => {
      const anterior = itinerary.find(x => x.id === id);
      if (!anterior) return;

      const atualizado: ItineraryItem = { ...anterior, ...patch };

      const escrever = () => {
        setItinerary(atual => atual.map(x => (x.id === id ? atualizado : x)));
        client
          .from('itinerary_items')
          .update(itineraryToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error) return;
            setItinerary(atual => atual.map(x => (x.id === id ? anterior : x)));
            recordFailure({
              entity: 'Item de roteiro',
              operation: 'atualizar',
              label: anterior.title,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure, itinerary],
  );

  const deleteItineraryItem = useCallback(
    (id: string) => {
      const removido = itinerary.find(x => x.id === id);
      if (!removido) return;

      const escrever = () => {
        setItinerary(atual => atual.filter(x => x.id !== id));
        client
          .from('itinerary_items')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error) return;
            setItinerary(atual => [...atual, removido]);
            recordFailure({
              entity: 'Item de roteiro',
              operation: 'excluir',
              label: removido.title,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure, itinerary],
  );

  return { itinerary, loading, addItineraryItem, updateItineraryItem, deleteItineraryItem };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test -- useItineraryData`
Expected: PASS — all cases in `useItineraryData.test.tsx` green.

- [ ] **Step 5: Commit**

```bash
git add src/data/useItineraryData.ts src/data/useItineraryData.test.tsx
git commit -m "feat(data): add optimistic itinerary_items hook backed by Supabase"
```

---

### Task 3: Wire `TripContext.tsx` to the new hook

**Files:**
- Modify: `src/context/TripContext.tsx`

**Interfaces:**
- Consumes: `useItineraryData` from Task 2 (`../data/useItineraryData`).
- Produces: no change to `TripContextType` — `itinerary: ItineraryItem[]`, `addItineraryItem`, `updateItineraryItem`, `deleteItineraryItem` keep their exact existing types (declared at `TripContext.tsx:118-121`, unchanged by this task).

- [ ] **Step 1: Remove the now-unused `INITIAL_ITINERARY` import**

In `src/context/TripContext.tsx`, the import block (around line 25-36) currently reads:

```typescript
import {
  INITIAL_FLIGHTS,
  INITIAL_ACCOMMODATIONS,
  INITIAL_TRANSPORTS,
  INITIAL_ITINERARY,
  INITIAL_GIFT_CARDS,
  INITIAL_PURCHASES,
  INITIAL_TASKS,
  INITIAL_DECISIONS,
  INITIAL_AI_CONFIGS,
  INITIAL_AI_LOGS
} from '../services/initialMockData';
```

Remove the `INITIAL_ITINERARY,` line:

```typescript
import {
  INITIAL_FLIGHTS,
  INITIAL_ACCOMMODATIONS,
  INITIAL_TRANSPORTS,
  INITIAL_GIFT_CARDS,
  INITIAL_PURCHASES,
  INITIAL_TASKS,
  INITIAL_DECISIONS,
  INITIAL_AI_CONFIGS,
  INITIAL_AI_LOGS
} from '../services/initialMockData';
```

Add the new hook's import right after the `useParticipantsData` import (around line 49):

```typescript
import { useParticipantsData } from '../data/useParticipantsData';
import { useItineraryData } from '../data/useItineraryData';
```

- [ ] **Step 2: Call the hook right after `useParticipantsData`**

Around line 390-401, immediately after the existing `useParticipantsData` call:

```typescript
  const {
    participants,
    loading: participantsLoading,
    addParticipant,
    updateParticipant,
    deleteParticipant,
  } = useParticipantsData({
    client,
    tripId: activeTripIdResolvido,
    today: hoje,
    recordFailure,
  });
```

add:

```typescript
  const {
    itinerary,
    loading: itineraryLoading,
    addItineraryItem,
    updateItineraryItem,
    deleteItineraryItem,
  } = useItineraryData({
    client,
    tripId: activeTripIdResolvido,
    recordFailure,
  });
```

- [ ] **Step 3: Remove the old `itinerary` `useState`**

Delete this block (around line 418-421):

```typescript
  const [itinerary, setItinerary] = useState<ItineraryItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_itinerary`);
    return saved ? JSON.parse(saved) : INITIAL_ITINERARY;
  });
```

- [ ] **Step 4: Remove the old localStorage-persist `useEffect`**

Delete this block (around line 519-521):

```typescript
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_itinerary`, JSON.stringify(itinerary));
  }, [itinerary]);
```

- [ ] **Step 5: Remove the old inline CRUD functions**

Delete this block (around line 678-689):

```typescript
  const addItineraryItem = (i: Omit<ItineraryItem, 'id'>) => {
    const newI: ItineraryItem = { ...i, id: newId() };
    setItinerary(prev => [...prev, newI]);
  };

  const updateItineraryItem = (id: string, i: Partial<ItineraryItem>) => {
    setItinerary(prev => prev.map(item => (item.id === id ? { ...item, ...i } : item)));
  };

  const deleteItineraryItem = (id: string) => {
    setItinerary(prev => prev.filter(item => item.id !== id));
  };
```

- [ ] **Step 6: Fold `itineraryLoading` into `tripDataLoading`**

Around line 944, change:

```typescript
        tripDataLoading: tripsLoading || participantsLoading,
```

to:

```typescript
        tripDataLoading: tripsLoading || participantsLoading || itineraryLoading,
```

- [ ] **Step 7: Leave the provider `value` block and `TripContextType` interface untouched**

The `itinerary`/`addItineraryItem`/`updateItineraryItem`/`deleteItineraryItem` entries in the provider's returned `value` object (around line 964-967) and their type declarations in `TripContextType` (around line 118-121) already reference these exact names — no edit needed there, since the hook's destructured return uses the same identifiers.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: PASS — all pre-existing tests plus the two new files from Tasks 1-2, no regressions.

- [ ] **Step 9: Typecheck and build**

Run: `npm run build`
Expected: succeeds — confirms `TripContext.tsx` still satisfies `TripContextType` and no unused-import errors from removing `INITIAL_ITINERARY`.

- [ ] **Step 10: Lint**

Run: `npm run lint`
Expected: only the two pre-existing `react/only-export-components` warnings (`TripContext.tsx`, `AuthContext.tsx`).

- [ ] **Step 11: Commit**

```bash
git add src/context/TripContext.tsx
git commit -m "feat(itinerary): wire TripContext to Supabase-backed itinerary hook"
```

---

### Task 4: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Confirm the Cronologia tab loads real data**

Open the app, go to "Cronologia". Confirm the calendar still shows the 7 park days (07, 08, 10, 11, 13, 14, 15/09) — this now comes from Supabase, not localStorage.

- [ ] **Step 3: Confirm writes persist across a reload**

Open a day's timeline, click a participant chip on an item to cycle it to "done". Confirm the coverage header updates immediately (same as before). **Reload the page.** Confirm the item is still marked "done" and the coverage percentage is unchanged — this is the proof the write landed in Supabase, not just local state.

- [ ] **Step 4: Confirm the network call**

With the browser's Network tab open, repeat the chip click from Step 3 on a different item. Confirm a `PATCH .../itinerary_items?id=eq.<uuid>` request fires and returns 2xx.

- [ ] **Step 5: Confirm the failure/retry path**

Using devtools, throttle the network to "Offline" (or block the Supabase host). Click a participant chip. Confirm the `WriteFailureBanner` appears (per `src/components/WriteFailureBanner.tsx`, already wired in `App.tsx`). Restore the network and click "tentar novamente" (or the banner's retry action). Confirm the write succeeds and the banner clears.

- [ ] **Step 6: Confirm `ItineraryView` (non-park items) still works**

Go to the "Roteiro & Atrações" tab. Confirm the 6 non-park items (flights, transit, restaurant, shopping) still appear, and that creating/editing/deleting an item there still works end-to-end against Supabase.

No commit for this task — it's verification only, not a code change.

---

## Self-Review Notes

- **Spec coverage:** mapper with time-truncation fix (Task 1), hook with optimistic writes/rollback/failure-recording matching `useParticipantsData` (Task 2), `TripContext` wiring with no public-surface change (Task 3), and the spec's own manual-verification checklist reproduced in full (Task 4). "Fora de escopo" items (other entities, `activeTripId`/`currency`/`exchangeRate`/`resolvedAuditIds`, no backfill) are respected — none of them are touched by any task.
- **Placeholder scan:** no TBD/TODO/"similar to Task N" — every step has literal code or an exact file:line diff.
- **Type consistency:** `ItineraryDataDeps`, the hook's return shape, and `itineraryFromRow`/`itineraryToInsert`'s signatures are used identically across Tasks 1-3. `TripContextType`'s existing field types (unchanged) are the contract Task 3's Step 7 explicitly confirms need no edit.
