-- =========================================================================
-- Roteiro operacional do Islands of Adventure — 14/09/2026 (replanejado no balcão do Royal Pacific, com Universal Express Unlimited)
--
-- GERADO por scripts/gerarSeedRoteiro.ts. Editar o módulo TS e regerar, nunca
-- editar este arquivo à mão.
--
-- Gerado a partir de src/services/roteiro/islandsOfAdventureDia14.ts.
--
-- Quinta versão: o dia foi interrompido por um imprevisto logo depois do
-- Ripsaw Falls (15h05) e a família não conseguiu voltar ao parque. Tudo até
-- ali (Seuss Landing, Hulk, Doctor Doom, Homem-Aranha, Ripsaw Falls) volta
-- marcado como `completed`; nada depois é reagendado dentro do próprio dia.
-- Três atrações fortes que ficaram para trás — Forbidden Journey, Hagrid's
-- e o VelociCoaster (pedido nº1 da Débora) — viram resgate deliberado no
-- dia 16 (ver roteiro_universal_studios_2026-09-16.sql). As demais (Bilge-
-- Rat Barges, Reign of Kong, Camp Jurassic, Hippogriff, Ollivanders de
-- Hogsmeade) ficam de fora da viagem.
--
-- ATENÇÃO: este seed apaga o dia inteiro antes de inserir. Os blocos já
-- cumpridos voltam marcados como `completed`, mas qualquer participant_status
-- marcado no app hoje se perde.
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
    ('2026-09-14', '11:00', '11:25', 'Kissimmee', 'Check-out do Celebration Suites e carga do carro', 'rest', 'Feito. Fica no roteiro como histórico do dia — apagar blocos cumpridos esconde o que a família já gastou de relógio.', 'Celebration Suites', 'completed', null, true, null, 'Universal''s Islands of Adventure', 'Hotel', 1, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, null, false, 0),
    ('2026-09-14', '11:25', '11:55', 'Kissimmee → Orlando', 'Kissimmee → Loews Royal Pacific Resort', 'transit', 'Feito, com ~10 min de adiantamento sobre o plano. Reserva 37654214702.', 'Celebration Suites → Universal''s Loews Royal Pacific Resort', 'completed', null, true, null, 'Universal''s Islands of Adventure', 'Deslocamento', 2, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, null, false, 0),
    ('2026-09-14', '11:55', '12:30', 'Orlando', 'Registro no Royal Pacific + Express Unlimited (com o almoço em paralelo)', 'rest', 'O bloco mais importante do dia. O Universal Express Unlimited dos 4 hóspedes é entregue no balcão, junto com as chaves — é o que sustenta os dias 14 e 16.', 'Universal''s Loews Royal Pacific Resort', 'completed', null, true, 'DIVIDIR: um adulto fica na fila do balcão, o outro leva as meninas ao Tuk Tuk Market e compra o almoço para levar (~US$ 45). Fazer em série custaria 60 min; em paralelo custa 35, e são esses 35 min que compram a entrada no parque às 13h em vez de 13h35. No balcão: pedir os 4 cartões Express, conferir que valem HOJE e em 16/09 (dia do check-out), e deixar as malas no Bell Services — o quarto só libera às 16h.', 'Universal''s Islands of Adventure', 'Hotel', 3, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, null, false, 0),
    ('2026-09-14', '12:30', '12:50', 'Orlando', 'Royal Pacific → Islands of Adventure', 'transit', null, 'Universal''s Loews Royal Pacific Resort → Universal''s Islands of Adventure', 'completed', null, true, 'Water taxi na doca do hotel ou a trilha a pé até o CityWalk — os dois dão ~12 min. Comer o grab-and-go no caminho ou nos bancos do Port of Entry.', 'Universal''s Islands of Adventure', 'Deslocamento', 4, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, null, false, 0),
    ('2026-09-14', '12:50', '13:00', 'Orlando', 'Entrada, segurança e conferência do horário de fechamento', 'transit', 'Ingresso Park-to-Park no app Universal Orlando Resort, com os cartões Express na mesma carteira digital.', 'Universal''s Islands of Adventure', 'completed', null, true, 'CONFERIR AINDA o fechamento de hoje no app (previsto 20h) — é o número que decide a hora de entrar na fila do Hagrid''s. Anotar também o horário das sessões do Ollivanders.', 'Universal''s Islands of Adventure', 'Entrada', 5, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se o fechamento for antes das 20h, cortar o bloco do Camp Jurassic e antecipar o jantar em 30 min: tudo depois dele desliza junto e o Hagrid''s continua sendo o último.', false, null, null, null, false, 0),
    ('2026-09-14', '13:00', '13:35', 'Orlando', 'Seuss Landing — Caro-Seuss-el, One Fish Two Fish, The Cat in the Hat e Trolley Train', 'park', 'Quatro atrações leves em sequência, todas dentro da altura da Gabi (91cm), a 5 min do Port of Entry.', 'Universal''s Islands of Adventure', 'completed', 91, true, 'Marcado como feito junto com o Hulk e o Doctor Doom. SE ficou para trás na pressa de chegar ao Marvel, a recuperação já existe no fim do dia: o Seuss fica a 8 min de Hogsmeade, e é exatamente para lá que a Gabi vai com um adulto enquanto a Débora anda no Hagrid''s às 19h25.', 'Universal''s Islands of Adventure', 'Seuss Landing', 6, 'attraction', 'B', 'express', 10, false, false, null, false, 'operating', true, null, false, null, null, null, false, 0),
    ('2026-09-14', '13:35', '14:00', 'Orlando', 'The Incredible Hulk Coaster', 'park', 'Feito. Primeira das quatro trocas do dia — Gabi (112cm) ficou de fora.', 'Universal''s Islands of Adventure', 'completed', 137, true, 'Gabi (112cm) fica de fora. Child Swap na plataforma, ~10 min de custo com Express.', 'Universal''s Islands of Adventure', 'Marvel Super Hero Island', 7, 'attraction', 'S', 'express', 4, false, true, null, false, 'operating', true, null, false, null, null, null, false, 0),
    ('2026-09-14', '14:00', '14:20', 'Orlando', 'Doctor Doom''s Fearfall', 'park', 'Feito. Segunda troca do dia.', 'Universal''s Islands of Adventure', 'completed', 132, true, 'Gabi (112cm) fora, Child Swap. Se o Storm Force Accelatron e o encontro dos heróis Marvel não saíram durante a troca, eles ficam aqui ao lado — 10 min, sem fila, e valem a volta se sobrar tempo antes do Toon Lagoon.', 'Universal''s Islands of Adventure', 'Marvel Super Hero Island', 8, 'attraction', 'A', 'express', 8, false, true, null, false, 'operating', true, null, false, null, null, null, false, 0),
    ('2026-09-14', '14:20', '14:40', 'Orlando', 'The Amazing Adventures of Spider-Man', 'park', 'Simulador 3D sobre trilho — a atração forte de maior alcance do dia, e a primeira em que os 4 andam juntos.', 'Universal''s Islands of Adventure', 'completed', 102, true, 'Feito. Saiu da frente do Hulk e do Doctor Doom para o lugar deles: a família chegou ao Marvel e foi direto nas duas que barram a Gabi, então o Homem-Aranha virou a recompensa dela logo depois das duas trocas seguidas.', 'Universal''s Islands of Adventure', 'Marvel Super Hero Island', 9, 'attraction', 'S', 'express', 3, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '14:40', '15:05', 'Orlando', 'Dudley Do-Right''s Ripsaw Falls', 'park', 'Queda de 15m em tronco. Molha de verdade — não é respingo.', 'Universal''s Islands of Adventure', 'completed', 112, true, 'Feito — última atração do dia. Barra de 44in = 111,8cm: a Gabi passou por 2mm, de tênis.', 'Universal''s Islands of Adventure', 'Toon Lagoon', 10, 'attraction', 'A', 'express', 5, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '15:05', '15:40', 'Orlando', 'Saída do parque por imprevisto e volta ao Royal Pacific', 'transit', 'O dia parou aqui: a família precisou deixar o Islands of Adventure logo depois do Ripsaw Falls e não conseguiu voltar hoje.', 'Universal''s Islands of Adventure → Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Water taxi ou trilha a pé de volta ao hotel, ~12 min. Os cartões Express Unlimited dos 4 continuam valendo no dia 16 (DEC-002/37654214702) — nada se perde por não terem sido usados hoje.', 'Universal''s Islands of Adventure', 'Deslocamento', 11, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, null, false, 0),
    ('2026-09-14', '15:40', '16:00', 'Orlando', 'Check-in do quarto e malas do Bell Services', 'rest', 'O quarto libera às 16h — a saída antecipada do parque coincide quase exatamente com o horário normal de check-in.', 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Retirar as malas deixadas no Bell Services pela manhã.', 'Universal''s Islands of Adventure', 'Hotel', 12, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, null, false, 0),
    ('2026-09-14', '16:00', '18:30', 'Orlando', 'Tarde livre no resort — piscina e Wantilan Luau (se houver vaga)', 'rest', 'A tarde que ninguém planejou vira folga de verdade em vez de tempo perdido: piscina com tobogã, praia artificial e lazy river do Royal Pacific.', 'Universal''s Loews Royal Pacific Resort', 'optional', null, true, 'Vale ligar para a recepção perguntando se há mesa no Wantilan Luau desta noite (luau havaiano com jantar, às quintas e domingos normalmente — conferir o dia de hoje) como alternativa ao jantar simples. Gabi (4 anos) se beneficia mais de um fim de tarde parado do que de mais estímulo.', 'Universal''s Islands of Adventure', 'Hotel', 13, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-14', '18:30', '19:30', 'Orlando', 'Jantar — Bahama Breeze ou Jake''s American Bar no CityWalk', 'restaurant', 'O Three Broomsticks ficou para trás com o resto de Hogsmeade — CityWalk fica a 10 min a pé do hotel e cobre o jantar sem exigir outro deslocamento de carro.', 'Universal''s Islands of Adventure', 'planned', null, true, 'Mobile order não se aplica fora dos parques; reservar pelo app do Universal Orlando Resort ou chegar sem fila por volta das 18h30. Butterbeer não está disponível fora dos parques.', 'Universal''s Islands of Adventure', 'CityWalk', 14, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, 10, false, 15),
    ('2026-09-14', '19:30', '20:30', 'Orlando', 'Malas, roupas e preparação do dia 15', 'rest', null, 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Amanhã é Epic Universe com Early Park Admission às 9h e SEM Express — despertador às 7h, roupa e mochila separadas hoje à noite, e os cartões Express guardados fora da mala (eles voltam a valer no dia 16, no Universal Studios/Islands of Adventure).', 'Universal''s Islands of Adventure', 'Hotel', 15, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0)
  ) as v(date, time_start, time_end, city, title, category, description, location, status, min_height_cm, child_friendly, notes, park, area, base_order, item_type, priority_tier, lightning_lane, lightning_lane_priority_rank, single_rider, child_switch, recommended_window, early_closure_risk, operational_status, counts_toward_completion, plan_b, time_is_estimated, show_block_start, show_block_end, recommended_arrival_min_before, last_showtime_of_day, reminder_minutes_before);
  get diagnostics v_inseridos = row_count;

  raise notice 'Roteiro operacional do Islands of Adventure 2026-09-14: % item(ns) removido(s), % inserido(s) na viagem % para % participante(s).',
    v_apagados, v_inseridos, v_trip, cardinality(v_participants);
end $$;
