-- Agenda o daily-digest (lista diária de atividades + lembretes) via pg_cron + pg_net.
-- Depende de dois segredos no Supabase Vault (criar uma vez, pelo SQL Editor):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<mesmo-valor-da-secret-CRON_SECRET-da-function>', 'cron_secret');
-- Se os segredos não existirem, o job não é criado e um WARNING é emitido.

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
    raise warning 'daily-digest não agendado: crie os segredos vault "project_url" e "cron_secret" e rode esta migração novamente.';
    return;
  end if;

  -- A function filtra por digest_time/timezone de cada tenant, então o cron
  -- roda 1x/hora e cada tenant recebe o digest na sua hora local configurada.
  perform cron.schedule(
    'whatsapp-daily-digest',
    '7 * * * *',
    format(
      $job$select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      ) as request_id;$job$,
      v_project_url || '/functions/v1/daily-digest',
      v_cron_secret
    )
  );
end $$;
