/**
 * Gera o SQL de um dia operacional a partir do módulo TS correspondente.
 *
 * Os seeds de 09, 11 e 12/09 foram escritos à mão, e o cabeçalho de cada um
 * pede "editar o TS e regerar, não editar este arquivo à mão" — sem um
 * gerador, isso era uma promessa que ninguém podia cumprir. Este script fecha
 * essa lacuna: a lista de colunas e a ordem dos valores saem de um lugar só.
 *
 *   npx vite-node scripts/gerarSeedRoteiro.ts
 */
import { writeFileSync } from 'node:fs';
import type { ItineraryItem } from '../src/types/database.types';
import { ISLANDS_OF_ADVENTURE_DIA_14_ITEMS } from '../src/services/roteiro/islandsOfAdventureDia14';
import { EPIC_UNIVERSE_DIA_15_ITEMS } from '../src/services/roteiro/epicUniverseDia15';
import { UNIVERSAL_STUDIOS_DIA_16_ITEMS } from '../src/services/roteiro/universalStudiosDia16';
import { ROTEIRO_TRIP_ID } from '../src/services/roteiro/shared';

/** Ordem única das colunas: usada no INSERT, no SELECT e no alias do VALUES. */
const COLUNAS = [
  ['date', 'date'],
  ['time_start', 'time'],
  ['time_end', 'time'],
  ['city', null],
  ['title', null],
  ['category', null],
  ['description', null],
  ['location', null],
  ['status', null],
  ['min_height_cm', 'int'],
  ['child_friendly', 'boolean'],
  ['notes', null],
  ['park', null],
  ['area', null],
  ['base_order', 'int'],
  ['item_type', null],
  ['priority_tier', null],
  ['lightning_lane', null],
  ['lightning_lane_priority_rank', 'int'],
  ['single_rider', 'boolean'],
  ['child_switch', 'boolean'],
  ['recommended_window', null],
  ['early_closure_risk', 'boolean'],
  ['operational_status', null],
  ['counts_toward_completion', 'boolean'],
  ['plan_b', null],
  ['time_is_estimated', 'boolean'],
  ['show_block_start', 'time'],
  ['show_block_end', 'time'],
  ['recommended_arrival_min_before', 'int'],
  ['last_showtime_of_day', 'boolean'],
  ['reminder_minutes_before', 'int'],
] as const satisfies readonly (readonly [keyof ItineraryItem, string | null])[];

const literal = (valor: unknown): string => {
  if (valor === undefined || valor === null) return 'null';
  if (typeof valor === 'boolean') return String(valor);
  if (typeof valor === 'number') return String(valor);
  return `'${String(valor).replace(/'/g, "''")}'`;
};

interface Dia {
  arquivo: string;
  titulo: string;
  data: string;
  itens: ItineraryItem[];
  /** Vai no cabeçalho do arquivo — por que o dia é assim. */
  premissas: string[];
}

function gerar(dia: Dia): string {
  const nomes = COLUNAS.map(([c]) => c);
  const select = COLUNAS.map(([c, cast]) => `      v.${c}${cast ? `::${cast}` : ''}`).join(',\n');
  const linhas = porOrdem(dia.itens)
    .map(item => `    (${COLUNAS.map(([c]) => literal(item[c])).join(', ')})`)
    .join(',\n');

  return `-- =========================================================================
-- ${dia.titulo}
--
-- GERADO por scripts/gerarSeedRoteiro.ts. Editar o módulo TS e regerar, nunca
-- editar este arquivo à mão.
--
${dia.premissas.map(p => (p ? `-- ${p}` : '--')).join('\n')}
--
-- Como aplicar:
--   supabase db query --linked "$(cat supabase/seeds/${dia.arquivo})"
-- ou colar no SQL Editor do dashboard do projeto bkrqhividgljticgjrem.
--
-- É idempotente: apaga TODO item de itinerary_items da viagem em ${dia.data}
-- antes de inserir. O delete arrasta itinerary_item_outcomes por
-- \`on delete cascade\` (20260908160000_itinerary_checkins.sql).
-- ATENÇÃO: roda antes de o dia começar — depois disso descarta os
-- \`participant_status\` do que já tiver sido marcado.
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
   where t.id = '${ROTEIRO_TRIP_ID}'::uuid;

  if v_trip is null then
    select t.id into v_trip
      from public.trips t
     where t.start_date <= date '${dia.data}'
       and t.end_date   >= date '${dia.data}'
     order by t.created_at
     limit 1;
  end if;

  if v_trip is null then
    raise exception 'Nenhuma viagem cobre ${dia.data}. Confirme o trip_id antes de rodar.';
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
     and date = date '${dia.data}';
  get diagnostics v_apagados = row_count;

  -- 4. O dia.
  insert into public.itinerary_items (
    trip_id, participant_ids, participant_status, currency, ${nomes.join(', ')}
  )
  select
      v_trip,
      v_participants,
      '{}'::jsonb,
      'USD',
${select}
  from (values
${linhas}
  ) as v(${nomes.join(', ')});
  get diagnostics v_inseridos = row_count;

  raise notice '${dia.titulo.split('—')[0].trim()} ${dia.data}: % item(ns) removido(s), % inserido(s) na viagem % para % participante(s).',
    v_apagados, v_inseridos, v_trip, cardinality(v_participants);
end $$;
`;
}

