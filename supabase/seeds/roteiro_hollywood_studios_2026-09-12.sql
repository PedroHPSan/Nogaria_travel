-- =========================================================================
-- Roteiro operacional do Hollywood Studios — 12/09/2026 (sem Early Entry,
-- sem Lightning Lane)
--
-- Gerado a partir de src/services/roteiro/hollywoodStudiosDia12.ts. Editar o
-- TS e regerar, não editar este arquivo à mão.
--
-- Como aplicar:
--   supabase db query --linked "$(cat supabase/seeds/roteiro_hollywood_studios_2026-09-12.sql)"
-- ou colar no SQL Editor do dashboard do projeto bkrqhividgljticgjrem.
--
-- É idempotente: apaga TODO item de itinerary_items da viagem em 2026-09-12
-- antes de inserir — o dia inteiro é Hollywood Studios, então não há o que
-- preservar. Isso também remove o item órfão "Avatar Flight of Passage"
-- (location "Disney's Animal Kingdom") que sobrou de 11/09 nesta data. O
-- delete em itinerary_items arrasta itinerary_item_outcomes por
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
     where t.start_date <= date '2026-09-12'
       and t.end_date   >= date '2026-09-12'
     order by t.created_at
     limit 1;
  end if;

  if v_trip is null then
    raise exception 'Nenhuma viagem cobre 2026-09-12. Confirme o trip_id antes de rodar.';
  end if;

  -- 2. Participantes: todos os da viagem entram em todos os blocos do dia.
  select coalesce(array_agg(p.id order by p.id), '{}'::uuid[])
    into v_participants
    from public.participants p
   where p.trip_id = v_trip;

  if cardinality(v_participants) = 0 then
    raise exception 'Viagem % não tem participantes cadastrados.', v_trip;
  end if;

  -- 3. Idempotência: limpa o dia inteiro (sem filtro de `park` — 12/09 é só
  --    Hollywood Studios e isto também remove o item órfão de Animal
  --    Kingdom que sobrou de 11/09). Arrasta itinerary_item_outcomes via
  --    cascade.
  delete from public.itinerary_items
   where trip_id = v_trip
     and date = date '2026-09-12';
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
    ('2026-09-12', '07:00', '07:20', 'Kissimmee', 'Acordar e preparação', 'rest', null, 'Celebration Suites', 'planned', null, true, 'Mochila: protetor solar, poncho, garrafas e carregador. Tênis fechado. Medir a Gabi antes de sair — hoje tem atração de 122cm.', 'Disney''s Hollywood Studios', 'Hotel', 1, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 10),
    ('2026-09-12', '07:20', '07:45', 'Kissimmee', 'Café da manhã no apartamento', 'restaurant', null, 'Celebration Suites', 'planned', null, true, 'Café rápido — sem parada para café dentro do parque hoje.', 'Disney''s Hollywood Studios', 'Hotel', 2, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-12', '07:45', '08:15', 'Kissimmee → Lake Buena Vista', 'Saída do hotel rumo ao Hollywood Studios', 'transit', null, 'Celebration Suites → Disney''s Hollywood Studios', 'planned', null, true, 'Sem Early Entry: chegar cedo na fila é o único jeito de ganhar tempo na abertura.', 'Disney''s Hollywood Studios', 'Deslocamento', 3, null, null, 'none', false, false, null, false, 'operating', false, 'Trânsito pesado na I-4: sair até 7h50 no mais tardar para não perder o rope drop.', false, null, null, null, false, 15),
    ('2026-09-12', '08:15', '08:40', 'Lake Buena Vista', 'Estacionamento e segurança', 'transit', null, 'Disney''s Hollywood Studios', 'planned', null, true, 'Estacionamento padrão US$ 35/dia. Fotografar a placa da vaga. Ingressos já abertos no My Disney Experience (voucher 4-Park Magic HWQK87515654).', 'Disney''s Hollywood Studios', 'Entrada', 4, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-12', '08:40', '09:00', 'Lake Buena Vista', 'Posicionamento na entrada regular (rope drop)', 'transit', null, 'Disney''s Hollywood Studios', 'planned', null, true, 'Sem Early Entry hoje: estar na frente da catraca antes das 9h vale a manhã inteira. Ir direto para Galaxy''s Edge.', 'Disney''s Hollywood Studios', 'Entrada', 5, null, null, 'none', false, false, null, false, 'operating', false, null, false, null, null, null, false, 0),
    ('2026-09-12', '09:00', '09:45', 'Lake Buena Vista', 'Star Wars: Rise of the Resistance', 'park', null, 'Disney''s Hollywood Studios', 'planned', 102, true, 'Prioridade absoluta do dia — a fila mais longa e mais sujeita a ficar parada. Ir direto, sem fotos.', 'Disney''s Hollywood Studios', 'Galaxy''s Edge', 6, 'attraction', 'S', 'none', false, true, 'Primeiros 30 minutos do dia', false, 'operating', true, 'Tem cerca de 1 chance em 5 de estar parada na abertura: se estiver, ir direto ao Slinky Dog Dash e voltar ao Rise às 19h.', false, null, null, null, false, 30),
    ('2026-09-12', '09:50', '10:25', 'Lake Buena Vista', 'Millennium Falcon: Smugglers Run', 'park', null, 'Disney''s Hollywood Studios', 'planned', 97, true, 'Cabine de pilotos — a Gabi senta no colo se não alcançar os controles.', 'Disney''s Hollywood Studios', 'Galaxy''s Edge', 7, 'attraction', 'S', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-12', '10:25', '10:45', 'Lake Buena Vista', 'Travessia Galaxy''s Edge → Toy Story Land', 'transit', null, 'Disney''s Hollywood Studios', 'planned', null, true, 'Aproveitar para passar pelo Datapad se sobrar tempo.', 'Disney''s Hollywood Studios', 'Deslocamento', 8, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 10),
    ('2026-09-12', '10:45', '11:20', 'Lake Buena Vista', 'Slinky Dog Dash', 'park', null, 'Disney''s Hollywood Studios', 'planned', 97, true, 'Segunda fila mais concorrida do parque — ainda de manhã evita a pior espera.', 'Disney''s Hollywood Studios', 'Toy Story Land', 9, 'attraction', 'S', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-12', '11:25', '11:50', 'Lake Buena Vista', 'Toy Story Mania!', 'park', null, 'Disney''s Hollywood Studios', 'planned', null, true, 'Sem restrição de altura: todo mundo joga junto.', 'Disney''s Hollywood Studios', 'Toy Story Land', 10, 'attraction', 'A', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-12', '11:55', '12:15', 'Lake Buena Vista', 'Alien Swirling Saucers', 'park', null, 'Disney''s Hollywood Studios', 'planned', 81, true, 'A mais suave de Toy Story Land — boa para a Gabi antes do almoço.', 'Disney''s Hollywood Studios', 'Toy Story Land', 11, 'attraction', 'B', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-12', '12:20', '13:05', 'Lake Buena Vista', 'Almoço — Woody''s Lunch Box', 'restaurant', 'Quick service temático de lancheira escolar — grilled cheese, totchos, milkshakes.', 'Disney''s Hollywood Studios', 'planned', null, true, 'Mobile order pelo app antes de sair da fila de Alien Swirling Saucers. ~US$ 60 para os 4.', 'Disney''s Hollywood Studios', 'Toy Story Land', 12, null, null, 'none', false, false, null, false, 'operating', false, null, false, null, null, 10, false, 20),
    ('2026-09-12', '13:10', '13:30', 'Lake Buena Vista', 'Travessia → Hollywood Boulevard', 'transit', null, 'Disney''s Hollywood Studios', 'planned', null, true, null, 'Disney''s Hollywood Studios', 'Deslocamento', 13, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-12', '13:30', '14:00', 'Lake Buena Vista', 'Mickey & Minnie''s Runaway Railway', 'park', 'Indoor — primeiro bloco da sequência que atravessa a janela de trovoada da tarde.', 'Disney''s Hollywood Studios', 'planned', null, true, 'Sem altura mínima: toda a família entra junto.', 'Disney''s Hollywood Studios', 'Hollywood Boulevard', 14, 'attraction', 'S', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-12', '14:05', '14:40', 'Lake Buena Vista', 'Star Tours – The Adventures Continue', 'park', null, 'Disney''s Hollywood Studios', 'planned', 102, true, 'Indoor, simulador — a viagem é sorteada entre dezenas de combinações.', 'Disney''s Hollywood Studios', 'Echo Lake', 15, 'attraction', 'A', 'none', false, false, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-12', '14:45', '15:20', 'Lake Buena Vista', 'Indiana Jones Epic Stunt Spectacular!', 'park', 'Anfiteatro coberto, mas ao ar livre — 30 minutos de dublês e explosões ao vivo.', 'Disney''s Hollywood Studios', 'planned', null, true, 'Chegar com folga: sentar na plateia é por ordem de chegada.', 'Disney''s Hollywood Studios', 'Echo Lake', 16, 'show', 'A', 'none', false, false, null, false, 'operating', true, 'Se for suspenso por raios nas proximidades, trocar por Walt Disney Presents (Main Street exhibits, totalmente indoor).', true, '14:45', '15:15', 15, false, 30),
    ('2026-09-12', '15:25', '15:55', 'Lake Buena Vista', 'For the First Time in Forever: A Frozen Sing-Along Celebration', 'park', 'Indoor (Hyperion Theater), 25 minutos.', 'Disney''s Hollywood Studios', 'planned', null, true, null, 'Disney''s Hollywood Studios', 'Echo Lake', 17, 'show', 'B', 'none', false, false, null, false, 'operating', true, null, true, '15:25', '15:50', null, false, 0),
    ('2026-09-12', '16:00', '16:25', 'Lake Buena Vista', 'The Little Mermaid – A Musical Adventure', 'park', 'Indoor, boneco-marionete em live-action — aberto desde 27/05/2025.', 'Disney''s Hollywood Studios', 'planned', null, true, null, 'Disney''s Hollywood Studios', 'Sunset Boulevard', 18, 'show', 'B', 'none', false, false, null, false, 'operating', true, null, true, '16:00', '16:20', null, false, 0),
    ('2026-09-12', '16:30', '16:55', 'Lake Buena Vista', 'Disney Junior Play and Dance!', 'park', 'Indoor, interativo — especialmente indicado para a Gabi.', 'Disney''s Hollywood Studios', 'optional', null, true, null, 'Disney''s Hollywood Studios', 'Grand Avenue', 19, 'show', 'C', 'none', false, false, null, false, 'operating', true, null, true, '16:30', '16:50', null, false, 0),
    ('2026-09-12', '17:00', '17:50', 'Lake Buena Vista', 'Jantar — Backlot Express', 'restaurant', 'Quick service climatizado, ao lado dos teatros da tarde — evita atravessar o parque na hora da tempestade.', 'Disney''s Hollywood Studios', 'planned', null, true, 'Mobile order pelo app. ~US$ 70 para os 4.', 'Disney''s Hollywood Studios', 'Echo Lake', 20, null, null, 'none', false, false, null, false, 'operating', false, null, false, null, null, 10, false, 30),
    ('2026-09-12', '17:55', '18:10', 'Lake Buena Vista', 'Travessia → Sunset Boulevard', 'transit', null, 'Disney''s Hollywood Studios', 'planned', null, true, null, 'Disney''s Hollywood Studios', 'Deslocamento', 21, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-12', '18:10', '18:45', 'Lake Buena Vista', 'The Twilight Zone Tower of Terror', 'park', null, 'Disney''s Hollywood Studios', 'planned', 102, true, 'Queda livre em sequência aleatória — a Gabi passa na barra, mas pode assustar; combinar antes de entrar.', 'Disney''s Hollywood Studios', 'Sunset Boulevard', 22, 'attraction', 'S', 'none', false, true, null, false, 'operating', true, null, true, null, null, null, false, 0),
    ('2026-09-12', '18:50', '19:20', 'Lake Buena Vista', 'Rock ''n'' Roller Coaster Starring The Muppets', 'park', null, 'Disney''s Hollywood Studios', 'planned', 122, true, 'Reabriu em 26/05/2026 com o Electric Mayhem — mesma barra de altura do Aerosmith (122cm). A Gabi (112cm) fica de fora.', 'Disney''s Hollywood Studios', 'Sunset Boulevard', 23, 'attraction', 'S', 'none', false, true, null, false, 'operating', true, 'Rider Switch: um adulto vai com a Débora primeiro, o outro espera com a Gabi (que ganha o cartão "Future Rock Star" na saída).', true, null, null, null, false, 20),
    ('2026-09-12', '19:25', '19:40', 'Lake Buena Vista', 'Disney Villains: Unfairly Ever After', 'park', 'Indoor, ~12 minutos — encaixe rápido antes do posicionamento do Fantasmic!.', 'Sunset Showcase', 'optional', null, true, null, 'Disney''s Hollywood Studios', 'Sunset Boulevard', 24, 'show', 'C', 'none', false, false, null, false, 'operating', true, null, true, '19:25', '19:35', null, false, 0),
    ('2026-09-12', '19:45', '20:30', 'Lake Buena Vista', 'Posicionamento no Hollywood Hills Amphitheater', 'transit', null, 'Hollywood Hills Amphitheater', 'planned', null, true, 'Sem assento reservado hoje: chegar 45 minutos antes é o mínimo para conseguir lugar sentado.', 'Disney''s Hollywood Studios', 'Sunset Boulevard', 25, null, null, 'none', false, false, null, false, 'operating', false, null, false, null, null, null, false, 30),
    ('2026-09-12', '20:30', '21:00', 'Lake Buena Vista', 'Fantasmic!', 'park', 'Espetáculo noturno com água, fogo e projeções — ~26 minutos. Horário a confirmar no app: em 2026 já oscilou entre 20h30 e 21h.', 'Hollywood Hills Amphitheater', 'planned', null, true, 'O trecho dos vilões tem fogo e volume alto — o mais pesado do dia para a Gabi. Dá para sair no meio pelos corredores laterais.', 'Disney''s Hollywood Studios', 'Sunset Boulevard', 26, 'show', 'S', 'none', false, false, null, false, 'operating', true, null, true, '20:30', '20:55', null, true, 0),
    ('2026-09-12', '21:00', '21:25', 'Lake Buena Vista', 'Compras finais — Mickey''s of Hollywood', 'shopping', null, 'Disney''s Hollywood Studios', 'optional', null, true, 'A loja opera um pouco além do horário de fechamento do parque.', 'Disney''s Hollywood Studios', 'Hollywood Boulevard', 27, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-12', '21:25', '21:50', 'Lake Buena Vista', 'Saída do parque e estacionamento', 'transit', null, 'Disney''s Hollywood Studios', 'planned', null, true, 'Fluxo de saída pesado — o parque esvazia às 21h30 para o Disney After Hours (22h–1h, ingresso à parte, não incluído hoje). A vaga foi fotografada de manhã.', 'Disney''s Hollywood Studios', 'Deslocamento', 28, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-12', '21:50', '22:25', 'Lake Buena Vista → Kissimmee', 'Retorno ao Celebration Suites', 'transit', null, 'Disney''s Hollywood Studios → Celebration Suites', 'planned', null, true, null, 'Disney''s Hollywood Studios', 'Deslocamento', 29, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0),
    ('2026-09-12', '22:25', '22:45', 'Kissimmee', 'Encerramento e preparação do dia 13', 'rest', null, 'Celebration Suites', 'planned', null, true, 'Dia 13 (Universal Studios Florida) começa só às 10h10 — dá para dormir até tarde.', 'Disney''s Hollywood Studios', 'Hotel', 30, null, null, 'none', false, false, null, false, 'operating', false, null, true, null, null, null, false, 0)
  ) as v(date, time_start, time_end, city, title, category, description, location, status, min_height_cm, child_friendly, notes, park, area, base_order, item_type, priority_tier, lightning_lane, single_rider, child_switch, recommended_window, early_closure_risk, operational_status, counts_toward_completion, plan_b, time_is_estimated, show_block_start, show_block_end, recommended_arrival_min_before, last_showtime_of_day, reminder_minutes_before);
  get diagnostics v_inseridos = row_count;

  raise notice 'Hollywood Studios 12/09/2026: % item(ns) removido(s), % inserido(s) na viagem % para % participante(s).',
    v_apagados, v_inseridos, v_trip, cardinality(v_participants);
end $$;
