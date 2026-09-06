// Tools (function calling) do bot WhatsApp: leitura e escrita sobre roteiro/tarefas.
// Args chegam do modelo Gemini — fronteira de dados externa — então cada tool
// valida os argumentos com checagens estritas antes de tocar no banco.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { GeminiToolDeclaration } from './gemini.ts';
import type { ParticipantRow } from './tripContext.ts';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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

function optionalString(args: Record<string, unknown>, field: string): string | null {
  const value = args[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_TITLE_LENGTH) {
    throw new Error(`Argumento inválido: ${field} inválido.`);
  }
  return value.trim();
}

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
    description: 'Retorna os voos da viagem com horários, trechos e localizadores.',
    parameters: { type: 'object', properties: {} },
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
  tripId: string;
  todayIso: string;
  participants: ParticipantRow[];
  /** Telefone de quem mandou a mensagem — usado para atribuir a ideia ao participante certo. */
  senderPhone?: string;
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

export function createToolExecutor(ctx: ToolContext): (name: string, args: Record<string, unknown>) => Promise<unknown> {
  const { supabase, tripId, todayIso, participants } = ctx;

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
        return { flights: data ?? [] };
      }

      case 'mark_itinerary_item_done': {
        const title = requireString(args, 'title');
        const date = optionalDate(args, 'date') ?? todayIso;
        const targets = findParticipant(participants, optionalString(args, 'participant'));

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

        const item = resolution.row;
        const current = (item.participant_status ?? {}) as Record<string, string>;
        const next = { ...current };
        for (const p of targets) next[p.id] = 'done';

        const { error: updErr } = await supabase
          .from('itinerary_items')
          .update({ participant_status: next })
          .eq('id', item.id);
        if (updErr) throw new Error(`Erro ao atualizar atividade: ${updErr.message}`);
        return {
          found: true,
          updated: true,
          title: item.title,
          markedFor: targets.map(p => p.nickname ?? p.full_name),
        };
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

        const senderDigits = (ctx.senderPhone ?? '').replace(/\D/g, '');
        const author = participants.find(p => senderDigits && (p.whatsapp_phone ?? '').replace(/\D/g, '') === senderDigits);

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

      case 'complete_task': {
        const title = requireString(args, 'title');
        const tasks = await searchTasks(supabase, tripId, title);
        const resolution = resolveMatch(tasks);
        if (resolution.kind === 'none') {
          return { found: false, message: `Nenhuma tarefa pendente encontrada com "${title}".` };
        }
        if (resolution.kind === 'ambiguous') {
          return {
            found: true,
            ambiguous: true,
            matches: resolution.rows.map(t => ({ title: t.title, due_date: t.due_date, score: t.score })),
          };
        }

        const { error: updErr } = await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', resolution.row.id);
        if (updErr) throw new Error(`Erro ao atualizar tarefa: ${updErr.message}`);
        return { found: true, updated: true, title: resolution.row.title };
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`);
    }
  };
}
