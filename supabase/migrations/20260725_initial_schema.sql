-- Database Schema for Intelligent Travel Management Platform (SaaS Multi-tenant)
-- Project: Nogaria_travel (bkrqhividgljticgjrem)

create extension if not exists "pgcrypto";

-- =========================================================================
-- HELPER FUNCTIONS (generic, no table dependencies)
-- =========================================================================

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- TENANTS (Organizations / Families)
-- =========================================================================

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  slug varchar(100) unique not null,
  plan varchar(50) not null default 'family' check (plan in ('free', 'family', 'pro', 'enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();

-- =========================================================================
-- PROFILES (mirrors auth.users)
-- =========================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email varchar(255) unique not null,
  full_name varchar(255) not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- MEMBERSHIPS (Tenant roles)
-- =========================================================================

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role varchar(50) not null check (role in ('admin', 'organizer', 'participant', 'viewer', 'developer')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index memberships_tenant_id_idx on public.memberships (tenant_id);
create index memberships_user_id_idx on public.memberships (user_id);

create function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = (select auth.uid())
  )
$$;

create function public.is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  )
$$;

-- Atomically create a tenant plus its first (admin) membership for the caller.
create function public.create_tenant_with_owner(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  insert into public.tenants (name, slug)
  values (p_name, p_slug)
  returning id into v_tenant_id;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_tenant_id, (select auth.uid()), 'admin');

  return v_tenant_id;
end;
$$;

-- =========================================================================
-- TRIPS
-- =========================================================================

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  title varchar(255) not null,
  destination_main varchar(255) not null,
  start_date date not null,
  end_date date not null,
  cover_image text,
  currency_base varchar(3) not null default 'USD' check (currency_base in ('USD', 'BRL')),
  status varchar(50) not null default 'planning' check (status in ('planning', 'confirmed', 'in_progress', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trips_tenant_id_idx on public.trips (tenant_id);

create trigger set_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

create function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips t
    join public.memberships m on m.tenant_id = t.tenant_id
    where t.id = p_trip_id
      and m.user_id = (select auth.uid())
  )
$$;

-- =========================================================================
-- PARTICIPANTS
-- =========================================================================

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  full_name varchar(255) not null,
  nickname varchar(100),
  birth_date date not null,
  is_minor boolean not null default false,
  relationship varchar(100) not null,
  responsible_participant_id uuid references public.participants (id) on delete set null,
  passport_number varchar(100),
  passport_expiry date,
  visa_status varchar(50) default 'valid' check (visa_status in ('valid', 'pending', 'exempt', 'expired')),
  dietary_restrictions text[],
  height_cm int check (height_cm is null or height_cm > 0),
  notes text,
  budget_limit_usd numeric(12, 2) not null default 0.00 check (budget_limit_usd >= 0),
  avatar_color varchar(50) not null default 'bg-blue-500',
  created_at timestamptz not null default now()
);

create index participants_trip_id_idx on public.participants (trip_id);
create index participants_responsible_participant_id_idx on public.participants (responsible_participant_id);

-- =========================================================================
-- DECISIONS
-- =========================================================================

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  topic varchar(255) not null,
  alternatives_considered text[] not null default '{}',
  chosen_decision text not null,
  reason text not null,
  decided_by_id uuid references public.participants (id) on delete set null,
  date date not null default current_date,
  financial_impact_usd numeric(12, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index decisions_trip_id_idx on public.decisions (trip_id);
create index decisions_decided_by_id_idx on public.decisions (decided_by_id);

-- =========================================================================
-- ACCOMMODATIONS
-- =========================================================================

create table public.accommodations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name varchar(255) not null,
  chain varchar(255),
  address text not null,
  city varchar(255) not null,
  check_in date not null,
  check_out date not null,
  check_in_time time,
  check_out_time time,
  confirmation_code varchar(100),
  guest_ids uuid[] not null default '{}',
  room_type varchar(255),
  price_total numeric(12, 2) not null default 0 check (price_total >= 0),
  resort_fee_per_night numeric(12, 2) check (resort_fee_per_night is null or resort_fee_per_night >= 0),
  parking_fee_per_night numeric(12, 2) check (parking_fee_per_night is null or parking_fee_per_night >= 0),
  is_breakfast_included boolean not null default false,
  currency varchar(3) not null default 'USD' check (currency in ('USD', 'BRL')),
  status varchar(50) not null default 'planning' check (status in ('confirmed', 'planning', 'replaced', 'cancelled')),
  replacement_reason text,
  linked_decision_id uuid references public.decisions (id) on delete set null,
  file_url text,
  distance_to_airport_km numeric(6, 2),
  notes text,
  created_at timestamptz not null default now()
);

create index accommodations_trip_id_idx on public.accommodations (trip_id);
create index accommodations_linked_decision_id_idx on public.accommodations (linked_decision_id);

-- =========================================================================
-- FLIGHTS
-- =========================================================================

create table public.flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  airline varchar(255) not null,
  flight_number varchar(50) not null,
  loyalty_program varchar(255),
  origin_airport varchar(10) not null,
  destination_airport varchar(10) not null,
  departure_time timestamptz not null,
  arrival_time timestamptz not null,
  terminal varchar(50),
  booking_code varchar(50) not null,
  class_type varchar(50) not null default 'economy' check (class_type in ('economy', 'premium_economy', 'business', 'first')),
  passenger_ids uuid[] not null default '{}',
  seats jsonb,
  price_cash numeric(12, 2) check (price_cash is null or price_cash >= 0),
  price_points numeric(12, 2) check (price_points is null or price_points >= 0),
  taxes_amount numeric(12, 2) check (taxes_amount is null or taxes_amount >= 0),
  currency varchar(3) not null default 'USD' check (currency in ('USD', 'BRL')),
  status varchar(50) not null default 'booked' check (status in ('booked', 'confirmed', 'changed', 'cancelled')),
  file_url text,
  notes text,
  created_at timestamptz not null default now(),
  check (arrival_time > departure_time)
);

