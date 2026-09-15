-- Move o disparo periódico das edge functions do bot WhatsApp do pg_cron
-- (Supabase Vault + pg_net) para o Vercel Cron (api/cron/*.ts, vercel.json).
--
-- Motivo: a conta do GitHub está em billing hold, o que bloqueia o job
-- manual `whatsapp` de .github/workflows/supabase.yml e, com ele, o único
-- disparo de fora do Supabase que a família tinha. O pg_cron continuaria
-- funcionando (roda dentro do Postgres, não depende do GitHub), mas o
-- disparo único do trip-report (migration anterior, 20260914180000) tinha um
-- bug real: agendado para '0 23 13 9 *' — dia 13 de setembro, que já tinha
-- passado quando a migration rodou (a família só saiu do parque e pediu o
-- relatório no dia 14 à noite). Um cron de data fixa que já passou não
-- dispara de novo até o mesmo dia/mês do ANO SEGUINTE. Em vez de corrigir a
-- data e repetir o mesmo padrão frágil, o disparo único do trip-report virou
-- uma routine avulsa do Claude Code (fora do banco, sem essa classe de bug
-- de novo) e os jobs RECORRENTES (daily-digest, activity-reminders,
-- activity-checkins) migram para o Vercel Cron, que também serve de
-- superfície única e observável (Vercel → Project → Cron Jobs) em vez de
-- pg_cron.job + Vault espalhados pelo Postgres.
--
-- Rodar os dois lados ao mesmo tempo duplica toda mensagem da família — por
-- isso este arquivo desagenda no pg_cron antes/junto do deploy do Vercel
-- Cron, não depois.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'whatsapp-daily-digest') then
    perform cron.unschedule('whatsapp-daily-digest');
  end if;

  if exists (select 1 from cron.job where jobname = 'whatsapp-activity-reminders') then
    perform cron.unschedule('whatsapp-activity-reminders');
  end if;

  if exists (select 1 from cron.job where jobname = 'whatsapp-activity-checkins') then
    perform cron.unschedule('whatsapp-activity-checkins');
  end if;

  -- Nunca chegou a disparar (data já passada), mas desagenda mesmo assim —
  -- senão fica pendurado até 13/09/2027.
  if exists (select 1 from cron.job where jobname = 'whatsapp-trip-report-2026-09-14-a-16') then
    perform cron.unschedule('whatsapp-trip-report-2026-09-14-a-16');
  end if;
end $$;

-- exchange-rate-sync fica no pg_cron: não é do bot WhatsApp, e o
-- 20260909120000_exchange_rates.sql que a agenda continua correto.
