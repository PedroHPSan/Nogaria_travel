# Roteiro dos Parques — Fatia 2: Timeline + Calendário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Cronologia" tab with a chronological day timeline and a month-calendar view for the parks roteiro (`category: 'park'` itinerary items), showing show time-blocks with conflict alerts and per-type/per-participant coverage that updates live as items are marked done/skipped.

**Architecture:** Three new presentational components under `src/features/timeline/` (`TimelineView` → `DayTimeline` + `MonthCalendar`) consume `useTrip()` directly (same pattern as every other feature view) and a new pure derivation module `src/services/coverageEngine.ts` (same pattern as `auditEngine.ts`: called inside `useMemo`/render, no new persisted state). Wiring is two small edits to `Navigation.tsx` and `App.tsx`.

**Tech Stack:** React 19 + TypeScript 6, Tailwind v4 utility classes matching existing `glass-card`/`glass-panel` styling, `lucide-react` icons. No new dependencies.

## Global Constraints

- No test framework exists in this repo (no runner, no test files) — per `CLAUDE.md`, do not invent one. Every code task below is verified with `npm run build` (typecheck + build) instead of an automated test; the final task does the full manual QA walkthrough the spec itself prescribes.
- Currency/monetary conventions do not apply — no money is touched in this fatia.
- `tsconfig` has `noUnusedLocals`/`noUnusedParameters` on — unused imports/vars fail `npm run build`, not `npm run dev`. Always verify with `npm run build`.
- `verbatimModuleSyntax` is on — use `import type { ... }` for type-only imports (already followed below).
- Do not touch `ItineraryView.tsx`, `App.tsx`'s existing branches, or any non-`category: 'park'` itinerary logic — out of scope per spec.
- `TripContext` stays 100% localStorage — no new persisted state; coverage is always derived, never stored.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/services/coverageEngine.ts` | New. Pure `computeCoverage(items, participants) → DayCoverage`: per-type and per-participant done/total counts, participant-eligibility check (height/age), overall percent. |
| `src/features/timeline/DayTimeline.tsx` | New. Renders one day: coverage header, chronological item list, show blocks, conflict badges, per-participant status chips (cycles `pending → done → skipped`). |
| `src/features/timeline/MonthCalendar.tsx` | New. Fixed September/2026 month grid; each day cell with a park shows park name + coverage %; click selects that day. |
| `src/features/timeline/TimelineView.tsx` | New. Root of the tab: owns `viewMode`/`selectedDate` state, filters `itinerary` by `activeTrip.id` + `category === 'park'`, composes the two components above. |
| `src/components/Navigation.tsx` | Modify. Add `'timeline'` to `NavTab`, add a "Cronologia" tab entry with the `Clock` icon. |
| `src/App.tsx` | Modify. Import `TimelineView`, add the `activeTab === 'timeline'` branch. |

---

### Task 1: Coverage engine

**Files:**
- Create: `src/services/coverageEngine.ts`

**Interfaces:**
- Consumes: `ItineraryItem`, `Participant` from `src/types/database.types.ts` (existing — `ItineraryItem.item_type`, `.counts_toward_completion`, `.participant_ids`, `.participant_status`, `.min_height_cm`, `.min_age_years`; `Participant.height_cm`, `.age`, `.id`).
- Produces: `computeCoverage(items: ItineraryItem[], participants: Participant[]): DayCoverage`, and types `CoverageCount { done: number; total: number }`, `CoverageItemType = 'attraction' | 'show' | 'experience' | 'character'`, `DayCoverage { byType: Record<CoverageItemType, CoverageCount>; byParticipant: Record<string, CoverageCount>; overall: CoverageCount; percent: number }`. Tasks 2 and 3 import all of these from this file.

- [ ] **Step 1: Write `coverageEngine.ts`**

```typescript
import type { ItineraryItem, Participant } from '../types/database.types';

export interface CoverageCount {
  done: number;
  total: number;
}

export type CoverageItemType = 'attraction' | 'show' | 'experience' | 'character';

