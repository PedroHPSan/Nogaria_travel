-- =========================================================================
-- Conferência do roteiro do EPCOT de 09/09/2026 e dos pré-requisitos dos avisos.
-- Somente leitura: nada aqui escreve no banco.
--
--   supabase db query --linked "$(cat supabase/seeds/verificar_epcot_2026-09-09.sql)"
--
-- As seis primeiras consultas conferem o roteiro; as três últimas conferem se
-- o bot tem condição de enviar alguma coisa — um roteiro perfeito não gera
-- aviso nenhum se o tenant estiver com `reminders_enabled = false`, se ninguém
-- tiver telefone, ou se o fuso do tenant não for o de Orlando.
-- =========================================================================

-- 1. O dia entrou? Esperado: 32 blocos, das 07:15 às 22:15.
select
  count(*)                                   as blocos,
  min(time_start)                            as primeiro,
  max(coalesce(time_end, time_start))        as ultimo,
  count(*) filter (where status = 'confirmed') as confirmados,
  count(*) filter (where status = 'optional')  as opcionais,
  count(*) filter (where lightning_lane <> 'none') as com_lightning_lane_deve_ser_zero
from public.itinerary_items
where date = date '2026-09-09' and park = 'EPCOT';

-- 2. Os avisos e a hora em que cada um dispara. Esperado: 9 linhas.
select
  base_order,
  time_start,
  title,
  reminder_minutes_before                                          as lead_min,
  (time_start - make_interval(mins => reminder_minutes_before))::time(0) as avisa_as
from public.itinerary_items
where date = date '2026-09-09' and park = 'EPCOT'
  and coalesce(reminder_minutes_before, -1) <> 0
order by base_order;

-- 3. Itens que caíram na cascata padrão sem querer. Esperado: nenhuma linha.
--    `null` aqui significa "usa o lead do tenant", o que transformaria um bloco
--    de passagem numa mensagem para cada participante.
select base_order, time_start, title
from public.itinerary_items
where date = date '2026-09-09' and park = 'EPCOT'
  and reminder_minutes_before is null
order by base_order;

-- 4. Sobreposição de horários. Esperado: nenhuma linha.
select base_order, title, time_start, prev_title, prev_end
from (
  select base_order, title, time_start,
         lag(title)    over (order by base_order) as prev_title,
         lag(time_end) over (order by base_order) as prev_end
  from public.itinerary_items
  where date = date '2026-09-09' and park = 'EPCOT'
) x
where prev_end is not null and time_start < prev_end;

-- 5. Altura mínima e Rider Switch. Esperado: 4 linhas (102/107/102/102).
select title, min_height_cm, child_switch
from public.itinerary_items
where date = date '2026-09-09' and park = 'EPCOT' and min_height_cm is not null
order by base_order;

-- 6. Sobras do EPCOT em 08/09 ainda como 'planned' — se vier > 0, elas ficam
--    penduradas na Cronologia e contam na cobertura (ver bloco opcional no
--    fim do roteiro_epcot_2026-09-09.sql).
select count(*) as itens_epcot_0809_ainda_planned
from public.itinerary_items
where date = date '2026-09-08' and park = 'EPCOT' and status = 'planned';

-- 7. O bot está ligado, e no fuso certo? `timezone` precisa ser o de Orlando:
--    o default da tabela é 'America/Sao_Paulo', que adianta todo aviso em 1h.
select tenant_id, enabled, reminders_enabled, timezone,
       reminder_lead_minutes, quiet_hours_start, quiet_hours_end, digest_time
from public.whatsapp_configs;

-- 8. Quem realmente recebe. Sem telefone, não há para onde mandar.
select count(*) filter (where whatsapp_phone is not null) as com_telefone,
       count(*)                                            as participantes
from public.participants p
where p.trip_id in (select trip_id from public.itinerary_items
                    where date = date '2026-09-09' and park = 'EPCOT');

-- 9. O que já foi enviado hoje (ledger). Cada linha é um aviso entregue.
select ai.time_start, ai.title, ar.lead_minutes, count(*) as destinatarios,
       max(ar.sent_at) as ultimo_envio
from public.activity_reminders ar
join public.itinerary_items ai on ai.id = ar.itinerary_item_id
where ai.date = date '2026-09-09'
group by ai.time_start, ai.title, ar.lead_minutes
order by ai.time_start;
