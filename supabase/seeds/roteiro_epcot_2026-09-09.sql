-- =========================================================================
-- Roteiro operacional do EPCOT — 09/09/2026 (sem Early Entry, sem Lightning Lane)
--
-- Gerado a partir de src/services/roteiro/epcotDia09.ts. Editar o TS e
-- regerar, não editar este arquivo à mão: o módulo é o registro do que foi
-- semeado no banco (ver o comentário sobre INITIAL_ITINERARY em
-- src/services/initialMockData.ts).
--
-- Como aplicar:
--   supabase db query --linked "$(cat supabase/seeds/roteiro_epcot_2026-09-09.sql)"
-- ou colar no SQL Editor do dashboard do projeto bkrqhividgljticgjrem.
--
-- É idempotente: apaga os itens do EPCOT já existentes em 2026-09-09 para
-- esta viagem antes de inserir, então pode rodar quantas vezes precisar.
-- ATENÇÃO: isso descarta os `participant_status` (marcações de "feito") que já
-- existirem nos itens do EPCOT de hoje. Rodar antes de começar o dia.
--
-- A viagem e os participantes são resolvidos por consulta, não hardcoded:
-- nada aqui depende de a semente original ter mantido os UUIDs.
-- =========================================================================

do $$
declare
  v_trip        uuid;
  v_participants uuid[];
  v_apagados    integer;
  v_inseridos   integer;
