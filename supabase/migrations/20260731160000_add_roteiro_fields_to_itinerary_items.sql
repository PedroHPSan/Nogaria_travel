-- Adds the roteiro dos 7 parques fields (fatia 1) to itinerary_items so the
-- granular park-day data (attractions/shows/experiences/characters) can be
-- stored server-side, matching the extended ItineraryItem TS interface.
alter table public.itinerary_items
  add column if not exists park text,
  add column if not exists area text,
  add column if not exists base_order integer,
  add column if not exists item_type character varying
    check (item_type is null or item_type in ('attraction', 'show', 'experience', 'character')),
  add column if not exists priority_tier character varying
    check (priority_tier is null or priority_tier in ('S', 'A', 'B', 'C')),
  add column if not exists lightning_lane character varying default 'none'
    check (lightning_lane is null or lightning_lane in ('none', 'genie_plus', 'individual', 'express')),
  add column if not exists lightning_lane_priority_rank integer,
  add column if not exists single_rider boolean not null default false,
  add column if not exists child_switch boolean not null default false,
  add column if not exists recommended_window text,
  add column if not exists early_closure_risk boolean not null default false,
  add column if not exists operational_status character varying default 'operating'
    check (operational_status is null or operational_status in ('operating', 'scheduled_closure', 'temporarily_closed', 'refurbishment')),
  add column if not exists counts_toward_completion boolean,
  add column if not exists participant_status jsonb not null default '{}'::jsonb,
  add column if not exists plan_b text,
  add column if not exists time_is_estimated boolean not null default false,
  add column if not exists show_block_start time without time zone,
  add column if not exists show_block_end time without time zone,
  add column if not exists recommended_arrival_min_before integer,
  add column if not exists last_showtime_of_day boolean not null default false;
