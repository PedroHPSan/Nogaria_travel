-- =========================================================================
-- EPCOT 09/09/2026 — conferência da lista original + complemento do que faltava.
-- Pode colar inteiro no SQL Editor do Supabase. Idempotente: o INSERT pula
-- qualquer bloco cujo título já exista no dia, então rodar duas vezes não
-- duplica nada.
-- =========================================================================

-- PARTE 1 — insere só o que está faltando.
do $$
declare
  v_trip uuid;
  v_part uuid[];
  v_add  integer;
begin
  select id into v_trip from public.trips
   where id = '9a8b7c6d-5e4f-4321-8765-4321fedcba09'::uuid;
  if v_trip is null then
    select id into v_trip from public.trips
     where start_date <= date '2026-09-09' and end_date >= date '2026-09-09'
     order by created_at limit 1;
  end if;
  if v_trip is null then raise exception 'Nenhuma viagem cobre 2026-09-09.'; end if;

  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_part
    from public.participants where trip_id = v_trip;

  insert into public.itinerary_items (
    trip_id, participant_ids, participant_status, currency,
    date, city, park, location, category, lightning_lane, status, child_friendly,
    single_rider, early_closure_risk, operational_status, last_showtime_of_day,
    time_is_estimated, reminder_minutes_before,
    time_start, time_end, title, area, base_order, item_type, priority_tier,
    min_height_cm, child_switch, counts_toward_completion, notes
  )
  select
      v_trip, v_part, '{}'::jsonb, 'USD',
      date '2026-09-09', 'Lake Buena Vista', 'EPCOT', 'EPCOT', 'park', 'none', 'optional', true,
      false, false, 'operating', false,
      true, 0,
      v.t0::time, v.t1::time, v.titulo, v.area, v.ordem::int, v.tipo, v.prio,
      v.altura::int, v.switch::boolean, false, v.notas
  from (values
    ('10:20', '10:45', 'Mission: SPACE – Orange Mission', 'World Discovery', 33, 'attraction', 'A', 112, true,
     'Alternativa intensa à Green, no mesmo horário — dá para fazer uma das duas. Gabi (100cm) não atinge os 112cm.'),
    ('20:05', '20:20', 'França — fotos, loja e snack', 'França', 34, 'experience', 'C', null, false,
     'Alternativa à travessia até o Canadá: das 20h05 às 20h20 dá tempo de uma coisa só.'),
    ('20:20', '20:35', 'Food & Wine Festival — quiosques do World Showcase', 'World Showcase', 35, 'experience', 'C', null, false,
     'Só se nada tiver ficado pendente. Caso contrário a Operação Resgate vence.')
  ) as v(t0, t1, titulo, area, ordem, tipo, prio, altura, switch, notas)
  where not exists (
    select 1 from public.itinerary_items i
     where i.trip_id = v_trip and i.date = date '2026-09-09' and i.title = v.titulo
  );

  get diagnostics v_add = row_count;
  raise notice 'Complemento: % bloco(s) adicionado(s).', v_add;
end $$;


-- PARTE 2 — checklist da lista original contra o que está no banco.
select
  v.item,
  case when i.time_start is null then '>>> AUSENTE'
       else to_char(i.time_start, 'HH24:MI') || '–' || to_char(coalesce(i.time_end, i.time_start), 'HH24:MI')
  end as no_banco,
  i.status
from (values
  ( 1, 'Acordar e preparação',              'Acordar%'),
  ( 2, 'Café da manhã no hotel',            'Café da manhã%'),
  ( 3, 'Saída do hotel',                    'Saída do hotel%'),
  ( 4, 'Estacionamento e catracas',         'Estacionamento%'),
  ( 5, 'Posicionamento no rope drop',       'Posicionamento%'),
  ( 6, 'Test Track',                        'Test Track'),
  ( 7, 'Guardians of the Galaxy',           'Guardians%'),
  ( 8, 'Mission: SPACE Green',              'Mission: SPACE – Green%'),
  ( 9, 'Mission: SPACE Orange',             'Mission: SPACE – Orange%'),
  (10, 'Spaceship Earth',                   'Spaceship Earth'),
  (11, 'Figment',                           'Journey Into Imagination%'),
  (12, 'Soarin''',                          'Soarin%'),
  (13, 'Living with the Land',              'Living with the Land'),
  (14, 'The Seas with Nemo & Friends',      'The Seas with Nemo%'),
  (15, 'SeaBase',                           'SeaBase%'),
  (16, 'Journey of Water (Moana)',          'Journey of Water%'),
  (17, 'Transição para o World Showcase',   'Travessia para o World Showcase%'),
  (18, 'México — Gran Fiesta Tour',         'Gran Fiesta Tour%'),
  (19, 'México — pavilhão',                 'Exploração do Pavilhão do México'),
  (20, 'Akershus',                          'Akershus%'),
  (21, 'Frozen Ever After',                 'Frozen Ever After'),
  (22, 'China',                             'China%'),
  (23, 'Alemanha',                          'Alemanha%'),
  (24, 'Itália',                            'Itália%'),
  (25, 'Estados Unidos — pausa',            'Estados Unidos%'),
  (26, 'Japão — Mitsukoshi',                'Japão%'),
  (27, 'Marrocos',                          'Marrocos%'),
  (28, 'Remy''s Ratatouille Adventure',     'Remy%'),
  (29, 'França — pavilhão',                 'França —%'),
  (30, 'Reino Unido e Canadá',              'Reino Unido%'),
  (31, 'Operação Resgate',                  'Operação Resgate%'),
  (32, 'Food & Wine Festival',              'Food & Wine%'),
  (33, 'Fila final da pendência',           'Fila final%'),
  (34, 'Luminous (show noturno)',           'Luminous%'),
  (35, 'Saída do parque',                   'Saída do EPCOT%')
) as v(ord, item, padrao)
left join lateral (
  select time_start, time_end, status
    from public.itinerary_items
   where date = date '2026-09-09' and park = 'EPCOT' and title ilike v.padrao
   order by time_start limit 1
) i on true
order by v.ord;
