// Tools (function calling) do bot WhatsApp: leitura e escrita sobre roteiro/tarefas.
// Args chegam do modelo Gemini — fronteira de dados externa — então cada tool
// valida os argumentos com checagens estritas antes de tocar no banco.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { GeminiToolDeclaration } from './gemini.ts';
import type { ParticipantRow } from './tripContext.ts';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TITLE_LENGTH = 255;

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
];

export interface ToolContext {
  supabase: SupabaseClient;
  tripId: string;
  todayIso: string;
  participants: ParticipantRow[];
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
          .order('time_start', { ascending: true });
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
          .order('due_date', { ascending: true });
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
          .order('departure_time', { ascending: true });
        if (error) throw new Error(`Erro ao consultar voos: ${error.message}`);
        return { flights: data ?? [] };
      }

      case 'mark_itinerary_item_done': {
        const title = requireString(args, 'title');
        const date = optionalDate(args, 'date') ?? todayIso;
        const targets = findParticipant(participants, optionalString(args, 'participant'));

        const { data: items, error } = await supabase
          .from('itinerary_items')
          .select('id, title, participant_status')
          .eq('trip_id', tripId)
          .eq('date', date)
          .ilike('title', `%${title}%`);
        if (error) throw new Error(`Erro ao consultar roteiro: ${error.message}`);
        if (!items || items.length === 0) {
          return { found: false, message: `Nenhuma atividade encontrada com "${title}" em ${date}.` };
        }
        if (items.length > 1) {
          return { found: true, ambiguous: true, matches: items.map(i => i.title) };
        }

        const item = items[0];
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

      case 'complete_task': {
        const title = requireString(args, 'title');
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('id, title, status')
          .eq('trip_id', tripId)
          .in('status', ['pending', 'in_progress'])
          .ilike('title', `%${title}%`);
        if (error) throw new Error(`Erro ao consultar tarefas: ${error.message}`);
        if (!tasks || tasks.length === 0) {
          return { found: false, message: `Nenhuma tarefa pendente encontrada com "${title}".` };
        }
        if (tasks.length > 1) {
          return { found: true, ambiguous: true, matches: tasks.map(t => t.title) };
        }

        const { error: updErr } = await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', tasks[0].id);
        if (updErr) throw new Error(`Erro ao atualizar tarefa: ${updErr.message}`);
        return { found: true, updated: true, title: tasks[0].title };
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`);
    }
  };
}
