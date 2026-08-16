// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useDocumentsData } from './useDocumentsData';
import type { DocumentFile } from '../types/database.types';
import type { SupabaseLike } from './useTripsData';

afterEach(() => {
  cleanup();
});

function mockClient(initialData: unknown[] = []): SupabaseLike {
  return {
    from: () => ({
      select: () => ({
        eq: vi.fn().mockResolvedValue({ data: initialData, error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
}

describe('useDocumentsData', () => {
  const initialDoc: DocumentFile = {
    id: 'doc-1',
    trip_id: 'trip-1',
    title: 'Passaporte',
    category: 'personal',
    file_url: 'https://example.com/pass.pdf',
    uploaded_at: '2026-08-16T12:00:00Z',
  };

  it('carrega documentos do Supabase no mount', async () => {
    const client = mockClient([initialDoc]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useDocumentsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.documents.length).toBe(1);
    expect(result.current.documents[0].title).toBe('Passaporte');
  });

  it('adiciona documento com escrita otimista', async () => {
    const client = mockClient([]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useDocumentsData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.addDocument({
        trip_id: 'trip-1',
        title: 'Voucher Hotel',
        category: 'hotel',
        file_url: 'https://example.com/voucher.pdf',
      });
    });

    expect(result.current.documents.length).toBe(1);
    expect(result.current.documents[0].title).toBe('Voucher Hotel');
    expect(recordFailure).not.toHaveBeenCalled();
  });
});
