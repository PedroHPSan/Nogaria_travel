-- Cotação diária USD/BRL (PTAX do Banco Central) — issue #32.
--
-- Até aqui o app usava DEFAULT_RATE = 5.62 hardcoded (com uma busca ao vivo
-- na AwesomeAPI pelo navegador). A fonte oficial passa a ser a PTAX de venda,
-- buscada server-side pela edge function `exchange-rate-sync` (o Olinda do
-- BCB não é acessível de todo navegador) e gravada aqui. O cliente lê a
-- última linha; a busca ao vivo vira fallback.
--
-- Não é tenant-scoped de propósito: é dado público, igual para todo mundo.
-- Só service_role escreve (não há policy de insert/update para authenticated).

create table if not exists public.exchange_rates (
  pair varchar(7) not null default 'USD-BRL',
  date date not null,
  rate numeric(12, 6) not null check (rate > 0),
  source varchar(40) not null default 'bcb_ptax_venda',
  fetched_at timestamptz not null default now(),
  primary key (pair, date)
);

comment on table public.exchange_rates is
  'Cotação de fechamento por dia útil (PTAX venda). Despesas congelam a taxa do dia em expenses.exchange_rate; esta tabela é a referência para o câmbio "de hoje" da UI.';

alter table public.exchange_rates enable row level security;

drop policy if exists exchange_rates_select on public.exchange_rates;
create policy exchange_rates_select on public.exchange_rates for select
  to authenticated using (true);

-- Agenda a sincronização via pg_cron + pg_net (mesmos segredos do Vault que
-- daily-digest/activity-reminders: project_url e cron_secret).
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
    raise warning 'exchange-rate-sync não agendado: crie os segredos vault "project_url" e "cron_secret" e rode esta migração novamente.';
    return;
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'exchange-rate-sync';

  -- A PTAX de fechamento sai ~13h30 (Brasília) em dia útil. 17:15 e 21:15 UTC
  -- = 14:15 e 18:15 em Brasília: a primeira pega o fechamento, a segunda é a
  -- rede de segurança para atraso do BCB. A function é idempotente (upsert).
  perform cron.schedule(
    'exchange-rate-sync',
    '15 17,21 * * 1-5',
    format(
      $job$select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      ) as request_id;$job$,
      v_project_url || '/functions/v1/exchange-rate-sync',
      v_cron_secret
    )
  );
end $$;