const porOrdem = (itens: ItineraryItem[]) =>
  [...itens].sort((a, b) => (a.base_order ?? 0) - (b.base_order ?? 0));

const DIAS: Dia[] = [
  {
    arquivo: 'roteiro_islands_of_adventure_2026-09-14.sql',
    titulo: "Roteiro operacional do Islands of Adventure — 14/09/2026 (replanejado às 11h, com Universal Express Unlimited)",
    data: '2026-09-14',
    itens: ISLANDS_OF_ADVENTURE_DIA_14_ITEMS,
    premissas: [
      'Gerado a partir de src/services/roteiro/islandsOfAdventureDia14.ts.',
      '',
      'Segunda versão do dia: a família passou a manhã no hotel e o dia foi',
      'remontado a partir das 11h. Sai do Celebration Suites (Kissimmee), passa',
      'pelo Loews Royal Pacific para retirar o Universal Express Unlimited dos 4',
      'hóspedes e entra no parque às 13h25, com fechamento às 20h — 6h30 de',
      "parque contra as ~4h do plano anterior. Hagrid's não aceita Express e por",
      'isso é o último bloco. Gabi (112cm) fica de fora de 5 das 6 atrações mais',
      'fortes: 4 viram Child Swap com Express.',
    ],
  },
  {
    arquivo: 'roteiro_epic_universe_2026-09-15.sql',
    titulo: 'Roteiro operacional do Epic Universe — 15/09/2026 (Early Park Admission, sem Express)',
    data: '2026-09-15',
    itens: EPIC_UNIVERSE_DIA_15_ITEMS,
    premissas: [
      'Gerado a partir de src/services/roteiro/epicUniverseDia15.ts.',
      '',
      'O Express Unlimited do Royal Pacific NÃO vale no Epic Universe — daí o',
      'dia inteiro, o Early Park Admission das 9h e o rope drop em Super',
      'Nintendo World. Parque abre 10h e fecha 20h em setembro/2026.',
    ],
  },
  {
    arquivo: 'roteiro_universal_studios_2026-09-16.sql',
    titulo: 'Roteiro operacional do Universal Studios Florida — 16/09/2026 (Express Unlimited, fecha 17h por Halloween Horror Nights) + estrada para Miami',
    data: '2026-09-16',
    itens: UNIVERSAL_STUDIOS_DIA_16_ITEMS,
    premissas: [
      'Gerado a partir de src/services/roteiro/universalStudiosDia16.ts.',
      '',
      'Segunda versão do dia, refeita junto com o replanejamento do 14/09: com',
      'o Islands of Adventure coberto inteiro no dia 14, o Hogwarts Express',
      'deixa de ser plano de resgate do Hogsmeade e a folga entra em',
      'TRANSFORMERS: The Ride-3D, Horror Make-Up Show e DreamWorks Land.',
      '',
      '16/09 é data do Halloween Horror Nights (setembro: 2-6, 9-13, 16-20,',
      '23-27, 30): o parque fecha às 17h para ingresso normal. Isso resolve o',
      'check-out do Royal Pacific (11h) e o check-in do Casa Faena em Miami',
      'Beach — o dia termina na estrada, não no parque.',
    ],
  },
];

for (const dia of DIAS) {
  const caminho = `supabase/seeds/${dia.arquivo}`;
  writeFileSync(caminho, gerar(dia), 'utf-8');
  console.log(`${caminho}: ${dia.itens.length} blocos`);
}
