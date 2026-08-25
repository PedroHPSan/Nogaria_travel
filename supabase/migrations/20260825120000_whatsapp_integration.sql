-- WhatsApp integration (bot NLP via Meta Cloud API + Gemini).
-- whatsapp_configs / whatsapp_messages are tenant-scoped, following the same
-- RLS pattern as ai_provider_configs / ai_usage_logs.

-- Phone used to identify the participant when they message the bot privately.
alter table public.participants
  add column if not exists whatsapp_phone varchar(20);

create table public.whatsapp_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider varchar(20) not null default 'meta' check (provider in ('meta')),
  -- Meta Cloud API phone number id that identifies which WABA number received the message.
  phone_number_id varchar(50) not null,
  digest_time time not null default '07:00',
  timezone varchar(64) not null default 'America/Sao_Paulo',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (phone_number_id)
);

create index whatsapp_configs_tenant_id_idx on public.whatsapp_configs (tenant_id);

-- Inbound/outbound message log. wa_message_id doubles as the webhook
-- idempotency key: Meta retries webhook deliveries, so replays are dropped
-- on the unique constraint instead of being answered twice.
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  wa_message_id varchar(255),
  direction varchar(10) not null check (direction in ('inbound', 'outbound')),
  sender_phone varchar(20),
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (wa_message_id)
);

create index whatsapp_messages_tenant_id_idx on public.whatsapp_messages (tenant_id);
create index whatsapp_messages_created_at_idx on public.whatsapp_messages (created_at);

alter table public.whatsapp_configs enable row level security;
alter table public.whatsapp_messages enable row level security;

create policy whatsapp_configs_all on public.whatsapp_configs for all
  to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

create policy whatsapp_messages_all on public.whatsapp_messages for all
  to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
