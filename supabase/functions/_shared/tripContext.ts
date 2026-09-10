// Montagem do contexto da viagem para o bot WhatsApp (NLP) e para o digest diário.
// A parte pura (buildSystemPrompt) é independente de I/O para ser testável.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface ParticipantRow {
  id: string;
  full_name: string;
  nickname: string | null;
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

/**
 * Horário local ("DD/MM HH:MM") de um timestamp UTC (ex: flights.departure_time),
 * no fuso informado. Sem isso, o valor cru do Postgres (UTC) chega ao Gemini como
 * se já fosse hora local — foi o que fez o bot informar horário de voo errado.
 */
export function formatLocalTime(isoUtc: string, timeZone: string): string {
  return new Date(isoUtc).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  });
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
      // Minimização (LGPD): o bot só precisa de is_minor + altura; a data de
      // nascimento exata do menor nunca vai para o prompt do Gemini.
      .select('id, full_name, nickname, is_minor, height_cm, whatsapp_phone')
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
      .select('airline, flight_number, origin_airport, destination_airport, departure_time, arrival_time, booking_code')
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

export type DigestMode = 'today' | 'tomorrow';

export interface DigestTrigger {
  mode: DigestMode;
  dateIso: string;
}

/**
 * Decide quais digests disparam nesta hora local do tenant: de manhã
 * (digest_time) o resumo de HOJE, à noite (evening_digest_time) a prévia de
 * AMANHÃ. Função pura para ser testável sem mockar hora do sistema — o
 * daily-digest roda a cada hora e só isso já decide o que (não) enviar.
 * Retorna as duas se as configs caírem na mesma hora (config incomum, mas
 * mais seguro que silenciosamente descartar uma).
 */
export function resolveDigestTriggers(input: {
  localHour: string;
  todayIso: string;
  digestTime: string;
  eveningDigestTime: string;
}): DigestTrigger[] {
  const triggers: DigestTrigger[] = [];
  if (input.digestTime.slice(0, 2) === input.localHour) {
    triggers.push({ mode: 'today', dateIso: input.todayIso });
  }
  if (input.eveningDigestTime.slice(0, 2) === input.localHour) {
    triggers.push({ mode: 'tomorrow', dateIso: addDaysIso(input.todayIso, 1) });
  }
  return triggers;
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
  '- Para "como chego lá", "quanto tempo leva", "que horas precisamos sair": use get_directions. Repasse o link do mapa e o tempo estimado numa frase curta, nunca descreva o trajeto passo a passo. Se a tool devolver needs_location, peça a localização de forma leve ("manda seu pin que eu calculo") em vez de inventar um ponto de partida.',
  '- mark_itinerary_item_done, complete_task e reschedule_itinerary_item têm confirmação em duas etapas: a primeira chamada (sem confirm) só valida e devolve um resumo em "preview" — mostre esse resumo à família e espere a confirmação explícita numa mensagem seguinte antes de chamar a MESMA ferramenta de novo com confirm=true. Nunca marque confirm=true sem uma confirmação explícita do usuário depois de ver o preview. Reagende só um item por mensagem.',
  '- Se reschedule_itinerary_item avisar conflito de horário no preview, inclua o aviso e a sugestão de horário livre na sua pergunta de confirmação — não esconda o conflito da família.',
  '- Quando uma busca devolver várias correspondências, pergunte qual delas — nunca escolha por conta própria.',
  '- De vez em quando o bot manda um check-in em lote perguntando se as atividades vencidas do roteiro rolaram. Quando a família responder, use confirm_itinerary_outcome pra cada atividade que ela mencionar (outcome=done se rolou, outcome=skipped se não rolou — inclua o motivo em note se contarem). Isso vale também quando a família falar espontaneamente que algo não deu tempo de fazer, mesmo fora de um check-in — não espere a pergunta do bot. Atividades marcadas como skipped ficam no banco de pendências: use list_unfulfilled_activities quando perguntarem o que ficou pendente, e sugira reencaixar (reschedule_itinerary_item) num horário livre ou, se a família não quiser mais fazer, cancelar de vez (cancel_itinerary_item).',
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
export function buildSystemPrompt(ctx: TripContext, dateIso: string, timeZone: string): string {
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
        ? `Voo nas próximas 24h: ${String(flight.airline)} ${String(flight.flight_number)}, ${String(flight.origin_airport)} → ${String(flight.destination_airport)}, saída ${formatLocalTime(String(flight.departure_time), timeZone)}${flight.arrival_time ? `, chegada ${formatLocalTime(String(flight.arrival_time), timeZone)}` : ''} (horário local, fuso ${timeZone}), localizador ${String(flight.booking_code)}.`
        : 'Voo nas próximas 24h: nenhum.',
    );
  }

  return `${STATIC_PROMPT}\n${dynamic.join('\n')}`;
}
