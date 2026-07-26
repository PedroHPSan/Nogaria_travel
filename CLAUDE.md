# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server with HMR
npm run build     # tsc -b && vite build  — typecheck runs first and will fail the build
npm run lint      # oxlint (not ESLint)
npm run preview   # serve the production build
```

There is **no test framework installed** — no test runner, no test files, no `test` script. Don't reference or invent one; if tests are wanted, that's a setup decision to raise with the user first.

`npm run lint` currently emits two known warnings (`react/only-export-components`), on `TripContext.tsx` and `AuthContext.tsx` — both export a provider component and a `useX` hook from the same file, which is the accepted pattern in this codebase for context modules. A clean lint run means "only those two warnings".

## Architecture

A single-page, client-only trip-management app (React 19 + Vite 8 + TypeScript 6 + Tailwind v4). UI strings are Portuguese (pt-BR).

### No router — tab state drives everything

`App.tsx` renders every feature view conditionally off one `useState<NavTab>`. The `NavTab` union lives in `src/components/Navigation.tsx` and is the canonical list of screens. Adding a screen means: extend `NavTab`, add an entry to the `tabs` array in `Navigation.tsx`, and add a branch in `App.tsx`.

### TripContext is the entire data layer

`src/context/TripContext.tsx` (~850 lines) holds **all** application state and **all** CRUD operations for every entity. There is no store library, no data-fetching layer, and no per-feature state. Every view calls `useTrip()`.

Adding a new entity type touches five places in order:

1. `src/types/database.types.ts` — the interface
2. `src/services/initialMockData.ts` — the `INITIAL_*` seed export (some seeds instead live inline at the top of `TripContext.tsx`, e.g. `INITIAL_LUGGAGE`, `INITIAL_EXPENSES`, `INITIAL_DOCUMENTS`, `INITIAL_LOYALTY`)
3. `TripContext.tsx` — a `useState` initialized from `localStorage`, a `useEffect` that persists it, and the add/update/delete functions
4. `TripContextType` — declare the new state and functions or they aren't reachable
5. The feature view + its modal

### Persistence is localStorage, one key per collection

Keys are `ANTIGRAVITY_TRAVEL_PLATFORM_V1_<collection>` (see `STORAGE_KEY`). Each collection gets its own `useState(() => JSON.parse(localStorage.getItem(...)) ?? INITIAL_X)` plus a matching `useEffect` writer.

**Consequence:** seed data is read only when a key is absent. Editing `initialMockData.ts` has no visible effect in a browser that already has state — clear localStorage to see seed changes.

### Supabase: Auth and tenants/memberships are wired; trip data is not

The Supabase project is **`Nogaria_travel`** (ref `bkrqhividgljticgjrem`, region `us-west-2`, Postgres 17), in a *different* Supabase account/org than the one `.mcp.json` and the Supabase MCP server are authenticated as — the MCP tools cannot see this project. Use the **Supabase CLI** instead: it's linked (`supabase link --project-ref bkrqhividgljticgjrem`), and `.env` (git-ignored, not committed) holds `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`. Useful commands: `supabase db query --linked "<sql>"`, `supabase db push --linked`, `supabase db advisors --linked --type security`.

The full schema is live remotely (4 migrations under `supabase/migrations/`), covering all ~19 entities from `database.types.ts`: `tenants`, `profiles`, `memberships`, `trips`, `participants`, `decisions`, `accommodations`, `flights`, `transport_reservations`, `itinerary_items`, `gift_cards`, `purchase_items`, `luggages`, `expenses`, `tasks`, `documents`, `loyalty_accounts`, `ai_provider_configs`, `ai_usage_logs`, plus `audit_finding_resolutions` (a DB-backed home for the `resolved` toggle audit findings already have client-side — findings themselves stay computed, not stored) and `tenant_invites` (pending team invites, see below). RLS is enabled on every table; access is entirely via `memberships` → `tenants` → `trips` (helper functions `is_tenant_member`/`is_tenant_admin`/`is_trip_member`, `SECURITY INVOKER`). Only `authenticated` and `service_role` are granted anything — **no `anon` access anywhere**, since this project post-dates Supabase's 2026-04 change that stopped auto-granting new public tables to any role, and this app has no public/anonymous use case. New tenants must go through the `create_tenant_with_owner(p_name text)` RPC (`SECURITY DEFINER`, `authenticated`-only, slug derived internally from the name) rather than inserting into `tenants` directly, since a bare INSERT policy on `tenants` would let any authenticated user join without a matching membership.

Deliberate deviations from the TS types, worth knowing before writing queries or wiring the client:
- `participants.age` is **not a column** — only `birth_date` (avoids the drift bug noted below under Gotchas). Compute age at the application layer.
- `gift_cards.cashback_amount` / `net_cost` / `effective_savings` / `effective_savings_pct` are Postgres **generated columns**, computed identically to `giftCardCalculator.ts` — don't set them on insert/update, Postgres rejects writes to generated columns.
- `ai_provider_configs` / `ai_usage_logs` carry a `tenant_id` column not present on the TS interfaces — required for RLS row isolation, since without it these tables would have no way to scope access per tenant.

**What's actually wired:** `src/services/supabaseClient.ts` creates the client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — Vite only exposes env vars to client code when they're `VITE_`-prefixed, so these are distinct from the unprefixed `SUPABASE_*` vars the CLI uses. `src/context/AuthContext.tsx` owns the session (via `supabase.auth.onAuthStateChange`, the single source of truth for session state — there's no separate `getSession()` call, since `onAuthStateChange` already delivers the initial session as an `INITIAL_SESSION` event to new subscribers), the signed-in user's `profile`, and their `tenantMemberships`/`activeTenantId`/`activeRole`. `src/features/auth/AuthGate.tsx` gates the whole app on that state: unauthenticated → `AuthScreen` (email/password, magic link, Google OAuth — Google needs the provider enabled and redirect URLs configured in the Supabase dashboard, not just client code), authenticated with zero tenants → `OnboardingScreen` (calls `createTenant`, which wraps `create_tenant_with_owner`), a failed profile/membership fetch → a retry screen, otherwise the app itself. `src/components/modals/TeamModal.tsx` reads/writes `memberships` and `tenant_invites` directly for the active tenant (list members, invite by email, cancel a pending invite) and is gated to admins for the invite/cancel actions via `activeRole`.

**Still not wired:** `TripContext.tsx` (trips/participants/flights/accommodations/expenses/etc.) remains 100% localStorage, deliberately out of scope for this pass — swapping its `useState`/`localStorage` pairs for `supabase-js` calls against the tables above hasn't been started. Logging out clears both the Supabase session and every `localStorage` key under `TripContext.tsx`'s `STORAGE_KEY` prefix, but nothing in `TripContext.tsx` itself talks to Supabase yet.

### Deployment: Vercel, connected to this repo's `main` branch

Vercel project `nogaria-travel` (team `pedrohpsans-projects`) auto-deploys on push to `main`. Production URL is **`https://nogaria-travel.vercel.app`** — treat this as the stable canonical URL (not the custom domain, see below). The project's env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are set directly in the Vercel dashboard (Project Settings → Environment Variables), not derived from anything in this repo — keep them in sync with `.env` by hand if the Supabase project ever changes.

