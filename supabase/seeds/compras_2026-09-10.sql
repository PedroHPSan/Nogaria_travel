-- =========================================================================
-- 10/09/2026 não aconteceu como planejado: os 19 itens de Hollywood Studios
-- no banco (Slinky Dog 07:40 → Fantasmic! 21:10) são ficção — a família
-- trocou o dia por compras (Best Buy, Apple Store, TJ Maxx). É por isso que
-- os 16 check-ins do bot sobre esse dia ficaram sem resposta: ele perguntava
-- "isso rolou?" sobre atrações em que ninguém pôs o pé.
--
-- Este seed:
--   1. marca os itens antigos de 10/09 como `cancelled` (terminal, mas fica
--      no histórico — mesma semântica de `cancel_itinerary_item` em
--      supabase/functions/_shared/tripTools.ts);
--   2. resolve as linhas `pending` de itinerary_item_outcomes desses itens,
--      para o check-in parar de perguntar sobre eles;
--   3. insere o dia real de compras (4 blocos, `status='completed'`,
--      `reminder_minutes_before=0` — o dia já passou, não faz sentido
--      avisar — e `counts_toward_completion=false`, já que não é roteiro
--      de parque).
--
-- Horários são aproximados (ninguém registrou o horário real na hora).
--
-- Como aplicar:
--   supabase db query --linked "$(cat supabase/seeds/compras_2026-09-10.sql)"
--
-- É idempotente: os passos 1–2 só tocam linhas que ainda não estão no estado
-- final, e o passo 3 apaga os blocos de compras já inseridos antes de
-- reinserir (identificados por category='shopping' e date=2026-09-10).
-- =========================================================================

do $$
declare
  v_trip         uuid;
  v_participants uuid[];
  v_cancelados   integer;
  v_resolvidos   integer;
  v_apagados     integer;
  v_inseridos    integer;
begin
  -- 1. Viagem: preferir o id da semente; senão, a viagem que cobre a data.
  select t.id into v_trip
    from public.trips t
   where t.id = '9a8b7c6d-5e4f-4321-8765-4321fedcba09'::uuid;

  if v_trip is null then
    select t.id into v_trip
      from public.trips t
     where t.start_date <= date '2026-09-10'
       and t.end_date   >= date '2026-09-10'
     order by t.created_at
     limit 1;
  end if;

  if v_trip is null then
    raise exception 'Nenhuma viagem cobre 2026-09-10. Confirme o trip_id antes de rodar.';
  end if;

  select coalesce(array_agg(p.id order by p.id), '{}'::uuid[])
    into v_participants
    from public.participants p
   where p.trip_id = v_trip;

  if cardinality(v_participants) = 0 then
    raise exception 'Viagem % não tem participantes cadastrados.', v_trip;
  end if;

  -- 2. Cancela o roteiro de Hollywood Studios que não aconteceu.
  update public.itinerary_items
     set status = 'cancelled',
         notes  = coalesce(notes || ' ', '') || '[Dia trocado por compras (Best Buy, Apple Store, TJ Maxx) — não aconteceu.]'
   where trip_id = v_trip
     and date = date '2026-09-10'
     and category <> 'shopping'
     and status <> 'cancelled';
  get diagnostics v_cancelados = row_count;

  -- 3. Resolve os check-ins pendentes desses itens — param de perguntar.
  update public.itinerary_item_outcomes o
     set status = 'cancelled',
         note = 'Dia trocado por compras — família não foi ao parque.',
         resolved_at = now()
    from public.itinerary_items i
   where o.itinerary_item_id = i.id
     and i.trip_id = v_trip
     and i.date = date '2026-09-10'
     and i.category <> 'shopping'
     and o.status = 'pending';
  get diagnostics v_resolvidos = row_count;

  -- 4. Idempotência do dia de compras: remove qualquer inserção anterior.
  delete from public.itinerary_items
   where trip_id = v_trip
     and date = date '2026-09-10'
     and category = 'shopping';
  get diagnostics v_apagados = row_count;

  -- 5. O dia real.
  insert into public.itinerary_items (
    trip_id, participant_ids, participant_status, currency,
    date, time_start, time_end, city, title, category, description, location, status, child_friendly, notes, base_order, counts_toward_completion, time_is_estimated, reminder_minutes_before
  )
  select
      v_trip,
      v_participants,
      '{}'::jsonb,
      'USD',
      v.date::date,
      v.time_start::time,
      v.time_end::time,
      v.city::text,
      v.title::text,
      v.category::text,
      v.description::text,
      v.location::text,
      v.status::text,
      v.child_friendly::boolean,
      v.notes::text,
      v.base_order::int,
      v.counts_toward_completion::boolean,
      v.time_is_estimated::boolean,
      v.reminder_minutes_before::int
  from (values
    ('2026-09-10', '11:00', '12:30', 'Lake Buena Vista', 'Best Buy', 'shopping', 'Troca de plano — dia de parque virou compras.', 'Best Buy', 'completed', true, 'Horário aproximado — ninguém registrou na hora.', 1, false, true, 0),
    ('2026-09-10', '12:30', '14:00', 'Lake Buena Vista', 'Apple Store', 'shopping', null, 'Apple Store', 'completed', true, 'Ver task "Agendar Pickup de iPhone e MacBook" — se a compra saiu aqui, a task pode fechar.', 2, false, true, 0),
    ('2026-09-10', '14:00', '15:30', 'Lake Buena Vista', 'TJ Maxx', 'shopping', null, 'TJ Maxx', 'completed', true, 'Horário aproximado.', 3, false, true, 0),
    ('2026-09-10', '15:30', '16:30', 'Kissimmee', 'Retorno ao hotel', 'transit', null, 'Celebration Suites', 'completed', true, null, 4, false, true, 0)
  ) as v(date, time_start, time_end, city, title, category, description, location, status, child_friendly, notes, base_order, counts_toward_completion, time_is_estimated, reminder_minutes_before);
  get diagnostics v_inseridos = row_count;

  raise notice '10/09/2026: % item(ns) de Hollywood Studios cancelado(s), % check-in(s) resolvido(s), % bloco(s) de compras removido(s) e % inserido(s) na viagem %.',
    v_cancelados, v_resolvidos, v_apagados, v_inseridos, v_trip;
end $$;
