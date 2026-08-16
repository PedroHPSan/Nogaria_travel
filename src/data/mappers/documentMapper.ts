import type { DocumentFile } from '../../types/database.types';

export interface DocumentRow {
  id: string;
  trip_id: string;
  title: string;
  category: DocumentFile['category'];
  file_url: string;
  linked_entity_type: DocumentFile['linked_entity_type'] | null;
  linked_entity_id: string | null;
  uploaded_at: string;
  file_size: string | null;
  notes: string | null;
}

export function documentFromRow(row: DocumentRow): DocumentFile {
  return {
    id: row.id,
    trip_id: row.trip_id,
    title: row.title,
    category: row.category,
    file_url: row.file_url,
    linked_entity_type: row.linked_entity_type ?? undefined,
    linked_entity_id: row.linked_entity_id ?? undefined,
    uploaded_at: row.uploaded_at,
    file_size: row.file_size ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function documentToInsert(doc: DocumentFile): DocumentRow {
  return {
    id: doc.id,
    trip_id: doc.trip_id,
    title: doc.title,
    category: doc.category,
    file_url: doc.file_url,
    linked_entity_type: doc.linked_entity_type ?? null,
    linked_entity_id: doc.linked_entity_id ?? null,
    uploaded_at: doc.uploaded_at,
    file_size: doc.file_size ?? null,
    notes: doc.notes ?? null,
  };
}
