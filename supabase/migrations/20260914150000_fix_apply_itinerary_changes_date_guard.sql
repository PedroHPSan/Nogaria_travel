-- Bug real de produção: apply_itinerary_changes validava a data de TODO item
-- do lote contra o período da viagem, mesmo quando aquele item não estava
-- mudando de data (ex.: um resequenciamento em lote que só recalcula
-- base_order). A viagem "NOGARIA USA 2026" tem itens do dia de embarque
-- (2026-09-03) com data anterior ao start_date (2026-09-05) — dado
-- pré-existente, não corrigido aqui — então qualquer lote que incluísse esses
-- itens (mesmo sem tocar na data deles) derrubava a transação inteira com
-- "Data fora do período da viagem", e o ReplanBoard reportava falha ao
-- aplicar 84 mudanças legítimas por causa de 2 itens que nem estavam mudando
-- de data.
--
-- Fix: só bloqueia quando a NOVA data diverge da data atual do item E cai
-- fora do período — mover um item de fato para fora do período da viagem
-- continua proibido; deixar um item onde já estava (ainda que fora do
-- período) não é.
create or replace function public.apply_itinerary_changes(p_trip_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
  v_trip_start date;
  v_trip_end date;
  v_ids uuid[];
  v_before jsonb;
  v_applied jsonb;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'p_changes deve ser um array jsonb';
  end if;

  if jsonb_array_length(p_changes) = 0 then
    raise exception 'Nenhuma mudança informada';
  end if;

  if jsonb_array_length(p_changes) > 200 then
    raise exception 'Lote grande demais (% itens, máximo 200)', jsonb_array_length(p_changes);
  end if;

  select start_date, end_date into v_trip_start, v_trip_end
  from public.trips where id = p_trip_id;

  if v_trip_start is null then
    raise exception 'Viagem % não encontrada', p_trip_id;
  end if;

  create temporary table _replan_changes on commit drop as
  select
    (c ->> 'item_id')::uuid as item_id,
    (c ->> 'date')::date as new_date,
    (c ->> 'time_start')::time as new_time_start,
    nullif(c ->> 'time_end', '')::time as new_time_end,
    nullif(c ->> 'base_order', '')::integer as new_base_order
  from jsonb_array_elements(p_changes) as c;

  if exists (select 1 from _replan_changes where item_id is null or new_date is null or new_time_start is null) then
    raise exception 'Cada mudança precisa de item_id, date e time_start válidos';
  end if;

  select array_agg(item_id) into v_ids from _replan_changes;

  -- Trava as linhas e confere que TODAS pertencem a esta viagem, antes de
  -- escrever qualquer coisa — impede o bot (service role, sem RLS) de gravar
  -- em outra viagem por um id vazado no payload.
  select count(*) into v_count
  from public.itinerary_items
  where id = any(v_ids) and trip_id = p_trip_id
  for update;

  if v_count <> array_length(v_ids, 1) then
    raise exception 'Um ou mais itens não pertencem a esta viagem (esperado %, encontrado %)', array_length(v_ids, 1), v_count;
  end if;

  -- Só bloqueia quem está de fato MUDANDO para uma data fora do período —
  -- um item que já estava fora (dado pré-existente) e não muda de data não
  -- deve derrubar o lote inteiro.
  if exists (
    select 1
    from _replan_changes c
    join public.itinerary_items i on i.id = c.item_id
    where c.new_date <> i.date and (c.new_date < v_trip_start or c.new_date > v_trip_end)
  ) then
    raise exception 'Data fora do período da viagem (% a %)', v_trip_start, v_trip_end;
  end if;

  select jsonb_agg(jsonb_build_object(
    'item_id', id, 'title', title, 'date', date, 'time_start', time_start, 'time_end', time_end, 'base_order', base_order
  ))
  into v_before
  from public.itinerary_items
  where id = any(v_ids);

  update public.itinerary_items i
  set date = c.new_date,
      time_start = c.new_time_start,
      time_end = coalesce(c.new_time_end, i.time_end),
      base_order = coalesce(c.new_base_order, i.base_order)
  from _replan_changes c
  where i.id = c.item_id and i.trip_id = p_trip_id;

  delete from public.activity_reminders
  where itinerary_item_id = any(v_ids) and kind = 'lead';

  delete from public.itinerary_item_outcomes
  where itinerary_item_id = any(v_ids);

  select jsonb_agg(jsonb_build_object(
    'item_id', id, 'title', title, 'date', date, 'time_start', time_start, 'time_end', time_end, 'base_order', base_order
  ))
  into v_applied
  from public.itinerary_items
  where id = any(v_ids);

  return jsonb_build_object('applied', v_applied, 'before', v_before, 'count', array_length(v_ids, 1));
end;
$$;

grant execute on function public.apply_itinerary_changes(uuid, jsonb) to authenticated, service_role;
