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

export interface TripContext {
  tenantId: string;
  trip: {
    id: string;
    title: string;
    destination_main: string;
    start_date: string;
    end_date: string;
    currency_base: string;
  } | null;
  participants: ParticipantRow[];
  todayItems: Record<string, unknown>[];
  tasksDueSoon: Record<string, unknown>[];
  nextFlight: Record<string, unknown> | null;
}

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
  const { data: trips } = await supabase
    .from('trips')
    .select('id, title, destination_main, start_date, end_date, currency_base')
    .eq('tenant_id', tenantId)
    .in('status', ['planning', 'confirmed', 'in_progress'])
    .order('start_date', { ascending: true });

  const trip =
    (trips ?? []).find(t => t.start_date <= dateIso && t.end_date >= dateIso) ??
    (trips ?? []).find(t => t.start_date >= dateIso) ??
    null;

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
      .select('*')
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

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Menor participante com altura cadastrada — referência dos alertas de altura mínima. */
export function youngestWithHeight(participants: ParticipantRow[]): ParticipantRow | null {
  const minors = participants.filter(p => p.is_minor && p.height_cm);
  return minors.sort((a, b) => (a.height_cm ?? 999) - (b.height_cm ?? 999))[0] ?? null;
}

/** System prompt fixo do bot, com as regras de negócio da viagem. */
export function buildSystemPrompt(ctx: TripContext, dateIso: string): string {
  const trip = ctx.trip;
  const roster = ctx.participants
    .map(p => `${p.nickname ?? p.full_name}${p.height_cm ? ` (${p.height_cm}cm)` : ''}${p.is_minor ? ' [menor]' : ''}`)
    .join(', ');

  return [
    'Você é o assistente de viagem da família no WhatsApp. Responda sempre em português (pt-BR), de forma objetiva e amigável, usando formatação do WhatsApp (*negrito*).',
    `Data de hoje: ${dateIso}.`,
    trip
      ? `Viagem ativa: "${trip.title}" para ${trip.destination_main}, de ${trip.start_date} a ${trip.end_date}. Moeda base: ${trip.currency_base}.`
      : 'Nenhuma viagem ativa encontrada no momento.',
    `Participantes: ${roster || 'não cadastrados'}.`,
    'Regras:',
    '- Para atrações com altura mínima, alerte quando um participante menor não atingir a altura exigida e sugira Rider Switch/Child Swap.',
    '- Use as ferramentas disponíveis para consultar ou alterar dados reais do roteiro e das tarefas. Nunca invente horários, preços ou reservas.',
    '- Antes de executar uma ferramenta de escrita (marcar concluído, completar tarefa), confirme o item exato encontrado na resposta ao usuário.',
    '- Se a pergunta não for sobre a viagem, responda brevemente e redirecione para o assunto da viagem.',
  ].join('\n');
}
