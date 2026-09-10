-- LGPD (issue #36): consentimento do responsável para dados de menores,
-- aceite de termos, exclusão completa por tenant e retenção de mensagens.

-- ---------------------------------------------------------------------------
-- 1. Consentimento específico para dados de menores (LGPD art. 14 §1º).
--    Quem consentiu (profile) e quando; a versão da política vigente na hora.
-- ---------------------------------------------------------------------------
alter table public.participants
  add column if not exists guardian_consent_at timestamptz,
  add column if not exists guardian_consent_by uuid references public.profiles (id) on delete set null,
  add column if not exists guardian_consent_version varchar(20);

comment on column public.participants.guardian_consent_at is
  'Momento em que um responsável consentiu com o tratamento dos dados deste menor (data de nascimento, altura, telefone). null para adultos ou cadastros antigos.';

-- ---------------------------------------------------------------------------
-- 2. Aceite dos termos de uso / política de privacidade pelo usuário.
--    Gate na AuthGate: sem aceite não se entra no app (cobre OAuth e magic link,
--    que não passam pelo formulário de cadastro).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version varchar(20);

-- ---------------------------------------------------------------------------
-- 3. Direito de exclusão: apagar o tenant remove tudo. Todas as tabelas de
--    dados referenciam tenants ou trips com ON DELETE CASCADE (inclusive
--    whatsapp_messages, ai_usage_logs, activity_reminders, pending_writes,
--    audit_finding_resolutions), então um DELETE em tenants basta.
--    SECURITY DEFINER porque a policy tenants_delete existe, mas a cascata em
--    tabelas filhas passaria pela RLS de cada uma; como definer (postgres,
--    que ignora RLS sem FORCE) a exclusão é atômica e completa.
--    A conta (auth.users/profiles) do usuário NÃO é apagada: ele pode ter
--    outros tenants. Não há objetos no bucket trip-documents a limpar — o
--    app guarda só URLs em documents.file_url.
-- ---------------------------------------------------------------------------
create or replace function public.delete_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_tenant_admin(p_tenant_id) then
    raise exception 'Apenas administradores podem excluir a organização.' using errcode = '42501';
  end if;

  delete from public.tenants where id = p_tenant_id;
end;
$$;

revoke execute on function public.delete_tenant(uuid) from public, anon;
grant execute on function public.delete_tenant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Retenção: mensagens do bot expiram N dias depois do fim da última viagem
--    do tenant. Enquanto houver viagem em andamento ou recente, nada é apagado
--    (o histórico é a memória do bot). ai_usage_logs fica (é a base de
--    custo/billing), mas user_name — o telefone — é anonimizado no mesmo prazo.
-- ---------------------------------------------------------------------------
alter table public.whatsapp_configs
  add column if not exists message_retention_days integer not null default 90
    check (message_retention_days between 7 and 730);

comment on column public.whatsapp_configs.message_retention_days is
  'Dias após o fim da última viagem do tenant para apagar whatsapp_messages e anonimizar ai_usage_logs.user_name.';

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
end;
$$;

revoke execute on function public.purge_expired_whatsapp_data() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'whatsapp-data-retention';
  -- 04:10 UTC = 01:10 em Brasília, fora do horário de uso do bot.
  perform cron.schedule('whatsapp-data-retention', '10 4 * * *', 'select public.purge_expired_whatsapp_data();');
end $$;
