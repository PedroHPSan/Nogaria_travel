-- Franquia mensal de mensagens do bot por tenant + visão de custo (issue #27).
--
-- A franquia deriva do plano do tenant (tenants.plan) e pode ser sobrescrita
-- por tenant em whatsapp_configs.monthly_message_quota (null = usa o plano).
-- O corte é feito na edge function whatsapp-webhook (corte suave: avisa, não
-- silencia). Aqui ficam só a fonte da regra e a agregação de custo.

alter table public.whatsapp_configs
  add column if not exists monthly_message_quota integer
    check (monthly_message_quota is null or monthly_message_quota >= 0);

comment on column public.whatsapp_configs.monthly_message_quota is
  'Teto de mensagens recebidas (inbound, kind=chat) por mês. null = franquia do plano (plan_message_quota). 0 = bot bloqueado.';

-- Franquia por plano. null = ilimitado. Ajustar aqui é ajustar a tabela de preços.
create or replace function public.plan_message_quota(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'free' then 50
    when 'family' then 300
    when 'pro' then 1500
    else null
  end;
$$;

-- Franquia efetiva do tenant: override da config, senão a do plano.
create or replace function public.tenant_message_quota(p_tenant_id uuid)
returns integer
language sql
stable
security invoker
as $$
  select coalesce(
    (select c.monthly_message_quota from public.whatsapp_configs c where c.tenant_id = p_tenant_id limit 1),
    (select public.plan_message_quota(t.plan) from public.tenants t where t.id = p_tenant_id)
  );
$$;

-- Custo real por tenant/mês. security_invoker faz a view respeitar a RLS das
-- tabelas base: cada membro só vê o próprio tenant; o service_role vê tudo.
create or replace view public.tenant_monthly_ai_costs
with (security_invoker = true) as
with ai as (
  select
    tenant_id,
    date_trunc('month', "timestamp")::date as month,
    count(*) as ai_calls,
    sum(tokens_input) as tokens_input,
    sum(tokens_output) as tokens_output,
    sum(estimated_cost_usd) as estimated_cost_usd,
    round(avg(latency_ms))::integer as avg_latency_ms,
    round(avg(tool_rounds), 2) as avg_tool_rounds,
    count(*) filter (where function_name = 'whatsapp_bot') as whatsapp_bot_calls,
    count(*) filter (where function_name = 'copilot_web') as copilot_calls
  from public.ai_usage_logs
  group by tenant_id, date_trunc('month', "timestamp")
),
wa as (
  select
    tenant_id,
    date_trunc('month', created_at)::date as month,
    count(*) filter (where direction = 'inbound' and kind = 'chat') as inbound_chat_messages,
    count(*) filter (where direction = 'outbound') as outbound_messages
  from public.whatsapp_messages
  group by tenant_id, date_trunc('month', created_at)
)
select
  coalesce(ai.tenant_id, wa.tenant_id) as tenant_id,
  coalesce(ai.month, wa.month) as month,
  coalesce(ai.ai_calls, 0) as ai_calls,
  coalesce(ai.whatsapp_bot_calls, 0) as whatsapp_bot_calls,
  coalesce(ai.copilot_calls, 0) as copilot_calls,
  coalesce(ai.tokens_input, 0) as tokens_input,
  coalesce(ai.tokens_output, 0) as tokens_output,
  coalesce(ai.estimated_cost_usd, 0) as estimated_cost_usd,
  ai.avg_latency_ms,
  ai.avg_tool_rounds,
  coalesce(wa.inbound_chat_messages, 0) as inbound_chat_messages,
  coalesce(wa.outbound_messages, 0) as outbound_messages,
  public.tenant_message_quota(coalesce(ai.tenant_id, wa.tenant_id)) as monthly_message_quota
from ai
full outer join wa on wa.tenant_id = ai.tenant_id and wa.month = ai.month;

comment on view public.tenant_monthly_ai_costs is
  'Custo e volume de IA/WhatsApp por tenant e mês. Ex.: select * from tenant_monthly_ai_costs where month = date_trunc(''month'', now())::date;';

-- Índice para a contagem mensal do webhook (tenant, direção/kind, created_at).
create index if not exists whatsapp_messages_tenant_inbound_month_idx
  on public.whatsapp_messages (tenant_id, created_at desc)
  where direction = 'inbound' and kind = 'chat';
