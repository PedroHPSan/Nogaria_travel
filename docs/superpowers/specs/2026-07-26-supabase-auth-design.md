# Supabase Auth & Multi-Tenant Onboarding — Design

## Context

The Supabase project `Nogaria_travel` (ref `bkrqhividgljticgjrem`) already has the full application schema (tenants, trips, participants, etc.) with RLS enforced via `memberships` → `tenants` → `trips`. The frontend (`TripContext.tsx`) is still 100% localStorage-backed and has no notion of a logged-in user — `activeTenant` is a hardcoded mock (`INITIAL_TENANT`, "Família Palheta").

This is the **auth** sub-project: get real users able to sign up, log in, land in a tenant, and invite teammates. Wiring the rest of the app's data (trips, participants, flights, ...) from localStorage to Supabase is an explicitly separate, later step — out of scope here.

## Goals

- Open self-service signup: anyone can create an account and become the owner of their own tenant (real multi-tenant SaaS, not a closed family-only app).
- Three auth methods: email+password, magic link, Google OAuth.
- Onboarding: after first sign-in with zero tenants, ask for an organization/family name and create a tenant via the existing `create_tenant_with_owner` RPC.
- Basic team invites: a tenant admin can invite someone by email. If that email already has an account, they're added instantly. If not, the invite is pending and auto-resolves the moment that email signs up.
- The rest of `TripContext` (trips, participants, flights, etc.) stays exactly as it is today (localStorage/mock) — only `activeTenant`/`tenants` switch from hardcoded mock data to the real authenticated values.

## Non-goals

- Wiring trips/participants/flights/etc. to the database (separate future step).
- Role-based UI restrictions beyond "admin can invite, everyone else can't" (the `UserRole` union already has `organizer`/`participant`/`viewer`/`developer`, but no finer permission matrix is being built now).
- Automated tests (this project has no test framework — see `CLAUDE.md`). Verification is `npm run build` + `npm run lint` + a manual click-through.
- Password reset UI, email template customization, account deletion, session-revocation UX.

## Database changes (new migration(s) on top of the existing schema)

### `create_tenant_with_owner` — simplify signature

Change from `create_tenant_with_owner(p_name text, p_slug text)` to `create_tenant_with_owner(p_name text)`. The slug is derived internally (slugified name + a short random suffix to guarantee uniqueness) so the onboarding UI only has to ask for one field and can never hit a "slug already taken" error.

### New table: `tenant_invites`

```
id              uuid pk default gen_random_uuid()
tenant_id       uuid not null references tenants(id) on delete cascade
email           text not null
role            varchar(50) not null check (same role set as memberships.role)
invited_by_id   uuid references profiles(id) on delete set null
created_at      timestamptz not null default now()
accepted_at     timestamptz  -- null until resolved
unique (tenant_id, lower(email))
```

RLS: only tenant admins (`is_tenant_admin(tenant_id)`) can select/insert/delete rows for their own tenant. No invitee-facing visibility is needed — resolution is fully automatic, nothing for the invited person to accept.

### Two triggers close the loop

1. `AFTER INSERT ON tenant_invites` (new trigger function `public.resolve_invite_if_profile_exists()`): looks up `profiles` by `lower(email) = lower(new.email)`. If found, inserts into `memberships` (`on conflict (tenant_id, user_id) do nothing`) and sets `accepted_at = now()` on the invite row immediately.
2. `handle_new_user()` (already exists) is extended: after inserting the new `profiles` row, it also scans `tenant_invites` for unaccepted rows matching the new user's email, inserts the corresponding `memberships` rows, and marks them accepted.

This covers both orders of operations (invited-before-signup and invited-after-account-exists) without requiring the invitee to do anything.

### Grants

Same pattern as the rest of the schema: `authenticated` + `service_role` only, no `anon`.

## Frontend architecture

### New: `AuthContext` (`src/context/AuthContext.tsx`, `useAuth()`)

A context separate from `TripContext` (which is already large and scoped to trip data — mixing auth in would make it worse, per the existing `CLAUDE.md` note about that file).

State: `session`, `profile` (own `profiles` row), `tenants` (array of `{tenant, role}` from `memberships` joined to `tenants`), `activeTenantId`, loading flags.

Actions: `signUpWithPassword`, `signInWithPassword`, `signInWithMagicLink`, `signInWithGoogle`, `signOut`, `createTenant(name)` (calls `create_tenant_with_owner`, then refetches `tenants`), `setActiveTenantId`.

Wiring: `supabase.auth.getSession()` on mount + `onAuthStateChange` subscription to keep session in sync; whenever a session appears, fetch `profiles` + `memberships`/`tenants`.