begin
  -- 1. Viagem: preferir o id da semente; senão, a viagem que cobre a data.
  select t.id into v_trip
    from public.trips t
   where t.id = '9a8b7c6d-5e4f-4321-8765-4321fedcba09'::uuid;

  if v_trip is null then
    select t.id into v_trip
      from public.trips t
     where t.start_date <= date '2026-09-09'
       and t.end_date   >= date '2026-09-09'
     order by t.created_at
     limit 1;
  end if;

  if v_trip is null then
    raise exception 'Nenhuma viagem cobre 2026-09-09. Confirme o trip_id antes de rodar.';
  end if;

  -- 2. Participantes: todos os da viagem entram em todos os blocos do dia.
  select coalesce(array_agg(p.id order by p.id), '{}'::uuid[])
    into v_participants
    from public.participants p
   where p.trip_id = v_trip;

  if cardinality(v_participants) = 0 then
    raise exception 'Viagem % não tem participantes cadastrados.', v_trip;
  end if;

  -- 3. Idempotência: limpa o dia do EPCOT antes de reescrevê-lo.
  delete from public.itinerary_items
   where trip_id = v_trip
     and date = date '2026-09-09'
     and park = 'EPCOT';
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
    ('2026-09-09', '07:15', '07:40', 'Kissimmee', 'Acordar e preparação', 'rest', null, 'Vacation Village at Parkway', 'planned', null, true, 'Mochila: protetor solar, poncho, garrafas e carregador. Tênis fechado.', 'EPCOT', 'Hotel', 1, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 15),
    ('2026-09-09', '07:40', '08:00', 'Kissimmee', 'Café da manhã no Vacation Village at Parkway', 'restaurant', null, 'Vacation Village at Parkway', 'planned', null, true, 'Café rápido no apartamento — não há parada para café dentro do parque hoje.', 'EPCOT', 'Hotel', 2, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-09', '08:00', '08:20', 'Kissimmee → Lake Buena Vista', 'Saída do hotel rumo ao EPCOT', 'transit', null, 'Vacation Village at Parkway → EPCOT', 'planned', null, true, 'Sair às 8h em ponto: ~20 min até o estacionamento e ~25 min de segurança e catracas.', 'EPCOT', 'Deslocamento', 3, null, null, 'none', false, false, null, false, 'operating', false, 'Depois de 8h15, cortar a foto na Spaceship Earth e ir direto para o Test Track.', false, null, null, null, false, 20),
    ('2026-09-09', '08:20', '08:45', 'Lake Buena Vista', 'Estacionamento, segurança e catracas', 'transit', null, 'EPCOT — Entrada Principal', 'planned', null, true, 'Fotografar a placa da vaga. Ingressos já abertos no My Disney Experience.', 'EPCOT', 'Entrada', 4, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-09', '08:45', '09:00', 'Lake Buena Vista', 'Posicionamento na entrada regular (rope drop)', 'transit', null, 'EPCOT — Entrada Principal', 'planned', null, true, 'Sem Early Entry hoje: estar na frente da catraca antes das 9h vale a manhã inteira.', 'EPCOT', 'Entrada', 5, null, null, 'none', false, false, null, false, 'operating', false, null, false, null, null, null, false, 0),
    ('2026-09-09', '09:00', '09:35', 'Lake Buena Vista', 'Test Track', 'park', null, 'EPCOT', 'planned', 102, true, 'Primeira atração do dia. Ir direto: sem fotos, sem loja, sem desvio.', 'EPCOT', 'World Discovery', 6, 'attraction', 'S', 'none', false, true, 'Primeiros 30 minutos do dia', false, 'operating', true, 'Se estiver em manutenção na abertura, inverter com Guardians e voltar às 20h20.', false, null, null, null, false, 30),
    ('2026-09-09', '09:35', '10:20', 'Lake Buena Vista', 'Guardians of the Galaxy: Cosmic Rewind', 'park', null, 'EPCOT', 'planned', 107, true, 'Conferir a espera antes de entrar na fila.', 'EPCOT', 'World Discovery', 7, 'attraction', 'S', 'none', false, true, null, false, 'operating', true, 'Fila acima de 75 min: pular agora e recuperar na Operação Resgate das 20h20.', true, null, null, null, false, 0),
    ('2026-09-09', '10:20', '10:45', 'Lake Buena Vista', 'Mission: SPACE – Green Mission', 'park', null, 'EPCOT', 'planned', 102, true, 'Versão Green (familiar). Quem quiser intensidade faz a Orange, que pede 112cm.', 'EPCOT', 'World Discovery', 8, 'attraction', 'B', 'none', false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '10:45', '11:10', 'Lake Buena Vista', 'Spaceship Earth', 'park', null, 'EPCOT', 'planned', null, true, 'Sem restrição de altura: todo mundo anda junto, inclusive a Gabi.', 'EPCOT', 'World Celebration', 9, 'attraction', 'A', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '11:10', '11:35', 'Lake Buena Vista', 'Journey Into Imagination with Figment', 'park', null, 'EPCOT', 'optional', null, true, 'Primeiro item a ser sacrificado se a manhã atrasar.', 'EPCOT', 'World Celebration', 10, 'attraction', 'B', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '11:35', '12:10', 'Lake Buena Vista', 'Soarin'' Around the World', 'park', null, 'EPCOT', 'planned', 102, true, 'Fila até 40 min: fazer agora. Acima disso, adiar.', 'EPCOT', 'World Nature', 11, 'attraction', 'S', 'none', false, true, null, false, 'operating', true, 'Fila acima de 40 min: adiar para a Operação Resgate das 20h20.', true, null, null, null, false, 0),
    ('2026-09-09', '12:10', '12:35', 'Lake Buena Vista', 'Living with the Land', 'park', null, 'EPCOT', 'planned', null, true, 'Barco com ar-condicionado — bom respiro no pico de calor.', 'EPCOT', 'World Nature', 12, 'attraction', 'A', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '12:35', '12:55', 'Lake Buena Vista', 'The Seas with Nemo & Friends', 'park', null, 'EPCOT', 'planned', null, true, null, 'EPCOT', 'World Nature', 13, 'attraction', 'A', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '12:55', '13:10', 'Lake Buena Vista', 'SeaBase Aquarium', 'park', null, 'EPCOT', 'optional', null, true, 'Pausa, banheiro e água. Teto rígido de 15 minutos.', 'EPCOT', 'World Nature', 14, 'experience', 'B', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '13:10', '13:35', 'Lake Buena Vista', 'Journey of Water, Inspired by Moana', 'park', null, 'EPCOT', 'planned', null, true, 'Percurso a pé, sem fila e sem restrição — tranquilo para a Gabi.', 'EPCOT', 'World Nature', 15, 'experience', 'B', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '13:35', '14:00', 'Lake Buena Vista', 'Travessia para o World Showcase (sentido México)', 'transit', null, 'EPCOT', 'planned', null, true, 'Atravessar direto até o México. Só voltamos ao Future World às 20h20.', 'EPCOT', 'Deslocamento', 16, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 15),
    ('2026-09-09', '14:00', '14:30', 'Lake Buena Vista', 'Gran Fiesta Tour Starring The Three Caballeros', 'park', null, 'EPCOT', 'planned', null, true, 'Dentro da pirâmide: fila curta e ar-condicionado.', 'EPCOT', 'México', 17, 'attraction', 'A', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '14:30', '14:55', 'Lake Buena Vista', 'Exploração do Pavilhão do México', 'park', null, 'EPCOT', 'optional', null, true, 'Mercado interno e fotos. Teto de 25 min: o Akershus é às 15h15.', 'EPCOT', 'México', 18, 'experience', 'C', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '15:15', '16:30', 'Lake Buena Vista', 'Akershus Royal Banquet Hall', 'restaurant', 'Reserva confirmada às 15h15. Refeição com as princesas, ~75 minutos.', 'EPCOT — Pavilhão da Noruega', 'confirmed', null, true, 'Âncora do dia. Chegar 15h00 no balcão — o resto do roteiro se move, esta reserva não.', 'EPCOT', 'Noruega', 19, 'character', null, 'none', false, false, null, false, 'operating', true, null, false, null, null, 15, false, 45),
    ('2026-09-09', '16:30', '17:15', 'Lake Buena Vista', 'Frozen Ever After', 'park', null, 'EPCOT', 'planned', null, true, 'Não sair da Noruega sem fazer: voltar aqui depois custa a travessia inteira.', 'EPCOT', 'Noruega', 20, 'attraction', 'S', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 15),
    ('2026-09-09', '17:15', '17:35', 'Lake Buena Vista', 'China — exploração e loja', 'park', null, 'EPCOT', 'optional', null, true, null, 'EPCOT', 'China', 21, 'experience', 'C', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '17:35', '17:55', 'Lake Buena Vista', 'Alemanha — exploração', 'park', null, 'EPCOT', 'optional', null, true, null, 'EPCOT', 'Alemanha', 22, 'experience', 'C', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '17:55', '18:10', 'Lake Buena Vista', 'Itália — fotos e exploração', 'park', null, 'EPCOT', 'optional', null, true, null, 'EPCOT', 'Itália', 23, 'experience', 'C', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '18:10', '18:30', 'Lake Buena Vista', 'Estados Unidos — pausa, água e banheiro', 'rest', null, 'EPCOT', 'planned', null, true, 'Última pausa longa do dia. Carregar celular antes do trecho final.', 'EPCOT', 'Estados Unidos', 24, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-09', '18:30', '18:55', 'Lake Buena Vista', 'Japão — Mitsukoshi (seção japonesa e Pokémon)', 'park', null, 'EPCOT', 'optional', null, true, 'Teto de 25 minutos: o Remy é às 19h10 e é a última atração-chave.', 'EPCOT', 'Japão', 25, 'experience', 'C', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '18:55', '19:10', 'Lake Buena Vista', 'Marrocos — travessia rápida', 'park', null, 'EPCOT', 'optional', null, true, null, 'EPCOT', 'Marrocos', 26, 'experience', 'C', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '19:10', '20:05', 'Lake Buena Vista', 'Remy''s Ratatouille Adventure', 'park', null, 'EPCOT', 'planned', null, true, 'Obrigatória. Aceitar a fila: sem Lightning Lane não existe segunda janela hoje.', 'EPCOT', 'França', 27, 'attraction', 'S', 'none', false, false, null, false, 'operating', true, 'Fila acima de 70 min: entrar mesmo assim e trocar a Operação Resgate pelo Luminous.', true, null, null, null, false, 30),
    ('2026-09-09', '20:05', '20:20', 'Lake Buena Vista', 'Reino Unido e Canadá — travessia', 'park', null, 'EPCOT', 'optional', null, true, 'Só passagem e foto. Sem loja: a Operação Resgate começa às 20h20.', 'EPCOT', 'Reino Unido / Canadá', 28, 'experience', 'C', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-09', '20:20', '20:35', 'Lake Buena Vista', 'Operação Resgate — escolher UMA pendência', 'event', null, 'EPCOT', 'planned', null, true, 'Abrir o My Disney Experience. Prioridade: Guardians › Soarin’ › Test Track › Remy › Frozen.', 'EPCOT', 'Fechamento', 29, null, null, 'none', false, false, null, false, 'operating', false, 'Se nada ficou pendente, ir direto para o Luminous no World Showcase Lagoon.', true, null, null, null, false, 20),
    ('2026-09-09', '20:35', '21:00', 'Lake Buena Vista', 'Fila final da pendência prioritária', 'park', null, 'EPCOT', 'optional', null, true, 'Entrar na fila antes das 21h — quem já está na fila no fechamento anda. Se cair numa das quatro de 102cm+, Rider Switch para a Gabi.', 'EPCOT', 'World Discovery / World Nature', 30, 'attraction', null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-09', '21:00', '21:20', 'Lake Buena Vista', 'Luminous: The Symphony of Us', 'park', null, 'World Showcase Lagoon', 'optional', null, true, 'Alternativa à fila final — não dá para fazer os dois. Posição 30 min antes.', 'EPCOT', 'Encerramento', 31, 'show', null, 'none', false, false, null, false, 'operating', true, null, false, '21:00', '21:20', 30, true, 40),
    ('2026-09-09', '21:20', '22:15', 'Lake Buena Vista → Kissimmee', 'Saída do EPCOT e retorno ao hotel', 'transit', null, 'EPCOT → Vacation Village at Parkway', 'planned', null, true, 'Fluxo de saída pesado. A vaga foi fotografada de manhã.', 'EPCOT', 'Deslocamento', 32, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0)
  ) as v(date, time_start, time_end, city, title, category, description, location, status, min_height_cm, child_friendly, notes, park, area, base_order, item_type, priority_tier, lightning_lane, single_rider, child_switch, recommended_window, early_closure_risk, operational_status, counts_toward_completion, plan_b, time_is_estimated, show_block_start, show_block_end, recommended_arrival_min_before, last_showtime_of_day, reminder_minutes_before);
  get diagnostics v_inseridos = row_count;

  raise notice 'EPCOT 09/09/2026: % item(ns) removido(s), % inserido(s) na viagem % para % participante(s).',
    v_apagados, v_inseridos, v_trip, cardinality(v_participants);
end $$;


-- =========================================================================
-- OPCIONAL — o roteiro original tinha o EPCOT em 08/09/2026.
-- Se aqueles itens ainda estiverem no banco como 'planned', eles ficam
-- pendurados na Cronologia como um dia de parque que não aconteceu, e ainda
-- contam na métrica de cobertura. Descomente para marcá-los como cancelados
-- (reversível: é só um UPDATE de status).
-- =========================================================================
-- update public.itinerary_items
--    set status = 'cancelled',
--        notes  = coalesce(notes || ' ', '') || '[Dia do EPCOT remarcado para 09/09/2026.]'
--  where date = date '2026-09-08'
--    and park = 'EPCOT'
--    and status = 'planned';
