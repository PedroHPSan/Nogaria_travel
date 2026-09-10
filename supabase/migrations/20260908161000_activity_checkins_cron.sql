-- Agenda o check-in em lote de itens vencidos do roteiro via pg_cron + pg_net.
-- Mesmos segredos do daily-digest/activity-reminders no Supabase Vault.

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
    raise warning 'activity-checkins não agendado: crie os segredos vault "project_url" e "cron_secret" e rode esta migração novamente.';
    return;
  end if;

  -- A cada 15 min, deslocado do digest (minuto 7) e dos avisos de horário
  -- (2,9,16,23,30,37,44,51,58). O cooldown de itinerary_item_outcomes é quem
  -- controla o espaçamento real entre mensagens — este cron só define a
  -- resolução mínima de detecção.
  perform cron.schedule(
    'whatsapp-activity-checkins',
    '5,20,35,50 * * * *',
    format(
      $job$select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      ) as request_id;$job$,
      v_project_url || '/functions/v1/activity-checkins',
      v_cron_secret
    )
  );
end $$;
