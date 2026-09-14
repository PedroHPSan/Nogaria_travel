-- =========================================================================
-- Roteiro operacional do Islands of Adventure — 14/09/2026 (meio período, com Universal Express Unlimited)
--
-- GERADO por scripts/gerarSeedRoteiro.ts. Editar o módulo TS e regerar, nunca
-- editar este arquivo à mão.
--
-- Gerado a partir de src/services/roteiro/islandsOfAdventureDia14.ts.
--
-- Dia de meio período: começa às 12h no Celebration Suites (Kissimmee) e
-- passa pelo Loews Royal Pacific, onde o Universal Express Unlimited dos 4
-- hóspedes é retirado. Hagrid's não aceita Express e por isso é o último
-- bloco do dia. Gabi (112cm) fica de fora de 5 das 6 atrações mais fortes.
--
-- Como aplicar:
--   supabase db query --linked "$(cat supabase/seeds/roteiro_islands_of_adventure_2026-09-14.sql)"
-- ou colar no SQL Editor do dashboard do projeto bkrqhividgljticgjrem.
--
-- É idempotente: apaga TODO item de itinerary_items da viagem em 2026-09-14
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
     where t.start_date <= date '2026-09-14'
       and t.end_date   >= date '2026-09-14'
     order by t.created_at
     limit 1;
  end if;

  if v_trip is null then
    raise exception 'Nenhuma viagem cobre 2026-09-14. Confirme o trip_id antes de rodar.';
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
     and date = date '2026-09-14';
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
    ('2026-09-14', '12:00', '12:25', 'Kissimmee', 'Check-out do Celebration Suites e carga do carro', 'rest', null, 'Celebration Suites', 'planned', null, true, 'Já passou do horário de check-out: avisar a recepção, pagar a taxa de late check-out se houver e sair. Varrer gavetas, cofre e carregadores antes de fechar a porta.', 'Universal''s Islands of Adventure', 'Hotel', 1, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-14', '12:25', '13:05', 'Kissimmee → Orlando', 'Kissimmee → Loews Royal Pacific Resort', 'transit', null, 'Celebration Suites → Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'I-4 sentido norte, saída 74/75. ~35 min sem trânsito. Reserva 37654214702.', 'Universal''s Islands of Adventure', 'Deslocamento', 2, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 10),
    ('2026-09-14', '13:05', '13:45', 'Orlando', 'Registro no Royal Pacific e retirada do Express Unlimited', 'rest', 'O bloco mais importante do dia. O Universal Express Unlimited dos 4 hóspedes é entregue no balcão, junto com as chaves — é o que sustenta os dias 14 e 16.', 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Check-in do quarto é às 16h, mas dá para registrar agora: pedir os cartões Express Unlimited e deixar as malas no Bell Services. Conferir se saíram 4 cartões e se valem para hoje e para 16/09 (dia do check-out).', 'Universal''s Islands of Adventure', 'Hotel', 3, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se o balcão se recusar a emitir o Express antes das 16h, insistir com o gerente de plantão — o benefício é do dia de chegada. Sem isso, o dia inteiro muda: ir para o Seuss Landing e o Hogsmeade primeiro e deixar as filas grandes para o dia 16.', false, null, null, null, false, 15),
    ('2026-09-14', '13:45', '14:05', 'Orlando', 'Almoço rápido no hotel (grab-and-go)', 'restaurant', null, 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Orchid Court / Tuk Tuk Market. Comer aqui em vez de dentro do parque salva ~30 min de uma tarde que já é curta. ~US$ 45 para os 4.', 'Universal''s Islands of Adventure', 'Hotel', 4, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-14', '14:05', '14:25', 'Orlando', 'Royal Pacific → Islands of Adventure', 'transit', null, 'Universal''s Loews Royal Pacific Resort → Universal''s Islands of Adventure', 'planned', null, true, 'Water taxi (sai na doca do hotel) ou caminhada pela trilha até o CityWalk — os dois dão ~12 min. Com carrinho da Gabi, a caminhada é mais previsível que a fila do barco.', 'Universal''s Islands of Adventure', 'Deslocamento', 5, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 10),
    ('2026-09-14', '14:25', '14:35', 'Orlando', 'Entrada e segurança', 'transit', null, 'Universal''s Islands of Adventure', 'planned', null, true, 'Ingresso Park-to-Park no app Universal Orlando Resort. Deixar o Express Unlimited na mesma carteira digital.', 'Universal''s Islands of Adventure', 'Entrada', 6, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-14', '14:35', '15:05', 'Orlando', 'Seuss Landing — Caro-Seuss-el, One Fish Two Fish e Trolley Train', 'park', 'Três atrações leves em sequência, todas dentro da altura da Gabi (91cm). Fica logo à direita do Port of Entry.', 'Universal''s Islands of Adventure', 'planned', 91, true, 'A área é o oposto do resto do dia: nada aqui tem fila longa à tarde. É o único bloco em que a Gabi lidera.', 'Universal''s Islands of Adventure', 'Seuss Landing', 7, 'attraction', 'B', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '15:05', '15:30', 'Orlando', 'The Amazing Adventures of Spider-Man', 'park', null, 'Universal''s Islands of Adventure', 'planned', 102, true, 'Toda a família anda junto — é a atração forte de maior alcance do dia (102cm).', 'Universal''s Islands of Adventure', 'Marvel Super Hero Island', 8, 'attraction', 'S', 'express', 3, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '15:30', '15:55', 'Orlando', 'The Incredible Hulk Coaster', 'park', null, 'Universal''s Islands of Adventure', 'planned', 137, true, 'Gabi (112cm) fica de fora. Child Swap na própria plataforma: Débora anda com um adulto, troca, o outro anda em seguida — com Express isso custa ~10 min, não uma fila inteira.', 'Universal''s Islands of Adventure', 'Marvel Super Hero Island', 9, 'attraction', 'S', 'express', 4, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '15:55', '16:20', 'Orlando', 'Dudley Do-Right''s Ripsaw Falls', 'park', 'Queda de 15m em tronco. Molha de verdade — não é respingo.', 'Universal''s Islands of Adventure', 'planned', 112, true, 'Barra de 44in = 111,8cm: a Gabi passa por 2mm, com tênis. Medir na entrada antes de entrar na fila. Poncho ou locker para celulares e a mochila.', 'Universal''s Islands of Adventure', 'Toon Lagoon', 10, 'attraction', 'A', 'express', 5, false, false, null, false, 'operating', true, 'Se a Gabi não passar na medição, ela e um adulto seguem para Me Ship, the Olive (sem altura mínima, ao lado) e o grupo se reencontra na saída.', true, null, null, null, false, 0),
    ('2026-09-14', '16:20', '16:50', 'Orlando', 'Jurassic World VelociCoaster', 'park', 'A melhor montanha-russa do complexo Universal e o pedido nº 1 da Débora desde o planejamento.', 'Universal''s Islands of Adventure', 'planned', 130, true, 'Gabi (112cm) fica de fora — Child Swap. Bolsos vazios: nada solto é permitido, há lockers gratuitos na entrada.', 'Universal''s Islands of Adventure', 'Jurassic Park', 11, 'attraction', 'S', 'express', 1, false, true, 'Antes do jantar, enquanto ainda há luz para a vista do topo', false, 'operating', true, null, true, null, null, null, false, 20),
    ('2026-09-14', '16:50', '17:10', 'Orlando', 'Raptor Encounter', 'park', null, 'Universal''s Islands of Adventure', 'planned', null, true, 'Sem altura mínima e sem fila paga — encontro com o velociraptor, o melhor bloco do dia para foto com a Gabi.', 'Universal''s Islands of Adventure', 'Jurassic Park', 12, 'character', 'A', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '17:10', '17:55', 'Orlando', 'Jantar antecipado — Thunder Falls Terrace', 'restaurant', 'Quick service com churrasco e frango grelhado, salão amplo e climatizado, vista para a queda do River Adventure.', 'Universal''s Islands of Adventure', 'planned', null, true, 'Mobile order pelo app antes de sair do Raptor Encounter. Jantar às 17h parece cedo, mas libera as últimas 2h para Hogsmeade e Hagrid''s. ~US$ 80 para os 4.', 'Universal''s Islands of Adventure', 'Jurassic Park', 13, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, 10, false, 15),
    ('2026-09-14', '17:55', '18:10', 'Orlando', 'Travessia Jurassic Park → Hogsmeade', 'transit', null, 'Universal''s Islands of Adventure', 'planned', null, true, 'A ponte de Jurassic Park cai direto no Hogsmeade — melhor entrada do parque, vale chegar olhando para o castelo.', 'Universal''s Islands of Adventure', 'Deslocamento', 14, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 10),
    ('2026-09-14', '18:10', '18:40', 'Orlando', 'Harry Potter and the Forbidden Journey', 'park', null, 'Universal''s Islands of Adventure', 'planned', 122, true, 'Gabi (112cm) fica de fora — Child Swap. A fila atravessa o interior do castelo de Hogwarts e vale por si só: quem faz o Child Swap deve pedir para percorrer a fila mesmo sem andar.', 'Universal''s Islands of Adventure', 'Hogsmeade', 15, 'attraction', 'S', 'express', 2, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '18:40', '19:00', 'Orlando', 'Flight of the Hippogriff', 'park', null, 'Universal''s Islands of Adventure', 'planned', 91, true, 'Montanha-russa infantil — a única de Hogsmeade em que a Gabi anda. Passa pela cabana do Hagrid.', 'Universal''s Islands of Adventure', 'Hogsmeade', 16, 'attraction', 'A', 'express', 6, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '19:00', '19:25', 'Orlando', 'Hogsmeade — Butterbeer, Ollivanders e lojas', 'park', 'Ollivanders (escolha da varinha), Honeydukes e Dervish & Banges, com o vilarejo já iluminado.', 'Universal''s Islands of Adventure', 'planned', null, true, 'Butterbeer gelada, não a frozen, se a fila da frozen estiver grande. Varinha interativa (~US$ 65) aciona as vitrines do vilarejo — decidir aqui, é o pedido recorrente da Débora.', 'Universal''s Islands of Adventure', 'Hogsmeade', 17, 'experience', 'A', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '19:25', '20:05', 'Orlando', 'Hagrid''s Magical Creatures Motorbike Adventure', 'park', 'Única atração forte do parque que NÃO aceita Universal Express — por isso é a última do dia.', 'Universal''s Islands of Adventure', 'planned', 122, true, 'Entrar na fila antes do fechamento: quem já está na fila anda, mesmo que o parque feche. Débora vai com um adulto; o outro leva a Gabi de volta ao Seuss Landing (10 min a pé) e todos se reencontram no Port of Entry.', 'Universal''s Islands of Adventure', 'Hogsmeade', 18, 'attraction', 'S', 'none', null, false, false, 'Últimos 30 minutos antes do fechamento', false, 'operating', true, 'Se o parque fechar às 18h ou 19h hoje (segunda não é noite de Halloween Horror Nights), este bloco cai e a família sai depois do Hogsmeade — o Hagrid''s então só é possível voltando de Hogwarts Express no dia 16.', true, null, null, null, false, 15),
    ('2026-09-14', '20:05', '20:35', 'Orlando', 'Saída do parque e retorno ao Royal Pacific', 'transit', null, 'Universal''s Islands of Adventure → Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Water taxi encerra pouco depois do fechamento do parque — se já tiver parado, a trilha a pé leva ~15 min e é iluminada.', 'Universal''s Islands of Adventure', 'Deslocamento', 19, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-14', '20:35', '21:15', 'Orlando', 'Check-in do quarto, malas e ceia leve', 'rest', null, 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Retirar as malas do Bell Services. Amanhã é Epic Universe com Early Park Admission às 9h — separar roupa e mochila hoje à noite.', 'Universal''s Islands of Adventure', 'Hotel', 20, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0)
  ) as v(date, time_start, time_end, city, title, category, description, location, status, min_height_cm, child_friendly, notes, park, area, base_order, item_type, priority_tier, lightning_lane, lightning_lane_priority_rank, single_rider, child_switch, recommended_window, early_closure_risk, operational_status, counts_toward_completion, plan_b, time_is_estimated, show_block_start, show_block_end, recommended_arrival_min_before, last_showtime_of_day, reminder_minutes_before);
  get diagnostics v_inseridos = row_count;

  raise notice 'Roteiro operacional do Islands of Adventure 2026-09-14: % item(ns) removido(s), % inserido(s) na viagem % para % participante(s).',
    v_apagados, v_inseridos, v_trip, cardinality(v_participants);
end $$;
