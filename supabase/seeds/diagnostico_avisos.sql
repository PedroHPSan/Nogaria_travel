-- =========================================================================
-- Por que o aviso de atividade não chegou?
-- Um único SELECT, resultado em 6 linhas. Somente leitura.
-- Cola inteiro no SQL Editor do Supabase.
--
-- A falha de envio e a ausência de cron produzem o MESMO silêncio do lado da
-- família (o código apaga a reserva e só loga), então a ordem das linhas vai
-- do "nunca foi agendado" até "foi agendado, rodou, e a Meta recusou".
-- =========================================================================
select n, verificacao, resultado from (

  -- 1. O pg_cron chegou a agendar o job? Se a migração rodou sem os segredos
  --    do Vault (project_url / cron_secret), ela só emitiu um WARNING.
  select 1 as n, '1. job no pg_cron' as verificacao,
    coalesce((
      select string_agg(jobname || '  [' || schedule || ']  ativo=' || active, E'\n')
        from cron.job where jobname like 'whatsapp%'
    ), '>>> NENHUM JOB AGENDADO — segredos do Vault ausentes, veja a migração activity_reminders_cron') as resultado

  union all
  -- 2. Ele rodou hoje?
  select 2, '2. ultimas execucoes',
    coalesce((
      select string_agg(t.linha, E'\n') from (
        select to_char(d.start_time at time zone 'America/New_York', 'HH24:MI') || '  ' || d.status
                 || coalesce('  ' || nullif(d.return_message, ''), '') as linha
          from cron.job_run_details d
          join cron.job j on j.jobid = d.jobid
         where j.jobname = 'whatsapp-activity-reminders'
         order by d.start_time desc limit 4
      ) t
    ), '>>> NUNCA EXECUTOU')

  union all
  -- 3. O que a function respondeu. Esta é a linha que resolve o caso:
  --    "skipped:sem-telefones", "skipped:janela-de-silencio",
  --    "skipped:nada-na-janela", "sent:N", ou "failed:<telefone>".
  select 3, '3. resposta da function',
    coalesce((
      select string_agg(t.linha, E'\n') from (
        select to_char(r.created at time zone 'America/New_York', 'HH24:MI')
                 || '  HTTP ' || coalesce(r.status_code::text, '-') || '  '
                 || left(coalesce(r.content, r.error_msg, ''), 200) as linha
          from net._http_response r
         order by r.created desc limit 4
      ) t
    ), '>>> SEM RESPOSTAS (pg_net guarda ~6h; se vazio, o cron não disparou)')

  union all
  -- 4. O bot está ligado e no fuso certo?
  select 4, '4. config do bot',
    coalesce((
      select string_agg('enabled=' || enabled || '  reminders=' || reminders_enabled
                        || '  tz=' || timezone || '  silencio=' || quiet_hours_start
                        || '-' || quiet_hours_end || '  lead=' || reminder_lead_minutes, E'\n')
        from public.whatsapp_configs
    ), '>>> NENHUMA LINHA EM whatsapp_configs — o bot não está configurado')

  union all
  -- 5. Tem para quem mandar?
  select 5, '5. telefones',
    (select count(*) filter (where whatsapp_phone is not null) || ' de ' || count(*)
            || ' participantes com whatsapp_phone'
       from public.participants
      where trip_id in (select trip_id from public.itinerary_items
                         where date = date '2026-09-09' and park = 'EPCOT'))

  union all
  -- 6. Saiu alguma coisa hoje? `digest` prova que o token e a janela de 24h
  --    da Meta estão de pé; só `reminder` faltando aponta para o agendamento.
  select 6, '6. enviados hoje',
    coalesce((
      select string_agg(kind || ': ' || c, '   ') from (
        select kind, count(*) c from public.whatsapp_messages
         where direction = 'outbound'
           and created_at >= date '2026-09-09'
         group by kind
      ) x
    ), '>>> NADA ENVIADO HOJE')

) z order by n;
