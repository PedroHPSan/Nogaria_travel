import type { TripIdea } from '../../types/database.types';

/** Linha da tabela public.trip_ideas exatamente como o Postgres devolve. */
export interface TripIdeaRow {
  id: string;
  trip_id: string;
  participant_id: string | null;
  content: string;
  category: 'negocio' | 'viagem' | 'outro' | null;
  source: 'whatsapp' | 'app';
  status: 'novo' | 'em_analise' | 'descartado' | 'aprovado';
  created_at: string;
}

export function tripIdeaFromRow(row: TripIdeaRow): TripIdea {
  return {
    id: row.id,
    trip_id: row.trip_id,
    participant_id: row.participant_id ?? undefined,
    content: row.content,
    category: row.category ?? undefined,
    source: row.source,
    status: row.status,
    created_at: row.created_at,
  };
}

export function tripIdeaToInsert(idea: TripIdea): TripIdeaRow {
  return {
    id: idea.id,
    trip_id: idea.trip_id,
    participant_id: idea.participant_id ?? null,
    content: idea.content,
    category: idea.category ?? null,
    source: idea.source,
    status: idea.status,
    created_at: idea.created_at,
  };
}
