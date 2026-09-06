// Montagem do contexto da viagem para o bot WhatsApp (NLP) e para o digest diário.
// A parte pura (buildSystemPrompt) é independente de I/O para ser testável.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface ParticipantRow {
  id: string;
  full_name: string;
  nickname: string | null;
  age?: number;
  is_minor: boolean;
  height_cm: number | null;
  whatsapp_phone: string | null;
}

export interface TripRow {
  id: string;
  title: string;
  destination_main: string;
  start_date: string;
  end_date: string;
  currency_base: string;
}

export interface TripContext {
  tenantId: string;
  trip: TripRow | null;
  participants: ParticipantRow[];
  todayItems: Record<string, unknown>[];
  tasksDueSoon: Record<string, unknown>[];
  nextFlight: Record<string, unknown> | null;
}

/**
 * Colunas do roteiro usadas pelo digest, pelos avisos e pelo system prompt.
 * Explícitas em vez de `*`: cada coluna a mais é payload de rede em todo
 * webhook e token a mais no prompt.
 */
export const ITINERARY_COLUMNS =
  'id, date, time_start, time_end, title, category, city, park, notes, min_height_cm, ' +
  'reminder_minutes_before, recommended_arrival_min_before';

/** Data local (YYYY-MM-DD) no fuso informado. */
export function localDateIso(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Viagem em andamento na data informada, ou a próxima a começar. */
export async function resolveActiveTrip(
  supabase: SupabaseClient,
  tenantId: string,
  dateIso: string,
): Promise<TripRow | null> {
  const { data: trips } = await supabase
    .from('trips')
    .select('id, title, destination_main, start_date, end_date, currency_base')
    .eq('tenant_id', tenantId)
    .in('status', ['planning', 'confirmed', 'in_progress'])
    .order('start_date', { ascending: true });

  return (
    (trips ?? []).find(t => t.start_date <= dateIso && t.end_date >= dateIso) ??
    (trips ?? []).find(t => t.start_date >= dateIso) ??
    null
  );
}

/**
 * Carrega o contexto do tenant: viagem ativa (em andamento ou a próxima),
 * participantes, roteiro do dia, tarefas vencendo em 48h e voo nas próximas 24h.
 * Usa o client informado — o caller decide o nível de acesso (service role no bot).
 */
export async function fetchTripContext(
  supabase: SupabaseClient,
  tenantId: string,
  dateIso: string,
): Promise<TripContext> {
  const trip = await resolveActiveTrip(supabase, tenantId, dateIso);

  if (!trip) {
    return { tenantId, trip: null, participants: [], todayItems: [], tasksDueSoon: [], nextFlight: null };
  }

  const [participantsRes, itemsRes, tasksRes, flightsRes] = await Promise.all([
    supabase
      .from('participants')
      .select('id, full_name, nickname, birth_date, is_minor, height_cm, whatsapp_phone')
      .eq('trip_id', trip.id),
    supabase
      .from('itinerary_items')
      .select(ITINERARY_COLUMNS)
      .eq('trip_id', trip.id)
      .eq('date', dateIso)
      .order('time_start', { ascending: true }),
    supabase
      .from('tasks')
      .select('id, title, due_date, priority, status')
      .eq('trip_id', trip.id)
      .in('status', ['pending', 'in_progress'])
      .lte('due_date', addDaysIso(dateIso, 2))
      .order('due_date', { ascending: true }),
    supabase
      .from('flights')
      .select('airline, flight_number, origin_airport, destination_airport, departure_time, booking_code')
      .eq('trip_id', trip.id)
      .in('status', ['booked', 'confirmed'])
      .gte('departure_time', new Date().toISOString())
      .lte('departure_time', new Date(Date.now() + 24 * 3600 * 1000).toISOString())
      .order('departure_time', { ascending: true })
      .limit(1),
  ]);

  return {
    tenantId,
    trip,
    participants: (participantsRes.data ?? []) as ParticipantRow[],
    todayItems: itemsRes.data ?? [],
    tasksDueSoon: tasksRes.data ?? [],
    nextFlight: (flightsRes.data ?? [])[0] ?? null,
  };
}

export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Menor participante com altura cadastrada — referência dos alertas de altura mínima. */
export function youngestWithHeight(participants: ParticipantRow[]): ParticipantRow | null {
  const minors = participants.filter(p => p.is_minor && p.height_cm);
  return minors.sort((a, b) => (a.height_cm ?? 999) - (b.height_cm ?? 999))[0] ?? null;
}

// Teto de itens injetados no prompt. Acima disso o custo em tokens supera o
// ganho de latência e o modelo cai na tool, que pagina melhor.
const MAX_PRELOADED_ITEMS = 15;

/**
 * Bloco fixo do system prompt. Fica *antes* de qualquer dado variável de
 * propósito: o Gemini faz cache implícito de prefixos idênticos, e um prefixo
 * estável reduz TTFT e custo em toda mensagem depois da primeira.
 */
const STATIC_PROMPT = [
  'Você é o assistente de viagem da família no WhatsApp, com uma persona leve e calorosa de "assistente de viagem da família".',
  'Sua missão é ajudar a família a ter as melhores férias possíveis. Dirija-se a eles de forma informal, usando os apelidos ou nomes cadastrados quando fizer sentido.',
  'NÃO seja formal ou robótico. Mantenha o tom direto e objetivo, mas acolhedor. Use emojis pontuais para dar um clima de férias (☀️, 🎢, ✈️), mas sem exagerar.',
  'Sempre responda em português (pt-BR) usando formatação do WhatsApp (*negrito*, _itálico_).',
  'Regras essenciais:',
  '- O bloco "CONTEXTO DE HOJE" abaixo já traz o roteiro do dia, as tarefas próximas e o voo iminente. Responda direto a partir dele, SEM chamar ferramenta. Use get_itinerary/get_tasks/get_flight_info apenas para outras datas, outros status ou detalhes que não estejam ali.',
  '- Para atrações com altura mínima, alerte quando um participante menor não atingir a altura exigida e sugira com gentileza o Rider Switch/Child Swap.',
  '- Use as ferramentas disponíveis para consultar ou alterar dados reais do roteiro e das tarefas. Nunca invente horários, preços ou reservas.',
  '- Sempre que alguém compartilhar uma ideia de negócio ou de viagem (mesmo de forma espontânea, sem pedir explicitamente), salve com save_trip_idea e confirme com uma frase curta e animada. Use list_trip_ideas se perguntarem o que já foi registrado.',
  '- Antes de executar uma ferramenta de escrita (marcar concluído, completar tarefa), confirme com naturalidade o item exato encontrado na resposta.',
  '- Quando uma busca devolver várias correspondências, pergunte qual delas — nunca escolha por conta própria.',
  '- Outros membros da família também conversam com você em conversas separadas; o que vale para todos está no banco, não no histórico desta conversa.',
  '- Se a pergunta não for sobre a viagem, responda brevemente e redirecione de forma leve para o assunto da viagem.',
  '- Compras, gift cards e orçamento não têm ferramenta aqui: não tente calcular ou estimar nada. Responda em 1-2 frases dizendo que esse relatório é consultado no app, sem abrir uma conversa longa sobre o assunto.',
].join('\n');

function preloadedItineraryLines(items: Record<string, unknown>[]): string[] {
  if (items.length === 0) return ['Roteiro de hoje: nenhuma atividade cadastrada (dia livre).'];

  const shown = items.slice(0, MAX_PRELOADED_ITEMS);
  const lines = ['Roteiro de hoje:'];
  for (const item of shown) {
    const start = String(item.time_start ?? '').slice(0, 5);
    const end = item.time_end ? `-${String(item.time_end).slice(0, 5)}` : '';
    const place = (item.park as string | null) ?? (item.city as string | null) ?? '';
    const height = item.min_height_cm ? ` [altura mín. ${item.min_height_cm}cm]` : '';
    lines.push(`- ${start}${end} ${String(item.title)}${place ? ` (${place})` : ''}${height}`);
  }
  if (items.length > shown.length) {
    lines.push(`- ... e mais ${items.length - shown.length} atividades (use get_itinerary para a lista completa).`);
  }
  return lines;
}

/** System prompt do bot: prefixo estático + contexto do dia já resolvido. */
export function buildSystemPrompt(ctx: TripContext, dateIso: string): string {
  const trip = ctx.trip;
  const roster = ctx.participants
    .map(p => `${p.nickname ?? p.full_name}${p.height_cm ? ` (${p.height_cm}cm)` : ''}${p.is_minor ? ' [menor]' : ''}`)
    .join(', ');

  const dynamic: string[] = [
    '',
    '--- CONTEXTO DE HOJE ---',
    `Data de hoje: ${dateIso}.`,
    trip
      ? `Viagem ativa: "${trip.title}" para ${trip.destination_main}, de ${trip.start_date} a ${trip.end_date}. Moeda base: ${trip.currency_base}.`
      : 'Nenhuma viagem ativa encontrada no momento.',
    `Membros do grupo (A Família): ${roster || 'não cadastrados'}.`,
  ];

  if (trip) {
    dynamic.push(...preloadedItineraryLines(ctx.todayItems));

    if (ctx.tasksDueSoon.length > 0) {
      dynamic.push('Tarefas vencendo em até 48h:');
      for (const task of ctx.tasksDueSoon) {
        dynamic.push(`- ${String(task.title)} (até ${String(task.due_date ?? 'sem prazo')}, ${String(task.priority)})`);
      }
    } else {
      dynamic.push('Tarefas vencendo em até 48h: nenhuma.');
    }

    const flight = ctx.nextFlight;
    dynamic.push(
      flight
        ? `Voo nas próximas 24h: ${String(flight.airline)} ${String(flight.flight_number)}, ${String(flight.origin_airport)} → ${String(flight.destination_airport)}, saída ${String(flight.departure_time)}, localizador ${String(flight.booking_code)}.`
        : 'Voo nas próximas 24h: nenhum.',
    );
  }

  return `${STATIC_PROMPT}\n${dynamic.join('\n')}`;
}
