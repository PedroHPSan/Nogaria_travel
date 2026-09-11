-- =========================================================================
-- Roteiro operacional do Animal Kingdom — 11/09/2026 (sem Early Entry, sem
-- Lightning Lane)
--
-- Gerado a partir de src/services/roteiro/animalKingdomDia11.ts. Editar o TS
-- e regerar, não editar este arquivo à mão.
--
-- Como aplicar:
--   supabase db query --linked "$(cat supabase/seeds/roteiro_animal_kingdom_2026-09-11.sql)"
-- ou colar no SQL Editor do dashboard do projeto bkrqhividgljticgjrem.
--
-- É idempotente: ao contrário do seed do EPCOT (que filtra por `park =
-- 'EPCOT'` e por isso deixou itens legados sobrevivendo), este apaga TODO
-- item de itinerary_items da viagem em 2026-09-11 antes de inserir — o dia
-- inteiro é Animal Kingdom, então não há o que preservar. O delete em
-- itinerary_items arrasta itinerary_item_outcomes por `on delete cascade`
-- (20260908160000_itinerary_checkins.sql), então os check-ins pendentes dos
-- 18 itens antigos somem junto.
-- ATENÇÃO: roda antes de o dia começar — depois disso descarta os
-- `participant_status` do que já tiver sido marcado.
--
-- A viagem e os participantes são resolvidos por consulta, não hardcoded.
-- =========================================================================

