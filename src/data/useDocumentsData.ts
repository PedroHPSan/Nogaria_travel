import { useCallback, useEffect, useState } from 'react';
import type { DocumentFile } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { documentFromRow, documentToInsert, type DocumentRow } from './mappers/documentMapper';

export interface DocumentsDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  fallbackDocuments?: DocumentFile[];
}

export function useDocumentsData({ client, tripId, recordFailure, fallbackDocuments = [] }: DocumentsDataDeps) {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('documents')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data && data.length > 0) {
          setDocuments((data as DocumentRow[]).map(documentFromRow));
        } else if (fallbackDocuments.length > 0) {
          setDocuments(fallbackDocuments.filter(d => d.trip_id === tripId));
        } else {
          setDocuments([]);
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  const addDocument = useCallback(
    (data: Omit<DocumentFile, 'id' | 'uploaded_at'>) => {
      const doc: DocumentFile = {
        ...data,
        id: newId(),
        uploaded_at: new Date().toISOString(),
      };

      const escrever = () => {
        setDocuments(prev => [...prev, doc]);
        client
          .from('documents')
          .insert(documentToInsert(doc))
          .then(({ error }) => {
            if (!error) return;
            setDocuments(prev => prev.filter(x => x.id !== doc.id));
            recordFailure({
              entity: 'Documento',
              operation: 'criar',
              label: doc.title,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const deleteDocument = useCallback(
    (id: string) => {
      let removido: DocumentFile | undefined;

      const escrever = () => {
        setDocuments(prev => {
          removido = prev.find(x => x.id === id);
          return prev.filter(x => x.id !== id);
        });

        if (!removido) return;

        client
          .from('documents')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !removido) return;
            setDocuments(prev => [...prev, removido!]);
            recordFailure({
              entity: 'Documento',
              operation: 'excluir',
              label: removido.title,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  return {
    documents,
    loading,
    addDocument,
    deleteDocument,
  };
}
