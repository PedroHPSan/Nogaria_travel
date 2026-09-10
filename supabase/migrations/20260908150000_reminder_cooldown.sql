-- Avisos de atividade em excesso: um roteiro no estilo "touring plan" (ride a
-- ride, ~15-25 min de intervalo entre itens) faz `reminder_lead_minutes` (60
-- por padrão) entrar na janela de vários itens ao mesmo tempo/em sequência
-- rápida — dezenas de avisos por dia, por participante. `reminder_cooldown_minutes`
-- é o intervalo mínimo entre dois avisos "normais" consecutivos da mesma
-- viagem: `activity-reminders/index.ts` passa pra `selectDueReminders` quanto
-- tempo faz desde o último aviso enviado, e a função só deixa passar um novo
-- aviso comum se esse intervalo já estourou. Um override explícito do item
-- (`reminder_minutes_before`) ou a atividade estar a ≤10min do início sempre
-- furam o cooldown — a família não pode nunca perder o aviso de algo que já
-- está prestes a começar.
alter table public.whatsapp_configs
  add column if not exists reminder_cooldown_minutes integer not null default 40;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'whatsapp_configs_reminder_cooldown_check'
  ) then
    alter table public.whatsapp_configs
      add constraint whatsapp_configs_reminder_cooldown_check
      check (reminder_cooldown_minutes between 0 and 240);
  end if;
end $$;

comment on column public.whatsapp_configs.reminder_cooldown_minutes is
  'Intervalo mínimo (min) entre dois avisos de atividade "normais" seguidos da mesma viagem. 0 desliga o cooldown. Override por item e avisos a <=10min do início sempre furam.';
