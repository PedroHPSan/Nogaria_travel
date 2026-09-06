-- Resumo da noite (prévia do dia seguinte), complementar ao digest da manhã
-- (resumo do dia atual). A function daily-digest passa a checar os dois
-- horários a cada execução horária do cron existente — nenhum cron novo.
alter table public.whatsapp_configs
  add column if not exists evening_digest_time time not null default '22:00';

comment on column public.whatsapp_configs.digest_time is
  'Horário local (whatsapp_configs.timezone) do resumo do dia ATUAL, de manhã.';
comment on column public.whatsapp_configs.evening_digest_time is
  'Horário local (whatsapp_configs.timezone) da prévia do dia SEGUINTE, à noite.';

-- Horários pedidos: manhã 06:00 (resumo de hoje), noite 22:00 (prévia de amanhã).
update public.whatsapp_configs set digest_time = '06:00';