create index flights_trip_id_idx on public.flights (trip_id);

-- =========================================================================
-- TRANSPORT RESERVATIONS
-- =========================================================================

create table public.transport_reservations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  type varchar(50) not null check (type in ('rental_car', 'uber', 'transfer', 'hotel_shuttle', 'train', 'flight', 'other')),
  provider_company varchar(255) not null,
  category_or_model varchar(255),
  primary_driver_id uuid references public.participants (id) on delete set null,
  additional_driver_ids uuid[] not null default '{}',
  pickup_location text not null,
  pickup_time timestamptz not null,
  dropoff_location text not null,
  dropoff_time timestamptz not null,
  confirmation_code varchar(100),
  price_total numeric(12, 2) not null default 0 check (price_total >= 0),
  currency varchar(3) not null default 'USD' check (currency in ('USD', 'BRL')),
  status varchar(50) not null default 'reserved' check (status in ('reserved', 'active', 'completed', 'cancelled')),
  requires_followup_transport boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index transport_reservations_trip_id_idx on public.transport_reservations (trip_id);
create index transport_reservations_primary_driver_id_idx on public.transport_reservations (primary_driver_id);

-- =========================================================================
-- ITINERARY ITEMS
-- =========================================================================

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  date date not null,
  time_start time not null,
  time_end time,
  city varchar(255) not null,
  title varchar(255) not null,
  category varchar(50) not null check (category in ('flight', 'hotel', 'park', 'restaurant', 'shopping', 'tour', 'rest', 'transit', 'event')),
  description text,
  location text,
  participant_ids uuid[] not null default '{}',
  estimated_cost numeric(12, 2) check (estimated_cost is null or estimated_cost >= 0),
  currency varchar(3) check (currency is null or currency in ('USD', 'BRL')),
  payment_method_id uuid,
  status varchar(50) not null default 'planned' check (status in ('planned', 'confirmed', 'optional', 'completed', 'cancelled')),
  min_height_cm int check (min_height_cm is null or min_height_cm > 0),
  min_age_years int check (min_age_years is null or min_age_years >= 0),
  child_friendly boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index itinerary_items_trip_id_idx on public.itinerary_items (trip_id);

