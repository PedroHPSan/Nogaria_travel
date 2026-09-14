-- =========================================================================
-- Roteiro operacional do Epic Universe — 15/09/2026 (Early Park Admission, sem Express)
--
-- GERADO por scripts/gerarSeedRoteiro.ts. Editar o módulo TS e regerar, nunca
-- editar este arquivo à mão.
--
-- Gerado a partir de src/services/roteiro/epicUniverseDia15.ts.
--
-- O Express Unlimited do Royal Pacific NÃO vale no Epic Universe — daí o
-- dia inteiro, o Early Park Admission das 9h e o rope drop em Super
-- Nintendo World. Parque abre 10h e fecha 20h em setembro/2026.
--
-- Como aplicar:
--   supabase db query --linked "$(cat supabase/seeds/roteiro_epic_universe_2026-09-15.sql)"
-- ou colar no SQL Editor do dashboard do projeto bkrqhividgljticgjrem.
--
-- É idempotente: apaga TODO item de itinerary_items da viagem em 2026-09-15
-- antes de inserir. O delete arrasta itinerary_item_outcomes por
-- `on delete cascade` (20260908160000_itinerary_checkins.sql).
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
     where t.start_date <= date '2026-09-15'
       and t.end_date   >= date '2026-09-15'
     order by t.created_at
     limit 1;
  end if;

  if v_trip is null then
    raise exception 'Nenhuma viagem cobre 2026-09-15. Confirme o trip_id antes de rodar.';
  end if;

  -- 2. Participantes: todos os da viagem entram em todos os blocos do dia.
  select coalesce(array_agg(p.id order by p.id), '{}'::uuid[])
    into v_participants
    from public.participants p
   where p.trip_id = v_trip;

  if cardinality(v_participants) = 0 then
    raise exception 'Viagem % não tem participantes cadastrados.', v_trip;
  end if;

  -- 3. Idempotência: limpa o dia inteiro.
  delete from public.itinerary_items
   where trip_id = v_trip
     and date = date '2026-09-15';
  get diagnostics v_apagados = row_count;

  -- 4. O dia.
  insert into public.itinerary_items (
    trip_id, participant_ids, participant_status, currency, date, time_start, time_end, city, title, category, description, location, status, min_height_cm, child_friendly, notes, park, area, base_order, item_type, priority_tier, lightning_lane, lightning_lane_priority_rank, single_rider, child_switch, recommended_window, early_closure_risk, operational_status, counts_toward_completion, plan_b, time_is_estimated, show_block_start, show_block_end, recommended_arrival_min_before, last_showtime_of_day, reminder_minutes_before
  )
  select
      v_trip,
      v_participants,
      '{}'::jsonb,
      'USD',
      v.date::date,
      v.time_start::time,
      v.time_end::time,
      v.city,
      v.title,
      v.category,
      v.description,
      v.location,
      v.status,
      v.min_height_cm::int,
      v.child_friendly::boolean,
      v.notes,
      v.park,
      v.area,
      v.base_order::int,
      v.item_type,
      v.priority_tier,
      v.lightning_lane,
      v.lightning_lane_priority_rank::int,
      v.single_rider::boolean,
      v.child_switch::boolean,
      v.recommended_window,
      v.early_closure_risk::boolean,
      v.operational_status,
      v.counts_toward_completion::boolean,
      v.plan_b,
      v.time_is_estimated::boolean,
      v.show_block_start::time,
      v.show_block_end::time,
      v.recommended_arrival_min_before::int,
      v.last_showtime_of_day::boolean,
      v.reminder_minutes_before::int
  from (values
    ('2026-09-15', '07:00', '07:30', 'Orlando', 'Acordar e preparação', 'rest', null, 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Dia mais longo dos três (11h de parque) e o único sem fura-fila. Tênis fechado, protetor solar, poncho, garrafas e carregador. Carrinho da Gabi é obrigatório hoje.', 'Epic Universe', 'Hotel', 1, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 15),
    ('2026-09-15', '07:30', '08:00', 'Orlando', 'Café da manhã no hotel', 'restaurant', null, 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Café reforçado — o primeiro bloco de comida dentro do parque só é às 12h20.', 'Epic Universe', 'Hotel', 2, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-15', '08:00', '08:30', 'Orlando', 'Royal Pacific → Epic Universe (ônibus do resort)', 'transit', 'O Epic Universe fica fora do complexo original: não há barco nem caminhada, só o ônibus do resort (~15 min) ou carro.', 'Universal''s Loews Royal Pacific Resort → Epic Universe', 'planned', null, true, 'Os ônibus para o Epic começam a rodar cerca de 1h antes do Early Park Admission e enchem. Estar no ponto às 8h, não às 8h15.', 'Epic Universe', 'Deslocamento', 3, null, null, 'none', null, false, false, null, false, 'operating', false, 'Fila de ônibus grande: ir de carro (estacionamento próprio do Epic, ~US$ 35) — 12 min pela Universal Blvd / Kirkman Extension.', false, null, null, null, false, 15),
    ('2026-09-15', '08:30', '09:00', 'Orlando', 'Entrada, segurança e posicionamento para o Early Park Admission', 'transit', null, 'Epic Universe', 'planned', null, true, 'Confirmar no app que o EPA de hoje inclui Super Nintendo World. Atravessar o Celestial Park sem parar — as fontes e os jardins ficam para o fim do dia.', 'Epic Universe', 'Entrada', 4, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se o EPA de hoje abrir Isle of Berk em vez de Super Nintendo World, inverter: Hiccup''s Wing Gliders e Dragon Racer''s Rally no EPA e Super Nintendo World às 10h.', false, null, null, null, false, 0),
    ('2026-09-15', '09:00', '09:40', 'Orlando', 'Mine-Cart Madness', 'park', 'A atração de maior demanda do Epic Universe. Sem Express, a hora do EPA é a única em que ela anda em menos de 20 min.', 'Epic Universe', 'planned', 122, true, 'Gabi (112cm) fica de fora — Child Swap. Decidir aqui sobre as Power-Up Bands (~US$ 40 cada): sem elas, os Key Challenges e o Bowser Jr. não funcionam.', 'Epic Universe', 'Super Nintendo World', 5, 'attraction', 'S', 'none', null, false, true, 'Primeiros 40 minutos do Early Park Admission', false, 'operating', true, null, false, null, null, null, false, 20),
    ('2026-09-15', '09:40', '10:10', 'Orlando', 'Mario Kart: Bowser''s Challenge', 'park', null, 'Epic Universe', 'planned', 102, true, 'Toda a família anda junto (102cm). Os óculos de realidade aumentada ficam sobre o boné do Mario — ajustar antes de embarcar, é o que mais atrapalha criança pequena.', 'Epic Universe', 'Super Nintendo World', 6, 'attraction', 'S', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-15', '10:10', '10:35', 'Orlando', 'Yoshi''s Adventure', 'park', null, 'Epic Universe', 'planned', 86, true, 'Barra de 86cm — a atração mais acessível do parque para a Gabi, e a vista de cima é a melhor foto da área.', 'Epic Universe', 'Super Nintendo World', 7, 'attraction', 'A', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-15', '10:35', '10:55', 'Orlando', 'Travessia Super Nintendo World → Ministry of Magic', 'transit', null, 'Epic Universe', 'planned', null, true, 'Sai pelo portal, atravessa o Celestial Park e entra pelo portal da Paris bruxa — ~12 min a pé.', 'Epic Universe', 'Deslocamento', 8, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-15', '10:55', '11:55', 'Orlando', 'Harry Potter and the Battle at the Ministry', 'park', 'A atração-âncora do Epic Universe: 102cm, então a família inteira anda junta — rara entre as fortes do dia.', 'Epic Universe', 'planned', 102, true, 'Sem Express: 60 min de fila é o cenário realista às 11h. Ir agora mesmo assim — à tarde passa de 90.', 'Epic Universe', 'Ministry of Magic', 9, 'attraction', 'S', 'none', null, false, false, null, false, 'operating', true, 'Se a fila estiver acima de 75 min, trocar por Le Cirque Arcanus e a exploração da Paris bruxa e voltar aqui às 19h, na última hora do parque.', true, null, null, null, false, 0),
    ('2026-09-15', '11:55', '12:20', 'Orlando', 'Paris bruxa — vitrines, varinhas e fachadas', 'park', null, 'Epic Universe', 'planned', null, true, 'A área tem interações de varinha espalhadas pelas fachadas — se a varinha interativa foi comprada ontem no Hogsmeade, ela funciona aqui também.', 'Epic Universe', 'Ministry of Magic', 10, 'experience', 'A', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-15', '12:20', '13:05', 'Orlando', 'Almoço — Café L''air De La Sirène', 'restaurant', 'Quick service temático da Paris bruxa, salão interno e climatizado.', 'Epic Universe', 'planned', null, true, 'Mobile order pelo app assim que sair da atração. ~US$ 85 para os 4.', 'Epic Universe', 'Ministry of Magic', 11, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, 10, false, 15),
    ('2026-09-15', '13:10', '13:35', 'Orlando', 'Le Cirque Arcanus', 'park', 'Espetáculo fechado com bonecos e criaturas mágicas, ~20 min. Primeiro bloco coberto da tarde.', 'Epic Universe', 'planned', null, true, 'Horário sujeito à programação do dia — conferir no app de manhã e ajustar este bloco se preciso.', 'Epic Universe', 'Ministry of Magic', 12, 'show', 'S', 'none', null, false, false, null, false, 'operating', true, null, false, '13:10', '13:30', 15, false, 20),
    ('2026-09-15', '13:35', '13:55', 'Orlando', 'Travessia Ministry of Magic → Isle of Berk', 'transit', null, 'Epic Universe', 'planned', null, true, null, 'Epic Universe', 'Deslocamento', 13, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-15', '13:55', '14:30', 'Orlando', 'Hiccup''s Wing Gliders', 'park', null, 'Epic Universe', 'planned', 102, true, 'Família inteira junta (102cm). É a melhor montanha-russa do Epic dentro da altura da Gabi.', 'Epic Universe', 'Isle of Berk', 14, 'attraction', 'S', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-15', '14:30', '14:55', 'Orlando', 'Fyre Drill', 'park', null, 'Epic Universe', 'planned', null, true, 'Sem altura mínima e interativa (jatos de água) — molha. Bloco leve entre duas de 122cm.', 'Epic Universe', 'Isle of Berk', 15, 'attraction', 'A', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-15', '14:55', '15:20', 'Orlando', 'Dragon Racer''s Rally', 'park', null, 'Epic Universe', 'planned', 122, true, 'Gabi (112cm) fica de fora — enquanto Débora anda, ela e um adulto fazem o Viking Training Camp, ali ao lado.', 'Epic Universe', 'Isle of Berk', 16, 'attraction', 'A', 'none', null, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-15', '15:20', '15:50', 'Orlando', 'The Untrainable Dragon', 'park', 'Teatro fechado, ~25 min, boneco animatrônico do Banguela em escala real. Segundo abrigo da tarde.', 'Epic Universe', 'planned', null, true, 'Sentar no meio, não na frente — o dragão é grande demais para as primeiras fileiras. Confirmar o horário no app.', 'Epic Universe', 'Isle of Berk', 17, 'show', 'S', 'none', null, false, false, null, false, 'operating', true, null, false, '15:20', '15:45', 15, false, 20),
    ('2026-09-15', '15:50', '16:10', 'Orlando', 'Travessia Isle of Berk → Dark Universe', 'transit', null, 'Epic Universe', 'planned', null, true, 'Dark Universe é a área mais pesada do parque em tema (monstros clássicos, penumbra, sustos ambientais). Combinar com a Gabi antes de entrar.', 'Epic Universe', 'Deslocamento', 18, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-15', '16:10', '16:55', 'Orlando', 'Monsters Unchained: The Frankenstein Experiment', 'park', 'A dark ride mais intensa do Epic Universe.', 'Epic Universe', 'planned', 122, true, 'Gabi (112cm) fica de fora — e o tema aqui não é só altura: a fila já é assustadora. Melhor que ela e um adulto esperem fora da área, na praça do portal.', 'Epic Universe', 'Dark Universe', 19, 'attraction', 'S', 'none', null, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-15', '16:55', '17:25', 'Orlando', 'Curse of the Werewolf', 'park', null, 'Epic Universe', 'optional', 122, true, 'Segunda de 122cm seguida. Se a espera do adulto que ficou com a Gabi estiver longa demais, este é o bloco a cortar — é o de menor prioridade da área.', 'Epic Universe', 'Dark Universe', 20, 'attraction', 'A', 'none', null, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-15', '17:25', '17:50', 'Orlando', 'Darkmoor Monster Makeup Experience', 'park', null, 'Epic Universe', 'planned', null, true, 'Sem altura mínima e mais teatral que assustador — reencaixa a Gabi na área depois de duas atrações que ela não pôde fazer.', 'Epic Universe', 'Dark Universe', 21, 'experience', 'B', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-15', '17:50', '18:10', 'Orlando', 'Travessia Dark Universe → Celestial Park', 'transit', null, 'Epic Universe', 'planned', null, true, null, 'Epic Universe', 'Deslocamento', 22, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-15', '18:10', '18:55', 'Orlando', 'Jantar no Celestial Park', 'restaurant', 'The Oak & Star Tavern (quick service) ou Atlantic (table service, exige reserva).', 'Epic Universe', 'planned', null, true, 'Mobile order no quick service — table service sem reserva às 18h não entra. ~US$ 90 para os 4.', 'Epic Universe', 'Celestial Park', 23, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, 10, false, 15),
    ('2026-09-15', '18:55', '19:25', 'Orlando', 'Stardust Racers', 'park', 'Montanha-russa dupla de lançamento do Celestial Park — a mais rápida do Epic.', 'Epic Universe', 'planned', 122, true, 'Gabi (112cm) fica de fora — Child Swap. À noite a fila cai e a vista das fontes iluminadas compensa ter deixado para o fim.', 'Epic Universe', 'Celestial Park', 24, 'attraction', 'S', 'none', null, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-15', '19:25', '19:45', 'Orlando', 'Constellation Carousel', 'park', null, 'Epic Universe', 'planned', null, true, 'Sem altura mínima — o último bloco em que a Gabi anda, e de propósito é o penúltimo do dia.', 'Epic Universe', 'Celestial Park', 25, 'attraction', 'A', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-15', '19:45', '20:00', 'Orlando', 'The Cosmos Fountain Show', 'park', 'Show de fontes, luz e música no lago central, ~8 min, no fechamento do parque.', 'Epic Universe', 'planned', null, true, 'Melhor ponto: a escadaria do lado do portal do Super Nintendo World, de costas para a saída — já encaminha a debandada.', 'Epic Universe', 'Celestial Park', 26, 'show', 'A', 'none', null, false, false, null, false, 'operating', true, null, false, '19:45', '19:55', null, true, 15),
    ('2026-09-15', '20:00', '20:40', 'Orlando', 'Saída e retorno ao Royal Pacific', 'transit', null, 'Epic Universe → Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'A fila do ônibus no fechamento é o pior gargalo do dia — sair durante o show de fontes economiza ~20 min.', 'Epic Universe', 'Deslocamento', 27, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-15', '20:40', '21:20', 'Orlando', 'Encerramento e malas fechadas para o dia 16', 'rest', null, 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Amanhã tem check-out às 7h15 com as malas no carro antes do parque — fechar tudo hoje. Separar o Express Unlimited: ele ainda vale o dia inteiro amanhã.', 'Epic Universe', 'Hotel', 28, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 15)
  ) as v(date, time_start, time_end, city, title, category, description, location, status, min_height_cm, child_friendly, notes, park, area, base_order, item_type, priority_tier, lightning_lane, lightning_lane_priority_rank, single_rider, child_switch, recommended_window, early_closure_risk, operational_status, counts_toward_completion, plan_b, time_is_estimated, show_block_start, show_block_end, recommended_arrival_min_before, last_showtime_of_day, reminder_minutes_before);
  get diagnostics v_inseridos = row_count;

  raise notice 'Roteiro operacional do Epic Universe 2026-09-15: % item(ns) removido(s), % inserido(s) na viagem % para % participante(s).',
    v_apagados, v_inseridos, v_trip, cardinality(v_participants);
end $$;
