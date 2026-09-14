-- =========================================================================
-- Roteiro operacional do Islands of Adventure — 14/09/2026 (replanejado no balcão do Royal Pacific, com Universal Express Unlimited)
--
-- GERADO por scripts/gerarSeedRoteiro.ts. Editar o módulo TS e regerar, nunca
-- editar este arquivo à mão.
--
-- Gerado a partir de src/services/roteiro/islandsOfAdventureDia14.ts.
--
-- Terceira versão do dia, feita com a família já no Royal Pacific às 11h52.
-- O check-out e a estrada entram como `completed` (histórico, não lixo), e
-- o registro no balcão roda EM PARALELO com o almoço grab-and-go: 35 min em
-- vez de 60, o que põe a família no parque às 13h em vez de 13h35 — 7h de
-- parque contra as ~4h do plano original. O tempo ganho comprou o Seuss
-- Trolley Train no bloco de abertura e uma pausa real de 20 min depois dos
-- dois blocos molhados. Hagrid's não aceita Express e por isso é o último
-- bloco. Gabi (112cm) fica de fora de 5 das 6 atrações mais fortes: 4 viram
-- Child Swap com Express.
--
-- ATENÇÃO: este seed apaga o dia inteiro antes de inserir. Os dois blocos já
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
    ('2026-09-14', '11:55', '12:30', 'Orlando', 'Registro no Royal Pacific + Express Unlimited (com o almoço em paralelo)', 'rest', 'O bloco mais importante do dia. O Universal Express Unlimited dos 4 hóspedes é entregue no balcão, junto com as chaves — é o que sustenta os dias 14 e 16.', 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'DIVIDIR: um adulto fica na fila do balcão, o outro leva as meninas ao Tuk Tuk Market e compra o almoço para levar (~US$ 45). Fazer em série custaria 60 min; em paralelo custa 35, e são esses 35 min que compram a entrada no parque às 13h em vez de 13h35. No balcão: pedir os 4 cartões Express, conferir que valem HOJE e em 16/09 (dia do check-out), e deixar as malas no Bell Services — o quarto só libera às 16h.', 'Universal''s Islands of Adventure', 'Hotel', 3, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se o balcão se recusar a emitir o Express antes das 16h, insistir com o gerente de plantão — o benefício é do dia de chegada. Sem ele, inverter o dia: Seuss Landing e Hogsmeade primeiro, filas grandes só depois das 16h com os cartões na mão.', false, null, null, null, false, 0),
    ('2026-09-14', '12:30', '12:50', 'Orlando', 'Royal Pacific → Islands of Adventure', 'transit', null, 'Universal''s Loews Royal Pacific Resort → Universal''s Islands of Adventure', 'planned', null, true, 'Water taxi na doca do hotel ou a trilha a pé até o CityWalk — os dois dão ~12 min. Com o carrinho da Gabi, a caminhada é mais previsível que a fila do barco. Comer o grab-and-go no caminho ou nos bancos do Port of Entry.', 'Universal''s Islands of Adventure', 'Deslocamento', 4, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 10),
    ('2026-09-14', '12:50', '13:00', 'Orlando', 'Entrada, segurança e conferência do horário de fechamento', 'transit', 'Ingresso Park-to-Park no app Universal Orlando Resort, com os cartões Express na mesma carteira digital.', 'Universal''s Islands of Adventure', 'planned', null, true, 'Conferir no app o fechamento de hoje (previsto 20h) — é o número que decide a hora de entrar na fila do Hagrid''s no fim do dia. Anotar também o horário das sessões do Ollivanders.', 'Universal''s Islands of Adventure', 'Entrada', 5, null, null, 'none', null, false, false, null, false, 'operating', false, 'Se o fechamento for antes das 20h, cortar o bloco do Camp Jurassic e antecipar o jantar em 30 min: tudo depois dele desliza junto e o Hagrid''s continua sendo o último.', true, null, null, null, false, 0),
    ('2026-09-14', '13:00', '13:35', 'Orlando', 'Seuss Landing — Caro-Seuss-el, One Fish Two Fish, The Cat in the Hat e Trolley Train', 'park', 'Quatro atrações leves em sequência, todas dentro da altura da Gabi (91cm), a 5 min do Port of Entry. O Trolley Train entrou com os 35 min ganhos no balcão.', 'Universal''s Islands of Adventure', 'planned', 91, true, 'Único bloco em que a Gabi lidera, e é de propósito que ele venha ANTES da sequência de 137/132/130cm que a barra. O Trolley Train carrega devagar: se a fila dele passar de 15 min, trocar pelo If I Ran the Zoo ao lado e seguir.', 'Universal''s Islands of Adventure', 'Seuss Landing', 6, 'attraction', 'B', 'express', 10, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '13:35', '13:55', 'Orlando', 'The Amazing Adventures of Spider-Man', 'park', 'Simulador 3D sobre trilho — a atração forte de maior alcance do dia.', 'Universal''s Islands of Adventure', 'planned', 102, true, 'Os 4 andam juntos (102cm). Inclui a travessia Seuss → Marvel pelo Port of Entry, ~6 min.', 'Universal''s Islands of Adventure', 'Marvel Super Hero Island', 7, 'attraction', 'S', 'express', 3, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '13:55', '14:20', 'Orlando', 'The Incredible Hulk Coaster', 'park', 'Lançamento de 0 a 65 km/h dentro do tubo verde — a primeira das quatro trocas do dia.', 'Universal''s Islands of Adventure', 'planned', 137, true, 'Gabi (112cm) fica de fora. Child Swap: avisar o atendente na entrada da fila Express, subir os 4 até a plataforma, um adulto espera com a Gabi na sala de troca e anda na volta do outro. Com Express, ~10 min de custo. Bolsos vazios — lockers gratuitos na entrada.', 'Universal''s Islands of Adventure', 'Marvel Super Hero Island', 8, 'attraction', 'S', 'express', 4, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '14:20', '14:40', 'Orlando', 'Doctor Doom''s Fearfall', 'park', 'Torre de lançamento de 61m — curta, e a melhor vista do parque no topo.', 'Universal''s Islands of Adventure', 'planned', 132, true, 'Gabi (112cm) fora, Child Swap de novo. Enquanto isso, quem estiver com ela faz o Storm Force Accelatron ao lado (sem altura mínima, xícaras giratórias) e o encontro dos heróis Marvel, que costuma acontecer na esquina da Cafe 4.', 'Universal''s Islands of Adventure', 'Marvel Super Hero Island', 9, 'attraction', 'A', 'express', 8, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '14:40', '15:05', 'Orlando', 'Dudley Do-Right''s Ripsaw Falls', 'park', 'Queda de 15m em tronco. Molha de verdade — não é respingo.', 'Universal''s Islands of Adventure', 'planned', 112, true, 'Barra de 44in = 111,8cm: a Gabi passa por 2mm, de tênis. Medir na entrada ANTES de entrar na fila, para não descobrir na plataforma. Celulares e a mochila no locker, não no colo. É o pico do calor do dia — é agora que os dois blocos molhados fazem sentido.', 'Universal''s Islands of Adventure', 'Toon Lagoon', 10, 'attraction', 'A', 'express', 5, false, false, null, false, 'operating', true, 'Se ela não passar na medição, ela e um adulto vão ao Me Ship, the Olive (sem altura mínima, ao lado, com canhões de água) e o grupo se reencontra na saída do tronco.', true, null, null, null, false, 0),
    ('2026-09-14', '15:05', '15:25', 'Orlando', 'Popeye & Bluto''s Bilge-Rat Barges', 'park', 'Bote circular em corredeira — o mais molhado do complexo Universal, sem exagero.', 'Universal''s Islands of Adventure', 'optional', 107, true, 'Gabi (112cm) passa. Encharca todo mundo, então é o primeiro bloco a cair se alguém estiver reclamando do frio do ar-condicionado. Poncho ajuda pouco aqui.', 'Universal''s Islands of Adventure', 'Toon Lagoon', 11, 'attraction', 'A', 'express', 6, false, false, null, false, 'operating', true, 'Se o grupo não topar molhar de novo, pular e alongar a pausa seguinte para 40 min.', true, null, null, null, false, 0),
    ('2026-09-14', '15:25', '15:45', 'Orlando', 'Pausa — secar, banheiro e sorvete', 'rest', 'Bloco novo, comprado com os 35 min ganhos no balcão do hotel.', 'Universal''s Islands of Adventure', 'planned', null, true, 'Não é folga: é o que segura a Gabi (4 anos) de pé até as 20h. Banheiro, troca de camiseta, garrafas cheias e protetor solar. Se o dia estourar o relógio, este bloco encolhe antes de qualquer atração.', 'Universal''s Islands of Adventure', 'Toon Lagoon', 12, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-14', '15:45', '16:05', 'Orlando', 'Skull Island: Reign of Kong', 'park', 'Caminhão-simulador em meio a animatrônicos em tamanho real. Escuro, alto e com sustos reais.', 'Universal''s Islands of Adventure', 'planned', 91, true, 'A Gabi passa na altura (91cm), mas 4 anos é a idade em que esta atração assusta de verdade. Decidir na entrada, olhando a fila temática — se ela travar ali, já é resposta.', 'Universal''s Islands of Adventure', 'Skull Island', 13, 'attraction', 'A', 'express', 7, false, false, null, false, 'operating', true, 'Se a Gabi recusar, ela e um adulto seguem direto para o Camp Jurassic (5 min adiante) e o grupo se reencontra na saída do Kong.', true, null, null, null, false, 0),
    ('2026-09-14', '16:05', '16:35', 'Orlando', 'Jurassic World VelociCoaster', 'park', 'A melhor montanha-russa do complexo Universal e o pedido nº 1 da Débora desde o planejamento.', 'Universal''s Islands of Adventure', 'planned', 130, true, 'Gabi (112cm) fora — terceira troca do dia, e a que mais compensa fazer com calma: a sala de Child Swap fica com vista para o lançamento. Nada solto nos bolsos; lockers gratuitos na entrada.', 'Universal''s Islands of Adventure', 'Jurassic Park', 14, 'attraction', 'S', 'express', 1, false, true, 'Meio da tarde, com luz para a vista do topo e antes da fila de fim de dia', false, 'operating', true, null, true, null, null, null, false, 20),
    ('2026-09-14', '16:35', '16:50', 'Orlando', 'Raptor Encounter', 'park', 'Encontro com o velociraptor Blue, com tratador em cena — o melhor bloco do dia para foto com a Gabi.', 'Universal''s Islands of Adventure', 'planned', null, true, 'Sem altura mínima e sem fila paga. O raptor avança na direção de quem se mexe: segurar a Gabi no colo na primeira aproximação.', 'Universal''s Islands of Adventure', 'Jurassic Park', 15, 'character', 'A', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '16:50', '17:15', 'Orlando', 'Camp Jurassic e Discovery Center', 'park', 'Playground temático em três níveis (redes, cavernas, canhões de água) e o centro de visitantes com o laboratório de DNA.', 'Universal''s Islands of Adventure', 'optional', null, true, 'Onde a Gabi gasta energia sem fila, antes das 2h30 finais em Hogsmeade. O Pteranodon Flyers fica ao lado e a Gabi habilita um adulto (a regra é 92-137cm), mas cobra 30-40 min de fila SEM Express por 1 min de voo: só se a espera estiver abaixo de 20 min.', 'Universal''s Islands of Adventure', 'Jurassic Park', 16, 'experience', 'B', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '17:15', '17:30', 'Orlando', 'Travessia Jurassic Park → Hogsmeade', 'transit', null, 'Universal''s Islands of Adventure', 'planned', null, true, 'A ponte de Jurassic Park cai direto no vilarejo — é a melhor entrada do parque, vale chegar olhando para o castelo e não para o celular.', 'Universal''s Islands of Adventure', 'Deslocamento', 17, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 10),
    ('2026-09-14', '17:30', '18:10', 'Orlando', 'Jantar no Three Broomsticks + Butterbeer', 'restaurant', 'Quick service dentro do salão do Três Vassouras: frango assado, costela e shepherd''s pie. O restaurante temático mais bem resolvido de Orlando.', 'Universal''s Islands of Adventure', 'planned', null, true, 'Mobile order pelo app ainda na travessia — às 17h30 o salão enche. Butterbeer gelada (não a frozen) se a fila da frozen estiver grande. ~US$ 90 para os 4. Jantar aqui elimina uma travessia inteira e entrega Hogsmeade iluminado para o resto da noite.', 'Universal''s Islands of Adventure', 'Hogsmeade', 18, null, null, 'none', null, false, false, null, false, 'operating', false, null, false, null, null, 10, false, 15),
    ('2026-09-14', '18:10', '18:40', 'Orlando', 'Harry Potter and the Forbidden Journey', 'park', 'Braço robótico dentro do castelo de Hogwarts — e a fila atravessa a estufa, o escritório do Dumbledore e a sala dos retratos falantes.', 'Universal''s Islands of Adventure', 'planned', 122, true, 'Gabi (112cm) fora — quarta e última troca do dia. Quem fizer o Child Swap deve pedir para percorrer a fila do castelo mesmo sem andar: ela vale por si só, e é a única parte que a Gabi pode ver.', 'Universal''s Islands of Adventure', 'Hogsmeade', 19, 'attraction', 'S', 'express', 2, false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '18:40', '19:00', 'Orlando', 'Flight of the Hippogriff', 'park', 'Montanha-russa familiar que passa pela cabana do Hagrid e pelo Bicuço.', 'Universal''s Islands of Adventure', 'planned', 91, true, 'A única de Hogsmeade em que a Gabi anda — e a compensação direta das três atrações que acabaram de barrá-la.', 'Universal''s Islands of Adventure', 'Hogsmeade', 20, 'attraction', 'A', 'express', 9, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '19:00', '19:25', 'Orlando', 'Ollivanders, Honeydukes e Dervish & Banges', 'park', 'Cerimônia de escolha da varinha (uma criança por sessão), doces do Honeydukes e o vilarejo já sob a luz noturna.', 'Universal''s Islands of Adventure', 'planned', null, true, 'Conferir o horário da última sessão do Ollivanders ao entrar na loja — em noite de fechamento às 20h costuma ser por volta das 19h40. Varinha interativa ~US$ 65: decidir aqui, é o pedido recorrente da Débora, e ela volta a funcionar no Beco Diagonal no dia 16.', 'Universal''s Islands of Adventure', 'Hogsmeade', 21, 'experience', 'A', 'none', null, false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-14', '19:25', '20:05', 'Orlando', 'Hagrid''s Magical Creatures Motorbike Adventure', 'park', 'Única atração forte do parque que NÃO aceita Universal Express — por isso é o último bloco do dia.', 'Universal''s Islands of Adventure', 'planned', 122, true, 'Entrar na fila até 19h50, com folga sobre o fechamento das 20h: quem já está na fila anda, mesmo depois de o parque fechar. Débora vai com um adulto; a Gabi fica com o outro nas lojas de Hogsmeade, que atendem ~30 min depois do fechamento, e todos se reencontram na saída do vilarejo.', 'Universal''s Islands of Adventure', 'Hogsmeade', 22, 'attraction', 'S', 'none', null, false, false, 'Últimos 30 minutos antes do fechamento das 20h', false, 'operating', true, 'Se a fila do Hagrid''s já estiver fechada (acontece quando a espera ultrapassa o horário do parque) ou se ele estiver em pane — o que é frequente —, a alternativa é o Hogwarts Express no dia 16, que devolve a família ao Hogsmeade; mas aí é sem Express e com o relógio do Halloween Horror Nights correndo.', true, null, null, null, false, 15),
    ('2026-09-14', '20:05', '20:40', 'Orlando', 'Saída pelo Lost Continent e Port of Entry', 'transit', null, 'Universal''s Islands of Adventure → Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Caminho de saída passa pelo Lost Continent — parar 2 min na Mystic Fountain, a fonte que conversa com quem passa, é o melhor fecho de dia para a Gabi. Compras de última hora na Islands of Adventure Trading Co., no Port of Entry, que fica aberta depois do fechamento.', 'Universal''s Islands of Adventure', 'Deslocamento', 23, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 10),
    ('2026-09-14', '20:40', '21:20', 'Orlando', 'Check-in do quarto, malas e preparação do dia 15', 'rest', null, 'Universal''s Loews Royal Pacific Resort', 'planned', null, true, 'Retirar as malas do Bell Services. Amanhã é Epic Universe com Early Park Admission às 9h e SEM Express — despertador às 7h, roupa e mochila separadas hoje à noite, e os cartões Express guardados fora da mala (eles voltam a valer no dia 16).', 'Universal''s Islands of Adventure', 'Hotel', 24, null, null, 'none', null, false, false, null, false, 'operating', false, null, true, null, null, null, false, 0)
  ) as v(date, time_start, time_end, city, title, category, description, location, status, min_height_cm, child_friendly, notes, park, area, base_order, item_type, priority_tier, lightning_lane, lightning_lane_priority_rank, single_rider, child_switch, recommended_window, early_closure_risk, operational_status, counts_toward_completion, plan_b, time_is_estimated, show_block_start, show_block_end, recommended_arrival_min_before, last_showtime_of_day, reminder_minutes_before);
  get diagnostics v_inseridos = row_count;

  raise notice 'Roteiro operacional do Islands of Adventure 2026-09-14: % item(ns) removido(s), % inserido(s) na viagem % para % participante(s).',
    v_apagados, v_inseridos, v_trip, cardinality(v_participants);
end $$;