-- =========================================================================
-- GIFT CARDS (Financial Module)
-- =========================================================================

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  store_brand varchar(100) not null,
  nominal_value numeric(12, 2) not null check (nominal_value >= 0),
  paid_amount numeric(12, 2) not null check (paid_amount >= 0),
  cashback_pct numeric(5, 2) not null default 0.00 check (cashback_pct >= 0 and cashback_pct <= 100),
  cashback_amount numeric(12, 2) generated always as (round(paid_amount * (cashback_pct / 100), 2)) stored,
  net_cost numeric(12, 2) generated always as (round(paid_amount - (paid_amount * (cashback_pct / 100)), 2)) stored,
  effective_savings numeric(12, 2) generated always as (
    round(nominal_value - (paid_amount - (paid_amount * (cashback_pct / 100))), 2)
  ) stored,
  effective_savings_pct numeric(6, 2) generated always as (
    case when nominal_value > 0
      then round(((nominal_value - (paid_amount - (paid_amount * (cashback_pct / 100)))) / nominal_value) * 100, 2)
      else 0
    end
  ) stored,
  currency varchar(3) not null default 'USD' check (currency in ('USD', 'BRL')),
  purchased_by_id uuid references public.participants (id) on delete set null,
  beneficiary_id uuid references public.participants (id) on delete set null,
  card_code_masked varchar(100) not null,
  current_balance numeric(12, 2) not null default 0 check (current_balance >= 0),
  expiry_date date,
  status varchar(50) not null default 'active' check (status in ('active', 'used', 'expired')),
  purchase_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index gift_cards_trip_id_idx on public.gift_cards (trip_id);
create index gift_cards_purchased_by_id_idx on public.gift_cards (purchased_by_id);
create index gift_cards_beneficiary_id_idx on public.gift_cards (beneficiary_id);

-- =========================================================================
-- PURCHASE ITEMS
-- =========================================================================

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  product_name varchar(255) not null,
  category varchar(50) not null check (category in ('electronics', 'clothing', 'footwear', 'kids', 'cosmetics', 'gifts', 'collectibles', 'personal', 'resale')),
  brand varchar(255),
  store_name varchar(255),
  target_participant_id uuid not null references public.participants (id) on delete cascade,
  beneficiary_id uuid references public.participants (id) on delete set null,
  priority varchar(50) not null default 'medium' check (priority in ('high', 'medium', 'low')),
  quantity int not null default 1 check (quantity > 0),
  target_price_usd numeric(12, 2) not null default 0 check (target_price_usd >= 0),
  price_found_usd numeric(12, 2) check (price_found_usd is null or price_found_usd >= 0),
  brl_equivalent_price numeric(12, 2) check (brl_equivalent_price is null or brl_equivalent_price >= 0),
  estimated_savings_pct numeric(6, 2),
  gift_card_eligible boolean not null default false,
  status varchar(50) not null default 'planned' check (status in ('planned', 'bought', 'online_ordered', 'delivered_hotel', 'cancelled')),
  delivery_location text,
  link_url text,
  notes text,
  created_at timestamptz not null default now()
);

create index purchase_items_trip_id_idx on public.purchase_items (trip_id);
create index purchase_items_target_participant_id_idx on public.purchase_items (target_participant_id);

-- =========================================================================
-- LUGGAGES
-- =========================================================================

create table public.luggages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  type varchar(50) not null check (type in ('checked', 'carry_on', 'personal_item')),
  bag_identifier varchar(255) not null,
  max_weight_kg numeric(6, 2) not null check (max_weight_kg > 0),
  current_weight_kg numeric(6, 2) check (current_weight_kg is null or current_weight_kg >= 0),
  description text,
  shopping_space_reserved_pct numeric(5, 2) check (shopping_space_reserved_pct is null or (shopping_space_reserved_pct >= 0 and shopping_space_reserved_pct <= 100)),
  created_at timestamptz not null default now()
);

create index luggages_trip_id_idx on public.luggages (trip_id);
create index luggages_participant_id_idx on public.luggages (participant_id);