export interface DayCoverage {
  byType: Record<CoverageItemType, CoverageCount>;
  byParticipant: Record<string, CoverageCount>;
  overall: CoverageCount;
  percent: number;
}

const ITEM_TYPES: CoverageItemType[] = ['attraction', 'show', 'experience', 'character'];

function emptyCount(): CoverageCount {
  return { done: 0, total: 0 };
}

function isParticipantEligible(item: ItineraryItem, participant: Participant): boolean {
  if (item.min_height_cm && participant.height_cm && participant.height_cm < item.min_height_cm) {
    return false;
  }
  if (item.min_age_years && participant.age < item.min_age_years) {
    return false;
  }
  return true;
}

export function computeCoverage(items: ItineraryItem[], participants: Participant[]): DayCoverage {
  const byType = ITEM_TYPES.reduce((acc, type) => {
    acc[type] = emptyCount();
    return acc;
  }, {} as Record<CoverageItemType, CoverageCount>);

  const byParticipant: Record<string, CoverageCount> = {};

  const countedItems = items.filter(item => item.counts_toward_completion !== false);

  countedItems.forEach(item => {
    const type = item.item_type;
    if (!type) return;

    byType[type].total += 1;
    let anyEligibleDone = false;

    item.participant_ids.forEach(participantId => {
      const participant = participants.find(p => p.id === participantId);
      if (!participant || !isParticipantEligible(item, participant)) return;

      if (!byParticipant[participantId]) byParticipant[participantId] = emptyCount();
      byParticipant[participantId].total += 1;

      if (item.participant_status?.[participantId] === 'done') {
        byParticipant[participantId].done += 1;
        anyEligibleDone = true;
      }
    });

    if (anyEligibleDone) byType[type].done += 1;
  });

  const overall = ITEM_TYPES.reduce(
    (acc, type) => ({ done: acc.done + byType[type].done, total: acc.total + byType[type].total }),
    emptyCount()
  );

  const percent = overall.total === 0 ? 0 : Math.round((overall.done / overall.total) * 100);

  return { byType, byParticipant, overall, percent };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: succeeds (no errors referencing `coverageEngine.ts`). It's not imported anywhere yet, so this only validates the file compiles standalone.

- [ ] **Step 3: Commit**

```bash
git add src/services/coverageEngine.ts
git commit -m "feat(timeline): add pure coverage derivation engine"
```

---

### Task 2: Day timeline component

**Files:**
- Create: `src/features/timeline/DayTimeline.tsx`

**Interfaces:**
- Consumes: `computeCoverage`/`DayCoverage` from Task 1 (`../../services/coverageEngine`); `useTrip()` → `updateItineraryItem` (existing, `src/context/TripContext.tsx`); `ItineraryItem`, `Participant` types.
- Produces: `DayTimeline` component with props `{ items: ItineraryItem[]; participants: Participant[] }` — `items` must already be filtered to one day's `category: 'park'` items (unsorted is fine, this component sorts). Task 4 renders `<DayTimeline items={dayItems} participants={participants} />`.

- [ ] **Step 1: Write `DayTimeline.tsx`**

```tsx
import React from 'react';
import { AlertTriangle, Clapperboard } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { computeCoverage } from '../../services/coverageEngine';
import type { ItineraryItem, Participant } from '../../types/database.types';

interface DayTimelineProps {
  items: ItineraryItem[];
  participants: Participant[];
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  attraction: 'Atração',
  show: 'Show',
  experience: 'Experiência',
  character: 'Personagem',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-slate-800 text-slate-400 border-slate-700',
  done: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  skipped: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  height_restricted: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  not_applicable: 'bg-slate-800 text-slate-500 border-slate-700',
};

function nextParticipantStatus(current?: string): 'pending' | 'done' | 'skipped' {
  if (current === 'done') return 'skipped';
  if (current === 'skipped') return 'pending';
  return 'done';
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function findConflictingShow(item: ItineraryItem, dayItems: ItineraryItem[]): ItineraryItem | undefined {
  if (item.item_type === 'show') return undefined;

  const itemStart = timeToMinutes(item.time_start);
  const itemEnd = item.time_end ? timeToMinutes(item.time_end) : itemStart + 30;

  return dayItems.find(other => {
    if (other.id === item.id) return false;
    if (other.item_type !== 'show' || !other.show_block_start || !other.show_block_end) return false;
    const blockStart = timeToMinutes(other.show_block_start);
    const blockEnd = timeToMinutes(other.show_block_end);
    return itemStart < blockEnd && itemEnd > blockStart;
  });
}

export const DayTimeline: React.FC<DayTimelineProps> = ({ items, participants }) => {
  const { updateItineraryItem } = useTrip();

  const sortedItems = [...items].sort((a, b) => a.time_start.localeCompare(b.time_start));
  const coverage = computeCoverage(items, participants);

  const handleStatusClick = (item: ItineraryItem, participantId: string) => {
    const current = item.participant_status?.[participantId];
    updateItineraryItem(item.id, {
      participant_status: { ...item.participant_status, [participantId]: nextParticipantStatus(current) },
    });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white">Cobertura do dia</span>
          <span className="text-lg font-bold text-blue-400">{coverage.percent}%</span>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {(['attraction', 'show', 'experience', 'character'] as const).map(type => (
            <span key={type} className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              {ITEM_TYPE_LABELS[type]}: {coverage.byType[type].done}/{coverage.byType[type].total}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {participants.map(p => {
            const c = coverage.byParticipant[p.id];
            if (!c || c.total === 0) return null;
            return (
              <span key={p.id} className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                <span className={`w-4 h-4 rounded-full ${p.avatar_color} text-white text-[9px] font-bold flex items-center justify-center`}>
                  {p.nickname ? p.nickname[0] : p.full_name[0]}
                </span>
                {c.done}/{c.total}
              </span>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {sortedItems.length === 0 ? (
          <div className="p-8 rounded-2xl glass-card text-center border border-slate-800 text-slate-400 text-xs">
            Nenhum item de parque para este dia.
          </div>
        ) : (
          sortedItems.map(item => {
            const isShow = Boolean(item.item_type === 'show' && item.show_block_start && item.show_block_end);
            const conflict = findConflictingShow(item, sortedItems);

            return (
              <div
                key={item.id}
                className={`glass-card p-4 rounded-2xl border space-y-3 ${
                  isShow ? 'border-purple-500/40 bg-purple-500/5' : 'border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isShow ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/10 text-blue-400'
                      }`}
                    >
                      {isShow ? <Clapperboard className="w-4 h-4" /> : item.time_start}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {item.item_type ? ITEM_TYPE_LABELS[item.item_type] : item.category}
                        </span>
                        {isShow && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Horário fixo {item.show_block_start}–{item.show_block_end}
                          </span>
                        )}
                        {!isShow && item.time_is_estimated && (
                          <span className="text-[10px] text-slate-500">~ horário estimado</span>
                        )}
                      </div>
                      <h4 className="font-bold text-base text-white mt-0.5">{item.title}</h4>
                    </div>
                  </div>
                </div>

                {conflict && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <div>
                      Conflita com <strong>{conflict.title}</strong> ({conflict.show_block_start}–{conflict.show_block_end}).
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
                  {item.participant_ids.map(pId => {
                    const p = participants.find(part => part.id === pId);
                    if (!p) return null;
                    const status = item.participant_status?.[pId] ?? 'pending';
                    return (
                      <button
                        key={pId}
                        onClick={() => handleStatusClick(item, pId)}
                        title={`${p.full_name}: ${status}`}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 transition ${
                          STATUS_STYLES[status] ?? STATUS_STYLES.pending
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full ${p.avatar_color} text-white text-[9px] font-bold flex items-center justify-center`}>
                          {p.nickname ? p.nickname[0] : p.full_name[0]}
                        </span>
                        {status}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: succeeds. `DayTimeline.tsx` isn't imported anywhere yet, so this only validates it compiles standalone (types line up with `coverageEngine.ts` and `database.types.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/features/timeline/DayTimeline.tsx
