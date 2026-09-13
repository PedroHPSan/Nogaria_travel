-- Cache de condições externas (themeparks.wiki + Open-Meteo) usadas para
-- embasar decisões de replanejamento — clima, horário de funcionamento do
-- parque e status por atração (REFURBISHMENT/CLOSED/DOWN). Tratado sempre
-- como dica, nunca verdade: nada aqui sobrescreve dado declarado pela família
-- em itinerary_items.

create table if not exists public.external_conditions (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('themeparks', 'open_meteo')),
  scope text not null check (scope in ('park_schedule', 'park_live', 'weather_daily')),
  -- Chave determinística montada em _shared/parkStatus.ts / weather.ts, ex.:
  --   themeparks:park_schedule:<entityId>:<AAAA-MM>
  --   themeparks:park_live:<entityId>
  --   open_meteo:weather_daily:<lat>,<lng>:<AAAA-MM-DD>
  cache_key text not null unique,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists external_conditions_expires_idx
  on public.external_conditions (expires_at);

comment on table public.external_conditions is
  'Cache de dado público de terceiro (horário de parque, status de atração, previsão do tempo) — deliberadamente SEM tenant_id: o conteúdo é idêntico para qualquer tenant, escopar só multiplicaria chamadas externas sem ganho de privacidade.';

-- Única tabela do schema sem isolamento por tenant, por design (ver comment
-- acima). Leitura liberada a qualquer usuário autenticado (o app lê direto
-- para pintar o badge de condições no board sem round-trip por edge function);
-- escrita só pelas edge functions com service role.
alter table public.external_conditions enable row level security;

drop policy if exists external_conditions_read on public.external_conditions;
create policy external_conditions_read on public.external_conditions
  for select to authenticated using (true);

grant select on public.external_conditions to authenticated;
grant select, insert, update, delete on public.external_conditions to service_role;

-- Limpeza de linhas expiradas há mais de 7 dias, pendurada na rotina diária de
-- retenção LGPD já existente (20260909140000_lgpd_consent_retention.sql) —
-- não justifica um cron dedicado. Corpo idêntico ao original, só com a
-- exclusão de external_conditions acrescentada ao final.
create or replace function public.purge_expired_whatsapp_data()
returns table (tenant_id uuid, messages_deleted bigint, logs_anonymized bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_deleted bigint;
  v_anon bigint;
begin
  for r in
    select c.tenant_id, c.message_retention_days,
           (select max(t.end_date) from public.trips t where t.tenant_id = c.tenant_id) as last_trip_end
    from public.whatsapp_configs c
  loop
    -- Sem viagem cadastrada, a referência é a própria idade da mensagem.
    if r.last_trip_end is not null and r.last_trip_end + r.message_retention_days >= current_date then
      continue;
    end if;

    delete from public.whatsapp_messages m
      where m.tenant_id = r.tenant_id
        and m.created_at < now() - make_interval(days => r.message_retention_days);
    get diagnostics v_deleted = row_count;

    update public.ai_usage_logs l
      set user_name = 'anonimizado'
      where l.tenant_id = r.tenant_id
        and l.function_name = 'whatsapp_bot'
        and l.user_name <> 'anonimizado'
        and l."timestamp" < now() - make_interval(days => r.message_retention_days);
    get diagnostics v_anon = row_count;

    tenant_id := r.tenant_id;
    messages_deleted := v_deleted;
    logs_anonymized := v_anon;
    return next;
  end loop;

  delete from public.external_conditions
  where expires_at < now() - interval '7 days';
end;
$$;

revoke execute on function public.purge_expired_whatsapp_data() from public, anon, authenticated;