-- =========================================================================
-- EXPENSES
-- =========================================================================

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency varchar(3) not null default 'USD' check (currency in ('USD', 'BRL')),
  amount_usd numeric(12, 2) not null check (amount_usd >= 0),
  amount_brl numeric(12, 2) not null check (amount_brl >= 0),
  exchange_rate numeric(8, 4) not null check (exchange_rate > 0),
  category varchar(50) not null check (category in ('accommodation', 'flight', 'transport', 'food', 'shopping', 'tickets', 'services', 'other')),
  paid_by_id uuid not null references public.participants (id) on delete cascade,
  beneficiary_ids uuid[] not null default '{}',
  gift_card_id uuid references public.gift_cards (id) on delete set null,
  payment_method_id uuid,
  date date not null default current_date,
  status varchar(50) not null default 'pending' check (status in ('paid', 'pending', 'reimbursed')),
  created_at timestamptz not null default now()
);

create index expenses_trip_id_idx on public.expenses (trip_id);
create index expenses_paid_by_id_idx on public.expenses (paid_by_id);
create index expenses_gift_card_id_idx on public.expenses (gift_card_id);

-- =========================================================================
-- TASKS
-- =========================================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title varchar(255) not null,
  description text,
  assigned_to_id uuid references public.participants (id) on delete set null,
  due_date date,
  priority varchar(50) not null default 'medium' check (priority in ('high', 'medium', 'low')),
  category varchar(50) not null check (category in ('logistics', 'finance', 'tickets', 'documents', 'shopping', 'general')),
  status varchar(50) not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index tasks_trip_id_idx on public.tasks (trip_id);
create index tasks_assigned_to_id_idx on public.tasks (assigned_to_id);

-- =========================================================================
-- DOCUMENTS
-- =========================================================================

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title varchar(255) not null,
  category varchar(50) not null check (category in ('flight', 'hotel', 'car', 'ticket', 'insurance', 'personal')),
  file_url text not null,
  linked_entity_type varchar(50) check (linked_entity_type in ('participant', 'flight', 'accommodation', 'transport')),
  linked_entity_id uuid,
  uploaded_at timestamptz not null default now(),
  file_size varchar(50),
  notes text
);

create index documents_trip_id_idx on public.documents (trip_id);

-- =========================================================================
-- LOYALTY ACCOUNTS
-- =========================================================================

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  program_name varchar(255) not null,
  holder_id uuid not null references public.participants (id) on delete cascade,
  balance_points bigint not null default 0 check (balance_points >= 0),
  cpm_usd numeric(8, 2) not null default 0 check (cpm_usd >= 0),
  cash_equivalent_usd numeric(12, 2) not null default 0 check (cash_equivalent_usd >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index loyalty_accounts_trip_id_idx on public.loyalty_accounts (trip_id);
create index loyalty_accounts_holder_id_idx on public.loyalty_accounts (holder_id);

-- =========================================================================
-- AI PROVIDER CONFIGS & USAGE LOGS
-- Tenant-scoped (not trip-scoped): shared AI configuration across a
-- tenant's trips. tenant_id is not part of the frontend TS type but is
-- required here to enforce multi-tenant row isolation.
-- =========================================================================

create table public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider varchar(50) not null check (provider in ('openai', 'gemini', 'anthropic', 'deepseek', 'groq', 'ollama', 'openrouter')),
  model_name varchar(255) not null,
  is_active boolean not null default true,
  is_default boolean not null default false,
  daily_token_limit int not null default 0 check (daily_token_limit >= 0),
  monthly_budget_usd numeric(12, 2) not null default 0 check (monthly_budget_usd >= 0),
  temperature numeric(3, 2) not null default 0.7 check (temperature >= 0 and temperature <= 2),
  created_at timestamptz not null default now()
);

create index ai_provider_configs_tenant_id_idx on public.ai_provider_configs (tenant_id);

create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  "timestamp" timestamptz not null default now(),
  user_name varchar(255) not null,
  function_name varchar(255) not null,
  provider varchar(50) not null,
  model varchar(255) not null,
  tokens_input int not null default 0 check (tokens_input >= 0),
  tokens_output int not null default 0 check (tokens_output >= 0),
  estimated_cost_usd numeric(12, 4) not null default 0 check (estimated_cost_usd >= 0)
);

