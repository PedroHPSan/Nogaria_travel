-- Aplicação atômica de um lote de mudanças de horário/dia em itinerary_items.
-- É a peça central do replanejamento facilitado: tanto o bot (replan_day)
-- quanto a tela (ReplanBoard) produzem um _shared/replanEngine.ts::ReplanProposal
-- e serializam para o mesmo formato de p_changes aqui.
--
-- Por que uma RPC e não N updates via PostgREST:
--   1. Atomicidade: trocar dois dias são 2×N updates: metade aplicada no meio
--      da viagem é roteiro corrompido, e não existe transação client-side no
--      PostgREST.
--   2. src/data/useItineraryData.ts::updateItineraryItem envia a linha inteira
--      e depende de `itinerary` num useCallback — N chamadas no mesmo tick leem
--      o mesmo snapshot e a última sobrescreve as anteriores. Uma RPC evita a
--      classe de bug sem reescrever o hook.
--   3. Um lugar só para os efeitos colaterais (limpar avisos e pendências dos
--      itens tocados) hoje duplicados dentro do commit de reschedule_itinerary_item.
create or replace function public.apply_itinerary_changes(p_trip_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
-- security invoker (não definer): no app a RLS de itinerary_items continua
-- governando quem pode mexer no quê; no bot, o service role já bypassa RLS
-- como bypassa hoje. A autorização de negócio (can_manage_itinerary) é feita
-- em TS antes de chamar isto, porque o Postgres não sabe qual telefone mandou
-- a mensagem. `security definer` aqui seria um buraco: qualquer authenticated
-- conseguiria mexer em itinerário de outro tenant só passando ids.
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

  -- Expande o payload numa tabela temporária, validando formato antes de
  -- tocar em qualquer linha real.
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

  if exists (select 1 from _replan_changes where new_date < v_trip_start or new_date > v_trip_end) then
    raise exception 'Data fora do período da viagem (% a %)', v_trip_start, v_trip_end;
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

  -- Um horário novo invalida o aviso de "daqui a N minutos" já calculado para
  -- o antigo; a unique (item, participante, kind) bloquearia o próximo aviso
  -- se a linha velha não saísse (mesma lógica de reschedule_itinerary_item).
  delete from public.activity_reminders
  where itinerary_item_id = any(v_ids) and kind = 'lead';

  -- Reagendar um item que estava marcado como "não rolou"/pendente de
  -- check-in resolve a pendência — ela deixa de fazer sentido no novo horário.
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
