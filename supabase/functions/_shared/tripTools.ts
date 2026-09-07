// Tools (function calling) do bot WhatsApp: leitura e escrita sobre roteiro/tarefas.
// Args chegam do modelo Gemini — fronteira de dados externa — então cada tool
// valida os argumentos com checagens estritas antes de tocar no banco.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { GeminiToolDeclaration } from './gemini.ts';
import { formatLocalTime, type ParticipantRow } from './tripContext.ts';
import {
  buildDirectionsUrl,
  computeLeaveBy,
  computeRoute,
  formatEta,
  resolveOrigin,
  type DirectionsPoint,
  type TravelMode,
} from './maps.ts';
import { detectConflicts, suggestFreeSlot, type ScheduleSlot } from './scheduleConflicts.ts';
import { consumePendingWrite, stagePendingWrite } from './pendingWrites.ts';
import { sendTextMessage } from './whatsappClient.ts';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_TITLE_LENGTH = 255;

// Tetos das leituras: sem eles, uma viagem madura despeja a tabela inteira no
// contexto do modelo — token bloat que atrasa o TTFT de toda resposta seguinte.
const MAX_ROWS = 50;
const MAX_FLIGHT_ROWS = 20;
const MAX_SEARCH_CANDIDATES = 5;

// Limiares de entity resolution. `search_itinerary_items`/`search_tasks`
// devolvem candidatos com score de similaridade (0-1); a escrita só acontece
// quando o melhor candidato é bom o bastante E está claramente à frente do
// segundo. Empate técnico vira desambiguação, não um chute.
const MIN_DECISIVE_SCORE = 0.6;
const MIN_SCORE_MARGIN = 0.15;

interface ScoredRow {
  id: string;
  title: string;
  score: number;
}

type Resolution<T extends ScoredRow> =
  | { kind: 'none' }
  | { kind: 'one'; row: T }
  | { kind: 'ambiguous'; rows: T[] };

/**
 * Decide entre agir e perguntar. Um único candidato fraco também vira pergunta:
 * "achei só isso, com 0.35 de similaridade" é um falso positivo esperando
 * acontecer numa tool de escrita.
 */
export function resolveMatch<T extends ScoredRow>(rows: T[]): Resolution<T> {
  if (rows.length === 0) return { kind: 'none' };
  const [best, runnerUp] = rows;
  const decisive =
    best.score >= MIN_DECISIVE_SCORE && (!runnerUp || best.score - runnerUp.score >= MIN_SCORE_MARGIN);
  return decisive ? { kind: 'one', row: best } : { kind: 'ambiguous', rows: rows.slice(0, MAX_SEARCH_CANDIDATES) };
}

function requireString(args: Record<string, unknown>, field: string): string {
  const value = args[field];
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_TITLE_LENGTH) {
    throw new Error(`Argumento inválido: ${field} ausente ou inválido.`);
  }
  return value.trim();
}

function optionalDate(args: Record<string, unknown>, field: string): string | null {
  const value = args[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new Error(`Argumento inválido: ${field} deve estar no formato AAAA-MM-DD.`);
  }
  return value;
}

function optionalTime(args: Record<string, unknown>, field: string): string | null {
  const value = args[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !TIME_RE.test(value)) {
    throw new Error(`Argumento inválido: ${field} deve estar no formato HH:MM.`);
  }
  return value;
}

function optionalString(args: Record<string, unknown>, field: string): string | null {
  const value = args[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_TITLE_LENGTH) {
    throw new Error(`Argumento inválido: ${field} inválido.`);
  }
  return value.trim();
}

