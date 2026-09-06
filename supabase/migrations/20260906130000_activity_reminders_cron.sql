-- Agenda os avisos de atividade por horário via pg_cron + pg_net.
-- Mesmos segredos do daily-digest, no Supabase Vault (criar uma vez):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<mesmo-valor-da-secret-CRON_SECRET-da-function>', 'cron_secret');
-- Sem eles, o job não é criado e um WARNING é emitido.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_project_url text;
  v_cron_secret text;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_cron_secret
    from vault.decrypted_secrets where name = 'cron_secret';

  if v_project_url is null or v_cron_secret is null then
    raise warning 'activity-reminders não agendado: crie os segredos vault "project_url" e "cron_secret" e rode esta migração novamente.';
    return;
  end if;

  -- A cada 10 min, deslocado dos minutos "redondos" para não concorrer com o
  -- daily-digest (minuto 7). A granularidade do cron é a *resolução* do aviso,
  -- não a sua precisão: a function compara o horário real do item com o relógio
  -- local do tenant, então um aviso de 60 min sai entre 60 e 50 min antes.
  perform cron.schedule(
    'whatsapp-activity-reminders',
    '3,13,23,33,43,53 * * * *',
    format(
      $job$select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      ) as request_id;$job$,
      v_project_url || '/functions/v1/activity-reminders',
      v_cron_secret
    )
  );
end $$;
