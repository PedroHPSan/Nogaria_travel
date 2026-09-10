import { useEffect } from 'react';

/**
 * Payload mínimo de um evento `postgres_changes` do Realtime do supabase-js —
 * só os campos que este hook consome.
 */
export interface RealtimePostgresChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

/**
 * Tipo estrutural mínimo do canal Realtime do supabase-js — só o que este
 * hook usa. Existe para o teste poder injetar um fake sem rede.
 */
export interface RealtimeChannelLike {
  on: (
    event: 'postgres_changes',
    filter: { event: '*'; schema: 'public'; table: string; filter?: string },
    callback: (payload: RealtimePostgresChangePayload) => void,
  ) => RealtimeChannelLike;
  subscribe: () => unknown;
}

/**
 * Tipo estrutural mínimo do cliente Realtime do supabase-js — só o que este
 * hook usa. O `supabase` real (supabase-js) satisfaz este shape; o cast
 * `as unknown as RealtimeClientLike` segue o mesmo padrão de `SupabaseLike`
 * em `useTripsData.ts`.
 */
export interface RealtimeClientLike {
  channel: (name: string) => RealtimeChannelLike;
  removeChannel: (channel: RealtimeChannelLike) => void;
}

export interface UseRealtimeTableOpts<TRow> {
  client: RealtimeClientLike | null;
  table: string;
  /** Ex.: `trip_id=eq.<id>`. Se null, o hook não assina nada. */
  filter: string | null;
  onInsert: (row: TRow) => void;
  onUpdate: (row: TRow) => void;
  onDelete: (old: { id: string }) => void;
}

/**
 * Assina mudanças (`INSERT`/`UPDATE`/`DELETE`) de uma tabela via Supabase
 * Realtime, escopadas por `filter`. Realtime é melhoria, não pré-requisito:
 * qualquer falha ao assinar é só um `console.warn`, nunca lança.
 *
 * RLS já filtra o que cada usuário recebe — `postgres_changes` respeita as
 * policies da tabela, então este hook não precisa (nem deve) reimplementar
 * autorização.
 */
export function useRealtimeTable<TRow>({
  client,
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeTableOpts<TRow>): void {
  useEffect(() => {
    if (!client || !filter) return;

    let channel: RealtimeChannelLike | null = null;

    try {
      channel = client
        .channel(`rt:${table}:${filter}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter },
          payload => {
            if (payload.eventType === 'INSERT') {
              onInsert(payload.new as TRow);
            } else if (payload.eventType === 'UPDATE') {
              onUpdate(payload.new as TRow);
            } else if (payload.eventType === 'DELETE') {
              onDelete(payload.old as { id: string });
            }
          },
        );
      channel.subscribe();
    } catch (err) {
      console.warn(`useRealtimeTable: falha ao assinar realtime de "${table}"`, err);
      return;
    }

    return () => {
      if (!channel) return;
      try {
        client.removeChannel(channel);
      } catch (err) {
        console.warn(`useRealtimeTable: falha ao remover canal de "${table}"`, err);
      }
    };
    // onInsert/onUpdate/onDelete não entram nas deps de propósito: os hooks
    // chamadores passam closures novas a cada render, e reassinar o canal a
    // cada render derrubaria/recriaria a conexão Realtime sem necessidade.
  }, [client, table, filter]);
}
