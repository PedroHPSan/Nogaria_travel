-- Fatia 1: performance/acurácia do bot + base de dados dos avisos de atividade.
--
-- Três blocos:
--   A) Índices e coluna `kind` que o caminho quente do webhook precisa.
--   B) Busca textual tolerante a acento/typo (entity resolution do function calling).
--   C) Config e ledger dos avisos de atividade agendados.

------------------------------------------------------------------------------
-- A) Caminho quente do webhook
------------------------------------------------------------------------------

-- `loadHistory` filtra (tenant_id, sender_phone) e ordena por created_at desc.
-- Os índices de coluna única existentes não servem esse acesso: o planner
-- precisa de um composto para virar index scan + limit em vez de sort.
create index if not exists whatsapp_messages_conversation_idx
  on public.whatsapp_messages (tenant_id, sender_phone, created_at desc);

-- O digest diário e os avisos de atividade também gravam em whatsapp_messages.
-- Sem distinguir a origem, esses textos longos entram no histórico enviado ao
-- modelo como turnos de conversa, consumindo janela de contexto todo dia.
alter table public.whatsapp_messages
  add column if not exists kind varchar(20) not null default 'chat';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'whatsapp_messages_kind_check'
  ) then
    alter table public.whatsapp_messages
      add constraint whatsapp_messages_kind_check
      check (kind in ('chat', 'digest', 'reminder'));
  end if;
end $$;

-- Telemetria de latência e roteamento. Sem separar "quantas rodadas de tool" de
-- "quantos tokens", não dá para saber se uma resposta lenta foi o modelo ou o
-- número de idas e vindas — e é sempre o número de idas e vindas.
alter table public.ai_usage_logs
  add column if not exists latency_ms integer,
  add column if not exists tool_rounds smallint,
  add column if not exists tools_called text;

-- Roteiro do dia é consultado por (trip_id, date) no digest, nos avisos e no
-- pré-carregamento do system prompt — sempre ordenado por horário.
create index if not exists itinerary_items_trip_date_idx
  on public.itinerary_items (trip_id, date, time_start);

------------------------------------------------------------------------------
-- B) Entity resolution tolerante (acento + typo)
------------------------------------------------------------------------------
-- O `ilike '%texto%'` usado pelas tools de escrita é case-insensitive mas não
-- ignora acento nem tolera erro de digitação: "montanha russa" não casa
-- "Montanha-Russa" e "expediton" não casa nada. Em pt-BR essa é a maior fonte
-- de erro do bot — o modelo acerta a intenção e erra o item.
--
-- word_similarity(query, título) é a métrica correta aqui: mede o quanto a
-- query casa com um *trecho* do título, então "everest" pontua alto em
-- "Expedition Everest" (similarity simples penalizaria a diferença de tamanho).
--
-- Piso de 0.45 calibrado empiricamente: 0.3 devolvia ruído ("check-in" casava
-- "Comprar chip internacional" com 0.33), o que faz o bot perguntar "você quis
-- dizer...?" sobre um item sem relação — pior que dizer que não encontrou.
-- 0.45 ainda acomoda erro de digitação ("expediton everest" = 0.75).
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Nota de performance: não há índice GIN de trigrama aqui de propósito. As
-- buscas já são pré-filtradas por trip_id (índice existente), o que reduz o
-- conjunto a algumas centenas de linhas curtas — varredura em memória na casa
-- de microssegundos. Um índice GIN exigiria um wrapper IMMUTABLE de unaccent e
-- só compensa uma ordem de grandeza acima deste volume.

create or replace function public.search_itinerary_items(
  p_trip_id uuid,
  p_query text,
  p_date date default null,
  p_limit integer default 5
)
returns table (
  id uuid,
  title text,
  item_date date,
  time_start time,
  participant_status jsonb,
  score real
)
language sql
stable
security invoker
set search_path = extensions, public
as $$
  with needle as (
    select unaccent(lower(btrim(p_query))) as q
  ),
  scored as (
    select
      i.id,
      i.title::text as title,
      i.date as item_date,
      i.time_start,
      i.participant_status,
      unaccent(lower(i.title)) as haystack,
      n.q as q
    from public.itinerary_items i
    cross join needle n
    where i.trip_id = p_trip_id
      and (p_date is null or i.date = p_date)
      and n.q <> ''
  )
  select
    s.id,
    s.title,
    s.item_date,
    s.time_start,
    s.participant_status,
    greatest(
      word_similarity(s.q, s.haystack),
      similarity(s.haystack, s.q),
      case when s.haystack like '%' || s.q || '%' then 0.85::real else 0::real end
    ) as score
  from scored s
  where greatest(
          word_similarity(s.q, s.haystack),
          similarity(s.haystack, s.q),
          case when s.haystack like '%' || s.q || '%' then 0.85::real else 0::real end
        ) >= 0.45
  order by score desc, s.item_date, s.time_start
  limit greatest(p_limit, 1);
