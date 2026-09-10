-- Realtime colaborativo básico (#41): adiciona as coleções por viagem (e
-- `trips`, por tenant) à publicação `supabase_realtime`, para que
-- `postgres_changes` do supabase-js entregue INSERT/UPDATE/DELETE aos
-- clientes assinantes.
--
-- Não precisa de `replica identity full`: o app só usa o `id` do payload
-- `old` de DELETE (default do Postgres já inclui a PK), nunca o resto da
-- linha excluída.
--
-- RLS já filtra o que cada usuário recebe — `postgres_changes` respeita as
-- policies existentes de cada tabela, então isto não abre acesso novo, só
-- distribui em tempo real o que a policy já deixaria o usuário ler.
--
-- Idempotente: pode ser reaplicada sem erro (`alter publication ... add
-- table` falha se a tabela já estiver na publicação, daí o guard via
-- `pg_publication_tables`).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'trips'
  ) then
    alter publication supabase_realtime add table public.trips;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'itinerary_items'
  ) then
    alter publication supabase_realtime add table public.itinerary_items;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'trip_ideas'
  ) then
    alter publication supabase_realtime add table public.trip_ideas;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'flights'
  ) then
    alter publication supabase_realtime add table public.flights;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'accommodations'
  ) then
    alter publication supabase_realtime add table public.accommodations;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'transport_reservations'
  ) then
    alter publication supabase_realtime add table public.transport_reservations;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'gift_cards'
  ) then
    alter publication supabase_realtime add table public.gift_cards;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'purchase_items'
  ) then
    alter publication supabase_realtime add table public.purchase_items;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'luggages'
  ) then
    alter publication supabase_realtime add table public.luggages;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'expenses'
  ) then
    alter publication supabase_realtime add table public.expenses;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'decisions'
  ) then
    alter publication supabase_realtime add table public.decisions;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table public.documents;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'loyalty_accounts'
  ) then
    alter publication supabase_realtime add table public.loyalty_accounts;
  end if;
end $$;
