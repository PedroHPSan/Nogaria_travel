-- =========================================================================
-- Roteiro operacional do Universal Studios Florida — 16/09/2026 (Express Unlimited, fecha 17h por Halloween Horror Nights) + estrada para Miami
--
-- GERADO por scripts/gerarSeedRoteiro.ts. Editar o módulo TS e regerar, nunca
-- editar este arquivo à mão.
--
-- Gerado a partir de src/services/roteiro/universalStudiosDia16.ts.
--
-- Terceira versão do dia: o Islands of Adventure NÃO foi coberto inteiro
-- no dia 14 (saída por imprevisto depois do Ripsaw Falls), então o
-- Hogwarts Express volta a ser plano de resgate — a família desce em
-- Hogsmeade às 9h20, pega Forbidden Journey, Hagrid's e o VelociCoaster
-- (nessa ordem) e volta ao Universal Studios às 11h35. Fast & Furious,
-- Horror Make-Up Show, Kang & Kodos e E.T. Adventure saem do anel da
-- tarde para abrir espaço.
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
    ('2026-09-16', '06:30', '07:00', 'Orlando', 'Acordar e fechar as malas', 'rest', null, 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Hoje as malas vão para o carro antes do parque — não dá para voltar ao quarto. Varrer cofre, gavetas e carregadores.', 'Universal Studios Florida', 'Hotel', 1, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 20),
    ('2026-09-16', '07:00', '07:30', 'Orlando', 'Check-out do Royal Pacific e carga do carro', 'rest', 'Check-out oficial é às 11h, mas a família sai antes para pegar o Early Park Admission das 8h.', 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'ATENÇÃO: separar os 4 cartões do Express Unlimited ANTES de fechar as malas — eles valem o dia inteiro de hoje e são o que sustenta o roteiro até as 17h. Conferir também a varinha interativa comprada no Hogsmeade: ela volta a funcionar hoje, no Beco Diagonal.', 'Universal Studios Florida', 'Hotel', 2, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se a fila do check-out estiver grande, fazer express check-out pela TV/app e deixar as chaves na urna — a fatura chega por e-mail.', false, null, null, null, false, 15),
    ('2026-09-16', '07:30', '07:50', 'Orlando', 'Royal Pacific → Universal Studios Florida', 'transit', null, 'Universal''s Loews Royal Pacific Resort → Universal Studios Florida', 'planned', null, true, 'Deixar o carro no estacionamento do complexo (e não na doca do hotel): a saída às 17h já sai direto para a estrada. Anotar o andar e a fileira — às 17h o estacionamento estará enchendo de público do HHN.', 'Universal Studios Florida', 'Deslocamento', 3, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-16', '07:50', '08:10', 'Orlando', 'Early Park Admission — entrada e ida direta ao Beco Diagonal', 'transit', null, 'Universal Studios Florida', 'planned', null, true, 'Sem parar em Production Central. O Beco Diagonal fica no fundo à direita, depois da fachada de Londres — a entrada é o vão de tijolos entre as casas, não tem placa.', 'Universal Studios Florida', 'Entrada', 4, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se o Early Park Admission de hoje for no Islands of Adventure em vez do Universal Studios (a Universal alterna), entrar mesmo assim às 9h e começar pelo Gringotts com Express: perde-se o Beco vazio, não a atração.', false, null, null, null, false, 0),
    ('2026-09-16', '08:10', '08:50', 'Orlando', 'Harry Potter and the Escape from Gringotts', 'park', 'Único bloco do dia em que o Early Park Admission vale mais que o Express: a fila atravessa o saguão do banco, e vazia ela é metade da atração.', 'Universal Studios Florida', 'planned', 107, true, 'Gabi (112cm) passa (107cm) — a família anda junta e não há Child Swap aqui. Bolsos vazios, lockers gratuitos na entrada.', 'Universal Studios Florida', 'Diagon Alley', 5, 'attraction', 'S', 'express', 1, false, false, 'Primeira hora, ainda no Early Park Admission', false, 'operating', true, null, false, null, null, null, false, 15),
    ('2026-09-16', '08:50', '09:20', 'Orlando', 'Beco Diagonal — Ollivanders, Travessa do Tranco e o dragão do Gringotts', 'park', 'A versão do Ollivanders aqui é maior que a de Hogsmeade, e a Knockturn Alley é a única rua coberta e noturna do complexo.', 'Universal Studios Florida', 'planned', null, true, 'Com a varinha interativa do dia 14, as vitrines do Beco reagem a ela — é o melhor uso do brinquedo em toda a viagem, e os medalhões de bronze no chão marcam onde cada feitiço funciona. O dragão no topo do Gringotts cospe fogo a cada ~10 min. Se passarem shows de rua (Tales of Beedle the Bard, Celestina Warbeck), eles acontecem no palco do Carkitt Market — 15 min cada, sem fila.', 'Universal Studios Florida', 'Diagon Alley', 6, 'experience', 'A', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '09:20', '09:35', 'Orlando', 'Hogwarts Express — King''s Cross → Hogsmeade (ida), resgate do Islands of Adventure', 'park', 'Fecha o ingresso Park-to-Park: o trem só embarca quem pode trocar de parque, e as cenas da ida são diferentes das da volta.', 'Universal Studios Florida', 'planned', null, true, 'Plataforma 9¾ com a passagem pela parede de tijolos — é a foto da Débora. Hoje o trem não é passeio isolado: leva ao resgate de Forbidden Journey, Hagrid''s e VelociCoaster, que ficaram pra trás no dia 14.', 'Universal Studios Florida', 'London', 7, 'attraction', 'A', 'none', null, false, false, null, false, 'operating', true, 'Se a fila de qualquer uma das pontas passar de 30 min, o resgate inteiro fica arriscado para o horário do HHN — pular direto para o anel do Universal Studios e aceitar a perda das três atrações.', true, null, null, null, false, 15),
    ('2026-09-16', '09:35', '09:55', 'Orlando', 'Harry Potter and the Forbidden Journey', 'park', 'Braço robótico dentro do castelo de Hogwarts — e a fila atravessa a estufa, o escritório do Dumbledore e a sala dos retratos falantes.', 'Universal''s Islands of Adventure', 'planned', 122, true, 'Gabi (112cm) fora — primeira troca do resgate. Abre o bloco porque tem Express e libera rápido, deixando mais fila da manhã disponível para o Hagrid''s logo depois.', 'Universal Studios Florida', 'Hogsmeade', 8, 'attraction', 'S', 'express', 2, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '09:55', '10:25', 'Orlando', 'Hagrid''s Magical Creatures Motorbike Adventure', 'park', 'Única atração forte do complexo que NÃO aceita Universal Express — e a melhor montanha-russa do Islands of Adventure.', 'Universal''s Islands of Adventure', 'planned', 122, true, 'Entra logo depois do Forbidden Journey de propósito: às 10h a fila ainda é de manhã, não a de fim de tarde que fez este mesmo bloco virar o último do dia 14. Débora vai com um adulto; a Gabi fica com o outro nas lojas de Hogsmeade e o grupo se reencontra na saída.', 'Universal Studios Florida', 'Hogsmeade', 9, 'attraction', 'S', 'none', null, false, false, 'Logo depois da abertura, antes de a fila da manhã crescer', false, 'operating', true, 'Se a fila publicada passar de 40 min, cortar aqui: sem Express, é o bloco mais caro do resgate, e VelociCoaster (também 130cm, também Child Swap, mas COM Express) é a prioridade seguinte se o relógio apertar.', true, null, null, null, false, 0),
    ('2026-09-16', '10:25', '10:35', 'Orlando', 'Travessia Hogsmeade → Jurassic Park', 'transit', null, 'Universal''s Islands of Adventure', 'planned', null, true, 'A ponte de Jurassic Park cai direto no vilarejo de Hogsmeade — mesma travessia que fecharia o dia 14, só que na direção contrária.', 'Universal Studios Florida', 'Deslocamento', 10, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-16', '10:35', '11:00', 'Orlando', 'Jurassic World VelociCoaster', 'park', 'A melhor montanha-russa do complexo Universal e o pedido nº1 da Débora desde o planejamento — a atração que este resgate existe para garantir.', 'Universal''s Islands of Adventure', 'planned', 130, true, 'Gabi (112cm) fora — segunda e última troca do resgate. Com Express, ~10-15 min de custo real.', 'Universal Studios Florida', 'Jurassic Park', 11, 'attraction', 'S', 'express', 1, false, true, null, false, 'operating', true, null, true, null, null, null, false, 15),
    ('2026-09-16', '11:00', '11:15', 'Orlando', 'Raptor Encounter', 'park', 'Encontro com o velociraptor Blue, com tratador em cena — sem fila paga e sem altura mínima.', 'Universal''s Islands of Adventure', 'optional', null, true, 'Bônus do resgate, só se o grupo sair do VelociCoaster no horário: é o primeiro a cair se o dia atrasar, porque não custa uma atração forte, só tempo.', 'Universal Studios Florida', 'Jurassic Park', 12, 'character', 'A', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '11:15', '11:35', 'Orlando', 'Hogwarts Express — Hogsmeade → King''s Cross (volta)', 'transit', null, 'Universal''s Islands of Adventure → Universal Studios Florida', 'planned', null, true, 'Fecha o resgate e devolve a família ao Universal Studios para o anel da tarde, que começa direto em New York — sem repassar por San Francisco.', 'Universal Studios Florida', 'Deslocamento', 13, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-16', '11:35', '12:10', 'Orlando', 'Revenge of the Mummy', 'park', 'Montanha-russa fechada com fogo real — o pedido da Débora desde o planejamento.', 'Universal Studios Florida', 'planned', 122, true, 'Única atração do anel da tarde em que a Gabi (112cm) fica de fora: Child Swap na plataforma, ~10 min com Express. Enquanto isso, a Gabi e um adulto veem o The Blues Brothers Show, que toca na esquina da Delancey Street.', 'Universal Studios Florida', 'New York', 14, 'attraction', 'S', 'express', 3, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '12:10', '12:30', 'Orlando', 'Race Through New York Starring Jimmy Fallon', 'park', null, 'Universal Studios Florida', 'planned', 102, true, 'Família junta (102cm). Simulador suave — bom bloco logo depois da Múmia, e o saguão com os cenários do Tonight Show vale a espera.', 'Universal Studios Florida', 'New York', 15, 'attraction', 'B', 'express', 7, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '12:30', '13:00', 'Orlando', 'TRANSFORMERS: The Ride-3D', 'park', 'Simulador sobre trilho com telas 3D de 18m — a melhor atração de tela do complexo e a que mais se aproxima do VelociCoaster em intensidade sem tirar a Gabi.', 'Universal Studios Florida', 'planned', 102, true, 'Os 4 andam juntos (102cm): é a atração forte de maior alcance da tarde. Movimento brusco — se a Gabi enjoar no Fallon, pular esta.', 'Universal Studios Florida', 'Production Central', 16, 'attraction', 'S', 'express', 4, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '13:00', '13:25', 'Orlando', 'Illumination''s Villain-Con Minion Blast', 'park', null, 'Universal Studios Florida', 'planned', 102, true, 'Tiro ao alvo em esteira rolante — pontuação por pessoa, e a Gabi entra (102cm).', 'Universal Studios Florida', 'Minion Land', 17, 'attraction', 'A', 'express', 6, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '13:25', '13:50', 'Orlando', 'Despicable Me Minion Mayhem', 'park', null, 'Universal Studios Florida', 'planned', 102, true, 'Simulador dos Minions. Há fileira estática para quem não quer movimento — pedir na entrada se a Gabi já estiver cansada de tela.', 'Universal Studios Florida', 'Minion Land', 18, 'attraction', 'A', 'express', 5, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '13:50', '14:30', 'Orlando', 'Almoço — Minion Cafe', 'restaurant', 'Quick service climatizado na própria Minion Land, com salão grande.', 'Universal Studios Florida', 'planned', null, true, 'Mobile order pelo app ainda na fila do Minion Mayhem. ~US$ 80 para os 4. É a última refeição sentada antes de Fort Pierce, às 19h — comer de verdade aqui.', 'Universal Studios Florida', 'Minion Land', 19, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, 10, false, 15),
    ('2026-09-16', '14:30', '15:00', 'Orlando', 'The Bourne Stuntacular', 'park', 'Teatro fechado, ~25 min, dublês ao vivo sobre tela LED — o melhor show do complexo Universal.', 'Universal Studios Florida', 'planned', null, true, 'Express dá entrada prioritária. CONFERIR o horário da sessão no app logo cedo: é o único bloco do dia com hora marcada de verdade, e tudo entre ele e o resgate da manhã desliza para encaixá-lo. E.T. Adventure não entra mais nesta versão do dia — saiu para abrir espaço ao resgate do Islands of Adventure; se sobrar tempo depois do Bourne, é a única atração que ainda cabe (86cm, ~20 min).', 'Universal Studios Florida', 'Hollywood', 20, 'show', 'S', 'express', null, false, false, null, false, 'operating', true, null, false, '14:30', '14:55', 15, false, 20),
    ('2026-09-16', '15:00', '15:25', 'Orlando', 'DreamWorks Land — Trolls Trollercoaster e Shrek''s Swamp', 'park', 'Área infantil inteira: montanha-russa leve (91cm), a praça de água do Shrek e o Po''s Kung Fu Training Camp.', 'Universal Studios Florida', 'planned', 91, true, 'O bloco da Gabi na tarde, e o único em que ela lidera. Roupa de troca no carro, não na mochila: a praça de água molha.', 'Universal Studios Florida', 'DreamWorks Land', 21, 'attraction', 'B', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '15:25', '15:50', 'Orlando', 'The Simpsons Ride', 'park', null, 'Universal Studios Florida', 'planned', 102, true, 'Simulador em cúpula, movimento forte para quem enjoa — se a Gabi já estiver cansada, é melhor ela e um adulto pularem e ficarem em Springfield mesmo, olhando a área (Moe''s, Kwik-E-Mart, a estátua do Jebediah).', 'Universal Studios Florida', 'Springfield', 22, 'attraction', 'A', 'express', 8, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '15:50', '16:15', 'Orlando', 'MEN IN BLACK Alien Attack', 'park', 'Última atração do dia e da fase Orlando inteira.', 'Universal Studios Florida', 'planned', 107, true, 'Tiro ao alvo competitivo — a pontuação final aparece no fim, e é a melhor disputa da viagem entre Pedro e Débora. A Gabi entra (107cm). Kang & Kodos'' Twirl ''n'' Hurl (ao lado, sem Express, 91cm) não entra mais nesta versão do dia — sai junto com o Fast & Furious e o Horror Make-Up Show para abrir espaço ao resgate da manhã.', 'Universal Studios Florida', 'World Expo', 23, 'attraction', 'A', 'express', 9, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-16', '16:15', '16:40', 'Orlando', 'Compras finais — Universal Studios Store', 'shopping', null, 'Universal Studios Florida', 'planned', null, true, 'Caminhada do World Expo até a loja da entrada é ~8 min e fecha o anel do dia sem repetir trecho. Última loja da fase Orlando: comprar aqui e não na saída, porque perto das 17h o fluxo em direção aos portões já trava.', 'Universal Studios Florida', 'Production Central', 24, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 10),
    ('2026-09-16', '16:40', '17:00', 'Orlando', 'Saída do parque antes do fechamento para o Halloween Horror Nights', 'transit', 'Hoje é noite de HHN: às 17h o parque é esvaziado de quem tem ingresso normal e reabre às 18h30 só para quem pagou o evento.', 'Universal Studios Florida', 'planned', null, true, 'Não é horário flexível — a equipe varre o parque das áreas do fundo para a frente, e World Expo/Springfield são as primeiras a serem limpas. Estar fora dos portões às 17h. O resgate da manhã consumiu quase toda a folga do dia original: estes 20 min (dobro dos 10 min da versão anterior) são o único amortecedor que sobrou — se o dia atrasar em qualquer bloco anterior, é aqui que o atraso aparece primeiro.', 'Universal Studios Florida', 'Saída', 25, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se o esvaziamento começar antes, sair pelo CityWalk e esperar no estacionamento; o roteiro já tinha as compras como último bloco descartável.', false, null, null, null, false, 20),
    ('2026-09-16', '17:00', '17:30', 'Orlando', 'CityWalk → carro, banheiro e abastecimento', 'transit', null, 'Universal Orlando Resort', 'planned', null, true, 'Abastecer antes da Turnpike (posto mais barato fora do complexo, na Kirkman). Banheiro agora — a primeira parada da estrada é a 1h30 daqui. Roupa de troca da Gabi antes de entrar no carro.', 'Universal Studios Florida', 'Deslocamento', 26, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-16', '17:30', '19:00', 'Orlando → Fort Pierce', 'Estrada Orlando → Fort Pierce (Florida''s Turnpike)', 'transit', 'Primeira metade dos ~385 km até Miami Beach. SunPass já ativado na minivan (reserva 53YH2M).', 'Universal Orlando Resort → Florida''s Turnpike', 'planned', null, true, 'Saída às 17h30 pega o contrafluxo: o trânsito pesado da noite é de quem está CHEGANDO ao HHN. Casa Faena avisado de check-in tarde (+1 305-604-8485).', 'Universal Studios Florida', 'Estrada', 27, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se a I-4/Turnpike travar, a alternativa é a US-192 até a Turnpike em Yeehaw Junction — mais longa em km, mas sem o gargalo de Orlando.', false, null, null, null, false, 20),
    ('2026-09-16', '19:00', '19:45', 'Fort Pierce', 'Jantar na estrada — Fort Pierce Service Plaza', 'restaurant', null, 'Fort Pierce Service Plaza, Florida''s Turnpike', 'planned', null, true, 'Praça de serviço com banheiro, combustível e praça de alimentação — a última boa antes de Miami. Trocar de motorista aqui.', 'Universal Studios Florida', 'Estrada', 28, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-16', '19:45', '21:45', 'Fort Pierce → Miami Beach', 'Fort Pierce → Miami Beach', 'transit', null, 'Casa Faena Miami Beach', 'planned', null, true, 'Turnpike até a I-195 e a Julia Tuttle Causeway. Estacionamento do Casa Faena é valet — conferir a diária no check-in.', 'Universal Studios Florida', 'Estrada', 29, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-16', '21:45', '22:15', 'Miami Beach', 'Check-in no Casa Faena Miami Beach', 'rest', 'Reserva PPHHBQBQ, 3 noites, quarto familiar. Encerra a fase Orlando da viagem.', 'Casa Faena Miami Beach', 'planned', null, true, 'Avisar por telefone quando passar de Fort Lauderdale. 22.000 pontos ALL Reward já aplicados — conferir se a reserva entrou como pré-paga.', 'Universal Studios Florida', 'Hotel', 30, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 15)
  ) as v(date, time_start, time_end, city, title, category, description, location, status, min_height_cm, child_friendly, notes, park, area, base_order, item_type, priority_tier, lightning_lane, lightning_lane_priority_rank, single_rider, child_switch, recommended_window, early_closure_risk, operational_status, counts_toward_completion, plan_b, time_is_estimated, show_block_start, show_block_end, recommended_arrival_min_before, last_showtime_of_day, reminder_minutes_before);
  get diagnostics v_inseridos = row_count;

  raise notice 'Roteiro operacional do Universal Studios Florida 2026-09-16: % item(ns) removido(s), % inserido(s) na viagem % para % participante(s).',
    v_apagados, v_inseridos, v_trip, cardinality(v_participants);
end $$;
