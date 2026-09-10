-- Uma configuração do bot por tenant (issue #20).
--
-- A UI faz upsert com on conflict (tenant_id); daily-digest e activity-reminders
-- já assumem uma linha por tenant. O índice só é criado se não houver
-- duplicata hoje — se houver, a migração avisa e deixa a limpeza manual.

do $$
begin
  if exists (
    select 1 from public.whatsapp_configs group by tenant_id having count(*) > 1
  ) then
    raise warning 'whatsapp_configs tem mais de uma linha para o mesmo tenant; remova as duplicatas e rode esta migração de novo.';
    return;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'whatsapp_configs_tenant_id_key'
  ) then
    alter table public.whatsapp_configs add constraint whatsapp_configs_tenant_id_key unique (tenant_id);
  end if;
end $$;