$$;

create or replace function public.search_tasks(
  p_trip_id uuid,
  p_query text,
  p_statuses text[] default array['pending', 'in_progress'],
  p_limit integer default 5
)
returns table (
  id uuid,
  title text,
  status text,
  due_date date,
  score real
)
language sql
stable
security invoker
set search_path = extensions, public
as $$
  with needle as (
    select unaccent(lower(btrim(p_query))) as q
  ),
  scored as (
    select
      t.id,
      t.title::text as title,
      t.status::text as status,
      t.due_date,
      unaccent(lower(t.title)) as haystack,
      n.q as q
    from public.tasks t
    cross join needle n
    where t.trip_id = p_trip_id
      and (p_statuses is null or t.status = any (p_statuses))
      and n.q <> ''
  )
  select
    s.id,
    s.title,
    s.status,
    s.due_date,
    greatest(
      word_similarity(s.q, s.haystack),
      similarity(s.haystack, s.q),
      case when s.haystack like '%' || s.q || '%' then 0.85::real else 0::real end
    ) as score
  from scored s
  where greatest(
          word_similarity(s.q, s.haystack),
          similarity(s.haystack, s.q),
          case when s.haystack like '%' || s.q || '%' then 0.85::real else 0::real end
        ) >= 0.45
  order by score desc, s.due_date nulls last
  limit greatest(p_limit, 1);
$$;

-- Mesmo padrão do resto do schema: nada para `anon`.
revoke all on function public.search_itinerary_items(uuid, text, date, integer) from public;
revoke all on function public.search_tasks(uuid, text, text[], integer) from public;
grant execute on function public.search_itinerary_items(uuid, text, date, integer) to authenticated, service_role;
grant execute on function public.search_tasks(uuid, text, text[], integer) to authenticated, service_role;

------------------------------------------------------------------------------
-- C) Avisos de atividade agendados
------------------------------------------------------------------------------

-- Antecedência padrão do aviso e janela de silêncio, por tenant.
alter table public.whatsapp_configs
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists reminder_lead_minutes integer not null default 60,
  add column if not exists quiet_hours_start time not null default '22:00',
  add column if not exists quiet_hours_end time not null default '07:00';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'whatsapp_configs_reminder_lead_check'
  ) then
    alter table public.whatsapp_configs
      add constraint whatsapp_configs_reminder_lead_check
      check (reminder_lead_minutes between 5 and 720);
  end if;
end $$;

-- Override por item: um jantar quer 15 min de aviso, um parque com
-- deslocamento quer 90. Quando nulo, cai no padrão do tenant (ajustado por
-- `recommended_arrival_min_before`, que já existe para shows).
alter table public.itinerary_items
  add column if not exists reminder_minutes_before integer
    check (reminder_minutes_before is null or reminder_minutes_before between 0 and 720);

-- Ledger de entrega. É o que torna o agendamento idempotente: o cron roda a
-- cada 10 min e reavalia a mesma janela várias vezes, então a chave única
-- (item, participante, tipo) é o que impede o mesmo aviso de sair duas vezes.
-- Também é o que permite "recuperar" um aviso atrasado sem duplicar: se uma
-- execução falhar, a seguinte ainda envia enquanto a atividade não começou.
create table if not exists public.activity_reminders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  itinerary_item_id uuid not null references public.itinerary_items (id) on delete cascade,
  participant_id uuid references public.participants (id) on delete cascade,
  kind varchar(20) not null default 'lead' check (kind in ('lead', 'day_start')),
  lead_minutes integer not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz not null default now(),
  unique (itinerary_item_id, participant_id, kind)
);

create index if not exists activity_reminders_tenant_idx
  on public.activity_reminders (tenant_id, sent_at desc);
create index if not exists activity_reminders_item_idx
  on public.activity_reminders (itinerary_item_id);

alter table public.activity_reminders enable row level security;

create policy activity_reminders_all on public.activity_reminders for all
  to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

grant select, insert, update, delete on public.activity_reminders to authenticated, service_role;
