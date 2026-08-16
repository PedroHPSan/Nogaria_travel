import { describe, expect, it } from 'vitest';
import { documentFromRow, documentToInsert, type DocumentRow } from './documentMapper';
import type { DocumentFile } from '../../types/database.types';

describe('documentMapper', () => {
  const mockRow: DocumentRow = {
    id: 'doc-1',
    trip_id: 'trip-1',
    title: 'Passaporte Bárbara',
    category: 'personal',
    file_url: 'https://example.com/passaporte.pdf',
    linked_entity_type: 'participant',
    linked_entity_id: 'p-1',
    uploaded_at: '2026-08-16T12:00:00Z',
    file_size: '2.4 MB',
    notes: 'Válido até 2030',
  };

  it('converte DocumentRow para DocumentFile', () => {
    const doc = documentFromRow(mockRow);
    expect(doc.id).toBe('doc-1');
    expect(doc.title).toBe('Passaporte Bárbara');
    expect(doc.category).toBe('personal');
    expect(doc.linked_entity_type).toBe('participant');
  });

  it('serializa DocumentFile para DocumentRow sem perda', () => {
    const doc: DocumentFile = {
      id: 'doc-1',
      trip_id: 'trip-1',
      title: 'Voucher Hotel Universal',
      category: 'hotel',
      file_url: 'https://example.com/voucher.pdf',
      uploaded_at: '2026-08-16T12:00:00Z',
    };

    const row = documentToInsert(doc);
    expect(row.id).toBe('doc-1');
    expect(row.linked_entity_type).toBeNull();
    expect(row.file_size).toBeNull();
  });
});