create index ai_usage_logs_tenant_id_idx on public.ai_usage_logs (tenant_id);

-- =========================================================================
-- AUDIT FINDING RESOLUTIONS
-- Audit findings themselves are computed on the fly by the app (see
-- src/services/auditEngine.ts) and are not persisted. Only the
-- user's "resolved" toggle needs a durable home per finding id.
-- =========================================================================

create table public.audit_finding_resolutions (
  trip_id uuid not null references public.trips (id) on delete cascade,
  finding_id text not null,
  resolved_at timestamptz not null default now(),
  resolved_by_id uuid references public.profiles (id) on delete set null,
  primary key (trip_id, finding_id)
);

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.trips enable row level security;
alter table public.participants enable row level security;
alter table public.decisions enable row level security;
alter table public.accommodations enable row level security;
alter table public.flights enable row level security;
alter table public.transport_reservations enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.gift_cards enable row level security;
alter table public.purchase_items enable row level security;
alter table public.luggages enable row level security;
alter table public.expenses enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.ai_provider_configs enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.audit_finding_resolutions enable row level security;

-- tenants: members can read; only admins can update. Creation goes through
-- create_tenant_with_owner() (SECURITY DEFINER), not a direct INSERT policy.
create policy tenants_select on public.tenants for select
  to authenticated using (public.is_tenant_member(id));
create policy tenants_update on public.tenants for update
  to authenticated using (public.is_tenant_admin(id)) with check (public.is_tenant_admin(id));
create policy tenants_delete on public.tenants for delete
  to authenticated using (public.is_tenant_admin(id));

-- profiles: users manage their own profile; tenant-mates can view each
-- other's profile (needed to display names/avatars across the app).
create policy profiles_select_self on public.profiles for select
  to authenticated using ((select auth.uid()) = id);
create policy profiles_select_tenant_mates on public.profiles for select
  to authenticated using (
    exists (
      select 1 from public.memberships mine
      join public.memberships theirs on theirs.tenant_id = mine.tenant_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = public.profiles.id
    )
  );
create policy profiles_update_self on public.profiles for update
  to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- memberships: members can see their tenant's roster; only admins manage it.
create policy memberships_select on public.memberships for select
  to authenticated using (public.is_tenant_member(tenant_id));
create policy memberships_insert on public.memberships for insert
  to authenticated with check (public.is_tenant_admin(tenant_id));
create policy memberships_update on public.memberships for update
  to authenticated using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));
create policy memberships_delete on public.memberships for delete
  to authenticated using (public.is_tenant_admin(tenant_id));

-- trips: any tenant member has full access (no finer role split yet).
create policy trips_all on public.trips for all
  to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

-- Trip-scoped tables: any member of the trip's tenant has full access.
create policy participants_all on public.participants for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy decisions_all on public.decisions for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy accommodations_all on public.accommodations for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy flights_all on public.flights for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy transport_reservations_all on public.transport_reservations for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy itinerary_items_all on public.itinerary_items for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy gift_cards_all on public.gift_cards for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy purchase_items_all on public.purchase_items for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy luggages_all on public.luggages for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy expenses_all on public.expenses for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy tasks_all on public.tasks for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy documents_all on public.documents for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy loyalty_accounts_all on public.loyalty_accounts for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy audit_finding_resolutions_all on public.audit_finding_resolutions for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- Tenant-scoped tables.
create policy ai_provider_configs_all on public.ai_provider_configs for all
  to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy ai_usage_logs_all on public.ai_usage_logs for all
  to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

-- =========================================================================
-- GRANTS
-- This project was created after Supabase's 2026-04 change that stopped
-- auto-granting anon/authenticated/service_role privileges on new public
-- tables. No anon access is needed anywhere in this app (private,
-- authenticated-only), so only authenticated and service_role are granted.
-- =========================================================================

grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant all on all routines in schema public to authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on routines to authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to authenticated, service_role;