do $$
declare
  v_trip         uuid;
  v_participants uuid[];
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
     where t.start_date <= date '2026-09-11'
       and t.end_date   >= date '2026-09-11'
     order by t.created_at
     limit 1;
  end if;

  if v_trip is null then
    raise exception 'Nenhuma viagem cobre 2026-09-11. Confirme o trip_id antes de rodar.';
  end if;

  -- 2. Participantes: todos os da viagem entram em todos os blocos do dia.
  select coalesce(array_agg(p.id order by p.id), '{}'::uuid[])
    into v_participants
    from public.participants p
   where p.trip_id = v_trip;

  if cardinality(v_participants) = 0 then
    raise exception 'Viagem % não tem participantes cadastrados.', v_trip;
  end if;

  -- 3. Idempotência: limpa o dia inteiro (sem filtro de `park` — 11/09 é só
  --    Animal Kingdom). Arrasta itinerary_item_outcomes via cascade.
  delete from public.itinerary_items
   where trip_id = v_trip
     and date = date '2026-09-11';
  get diagnostics v_apagados = row_count;

  -- 4. O dia.
  insert into public.itinerary_items (
    trip_id, participant_ids, participant_status, currency,
    date, time_start, time_end, city, title, category, description, location, status, min_height_cm, child_friendly, notes, park, area, base_order, item_type, priority_tier, lightning_lane, single_rider, child_switch, recommended_window, early_closure_risk, operational_status, counts_toward_completion, plan_b, time_is_estimated, show_block_start, show_block_end, recommended_arrival_min_before, last_showtime_of_day, reminder_minutes_before
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
      v.min_height_cm::int,
      v.child_friendly::boolean,
      v.notes::text,
      v.park::text,
      v.area::text,
      v.base_order::int,
      v.item_type::text,
      v.priority_tier::text,
      v.lightning_lane::text,
      v.single_rider::boolean,
      v.child_switch::boolean,
      v.recommended_window::text,
      v.early_closure_risk::boolean,
      v.operational_status::text,
      v.counts_toward_completion::boolean,
      v.plan_b::text,
      v.time_is_estimated::boolean,
      v.show_block_start::time,
      v.show_block_end::time,
      v.recommended_arrival_min_before::int,
      v.last_showtime_of_day::boolean,
      v.reminder_minutes_before::int
  from (values
    ('2026-09-11', '06:10', '06:25', 'Kissimmee', 'Acordar e preparação', 'rest', null, 'Celebration Suites', 'planned', null, true, 'Mochila: protetor solar, poncho, garrafas e carregador. Tênis fechado. Medir a Gabi antes de sair.', 'Disney''s Animal Kingdom', 'Hotel', 1, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 10),
    ('2026-09-11', '06:25', '06:45', 'Kissimmee', 'Café da manhã no apartamento', 'restaurant', null, 'Celebration Suites', 'planned', null, true, 'Café rápido — sem parada para café dentro do parque hoje.', 'Disney''s Animal Kingdom', 'Hotel', 2, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-11', '06:45', '07:15', 'Kissimmee → Lake Buena Vista', 'Saída do hotel rumo ao Animal Kingdom', 'transit', null, 'Celebration Suites → Disney''s Animal Kingdom', 'planned', null, true, 'Sem Early Entry: chegar cedo na fila é o único jeito de ganhar tempo na abertura.', 'Disney''s Animal Kingdom', 'Deslocamento', 3, null, null, 'none', false, false, null, false, 'operating', false, 'Trânsito pesado na I-4: sair até 6h50 no mais tardar para não perder o rope drop.', false, null, null, null, false, 15),
    ('2026-09-11', '07:15', '07:45', 'Lake Buena Vista', 'Estacionamento e segurança', 'transit', null, 'Animal Kingdom — Entrada Principal', 'planned', null, true, 'Fotografar a placa da vaga. Ingressos já abertos no My Disney Experience.', 'Disney''s Animal Kingdom', 'Entrada', 4, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-11', '07:45', '08:00', 'Lake Buena Vista', 'Posicionamento na entrada regular (rope drop)', 'transit', null, 'Animal Kingdom — Entrada Principal', 'planned', null, true, 'Sem Early Entry hoje: estar na frente da catraca antes das 8h vale a manhã inteira. Ir direto para Pandora.', 'Disney''s Animal Kingdom', 'Entrada', 5, null, null, 'none', false, false, null, false, 'operating', false, null, false, null, null, null, false, 15),
    ('2026-09-11', '08:00', '08:45', 'Lake Buena Vista', 'Avatar Flight of Passage', 'park', null, 'Disney''s Animal Kingdom', 'planned', 112, true, 'Prioridade absoluta do dia. Ir direto, sem fotos.', 'Disney''s Animal Kingdom', 'Pandora', 6, 'attraction', 'S', 'none', false, true, 'Primeiros 30 minutos do dia', false, 'operating', true, 'Se a Gabi não passar na medição, Rider Switch: um adulto vai com a Débora primeiro, o outro espera com a Gabi.', false, null, null, null, false, 0),
    ('2026-09-11', '08:45', '09:15', 'Lake Buena Vista', 'Na''vi River Journey', 'park', null, 'Disney''s Animal Kingdom', 'planned', null, true, 'Sem restrição de altura: todo mundo anda junto.', 'Disney''s Animal Kingdom', 'Pandora', 7, 'attraction', 'S', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-11', '09:15', '09:25', 'Lake Buena Vista', 'Atalho de Pandora para África', 'transit', null, 'Disney''s Animal Kingdom', 'planned', null, true, 'Ir direto para o Kilimanjaro Safaris — os animais ficam mais ativos de manhã.', 'Disney''s Animal Kingdom', 'Deslocamento', 8, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-11', '09:25', '10:05', 'Lake Buena Vista', 'Kilimanjaro Safaris', 'park', null, 'Disney''s Animal Kingdom', 'planned', null, true, 'Fazer o safári ainda pela manhã, antes do calor deixar os animais parados.', 'Disney''s Animal Kingdom', 'África', 9, 'attraction', 'S', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-11', '10:05', '10:35', 'Lake Buena Vista', 'Gorilla Falls Exploration Trail', 'park', null, 'Disney''s Animal Kingdom', 'planned', null, true, 'Trilha inteira, sem pressa — sombreada.', 'Disney''s Animal Kingdom', 'África', 10, 'experience', 'A', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-11', '10:35', '10:50', 'Lake Buena Vista', 'Deslocamento até o Harambe Theatre', 'transit', null, 'Disney''s Animal Kingdom', 'planned', null, true, null, 'Disney''s Animal Kingdom', 'Deslocamento', 11, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-11', '10:50', '11:35', 'Lake Buena Vista', 'Festival of the Lion King', 'park', 'Show completo, 40 minutos — não 25 como no roteiro original.', 'Animal Kingdom — Harambe Theatre', 'planned', null, true, 'Chegar com folga: é o espetáculo mais concorrido do parque.', 'Disney''s Animal Kingdom', 'África', 12, 'show', 'S', 'none', false, false, null, false, 'operating', true, null, false, '10:50', '11:30', 20, false, 20),
    ('2026-09-11', '11:35', '11:45', 'Lake Buena Vista', 'Deslocamento até a estação do trem (África)', 'transit', null, 'Disney''s Animal Kingdom', 'planned', null, true, null, 'Disney''s Animal Kingdom', 'Deslocamento', 13, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-11', '11:45', '12:05', 'Lake Buena Vista', 'Wildlife Express Train (ida)', 'park', 'Narração do Robert Irwin no trajeto — reaberto em 26/05/2026 junto com Bluey''s Wild World.', 'Disney''s Animal Kingdom', 'planned', null, true, 'Só se chega a Conservation Station de trem.', 'Disney''s Animal Kingdom', 'Rafiki''s Planet Watch', 14, 'experience', 'B', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 15),
    ('2026-09-11', '12:05', '13:00', 'Lake Buena Vista', 'Bluey''s Wild World', 'park', 'Experiência interativa com Bluey e Bingo — substituiu Affection Section e The Animation Experience.', 'Conservation Station', 'planned', null, true, 'Fecha às 15h45 — não deixar para mais tarde. Área coberta e com ar-condicionado.', 'Disney''s Animal Kingdom', 'Rafiki''s Planet Watch', 15, 'experience', 'B', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-11', '13:00', '13:15', 'Lake Buena Vista', 'Wildlife Express Train (volta)', 'park', null, 'Disney''s Animal Kingdom', 'planned', null, true, null, 'Disney''s Animal Kingdom', 'Rafiki''s Planet Watch', 16, 'experience', 'B', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-11', '13:15', '14:30', 'Lake Buena Vista', 'Almoço — Yak & Yeti Restaurant', 'restaurant', 'Pausa longa do meio do dia — reserva a confirmar antes da viagem.', 'Animal Kingdom — Ásia', 'planned', null, true, 'Chegar 13h05 no balcão. Ambiente fechado e com ar-condicionado: melhor horário para a Gabi descansar.', 'Disney''s Animal Kingdom', 'Asia', 17, 'character', null, 'none', false, false, null, false, 'operating', true, 'Sem reserva: Yak & Yeti Local Food Cafés (balcão, sem reserva) ou Satu’li Canteen em Pandora — nesse caso a pausa encolhe.', false, null, null, 10, false, 30),
    ('2026-09-11', '14:30', '14:45', 'Lake Buena Vista', 'Deslocamento até o Anandapur Theater', 'transit', null, 'Disney''s Animal Kingdom', 'planned', null, true, null, 'Disney''s Animal Kingdom', 'Deslocamento', 18, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-11', '14:45', '15:15', 'Lake Buena Vista', 'Feathered Friends in Flight!', 'park', 'Show de 25 minutos, ao ar livre mas coberto — bom plano se a tarde fechar tempestade.', 'Animal Kingdom — Anandapur Theater', 'planned', null, true, null, 'Disney''s Animal Kingdom', 'Asia', 19, 'show', 'A', 'none', false, false, null, false, 'operating', true, null, true, '14:45', '15:10', null, false, 15),
    ('2026-09-11', '15:15', '15:50', 'Lake Buena Vista', 'Maharajah Jungle Trek', 'park', null, 'Disney''s Animal Kingdom', 'planned', null, true, 'Trilha sombreada — bom horário para o pico de calor.', 'Disney''s Animal Kingdom', 'Asia', 20, 'experience', 'A', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-11', '15:50', '16:25', 'Lake Buena Vista', 'Kali River Rapids', 'park', null, 'Disney''s Animal Kingdom', 'planned', 97, true, 'Levar capa de chuva. Fecha com raio nas proximidades — é a atração mais sujeita à tempestade de setembro.', 'Disney''s Animal Kingdom', 'Asia', 21, 'attraction', 'A', 'none', false, false, null, false, 'operating', true, 'Se fechar por tempestade, trocar pela repetição livre das 18h40.', true, null, null, null, false, 0),
    ('2026-09-11', '16:25', '16:35', 'Lake Buena Vista', 'Deslocamento até o Expedition Everest', 'transit', null, 'Disney''s Animal Kingdom', 'planned', null, true, null, 'Disney''s Animal Kingdom', 'Deslocamento', 22, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-11', '16:35', '17:15', 'Lake Buena Vista', 'Expedition Everest – Legend of the Forbidden Mountain', 'park', null, 'Disney''s Animal Kingdom', 'planned', 112, true, 'A fila single rider foi descontinuada em 2026 — não contar com ela para agilizar.', 'Disney''s Animal Kingdom', 'Asia', 23, 'attraction', 'S', 'none', false, true, null, false, 'operating', true, 'Se a Gabi não passar na medição, Rider Switch aqui também.', true, null, null, null, false, 0),
    ('2026-09-11', '17:15', '17:35', 'Lake Buena Vista', 'Zootopia: Better Zoogether!', 'park', 'Substituiu It''s Tough to Be a Bug! em 07/11/2025 — show de ~9 minutos.', 'Animal Kingdom — Tree of Life Theater', 'planned', null, true, null, 'Disney''s Animal Kingdom', 'Discovery Island', 24, 'show', 'A', 'none', false, false, null, false, 'operating', true, null, true, '17:15', '17:24', null, false, 0),
    ('2026-09-11', '17:50', '18:20', 'Lake Buena Vista', 'Finding Nemo: The Big Blue… and Beyond!', 'park', 'Show completo, 25 minutos — não 40 como no roteiro original.', 'Animal Kingdom — Theater in the Wild', 'planned', null, true, null, 'Disney''s Animal Kingdom', 'Discovery Island', 25, 'show', 'S', 'none', false, false, null, false, 'operating', true, null, true, '17:50', '18:15', null, true, 15),
    ('2026-09-11', '18:20', '18:40', 'Lake Buena Vista', 'Discovery Island Trails e Árvore da Vida', 'park', null, 'Disney''s Animal Kingdom', 'planned', null, true, 'Fotos na Tree of Life. O parque fecha às 19h — sem escurecer, não há Awakenings hoje.', 'Disney''s Animal Kingdom', 'Discovery Island', 26, 'experience', 'B', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-11', '18:40', '19:00', 'Lake Buena Vista', 'Repetição livre (Everest, Na’vi ou Flight of Passage)', 'park', null, 'Disney''s Animal Kingdom', 'optional', null, true, 'Filas mais curtas perto do fechamento — escolher pela fila do My Disney Experience.', 'Disney''s Animal Kingdom', 'Pandora / Asia', 27, 'attraction', null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-11', '19:00', '19:20', 'Lake Buena Vista', 'Island Mercantile', 'shopping', null, 'Disney''s Animal Kingdom', 'planned', null, true, 'A loja opera um pouco além do horário de fechamento do parque.', 'Disney''s Animal Kingdom', 'Discovery Island', 28, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 15),
    ('2026-09-11', '19:20', '20:00', 'Lake Buena Vista → Kissimmee', 'Saída do Animal Kingdom e retorno ao hotel', 'transit', null, 'Disney''s Animal Kingdom → Celebration Suites', 'planned', null, true, 'Fluxo de saída pesado. A vaga foi fotografada de manhã.', 'Disney''s Animal Kingdom', 'Deslocamento', 29, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0)
  ) as v(date, time_start, time_end, city, title, category, description, location, status, min_height_cm, child_friendly, notes, park, area, base_order, item_type, priority_tier, lightning_lane, single_rider, child_switch, recommended_window, early_closure_risk, operational_status, counts_toward_completion, plan_b, time_is_estimated, show_block_start, show_block_end, recommended_arrival_min_before, last_showtime_of_day, reminder_minutes_before);
  get diagnostics v_inseridos = row_count;

  raise notice 'Animal Kingdom 11/09/2026: % item(ns) removido(s), % inserido(s) na viagem % para % participante(s).',
    v_apagados, v_inseridos, v_trip, cardinality(v_participants);
end $$;