function optionalInt(args: Record<string, unknown>, field: string, min: number, max: number): number | null {
  const value = args[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Argumento inválido: ${field} deve ser um inteiro entre ${min} e ${max}.`);
  }
  return value;
}

const CONFIRM_DESCRIPTION =
  'true só depois que a família confirmar explicitamente, numa mensagem seguinte, o resumo que você mostrou na resposta anterior. Nunca marque true na mesma mensagem que ainda não foi confirmada.';

export const TOOL_DECLARATIONS: GeminiToolDeclaration[] = [
  {
    name: 'get_itinerary',
    description: 'Lista as atividades do roteiro de uma data (AAAA-MM-DD). Se a data for omitida, usa a data de hoje.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Data no formato AAAA-MM-DD (opcional).' },
      },
    },
  },
  {
    name: 'get_tasks',
    description: 'Lista as tarefas da viagem, opcionalmente filtradas por status.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'Status da tarefa (opcional).' },
      },
    },
  },
  {
    name: 'get_flight_info',
    description: 'Retorna os voos da viagem com horários (já no fuso local do destino, não converta), trechos e localizadores.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_directions',
    description:
      'Calcula a rota até uma atividade do roteiro ou um lugar livre (farmácia, restaurante, etc). Devolve link do Google Maps e, quando possível, tempo estimado e o horário-limite para sair. Repasse só o link e o tempo em 1-2 frases — nunca descreva o trajeto passo a passo.',
    parameters: {
      type: 'object',
      properties: {
        destination_title: { type: 'string', description: 'Nome do lugar ou título (exato/aproximado) da atividade do roteiro.' },
        date: { type: 'string', description: 'Data AAAA-MM-DD da atividade, só para desambiguar (opcional, default hoje).' },
        from: { type: 'string', description: 'Ponto de partida, se a família mencionar um (ex: "do hotel", "do Epcot"). Opcional — se omitido, a tool resolve sozinha.' },
        travel_mode: { type: 'string', enum: ['driving', 'walking', 'transit', 'bicycling'], description: 'Modo de transporte (opcional, default driving).' },
      },
      required: ['destination_title'],
    },
  },
  {
    name: 'mark_itinerary_item_done',
    description: 'Marca uma atração/atividade do roteiro como concluída para um participante (ou todos, se omitido).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título (exato ou aproximado) da atividade.' },
        date: { type: 'string', description: 'Data AAAA-MM-DD (opcional, default hoje).' },
        participant: { type: 'string', description: 'Nome ou apelido do participante (opcional).' },
        confirm: { type: 'boolean', description: CONFIRM_DESCRIPTION },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    description: 'Marca uma tarefa da viagem como concluída.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título (exato ou aproximado) da tarefa.' },
        confirm: { type: 'boolean', description: CONFIRM_DESCRIPTION },
      },
      required: ['title'],
    },
  },
  {
    name: 'reschedule_itinerary_item',
    description:
      'Move uma atividade do roteiro para outra data/horário, ou atrasa/adianta em X minutos. SEMPRE chame primeiro sem confirm — a tool devolve um resumo da mudança (e avisa de conflito de horário, se houver) para você mostrar à família antes de aplicar. Só chame de novo com confirm=true depois que a família confirmar explicitamente numa mensagem seguinte.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título (exato ou aproximado) da atividade.' },
        date: { type: 'string', description: 'Data ATUAL do item, AAAA-MM-DD (opcional, default hoje) — usada para achar o item, não o novo horário.' },
        new_date: { type: 'string', description: 'Nova data AAAA-MM-DD (opcional, se omitido mantém a data atual).' },
        new_time_start: { type: 'string', description: 'Novo horário HH:MM (opcional, se omitido mantém o horário atual).' },
        shift_minutes: { type: 'integer', description: 'Desloca o horário atual em minutos (-720 a 720). Use para "atrasamos 40 minutos" em vez de calcular você mesmo o novo horário. Não combine com new_date/new_time_start.' },
        confirm: { type: 'boolean', description: CONFIRM_DESCRIPTION },
      },
      required: ['title'],
    },
  },
  {
    name: 'set_activity_reminder',
    description:
      'Define de quantos minutos de antecedência a família quer ser avisada de uma atividade do roteiro. ' +
      'Use quando pedirem algo como "me avisa 30 minutos antes do jantar" ou "avisa com 2 horas de antecedência do Magic Kingdom". ' +
      'Use minutes_before = 0 para desligar o aviso daquela atividade.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título (exato ou aproximado) da atividade.' },
        minutes_before: { type: 'integer', description: 'Antecedência do aviso, em minutos (0 a 720).' },
        date: { type: 'string', description: 'Data AAAA-MM-DD (opcional, default hoje).' },
      },
      required: ['title', 'minutes_before'],
    },
  },
  {
    name: 'save_trip_idea',
    description:
      'Salva uma ideia de negócio ou de viagem que o participante compartilhou, para a sessão de brainstorming da família. ' +
      'Use sempre que alguém mandar uma ideia, insight ou sugestão espontânea (ex: "ideia de negócio: ...", "e se a gente...", "seria legal fazer...").',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'O texto da ideia, resumido de forma clara.' },
        category: { type: 'string', enum: ['negocio', 'viagem', 'outro'], description: 'Categoria da ideia (opcional).' },
      },
      required: ['content'],
    },
  },
  {
    name: 'list_trip_ideas',
    description: 'Lista as últimas ideias já registradas na sessão de brainstorming da viagem.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['negocio', 'viagem', 'outro'], description: 'Filtrar por categoria (opcional).' },
      },
    },
  },
];

export interface ToolContext {
  supabase: SupabaseClient;
  tenantId: string;
  tripId: string;
  todayIso: string;
  participants: ParticipantRow[];
  /** Fuso do tenant (whatsapp_configs.timezone) — usado para converter horários de voo (UTC no banco) e calcular leave_by. */
  timeZone: string;
  /** Telefone de quem mandou a mensagem. Exigido pelas tools de confirmação em duas fases (a pendência é indexada por ele) e para atribuir ideias/localização ao participante certo. */
  senderPhone: string;
  /** Necessários só para o fan-out do reschedule (avisar os outros participantes). */
  phoneNumberId: string;
  metaAccessToken: string;
  /** ETA do get_directions via Routes API. Sem ela a tool ainda funciona — só devolve o link, sem ETA/leave_by. */
  googleMapsApiKey: string | null;
}

function findParticipant(participants: ParticipantRow[], nameOrNick: string | null): ParticipantRow[] {
  if (!nameOrNick) return participants;
  const needle = nameOrNick.toLowerCase();
  const match = participants.filter(
    p => p.full_name.toLowerCase().includes(needle) || (p.nickname ?? '').toLowerCase().includes(needle),
  );
  if (match.length === 0) throw new Error(`Participante "${nameOrNick}" não encontrado na viagem.`);
  return match;
}

function findParticipantByPhone(participants: ParticipantRow[], phone: string): ParticipantRow | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  return participants.find(p => (p.whatsapp_phone ?? '').replace(/\D/g, '') === digits) ?? null;
}

interface ItineraryMatch extends ScoredRow {
  item_date: string;
  time_start: string | null;
  participant_status: Record<string, string> | null;
}

interface TaskMatch extends ScoredRow {
  status: string;
  due_date: string | null;
}

/**
 * Busca ranqueada no roteiro via RPC `search_itinerary_items`, que normaliza
 * acento e tolera erro de digitação (unaccent + trigrama). Substitui o
 * `ilike '%texto%'`, que não casava "montanha russa" com "Montanha-Russa".
 */
async function searchItinerary(
  supabase: SupabaseClient,
  tripId: string,
  query: string,
  date: string | null,
): Promise<ItineraryMatch[]> {
  const { data, error } = await supabase.rpc('search_itinerary_items', {
    p_trip_id: tripId,
    p_query: query,
    p_date: date,
    p_limit: MAX_SEARCH_CANDIDATES,
  });
  if (error) throw new Error(`Erro ao consultar roteiro: ${error.message}`);
  return (data ?? []) as ItineraryMatch[];
}

/** Mesma busca ranqueada, sobre tarefas ainda abertas. */
async function searchTasks(supabase: SupabaseClient, tripId: string, query: string): Promise<TaskMatch[]> {
  const { data, error } = await supabase.rpc('search_tasks', {
    p_trip_id: tripId,
    p_query: query,
    p_statuses: ['pending', 'in_progress'],
    p_limit: MAX_SEARCH_CANDIDATES,
  });
  if (error) throw new Error(`Erro ao consultar tarefas: ${error.message}`);
  return (data ?? []) as TaskMatch[];
}

// ---------------------------------------------------------------------------
// Confirmação em duas fases (mark_itinerary_item_done, complete_task,
// reschedule_itinerary_item). Ver pendingWrites.ts para o "porquê" de indexar
// por telefone em vez de um token.
// ---------------------------------------------------------------------------

/** O que `prepare()` devolve: ou uma resposta pronta (achou nada / ambíguo — não precisa confirmação), ou algo a confirmar. */
type PrepareOutcome = { kind: 'resolved'; response: unknown } | { kind: 'stage'; preview: string; payload: Record<string, unknown> };

async function withConfirmation(
  ctx: Pick<ToolContext, 'supabase' | 'tenantId' | 'tripId' | 'senderPhone'>,
  toolName: string,
  confirm: boolean,
  prepare: () => Promise<PrepareOutcome>,
  commit: (payload: Record<string, unknown>) => Promise<unknown>,
): Promise<unknown> {
  if (confirm) {
    const payload = await consumePendingWrite(ctx.supabase, { senderPhone: ctx.senderPhone, toolName });
    if (!payload) {
      return { confirmed: false, message: 'Não achei nenhuma ação pendente para confirmar — peça de novo.' };
    }
    return commit(payload);
  }

  const outcome = await prepare();
  if (outcome.kind === 'resolved') return outcome.response;

  await stagePendingWrite(ctx.supabase, {
    tenantId: ctx.tenantId,
    tripId: ctx.tripId,
    senderPhone: ctx.senderPhone,
    toolName,
    payload: outcome.payload,
    preview: outcome.preview,
  });
  return { confirmation_needed: true, preview: outcome.preview };
}

// ---------------------------------------------------------------------------
// Maps/rotas
// ---------------------------------------------------------------------------

interface AccommodationRow {
  name: string;
  address: string | null;
  place_id: string | null;
}

async function fetchActiveAccommodation(
  supabase: SupabaseClient,
  tripId: string,
  dateIso: string,
): Promise<AccommodationRow | null> {
  const { data } = await supabase
    .from('accommodations')
    .select('name, address, place_id')
    .eq('trip_id', tripId)
    .lte('check_in', dateIso)
    .gte('check_out', dateIso)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function fetchParticipantPin(
  supabase: SupabaseClient,
  participantId: string,
): Promise<{ lat: number; lng: number; sharedAt: string } | null> {
  const { data } = await supabase
    .from('participant_locations')
    .select('lat, lng, shared_at')
    .eq('participant_id', participantId)
    .maybeSingle();
  if (!data) return null;
  return { lat: data.lat, lng: data.lng, sharedAt: data.shared_at };
}

// ---------------------------------------------------------------------------
// Reagendamento — aritmética de horário e checagem de conflito
// ---------------------------------------------------------------------------

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number): string {
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export interface ItineraryItemRow {
  id: string;
  title: string;
  date: string;
  time_start: string;
  time_end: string | null;
}

interface RescheduleTarget {
  newDate: string;
  newTimeStart: string;
  newTimeEnd: string | null;
}

/**
 * Resolve a nova data/horário a partir de (new_date/new_time_start) OU
 * shift_minutes, preservando a duração original do item. `shift_minutes` que
 * cruza a meia-noite é rejeitado — rolar o dia sozinho é decisão da família,
 * não do bot.
 */
export function resolveRescheduleTarget(
  item: ItineraryItemRow,
  args: { newDate: string | null; newTimeStart: string | null; shiftMinutes: number | null },
): RescheduleTarget {
  const durationMin = item.time_end ? timeToMinutes(item.time_end) - timeToMinutes(item.time_start) : null;

  if (args.shiftMinutes !== null) {
    if (args.newDate || args.newTimeStart) {
      throw new Error('Argumento inválido: use shift_minutes OU new_date/new_time_start, não os dois.');
    }
    const startMin = timeToMinutes(item.time_start) + args.shiftMinutes;
    if (startMin < 0 || startMin >= 24 * 60) {
      throw new Error('Esse deslocamento cruza a meia-noite — peça a nova data e horário diretamente em vez de um deslocamento.');
    }
    const newTimeStart = minutesToTime(startMin);
    const newTimeEnd = durationMin !== null ? minutesToTime(startMin + durationMin) : null;
    return { newDate: item.date, newTimeStart, newTimeEnd };
  }

  const newDate = args.newDate ?? item.date;
  const newTimeStart = args.newTimeStart ?? item.time_start.slice(0, 5);
  const newTimeEnd = durationMin !== null ? minutesToTime(timeToMinutes(newTimeStart) + durationMin) : null;
  return { newDate, newTimeStart, newTimeEnd };
}

export function createToolExecutor(ctx: ToolContext): (name: string, args: Record<string, unknown>) => Promise<unknown> {
  const { supabase, tenantId, tripId, todayIso, participants, timeZone, senderPhone, phoneNumberId, metaAccessToken, googleMapsApiKey } = ctx;

  return async (name, args) => {
    switch (name) {
      case 'get_itinerary': {
        const date = optionalDate(args, 'date') ?? todayIso;
        const { data, error } = await supabase
          .from('itinerary_items')
          .select('date, time_start, time_end, title, category, city, park, notes, min_height_cm')
          .eq('trip_id', tripId)
          .eq('date', date)
          .order('time_start', { ascending: true })
          .limit(MAX_ROWS);
        if (error) throw new Error(`Erro ao consultar roteiro: ${error.message}`);
        return { date, items: data ?? [] };
      }

      case 'get_tasks': {
        const status = optionalString(args, 'status');
        if (status && !['pending', 'in_progress', 'completed'].includes(status)) {
          throw new Error('Argumento inválido: status deve ser pending, in_progress ou completed.');
        }
        let query = supabase
          .from('tasks')
          .select('title, due_date, priority, status, category')
          .eq('trip_id', tripId)
          .order('due_date', { ascending: true })
          .limit(MAX_ROWS);
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw new Error(`Erro ao consultar tarefas: ${error.message}`);
        return { tasks: data ?? [] };
      }

      case 'get_flight_info': {
        const { data, error } = await supabase
          .from('flights')
          .select('airline, flight_number, origin_airport, destination_airport, departure_time, arrival_time, booking_code, status')
          .eq('trip_id', tripId)
          .order('departure_time', { ascending: true })
          .limit(MAX_FLIGHT_ROWS);
        if (error) throw new Error(`Erro ao consultar voos: ${error.message}`);
        // departure_time/arrival_time vêm em UTC do Postgres; convertidos aqui para
        // o fuso do tenant, senão o modelo lê os dígitos crus como se já fossem hora local.
        const flights = (data ?? []).map(f => ({
          ...f,
          departure_time: formatLocalTime(f.departure_time, timeZone),
          arrival_time: f.arrival_time ? formatLocalTime(f.arrival_time, timeZone) : null,
        }));
        return { flights, timezone: timeZone };
      }

      case 'get_directions': {
        const destinationTitle = requireString(args, 'destination_title');
        const date = optionalDate(args, 'date') ?? todayIso;
        const fromText = optionalString(args, 'from');
        const travelModeArg = optionalString(args, 'travel_mode');
        const travelMode = (['driving', 'walking', 'transit', 'bicycling'] as const).includes(travelModeArg as TravelMode)
          ? (travelModeArg as TravelMode)
          : 'driving';

        // Tenta casar com um item do roteiro pra ter local estruturado e horário
        // (pro leave_by); se não achar, trata como lugar livre — falso positivo
        // numa leitura é barato, ao contrário de uma tool de escrita.
        const matches = await searchItinerary(supabase, tripId, destinationTitle, date);
        const resolution = resolveMatch(matches);

        let destinationText = destinationTitle;
        let destinationPlaceId: string | null = null;
        let activityTimeStart: string | null = null;
        let recommendedArrivalMinBefore: number | null = null;

        if (resolution.kind === 'one') {
          const { data: full } = await supabase
            .from('itinerary_items')
            .select('title, location, park, city, place_id, time_start, recommended_arrival_min_before')
            .eq('id', resolution.row.id)
            .maybeSingle();
          if (full) {
            destinationText = (full.location as string | null) || [full.park, full.city].filter(Boolean).join(', ') || full.title;
            destinationPlaceId = full.place_id;
            activityTimeStart = full.time_start;
            recommendedArrivalMinBefore = full.recommended_arrival_min_before;
          }
        }

        const accommodation = await fetchActiveAccommodation(supabase, tripId, date);
        const sender = findParticipantByPhone(participants, senderPhone);
        const pin = sender ? await fetchParticipantPin(supabase, sender.id) : null;

        const origin = resolveOrigin({
          explicit: fromText ? { text: fromText } : null,
          pin,
          accommodation: accommodation
            ? { text: accommodation.address ? `${accommodation.name}, ${accommodation.address}` : accommodation.name }
            : null,
          now: new Date(),
        });

        const destination: DirectionsPoint = { text: destinationText, placeId: destinationPlaceId };
        const mapsUrl = buildDirectionsUrl({ origin: origin.point ?? null, destination, travelMode });

        let eta: { minutes: number; km: number; text: string } | null = null;
        if (googleMapsApiKey && origin.point) {
          const route = await computeRoute({ apiKey: googleMapsApiKey, origin: origin.point, destination, travelMode }).catch(() => null);
          if (route) {
            eta = {
              minutes: Math.round(route.durationSeconds / 60),
              km: Number((route.distanceMeters / 1000).toFixed(1)),
              text: formatEta(route.durationSeconds, route.distanceMeters),
            };
          }
        }

        const leaveBy =
          eta && activityTimeStart
            ? computeLeaveBy({
                activityTimeStart,
                etaSeconds: eta.minutes * 60,
                recommendedArrivalMinBefore,
              })
            : null;

        return {
          destination: destinationText,
          origin: origin.kind === 'ask' ? null : origin.label,
          maps_url: mapsUrl,
          eta,
          leave_by: leaveBy,
          needs_location: origin.kind === 'ask',
        };
      }

      case 'mark_itinerary_item_done': {
        const confirm = args.confirm === true;
        return withConfirmation(
          { supabase, tenantId, tripId, senderPhone },
          'mark_itinerary_item_done',
          confirm,
          async (): Promise<PrepareOutcome> => {
            const title = requireString(args, 'title');
            const date = optionalDate(args, 'date') ?? todayIso;
            const targets = findParticipant(participants, optionalString(args, 'participant'));

            const items = await searchItinerary(supabase, tripId, title, date);
            const resolution = resolveMatch(items);
            if (resolution.kind === 'none') {
              return { kind: 'resolved', response: { found: false, message: `Nenhuma atividade encontrada com "${title}" em ${date}.` } };
            }
            if (resolution.kind === 'ambiguous') {
              return {
                kind: 'resolved',
                response: {
                  found: true,
                  ambiguous: true,
                  matches: resolution.rows.map(i => ({ title: i.title, time: i.time_start, score: i.score })),
                },
              };
            }

            const item = resolution.row;
            const names = targets.map(p => p.nickname ?? p.full_name).join(', ');
            const preview = `Marcar "${item.title}" (${date}${item.time_start ? ` ${item.time_start.slice(0, 5)}` : ''}) como concluída para ${names}?`;
            return { kind: 'stage', preview, payload: { itemId: item.id, itemTitle: item.title, targetIds: targets.map(p => p.id) } };
          },
          async payload => {
            const itemId = payload.itemId as string;
            const { data: current } = await supabase
              .from('itinerary_items')
              .select('title, participant_status')
              .eq('id', itemId)
              .maybeSingle();
            if (!current) return { found: false, message: 'Essa atividade não existe mais no roteiro.' };

            const next = { ...((current.participant_status as Record<string, string> | null) ?? {}) };
            for (const id of payload.targetIds as string[]) next[id] = 'done';

            const { error } = await supabase.from('itinerary_items').update({ participant_status: next }).eq('id', itemId);
            if (error) throw new Error(`Erro ao atualizar atividade: ${error.message}`);

            const markedFor = (payload.targetIds as string[]).map(id => {
              const p = participants.find(x => x.id === id);
              return p?.nickname ?? p?.full_name ?? id;
            });
            return { found: true, updated: true, title: current.title, markedFor };
          },
        );
      }

      case 'complete_task': {
        const confirm = args.confirm === true;
        return withConfirmation(
          { supabase, tenantId, tripId, senderPhone },
          'complete_task',
          confirm,
          async (): Promise<PrepareOutcome> => {
            const title = requireString(args, 'title');
            const tasks = await searchTasks(supabase, tripId, title);
            const resolution = resolveMatch(tasks);
            if (resolution.kind === 'none') {
              return { kind: 'resolved', response: { found: false, message: `Nenhuma tarefa pendente encontrada com "${title}".` } };
            }
            if (resolution.kind === 'ambiguous') {
              return {
                kind: 'resolved',
                response: {
                  found: true,
                  ambiguous: true,
                  matches: resolution.rows.map(t => ({ title: t.title, due_date: t.due_date, score: t.score })),
                },
              };
            }

            const task = resolution.row;
            return {
              kind: 'stage',
              preview: `Marcar a tarefa "${task.title}" como concluída?`,
              payload: { taskId: task.id, taskTitle: task.title },
            };
          },
          async payload => {
            const taskId = payload.taskId as string;
            const { error } = await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId);
            if (error) throw new Error(`Erro ao atualizar tarefa: ${error.message}`);
            return { found: true, updated: true, title: payload.taskTitle };
          },
        );
      }

      case 'reschedule_itinerary_item': {
        const confirm = args.confirm === true;
        return withConfirmation(
          { supabase, tenantId, tripId, senderPhone },
          'reschedule_itinerary_item',
          confirm,
          async (): Promise<PrepareOutcome> => {
            const title = requireString(args, 'title');
            const currentDate = optionalDate(args, 'date') ?? todayIso;
            const newDateArg = optionalDate(args, 'new_date');
            const newTimeStartArg = optionalTime(args, 'new_time_start');
            const shiftMinutes = optionalInt(args, 'shift_minutes', -720, 720);
            if (!newDateArg && !newTimeStartArg && shiftMinutes === null) {
              throw new Error('Argumento inválido: informe new_date, new_time_start ou shift_minutes.');
            }

            // Busca pela data ATUAL do item, nunca pela nova — é o item que ainda
            // não foi movido que precisa ser encontrado.
            const matches = await searchItinerary(supabase, tripId, title, currentDate);
            const resolution = resolveMatch(matches);
            if (resolution.kind === 'none') {
              return { kind: 'resolved', response: { found: false, message: `Nenhuma atividade encontrada com "${title}" em ${currentDate}.` } };
            }
            if (resolution.kind === 'ambiguous') {
              return {
                kind: 'resolved',
                response: {
                  found: true,
                  ambiguous: true,
                  matches: resolution.rows.map(i => ({ title: i.title, time: i.time_start, score: i.score })),
                },
              };
            }

            const { data: fullItem } = await supabase
              .from('itinerary_items')
              .select('id, title, date, time_start, time_end')
              .eq('id', resolution.row.id)
              .maybeSingle();
            if (!fullItem) return { kind: 'resolved', response: { found: false, message: 'Essa atividade não existe mais no roteiro.' } };

            const { data: trip } = await supabase.from('trips').select('start_date, end_date').eq('id', tripId).maybeSingle();

            const target = resolveRescheduleTarget(fullItem as ItineraryItemRow, {
              newDate: newDateArg,
              newTimeStart: newTimeStartArg,
              shiftMinutes,
            });

            if (trip && (target.newDate < trip.start_date || target.newDate > trip.end_date)) {
              throw new Error(`Nova data fora do período da viagem (${trip.start_date} a ${trip.end_date}).`);
            }

            const { data: dayItems } = await supabase
              .from('itinerary_items')
              .select('id, title, time_start, time_end')
              .eq('trip_id', tripId)
              .eq('date', target.newDate)
              .neq('id', fullItem.id);

            const movedSlot: ScheduleSlot = { id: fullItem.id, title: fullItem.title, timeStart: target.newTimeStart, timeEnd: target.newTimeEnd };
            const daySlots: ScheduleSlot[] = (dayItems ?? []).map(i => ({
              id: i.id,
              title: i.title,
              timeStart: i.time_start,
              timeEnd: i.time_end,
            }));
            const conflicts = detectConflicts(movedSlot, daySlots);

            let preview = `Mover "${fullItem.title}" de ${fullItem.date} ${fullItem.time_start.slice(0, 5)} para ${target.newDate} ${target.newTimeStart}?`;
            if (conflicts.length > 0) {
              const suggestion = suggestFreeSlot(movedSlot, daySlots);
              preview += ` ⚠️ Conflita com "${conflicts.map(c => c.title).join('", "')}" nesse horário.`;
              if (suggestion) preview += ` Horário livre mais próximo: ${suggestion}.`;
            }

            return {
              kind: 'stage',
              preview,
              payload: {
                itemId: fullItem.id,
                itemTitle: fullItem.title,
                fromDate: fullItem.date,
                fromTimeStart: fullItem.time_start,
                newDate: target.newDate,
                newTimeStart: target.newTimeStart,
                newTimeEnd: target.newTimeEnd,
              },
            };
          },
          async payload => {
            const itemId = payload.itemId as string;
            const { error } = await supabase
              .from('itinerary_items')
              .update({ date: payload.newDate, time_start: payload.newTimeStart, time_end: payload.newTimeEnd })
              .eq('id', itemId);
            if (error) throw new Error(`Erro ao reagendar atividade: ${error.message}`);

            // O lembrete já pode ter sido reservado/enviado pro horário antigo; a
            // chave única (item, participante, kind) do ledger impediria o aviso
            // do horário novo de sair se essa linha continuasse aqui.
            await supabase.from('activity_reminders').delete().eq('itinerary_item_id', itemId).eq('kind', 'lead');

            // Fan-out best-effort: são conversas 1:1 (sem grupo), então quem não
            // falou com o bot nas últimas 24h não recebe texto livre — a falha é
            // reportada de volta pra quem reagendou, não escondida.
            const sender = findParticipantByPhone(participants, senderPhone);
            const others = participants.filter(p => p.id !== sender?.id && p.whatsapp_phone);
            const notified: string[] = [];
            const notReached: string[] = [];
            const text = `📅 *Roteiro atualizado*: "${payload.itemTitle}" foi movido para ${payload.newDate} às ${String(payload.newTimeStart).slice(0, 5)}.`;
            for (const p of others) {
              try {
                await sendTextMessage({
                  phoneNumberId,
                  accessToken: metaAccessToken,
                  to: p.whatsapp_phone!.replace(/\D/g, ''),
                  text,
                });
                notified.push(p.nickname ?? p.full_name);
              } catch {
                notReached.push(p.nickname ?? p.full_name);
              }
            }

            return {
              rescheduled: true,
              title: payload.itemTitle,
              from: { date: payload.fromDate, time: String(payload.fromTimeStart).slice(0, 5) },
              to: { date: payload.newDate, time: payload.newTimeStart },
              notified,
              notReached,
            };
          },
        );
      }

      case 'set_activity_reminder': {
        const title = requireString(args, 'title');
        const date = optionalDate(args, 'date') ?? todayIso;
        const minutes = args.minutes_before;
        if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0 || minutes > 720) {
          throw new Error('Argumento inválido: minutes_before deve ser um inteiro entre 0 e 720.');
        }

        const items = await searchItinerary(supabase, tripId, title, date);
        const resolution = resolveMatch(items);
        if (resolution.kind === 'none') {
          return { found: false, message: `Nenhuma atividade encontrada com "${title}" em ${date}.` };
        }
        if (resolution.kind === 'ambiguous') {
          return {
            found: true,
            ambiguous: true,
            matches: resolution.rows.map(i => ({ title: i.title, time: i.time_start, score: i.score })),
          };
        }

        const { error: updErr } = await supabase
          .from('itinerary_items')
          .update({ reminder_minutes_before: minutes })
          .eq('id', resolution.row.id);
        if (updErr) throw new Error(`Erro ao ajustar o aviso: ${updErr.message}`);
        return {
          found: true,
          updated: true,
          title: resolution.row.title,
          minutes_before: minutes,
          disabled: minutes === 0,
        };
      }

      case 'save_trip_idea': {
        const content = requireString(args, 'content');
        const category = optionalString(args, 'category');
        if (category && !['negocio', 'viagem', 'outro'].includes(category)) {
          throw new Error('Argumento inválido: category deve ser negocio, viagem ou outro.');
        }

        const author = findParticipantByPhone(participants, senderPhone);

        const { data, error } = await supabase
          .from('trip_ideas')
          .insert({
            trip_id: tripId,
            participant_id: author?.id ?? null,
            content,
            category: category ?? null,
            source: 'whatsapp',
            status: 'novo',
          })
          .select('id')
          .single();
        if (error) throw new Error(`Erro ao salvar ideia: ${error.message}`);
        return { saved: true, id: data.id, author: author?.nickname ?? author?.full_name ?? null };
      }

      case 'list_trip_ideas': {
        const category = optionalString(args, 'category');
        let query = supabase
          .from('trip_ideas')
          .select('content, category, status, created_at')
          .eq('trip_id', tripId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (category) query = query.eq('category', category);
        const { data, error } = await query;
        if (error) throw new Error(`Erro ao consultar ideias: ${error.message}`);
        return { ideas: data ?? [] };
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`);
    }
  };
}
