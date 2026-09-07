-- Maps/rotas + reprogramação de agenda + confirmação em duas fases do bot
-- WhatsApp. Três blocos: (A) cache de geocoding para o get_directions, (B)
-- última localização compartilhada por participante, (C) confirmação
-- pendente das escritas destrutivas (mover horário, marcar concluído).

------------------------------------------------------------------------------
-- A) Cache de geocoding — tudo nullable, preenchido sob demanda pela tool
------------------------------------------------------------------------------
-- Nem itinerary_items nem accommodations têm coordenadas hoje (só `location`/
-- `address` em texto livre). Sem backfill: get_directions geocoda a primeira
-- vez que alguém pergunta pela rota de um lugar e grava aqui, então a segunda
-- pergunta sobre o mesmo lugar não paga geocoding de novo. place_id fixa o
-- alvo exato no Maps (evita o Maps resolver "Cinderella Castle" diferente em
-- cada chamada).
alter table public.itinerary_items
  add column if not exists place_id text,
  add column if not exists lat numeric(9, 6),
  add column if not exists lng numeric(9, 6),
  add column if not exists geocoded_at timestamptz;

alter table public.accommodations
  add column if not exists place_id text,
  add column if not exists lat numeric(9, 6),
  add column if not exists lng numeric(9, 6),
  add column if not exists geocoded_at timestamptz;

------------------------------------------------------------------------------
-- B) Última localização compartilhada — cache, não histórico
------------------------------------------------------------------------------
-- Só a posição mais recente (upsert por participant_id). Isto NÃO é rastreio:
-- não guarda trilha, só a origem para calcular rota quando a família manda o
-- pin. Fica velha sozinha (checada por idade na hora de usar, ver
-- resolveOrigin em _shared/maps.ts) — sem job de limpeza necessário.
create table if not exists public.participant_locations (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  participant_id uuid primary key references public.participants (id) on delete cascade,
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,
  shared_at timestamptz not null default now()
);

alter table public.participant_locations enable row level security;

drop policy if exists participant_locations_all on public.participant_locations;
create policy participant_locations_all on public.participant_locations for all
  to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

grant select, insert, update, delete on public.participant_locations to authenticated, service_role;

------------------------------------------------------------------------------
-- C) Confirmação em duas fases das escritas destrutivas
------------------------------------------------------------------------------
-- "Confirme antes de escrever" era só instrução de system prompt — não é
-- mecanismo de controle sobre um modelo estatístico. A intenção já resolvida
-- (ids, não texto) fica aqui entre a primeira mensagem (preview) e a segunda
-- (confirmação), porque o histórico do bot só persiste texto — nunca
-- resultado de tool — e a confirmação chega numa mensagem SEGUINTE, fora do
-- contents[] da chamada que gerou o preview.
--
-- Uma pendência por telefone (não por token): a segunda chamada busca pelo
-- sender_phone, não por algo que o modelo precise "lembrar" entre mensagens.
create table if not exists public.pending_writes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  sender_phone text not null,
  tool_name text not null,
  payload jsonb not null,
  preview text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists pending_writes_sender_idx
  on public.pending_writes (sender_phone);

alter table public.pending_writes enable row level security;

drop policy if exists pending_writes_all on public.pending_writes;
create policy pending_writes_all on public.pending_writes for all
  to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

grant select, insert, update, delete on public.pending_writes to authenticated, service_role;

------------------------------------------------------------------------------
-- D) Reagendamento reusa o ledger de avisos como canal de fan-out idempotente
------------------------------------------------------------------------------
-- 'reschedule' evita reavisar os outros participantes duas vezes se a família
-- reagendar o mesmo item de novo em poucos minutos — mesma chave única
-- (item, participante, tipo) que já protege os avisos por horário.
alter table public.activity_reminders drop constraint if exists activity_reminders_kind_check;
alter table public.activity_reminders
  add constraint activity_reminders_kind_check check (kind in ('lead', 'day_start', 'reschedule'));