### New Supabase client module (`src/services/supabaseClient.ts`)

Reads `import.meta.env.VITE_SUPABASE_URL` / `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`. **Environment detail:** the existing `.env` uses unprefixed names (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`), which Vite does not expose to browser code — only `VITE_`-prefixed vars are bundled client-side. This migration adds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `.env` (and documents them in `env.example`, without real values). `SUPABASE_SECRET_KEY` is never read by frontend code.

### No new router

A single `AuthGate` component (`src/features/auth/AuthGate.tsx`) decides what to render based on state — consistent with the app's existing no-router, `useState`-driven pattern (`App.tsx` already switches views this way, per `CLAUDE.md`).

```
AuthProvider
  └─ AuthGate
       ├─ (no session)         → AuthScreen
       ├─ (session, 0 tenants) → OnboardingScreen
       └─ (session, ≥1 tenant) → TripProvider → MainAppContent (existing app)
```

### New screens (`src/features/auth/`)

- `AuthScreen.tsx` — Login/Signup toggle, each with email+password fields, a magic-link button, and a Google button. Styled with the existing dark glassmorphism classes (`glass-card`, slate/blue palette) — hand-rolled forms calling `supabase-js` methods directly (`signInWithPassword` / `signUp` / `signInWithOtp` / `signInWithOAuth`), not the `@supabase/auth-ui-react` package (current Supabase docs consistently show hand-rolled forms; the prebuilt package doesn't appear in current guidance, so it's skipped to avoid a possibly under-maintained dependency and because a custom form matches the app's distinctive visual style better).
- `OnboardingScreen.tsx` — single text field ("nome da sua família/organização") → `createTenant(name)`.

### Header additions

- A "Equipe" button next to the existing Audit/AI buttons, opening `TeamModal.tsx` (follows the existing `BaseModal` pattern): lists current members (`profiles` joined via `memberships`) and pending invites (`tenant_invites` where `accepted_at is null`); an invite form (email + role) is shown/enabled only when the current user's role in the active tenant is `admin`.
- A small account menu (avatar + "Sair"/logout).

### `TripContext` touch-point

`TripContext` stops hardcoding `INITIAL_TENANT` and instead reads `activeTenant`/`tenants` from `useAuth()`. Everything else in `TripContext` (trips, participants, flights, ...) is untouched — still localStorage/mock, per the explicit scope decision above.

## Data flow

1. App loads → `AuthProvider` checks for an existing session and subscribes to auth state changes.
2. No session → `AuthScreen`.
   - Signup (email+password): `supabase.auth.signUp` creates the `auth.users` row → `handle_new_user` trigger creates the `profiles` row and resolves any pending `tenant_invites` for that email. Supabase's default email-confirmation requirement means the user sees a "confirm your email" screen before they get a session.
   - Login (email+password): `signInWithPassword`.
   - Magic link: `signInWithOtp({ email })` → "check your email" message → clicking the link returns the user to the app with a session.
   - Google: `signInWithOAuth({ provider: 'google', redirectTo })` → standard OAuth redirect.
3. Session established → `AuthContext` fetches the profile and tenant memberships.
   - Non-empty tenants (e.g., an invite already auto-resolved) → skip onboarding, activate the first tenant.
   - Empty tenants → `OnboardingScreen` → `create_tenant_with_owner` → refetch → enter the app.
4. Inside the app, `TripContext` sources `activeTenant`/`tenants` from `AuthContext`.
5. `TeamModal`: an invite insert into `tenant_invites` either resolves instantly (existing account) or sits under "convites pendentes" until the invitee signs up.
6. Logout clears session state and returns to `AuthScreen`.

## Error handling

- Signup with an already-registered email → "esse email já está cadastrado, tente entrar", switch to the Login tab.
- Weak password → surface Supabase's own validation message.
- Email confirmation pending → explicit screen with a resend option.
- Invalid login credentials → generic "email ou senha incorretos" (no user enumeration between "wrong password" and "no such account").
- OAuth / magic-link failures → dismissible error banner, doesn't block the screen.
- Onboarding with an empty name → client-side validation before calling the RPC.
- Inviting an email that's already a member → unique-constraint violation surfaced as "essa pessoa já faz parte da equipe".
- Non-admin users never see an actionable invite form (UI hides it); the RLS insert policy on `tenant_invites` is the real enforcement layer regardless of UI state.

## Verification plan

No test framework exists in this repo (confirmed in `CLAUDE.md`) and none is being introduced for this feature. Verification is:
1. `npm run build` and `npm run lint` for type/lint correctness.
2. A manual click-through in the browser: signup → email confirmation → onboarding → invite a second (real or test) account → logout → log back in → confirm the invited account lands in the same tenant.