The custom domain **`nogaria.store`** (registered via Locaweb) is attached to the Vercel project but currently broken (DNS/registrar-side issue, tracked as a support ticket with Locaweb — not a Vercel or app-code problem). Once fixed, it should become the primary URL; until then, use the `.vercel.app` one everywhere (including Supabase's Auth URL Configuration, below).

**Supabase Auth ↔ Vercel wiring:** the Supabase dashboard's Auth → URL Configuration (`https://supabase.com/dashboard/project/bkrqhividgljticgjrem/auth/url-configuration`) controls where email confirmation links, magic links, and OAuth redirects land — it is **not** derived from anything in code or `vercel.json`, so it goes stale silently if the deployment URL changes. Currently set to Site URL `https://nogaria-travel.vercel.app`, with `https://nogaria-travel.vercel.app/**`, `https://nogaria-travel-git-main-pedrohpsans-projects.vercel.app/**`, `https://nogaria.store/**`, and `http://localhost:5173/**` (for local dev — Vite's default port; the Supabase project's default Site URL was originally `localhost:3000`, which silently broke local magic-link/OAuth testing until this was added) all in the redirect allow-list. Update this dashboard setting by hand whenever the canonical URL changes (e.g., once `nogaria.store` is fixed).

### Services (`src/services/`) — pure functions, two different timings

- **`auditEngine.ts`** — `runFullTripAudit()` derives `AuditFinding[]` from the whole trip. Called inside a `useMemo` in `TripContext`, so findings recompute on every data change; `rerunAudit()` is intentionally a no-op. Only the *resolved* flags are persisted (as an ID array in `resolvedAuditIds`), never the findings themselves. The unresolved count feeds the Audit tab badge in `App.tsx`.
- **`giftCardCalculator.ts`** — applied at **write** time, not render time. `addGiftCard`/`updateGiftCard` in the context recompute and store `net_cost`, `cashback_amount`, `effective_savings`, `effective_savings_pct` on the record. Any new code path that mutates a gift card must recompute these or the denormalized fields go stale.
- **`exchangeRateService.ts`** — formatting/conversion only, with a hardcoded `DEFAULT_RATE = 5.62`. Nothing fetches a live rate despite the name and the `exchangeRateDate` field.

### Currency convention

**All monetary values are stored in USD.** Conversion and formatting happen at render time via `formatAmount(usd)` / `convertAmount(usd)` from `useTrip()`, driven by the user's `currency` toggle and `exchangeRate`. Never store BRL into a USD field. (`Expense` is the exception — it carries `amount`, `amount_usd`, `amount_brl`, and `exchange_rate` together.)

### View / modal pattern

Each `src/features/<domain>/<Name>View.tsx` owns its modal open/close state and a `editingX: X | null`. The same modal serves create and edit: `null` initial data means create. Views filter their collection by `activeTrip.id` themselves — the context stores entities for *all* trips unfiltered.

All modals wrap `components/modals/BaseModal.tsx`, which supplies the overlay, header, Escape-to-close, and body-scroll lock. Modals live in the shared `components/modals/` directory, not next to their feature.

### Styling

Tailwind v4 via the `@tailwindcss/vite` plugin; `src/index.css` uses `@import "tailwindcss"` and defines the `.glass-panel` / `.glass-card` utilities the UI leans on heavily.

`tailwind.config.js` is **effectively dead**: under Tailwind v4 it isn't auto-loaded, there is no `@config` directive, and nothing in `src/` uses the semantic tokens it defines (`bg-primary`, `text-foreground`, …). The HSL variables in `index.css` `:root` are likewise unused. Match the existing code: raw palette classes (`slate-*`, `blue-*`, `rose-*`, `amber-*`, `emerald-*`) on a dark background, plus the glass utilities. `src/App.css` is orphaned — nothing imports it.

Icons are `lucide-react` throughout (16 files). `recharts`, `date-fns`, `clsx`, and `tailwind-merge` are installed but **unused** — prefer them over new dependencies if you need charts, date math, or class merging.

## Gotchas

- **`auditEngine.ts` and `AiCopilotView.tsx` are hardcoded to one specific trip.** The audit matches participants by `nickname === 'Pedro'` / `'Gabi'` and `age === 12`, and string-matches the literal timestamp `'2026-09-19T17:30'`. The AI Copilot is not an LLM at all — it's a `setTimeout` plus keyword `if/else` chain returning canned Portuguese text about this trip. The `AiProviderConfig` / `AiUsageLog` settings UI is decorative; no provider is ever called. Generalizing either module means removing hardcoded names, ages, and dates.
- **`DocumentFile` and `LoyaltyAccount` are declared twice** — in `database.types.ts` *and* again in `TripContext.tsx`, which exports its own copies. The context and everything downstream use the `TripContext` versions. Edit both, or consolidate, to avoid drift.
- **`Participant.age` is a stored field, not derived** from `birth_date`, and the audit logic reads it directly. Updating a birth date without updating `age` silently breaks age-restriction findings. (The SQL table has `birth_date` and no `age` column.)
- **tsconfig is strict in ways that break builds late:** `noUnusedLocals` and `noUnusedParameters` turn unused variables into build failures (`npm run dev` won't catch them — only `npm run build`). `verbatimModuleSyntax` requires `import type` for type-only imports. `erasableSyntaxOnly` forbids enums and constructor parameter properties.
- **IDs are generated as `` `prefix-${Date.now()}` ``** in every context CRUD function. Two records created in the same millisecond collide.
- **`DailyBriefingView` uses the Web Speech API** (`window.speechSynthesis`) directly, guarded by feature detection.
- `README.md` is the untouched Vite starter template and describes nothing about this app.