git commit -m "feat(timeline): add DayTimeline component with show blocks and conflict alerts"
```

---

### Task 3: Month calendar component

**Files:**
- Create: `src/features/timeline/MonthCalendar.tsx`

**Interfaces:**
- Consumes: `computeCoverage` from Task 1; `ItineraryItem`, `Participant` types.
- Produces: `MonthCalendar` component with props `{ parkItems: ItineraryItem[]; participants: Participant[]; selectedDate: string; onSelectDate: (date: string) => void }` — `parkItems` is the trip's full `category: 'park'` set (unfiltered by date; this component groups by date itself). Task 4 renders `<MonthCalendar parkItems={parkItems} participants={participants} selectedDate={selectedDate} onSelectDate={...} />`.

- [ ] **Step 1: Write `MonthCalendar.tsx`**

```tsx
import React from 'react';
import { computeCoverage } from '../../services/coverageEngine';
import type { ItineraryItem, Participant } from '../../types/database.types';

interface MonthCalendarProps {
  parkItems: ItineraryItem[];
  participants: Participant[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const YEAR = 2026;
const MONTH = 9; // Setembro — a viagem cabe inteira neste mês (ver spec da fatia 2)

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function buildMonthGrid(): (string | null)[] {
  const firstWeekday = new Date(YEAR, MONTH - 1, 1).getDay();
  const daysInMonth = new Date(YEAR, MONTH, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${YEAR}-${String(MONTH).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return cells;
}

export const MonthCalendar: React.FC<MonthCalendarProps> = ({ parkItems, participants, selectedDate, onSelectDate }) => {
  const cells = buildMonthGrid();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white">Setembro 2026</h3>
      <div className="grid grid-cols-7 gap-1.5 text-[10px] text-slate-500 font-semibold uppercase text-center">
        {WEEKDAY_LABELS.map(label => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;

          const dayItems = parkItems.filter(i => i.date === date);
          const hasParkDay = dayItems.length > 0;
          const parkName = hasParkDay ? dayItems[0].park : undefined;
          const coverage = hasParkDay ? computeCoverage(dayItems, participants) : null;
          const isSelected = date === selectedDate;
          const dayNumber = Number(date.slice(-2));

          return (
            <button
              key={date}
              disabled={!hasParkDay}
              onClick={() => hasParkDay && onSelectDate(date)}
              className={`aspect-square rounded-xl border p-1.5 flex flex-col items-center justify-center gap-0.5 text-center transition ${
                !hasParkDay
                  ? 'border-slate-800/60 text-slate-600 cursor-default'
                  : isSelected
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-blue-500/50'
              }`}
            >
              <span className="text-xs font-bold">{dayNumber}</span>
              {hasParkDay && (
                <>
                  <span className="text-[9px] leading-tight truncate max-w-full">{parkName}</span>
                  <span className="text-[9px] font-bold text-emerald-400">{coverage?.percent}%</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: succeeds. Standalone compile check — not imported anywhere yet.

- [ ] **Step 3: Commit**

```bash
git add src/features/timeline/MonthCalendar.tsx
git commit -m "feat(timeline): add MonthCalendar component for September 2026"
```

---

### Task 4: Timeline root view

**Files:**
- Create: `src/features/timeline/TimelineView.tsx`

**Interfaces:**
- Consumes: `useTrip()` → `itinerary`, `activeTrip`, `participants` (existing); `DayTimeline` from Task 2; `MonthCalendar` from Task 3.
- Produces: `TimelineView` component (no props — reads everything from `useTrip()`, same pattern as `ItineraryView`). Task 5 renders `<TimelineView />`.

- [ ] **Step 1: Write `TimelineView.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { DayTimeline } from './DayTimeline';
import { MonthCalendar } from './MonthCalendar';

export const TimelineView: React.FC = () => {
  const { itinerary, activeTrip, participants } = useTrip();

  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const parkItems = itinerary.filter(i => i.trip_id === activeTrip.id && i.category === 'park');
  const availableDates = Array.from(new Set(parkItems.map(i => i.date))).sort();

  useEffect(() => {
    if (selectedDate || availableDates.length === 0) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    const closest = availableDates.find(d => d >= todayIso) ?? availableDates[0];
    setSelectedDate(closest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDates.join(','), selectedDate]);

  const dayItems = parkItems.filter(i => i.date === selectedDate);
  const parkName = dayItems[0]?.park;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Cronologia dos Parques</h2>
          <p className="text-xs text-slate-400">
            {viewMode === 'timeline' && selectedDate
              ? `${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}${parkName ? ` • ${parkName}` : ''}`
              : 'Setembro 2026'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              viewMode === 'timeline' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Timeline
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              viewMode === 'calendar' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendário
          </button>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        selectedDate ? (
          <DayTimeline items={dayItems} participants={participants} />
        ) : (
          <div className="p-8 rounded-2xl glass-card text-center border border-slate-800 text-slate-400 text-xs">
            Nenhum dia de parque cadastrado nesta viagem.
          </div>
        )
      ) : (
        <MonthCalendar
          parkItems={parkItems}
          participants={participants}
          selectedDate={selectedDate}
          onSelectDate={date => {
            setSelectedDate(date);
            setViewMode('timeline');
          }}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: succeeds. Still not imported into `App.tsx` yet, so this validates the component tree compiles in isolation.

- [ ] **Step 3: Commit**

```bash
git add src/features/timeline/TimelineView.tsx
git commit -m "feat(timeline): add TimelineView composing DayTimeline and MonthCalendar"
```

---

### Task 5: Wire the "Cronologia" tab into navigation

**Files:**
- Modify: `src/components/Navigation.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `TimelineView` from Task 4 (`./features/timeline/TimelineView` relative to `App.tsx`).
- Produces: `NavTab` now includes `'timeline'`; clicking the "Cronologia" tab renders `TimelineView`.

- [ ] **Step 1: Add `'timeline'` to `NavTab` and the icon import**

In `src/components/Navigation.tsx`, add `Clock` to the `lucide-react` import (line 2-14):

```typescript
import {
  LayoutDashboard,
  Users,
  Plane,
  CalendarDays,
  CreditCard,
  ShoppingBag,
  CheckSquare,
  FileText,
  ShieldCheck,
  Bot,
  Volume2,
  Clock
} from 'lucide-react';
```

Add `'timeline'` to the `NavTab` union (line 17-28), right after `'itinerary'`:

```typescript
export type NavTab =
  | 'dashboard'
  | 'briefing'
  | 'participants'
  | 'logistics'
  | 'itinerary'
  | 'timeline'
  | 'purchases'
  | 'financial'
  | 'tasks_decisions'
  | 'documents'
  | 'audit'
  | 'ai';
```

- [ ] **Step 2: Add the tab entry**

In the `tabs` array (line 45-57 of `src/components/Navigation.tsx`), add a new entry right after `'itinerary'`:

```typescript
  const tabs: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'briefing', label: 'Briefing do Dia', icon: Volume2 },
    { id: 'participants', label: `Grupo (${participants.length})`, icon: Users },
    { id: 'logistics', label: 'Logística', icon: Plane },
    { id: 'itinerary', label: 'Roteiro & Atrações', icon: CalendarDays },
    { id: 'timeline', label: 'Cronologia', icon: Clock },
    { id: 'purchases', label: 'Compras & Malas', icon: ShoppingBag },
    { id: 'financial', label: 'Gift Cards & Financial', icon: CreditCard },
    { id: 'tasks_decisions', label: 'Pendências', icon: CheckSquare, badge: pendingTaskCount > 0 ? pendingTaskCount : undefined },
    { id: 'documents', label: 'Vouchers & PDF', icon: FileText },
    { id: 'audit', label: 'Auditoria', icon: ShieldCheck, badge: auditCount > 0 ? auditCount : undefined },
    { id: 'ai', label: 'IA Copilot', icon: Bot }
  ];
```

- [ ] **Step 3: Import and render `TimelineView` in `App.tsx`**

Add the import in `src/App.tsx` (after line 13, `import { ItineraryView } ...`):

```typescript
import { TimelineView } from './features/timeline/TimelineView';
```

Add the branch after the `'itinerary'` block (after line 64, before the `'purchases'` block):

```tsx
        {activeTab === 'timeline' && (
          <TimelineView />
        )}
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: succeeds with no errors. This is the first point the whole new component tree is actually reachable from `App.tsx`, so it also catches any prop-shape mismatch between `TimelineView`/`DayTimeline`/`MonthCalendar`.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: only the two pre-existing `react/only-export-components` warnings on `TripContext.tsx`/`AuthContext.tsx` (per `CLAUDE.md`) — no new warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components/Navigation.tsx src/App.tsx
git commit -m "feat(timeline): wire Cronologia tab into navigation"
```

---

### Task 6: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Open the app and go to the new tab**

Navigate to the app in a browser, click the "Cronologia" tab.

- [ ] **Step 3: Verify calendar mode**

Switch to "Calendário". Confirm days 07, 08, 10, 11, 13, 14 and 15/09/2026 show a park name and an initial coverage of 0%; all other days are neutral (no park name, not clickable).

- [ ] **Step 4: Verify timeline mode for one day**

Click 07/09 (Magic Kingdom). Confirm:
- The ~40 items for that day render in chronological order by `time_start`.
- Shows render as a visually distinct block labeled with their fixed `show_block_start`–`show_block_end` window.
- Clicking a participant chip on an item cycles `pending → done → skipped → pending`, and the coverage header percentage updates immediately (no reload).

- [ ] **Step 5: Verify conflict badges**

Confirm the days with a real item/show-block overlap (6 in the current dataset) show the "Conflita com `<nome do show>`" badge on the non-show item that falls inside the show's block. Cross-check by finding those overlaps directly against the data if needed:

```bash
supabase db query --linked "select date, title, time_start, time_end from itinerary_items where category = 'park' and item_type != 'show' order by date, time_start;"
```

(cross-reference against `show_block_start`/`show_block_end` of same-day shows to confirm which 6 should show the badge.)

- [ ] **Step 6: Verify calendar reflects the update**

Go back to "Calendário". Confirm the percentage shown for 07/09 has changed to reflect the item(s) marked "done" in Step 4.

- [ ] **Step 7: Final build check**

Run: `npm run build`
Expected: succeeds — this is the full typecheck + production build, the closest thing this repo has to a CI gate (per `CLAUDE.md`, `npm run build` runs `tsc -b` first).

No commit for this task — it's verification only, not a code change.

---

## Self-Review Notes

- **Spec coverage:** navigation entry with toggle (Task 5), chronological list ordered by `time_start` (Task 2), show blocks + conflict badge (Task 2), per-participant status cycling (Task 2), per-type + per-participant coverage (Task 1 + Task 2 header), month grid with click-to-select (Task 3), no new `TripContext` state (confirmed — everything derives from existing `itinerary`/`participants` via `useMemo`-free pure calls each render), September-only grid with no month nav (Task 3, hardcoded `YEAR`/`MONTH`), full manual QA matching the spec's own Verification section (Task 6). All "Fora de escopo" items are respected — `ItineraryView.tsx` is untouched, no new `TripContext` fields, no month navigation, no bulk/keyboard status editing.
- **Placeholder scan:** no TBD/TODO, no "similar to Task N" — every step has literal code.
- **Type consistency:** `DayCoverage`/`CoverageCount`/`CoverageItemType` from Task 1 are used identically (same field names) in Task 2's header and Task 3's cell coverage. `DayTimeline` props (`items`, `participants`) and `MonthCalendar` props (`parkItems`, `participants`, `selectedDate`, `onSelectDate`) match exactly how Task 4 invokes them.
