-- Brainstorm de ideias de negócio/viagem capturadas via bot do WhatsApp (ou
-- lançadas manualmente no app). Segue o mesmo padrão trip-scoped de tasks/
-- itinerary_items: RLS via is_trip_member.

create table public.trip_ideas (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  participant_id uuid references public.participants (id) on delete set null,
  content text not null,
  category varchar(50) check (category in ('negocio', 'viagem', 'outro')),
  source varchar(20) not null default 'app' check (source in ('whatsapp', 'app')),
  status varchar(20) not null default 'novo' check (status in ('novo', 'em_analise', 'descartado', 'aprovado')),
  created_at timestamptz not null default now()
);

create index trip_ideas_trip_id_idx on public.trip_ideas (trip_id);
create index trip_ideas_created_at_idx on public.trip_ideas (created_at);

alter table public.trip_ideas enable row level security;

create policy trip_ideas_all on public.trip_ideas for all
  to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
