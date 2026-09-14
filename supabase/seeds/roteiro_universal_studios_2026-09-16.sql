-- =========================================================================
-- Roteiro operacional do Universal Studios Florida — 16/09/2026 (Express Unlimited, fecha 17h por Halloween Horror Nights) + estrada para Miami
--
-- GERADO por scripts/gerarSeedRoteiro.ts. Editar o módulo TS e regerar, nunca
-- editar este arquivo à mão.
--
-- Gerado a partir de src/services/roteiro/universalStudiosDia16.ts.
--
-- 16/09 é data do Halloween Horror Nights (setembro: 2-6, 9-13, 16-20,
-- 23-27, 30): o parque fecha às 17h para ingresso normal. Isso resolve o
-- check-out do Royal Pacific (11h) e o check-in do Casa Faena em Miami
-- Beach — o dia termina na estrada, não no parque.
--
-- Como aplicar:
--   supabase db query --linked "$(cat supabase/seeds/roteiro_universal_studios_2026-09-16.sql)"
-- ou colar no SQL Editor do dashboard do projeto bkrqhividgljticgjrem.
--
-- É idempotente: apaga TODO item de itinerary_items da viagem em 2026-09-16
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
     where t.start_date <= date '2026-09-16'
       and t.end_date   >= date '2026-09-16'
     order by t.created_at
     limit 1;
  end if;

  if v_trip is null then
    raise exception 'Nenhuma viagem cobre 2026-09-16. Confirme o trip_id antes de rodar.';
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
     and date = date '2026-09-16';
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
    ('2026-09-16', '06:45', '07:15', 'Orlando', 'Acordar e fechar as malas', 'rest', null, 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Hoje as malas vão para o carro antes do parque — não dá para voltar ao quarto. Varrer cofre, gavetas e carregadores.', 'Universal Studios Florida', 'Hotel', 1, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 20),
    ('2026-09-16', '07:15', '07:45', 'Orlando', 'Check-out do Royal Pacific e carga do carro', 'rest', 'Check-out oficial é às 11h, mas a família sai antes para pegar o Early Park Admission das 8h.', 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'ATENÇÃO: separar os 4 cartões do Express Unlimited ANTES de fechar as malas — eles valem o dia inteiro de hoje e são o que sustenta o roteiro até as 17h.', 'Universal Studios Florida', 'Hotel', 2, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se a fila do check-out estiver grande, fazer express check-out pela TV/app e deixar as chaves na urna — a fatura chega por e-mail.', false, null, null, null, false, 15),
    ('2026-09-16', '07:45', '08:05', 'Orlando', 'Royal Pacific → Universal Studios Florida', 'transit', null, 'Universal''s Loews Royal Pacific Resort → Universal Studios Florida', 'planned', null, true, 'Deixar o carro no estacionamento do complexo (e não na doca do hotel): a saída às 17h já sai direto para a estrada.', 'Universal Studios Florida', 'Deslocamento', 3, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-16', '08:05', '08:30', 'Orlando', 'Early Park Admission — entrada e ida direta ao Beco Diagonal', 'transit', null, 'Universal Studios Florida', 'planned', null, true, 'Sem parar em Production Central. O Beco Diagonal fica no fundo à direita, depois da fachada de Londres — a entrada é o vão de tijolos, não tem placa.', 'Universal Studios Florida', 'Entrada', 4, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se o EPA de hoje for no Islands of Adventure em vez do Universal Studios, entrar mesmo assim às 9h e começar pelo Gringotts com Express.', false, null, null, null, false, 0),
    ('2026-09-16', '08:30', '09:10', 'Orlando', 'Harry Potter and the Escape from Gringotts', 'park', 'Único bloco do dia em que o Early Park Admission vale mais que o Express: a fila atravessa o saguão do banco, e vazia ela é metade da atração.', 'Universal Studios Florida', 'planned', 107, true, 'Gabi (112cm) passa (107cm) — a família anda junta. Bolsos vazios, lockers gratuitos na entrada.', 'Universal Studios Florida', 'Diagon Alley', 5, 'attraction', 'S', 'express', 1, false, false, 'Primeira hora, ainda no Early Park Admission', false, 'operating', true, null, false, null, null, null, false, 15),
    ('2026-09-16', '09:10', '09:45', 'Orlando', 'Beco Diagonal — Ollivanders, Travessa do Tranco e lojas', 'park', 'Ollivanders (a versão do Beco é maior que a de Hogsmeade), Knockturn Alley e o dragão no topo do Gringotts, que cospe fogo de tempos em tempos.', 'Universal Studios Florida', 'planned', null, true, 'Se a varinha interativa foi comprada no Hogsmeade, as vitrines daqui reagem a ela — é o melhor uso do brinquedo em toda a viagem.', 'Universal Studios Florida', 'Diagon Alley', 6, 'experience', 'A', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '09:45', '10:30', 'Orlando', 'Hogwarts Express — King''s Cross ↔ Hogsmeade (ida e volta)', 'park', 'Fecha o ingresso Park-to-Park: o trem só embarca quem pode trocar de parque, e as cenas da ida são diferentes das da volta.', 'Universal Studios Florida', 'planned', null, true, 'Ida, ~15 min no Hogsmeade e volta. Plataforma 9¾ com a passagem pela parede de tijolos — é a foto da Débora.', 'Universal Studios Florida', 'London', 7, 'attraction', 'A', 'none', null, false, false, null, false, 'operating', true, 'Se a fila de uma das pontas passar de 30 min, fazer só a ida, aproveitar o Hogsmeade e voltar pelo mesmo trem mais tarde — ou desistir da volta e sair pelo Islands of Adventure às 17h.', true, null, null, null, false, 15),
    ('2026-09-16', '10:30', '10:55', 'Orlando', 'Fast & Furious – Supercharged', 'park', null, 'Universal Studios Florida', 'optional', 102, true, 'A mais fraca do parque, mas fica exatamente no caminho entre Londres e New York — só entra por isso. Primeira a cair se o dia atrasar.', 'Universal Studios Florida', 'San Francisco', 8, 'attraction', 'C', 'express', 7, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '10:55', '11:30', 'Orlando', 'Revenge of the Mummy', 'park', 'Montanha-russa fechada com fogo real — o pedido da Débora desde o planejamento.', 'Universal Studios Florida', 'planned', 122, true, 'Única atração do parque em que a Gabi (112cm) fica de fora. Child Swap na plataforma; com Express custa ~10 min.', 'Universal Studios Florida', 'New York', 9, 'attraction', 'S', 'express', 2, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '11:30', '11:55', 'Orlando', 'Race Through New York Starring Jimmy Fallon', 'park', null, 'Universal Studios Florida', 'planned', 102, true, 'Família junta (102cm). Simulador suave — bom bloco logo depois da Múmia.', 'Universal Studios Florida', 'New York', 10, 'attraction', 'B', 'express', 6, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '11:55', '12:25', 'Orlando', 'Illumination''s Villain-Con Minion Blast', 'park', null, 'Universal Studios Florida', 'planned', 102, true, 'Tiro ao alvo em esteira rolante — pontuação por pessoa, e a Gabi entra (102cm).', 'Universal Studios Florida', 'Minion Land', 11, 'attraction', 'A', 'express', 5, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '12:25', '12:50', 'Orlando', 'Despicable Me Minion Mayhem', 'park', null, 'Universal Studios Florida', 'planned', 102, true, 'Simulador dos Minions. Há fileira estática para quem não quer movimento — pedir na entrada se a Gabi estiver cansada.', 'Universal Studios Florida', 'Minion Land', 12, 'attraction', 'A', 'express', 4, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '12:50', '13:35', 'Orlando', 'Almoço — Minion Cafe', 'restaurant', 'Quick service climatizado na própria Minion Land, com salão grande.', 'Universal Studios Florida', 'planned', null, true, 'Mobile order pelo app na fila do Minion Mayhem. ~US$ 80 para os 4.', 'Universal Studios Florida', 'Minion Land', 13, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, 10, false, 15),
    ('2026-09-16', '13:35', '14:00', 'Orlando', 'E.T. Adventure', 'park', null, 'Universal Studios Florida', 'planned', 86, true, 'Barra de 86cm e a única atração original de 1990 ainda de pé no parque. Dizem o nome da Gabi no fim do passeio se for informado na entrada.', 'Universal Studios Florida', 'Hollywood', 14, 'attraction', 'A', 'express', 8, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '14:00', '14:30', 'Orlando', 'The Bourne Stuntacular', 'park', 'Teatro fechado, ~25 min, dublês ao vivo sobre tela LED — o melhor show do complexo Universal.', 'Universal Studios Florida', 'planned', null, true, 'Express dá entrada prioritária. Conferir o horário da sessão no app — este bloco é a âncora da tarde.', 'Universal Studios Florida', 'Hollywood', 15, 'show', 'S', 'express', null, false, false, null, false, 'operating', true, null, false, '14:00', '14:25', 15, false, 20),
    ('2026-09-16', '14:30', '14:55', 'Orlando', 'Trolls Trollercoaster e DreamWorks Land', 'park', null, 'Universal Studios Florida', 'planned', 91, true, 'Área infantil com montanha-russa leve (91cm), praça de água e encontros de personagem — o bloco da Gabi no dia.', 'Universal Studios Florida', 'DreamWorks Land', 16, 'attraction', 'B', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '14:55', '15:25', 'Orlando', 'The Simpsons Ride', 'park', null, 'Universal Studios Florida', 'planned', 102, true, 'Simulador em cúpula, movimento forte para quem enjoa — se a Gabi já estiver cansada, é melhor ela e um adulto pularem.', 'Universal Studios Florida', 'Springfield', 17, 'attraction', 'A', 'express', 3, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '15:25', '15:50', 'Orlando', 'MEN IN BLACK Alien Attack', 'park', null, 'Universal Studios Florida', 'planned', 107, true, 'Tiro ao alvo competitivo — a pontuação final aparece no fim, e é a melhor disputa da viagem entre Pedro e Débora.', 'Universal Studios Florida', 'World Expo', 18, 'attraction', 'A', 'express', 9, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '15:50', '16:10', 'Orlando', 'Kang & Kodos'' Twirl ''n'' Hurl e Springfield', 'park', null, 'Universal Studios Florida', 'optional', 91, true, 'Bloco de folga antes da saída: a Gabi anda, e Springfield é a área com mais detalhe para fotografar do parque.', 'Universal Studios Florida', 'Springfield', 19, 'attraction', 'B', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '16:10', '16:40', 'Orlando', 'Compras finais — Universal Studios Store', 'shopping', null, 'Universal Studios Florida', 'planned', null, true, 'Última loja da fase Orlando. Comprar aqui e não na saída: às 16h40 o fluxo em direção aos portões já trava.', 'Universal Studios Florida', 'Production Central', 20, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-16', '16:40', '17:00', 'Orlando', 'Saída do parque antes do fechamento para o Halloween Horror Nights', 'transit', 'Hoje é noite de HHN: às 17h o parque é esvaziado de quem tem ingresso normal e reabre às 18h30 só para quem pagou o evento.', 'Universal Studios Florida', 'planned', null, true, 'Não é horário flexível — a equipe varre o parque das áreas do fundo para a frente. Estar fora dos portões às 17h.', 'Universal Studios Florida', 'Saída', 21, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se o esvaziamento começar antes, sair pelo CityWalk e esperar no estacionamento; o roteiro já tinha as compras como último bloco descartável.', false, null, null, null, false, 20),
    ('2026-09-16', '17:00', '17:30', 'Orlando', 'CityWalk → carro, banheiro e abastecimento', 'transit', null, 'Universal Orlando Resort', 'planned', null, true, 'Abastecer antes da Turnpike (posto mais barato fora do complexo, na Kirkman). Banheiro agora — a primeira parada da estrada é a 1h30 daqui.', 'Universal Studios Florida', 'Deslocamento', 22, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-16', '17:30', '19:00', 'Orlando → Fort Pierce', 'Estrada Orlando → Fort Pierce (Florida''s Turnpike)', 'transit', 'Primeira metade dos ~385 km até Miami Beach. SunPass já ativado na minivan (reserva 53YH2M).', 'Universal Orlando Resort → Florida''s Turnpike', 'planned', null, true, 'Saída às 17h30 pega o contrafluxo: o trânsito pesado da noite é de quem está CHEGANDO ao HHN. Casa Faena avisado de check-in tarde (+1 305-604-8485).', 'Universal Studios Florida', 'Estrada', 23, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se a I-4/Turnpike travar, a alternativa é a US-192 até a Turnpike em Yeehaw Junction — mais longa em km, mas sem o gargalo de Orlando.', false, null, null, null, false, 20),
    ('2026-09-16', '19:00', '19:45', 'Fort Pierce', 'Jantar na estrada — Fort Pierce Service Plaza', 'restaurant', null, 'Fort Pierce Service Plaza, Florida''s Turnpike', 'planned', null, true, 'Praça de serviço com banheiro, combustível e praça de alimentação — a última boa antes de Miami. Trocar de motorista aqui.', 'Universal Studios Florida', 'Estrada', 24, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-16', '19:45', '21:45', 'Fort Pierce → Miami Beach', 'Fort Pierce → Miami Beach', 'transit', null, 'Casa Faena Miami Beach', 'planned', null, true, 'Turnpike até a I-195 e a Julia Tuttle Causeway. Estacionamento do Casa Faena é valet — conferir a diária no check-in.', 'Universal Studios Florida', 'Estrada', 25, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-16', '21:45', '22:15', 'Miami Beach', 'Check-in no Casa Faena Miami Beach', 'rest', 'Reserva PPHHBQBQ, 3 noites, quarto familiar. Encerra a fase Orlando da viagem.', 'Casa Faena Miami Beach', 'planned', null, true, 'Avisar por telefone quando passar de Fort Lauderdale. 22.000 pontos ALL Reward já aplicados — conferir se a reserva entrou como pré-paga.', 'Universal Studios Florida', 'Hotel', 26, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 15)
  ) as v(date, time_start, time_end, city, title, category, description, location, status, min_height_cm, child_friendly, notes, park, area, base_order, item_type, priority_tier, lightning_lane, lightning_lane_priority_rank, single_rider, child_switch, recommended_window, early_closure_risk, operational_status, counts_toward_completion, plan_b, time_is_estimated, show_block_start, show_block_end, recommended_arrival_min_before, last_showtime_of_day, reminder_minutes_before);
  get diagnostics v_inseridos = row_count;

  raise notice 'Roteiro operacional do Universal Studios Florida 2026-09-16: % item(ns) removido(s), % inserido(s) na viagem % para % participante(s).',
    v_apagados, v_inseridos, v_trip, cardinality(v_participants);
end $$;
