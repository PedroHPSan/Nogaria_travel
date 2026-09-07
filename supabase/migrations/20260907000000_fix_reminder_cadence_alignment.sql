-- Bug real observado em produção: TODO aviso de atividade saía com "Daqui a
-- 57 min!", não importa a atividade ou o dia — a família achou que estava
-- quebrado.
--
-- Causa: o cron batia em minutos fixos (3,13,23,...,53) e a antecedência
-- padrão (reminder_lead_minutes) é redonda (60). Itinerários normais marcam
-- atividades em horários redondos (múltiplos de 10 min: 17:20, 18:00, 19:30).
-- 10 (grade da atividade) e 10 (espaçamento do cron) compartilham o mesmo
-- fator — então "o primeiro tick depois de (horário - 60min)" cai SEMPRE 3
-- minutos depois do limiar, e minutesUntil = 60 - 3 = 57 em todo item, todo
-- dia. O comentário original ("sai entre 60 e 50 min antes") descrevia uma
-- variação que na prática nunca acontece para roteiros em horários redondos
-- — que é o caso comum, não a exceção.
--
-- Fix: espaçamento de 7 minutos em vez de 10. 7 e 10 são coprimos, então o
-- deslocamento entre o limiar (múltiplo de 10) e o tick seguinte passa a
-- rotacionar por 7 valores diferentes conforme o horário da atividade, em
-- vez de travar sempre no mesmo. Continua evitando o minuto 7 (digest).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'whatsapp-activity-reminders') then
    perform cron.unschedule('whatsapp-activity-reminders');
  end if;
end $$;

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
    raise warning 'activity-reminders não reagendado: segredos vault "project_url"/"cron_secret" ausentes — rode esta migração de novo depois de criá-los.';
    return;
  end if;

  perform cron.schedule(
    'whatsapp-activity-reminders',
    '2,9,16,23,30,37,44,51,58 * * * *',
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
