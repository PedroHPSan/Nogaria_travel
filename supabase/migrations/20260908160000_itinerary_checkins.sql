-- Reconciliação do roteiro com a realidade: quando um item passa do horário
-- sem ninguém marcar como feito, a viagem raramente segue o plano à risca
-- (fila maior que o esperado, atração fechada, cansaço). Em vez de deixar o
-- item simplesmente "sumir" do controle, o bot pergunta em lote (nunca item a
-- item — ver activity-checkins/index.ts e _shared/checkinScheduler.ts) e guarda
-- a resposta aqui: isto É o "banco de atividades não realizadas" pedido —
-- status='skipped' é a lista que a IA usa pra sugerir reencaixe depois.

create table if not exists public.itinerary_item_outcomes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  itinerary_item_id uuid not null references public.itinerary_items (id) on delete cascade,
  -- pending: perguntado, aguardando resposta da família.
  -- skipped: confirmado que não rolou — fica no banco até reencaixe (reschedule
  --   limpa esta linha, ver tripTools.ts) ou cancelamento explícito.
  -- cancelled: a família desistiu da atividade — terminal, sai do banco ativo
  --   mas fica registrado (histórico), não é apagado.
  status varchar(20) not null check (status in ('pending', 'skipped', 'cancelled')),
  note text,
  resolved_by_participant_id uuid references public.participants (id) on delete set null,
  asked_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (itinerary_item_id)
);

create index if not exists itinerary_item_outcomes_trip_status_idx
  on public.itinerary_item_outcomes (trip_id, status);

alter table public.itinerary_item_outcomes enable row level security;

drop policy if exists itinerary_item_outcomes_all on public.itinerary_item_outcomes;
create policy itinerary_item_outcomes_all on public.itinerary_item_outcomes for all
  to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

grant select, insert, update, delete on public.itinerary_item_outcomes to authenticated, service_role;

-- 'checkin': mensagens de pergunta em lote do activity-checkins — mesmo motivo
-- de 'digest'/'reminder' já existirem: não deve entrar no histórico de chat
-- que vai pro Gemini (loadHistory filtra kind = 'chat').
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_kind_check;
alter table public.whatsapp_messages
  add constraint whatsapp_messages_kind_check check (kind in ('chat', 'digest', 'reminder', 'checkin'));

alter table public.whatsapp_configs
  add column if not exists checkins_enabled boolean not null default true,
  add column if not exists checkin_cooldown_minutes integer not null default 90,
  add column if not exists checkin_grace_minutes integer not null default 20;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'whatsapp_configs_checkin_cooldown_check'
  ) then
    alter table public.whatsapp_configs
      add constraint whatsapp_configs_checkin_cooldown_check
      check (checkin_cooldown_minutes between 15 and 480);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'whatsapp_configs_checkin_grace_check'
  ) then
    alter table public.whatsapp_configs
      add constraint whatsapp_configs_checkin_grace_check
      check (checkin_grace_minutes between 0 and 180);
  end if;
end $$;

comment on column public.whatsapp_configs.checkin_cooldown_minutes is
  'Intervalo mínimo (min) entre duas mensagens de check-in (lote de itens pendentes) da mesma viagem.';
comment on column public.whatsapp_configs.checkin_grace_minutes is
  'Quantos minutos depois do fim (ou início + 30min, se não houver fim) de um item esperar antes de perguntar se aconteceu.';
