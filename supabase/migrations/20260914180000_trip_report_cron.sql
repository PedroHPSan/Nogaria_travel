-- Disparo único do trip-report (relatório detalhado do roteiro reprogramado
-- de 14 a 16/09, com as mudanças de hotel/horário desta sessão) hoje às 20:00
-- America/New_York (23:00 UTC), a tempo do checkout cedo de amanhã.
-- Mesmos segredos Vault já usados pelo daily-digest (project_url, cron_secret);
-- se ainda não existirem, o job não é criado e um WARNING é emitido.

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
    raise warning 'trip-report não agendado: crie os segredos vault "project_url" e "cron_secret" e rode esta migração novamente.';
    return;
  end if;

  -- Cron de data fixa (23:00 UTC do dia 13/09/2026) — desagenda a si mesmo
  -- depois de disparar, já que é um envio único, não recorrente.
  perform cron.schedule(
    'whatsapp-trip-report-2026-09-14-a-16',
    '0 23 13 9 *',
    format(
      $job$select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      ) as request_id;
      select cron.unschedule('whatsapp-trip-report-2026-09-14-a-16');$job$,
      v_project_url || '/functions/v1/trip-report?start=2026-09-14&end=2026-09-16',
      v_cron_secret
    )
  );
end $$;
