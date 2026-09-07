// Fake mínimo do client supabase-js para testar os executores de tool sem
// banco real. Cobre só a superfície usada por tripTools.ts/pendingWrites.ts:
// from().{select,insert,update,upsert,delete,eq,neq,lte,gte,order,limit,
// maybeSingle,single} + rpc(). Cada builder é "thenable" (como o real
// PostgrestFilterBuilder), então `await supabase.from(t).update(x).eq(...)`
// funciona sem precisar de `.select()` no meio.

type Row = Record<string, unknown>;

export function createTestSupabase(
  seed: Record<string, Row[]> = {},
  rpcImpl: (name: string, args: Record<string, unknown>) => { data: unknown; error: null | { message: string } } = () => ({
    data: [],
    error: null,
  }),
) {
  const tables: Record<string, Row[]> = seed;

  function makeBuilder(table: string) {
    const filters: Array<(row: Row) => boolean> = [];
    let action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
    let payload: Row | null = null;
    let upsertConflictCol = 'id';
    let single = false;

    const exec = () => {
      const rows = tables[table] ?? (tables[table] = []);

      if (action === 'insert') {
        const row = { id: (payload as Row).id ?? crypto.randomUUID(), ...(payload as Row) };
        rows.push(row);
        return { data: single ? row : [row], error: null };
      }
      if (action === 'upsert') {
        const idx = rows.findIndex(r => r[upsertConflictCol] === (payload as Row)[upsertConflictCol]);
        if (idx >= 0) rows[idx] = { ...rows[idx], ...(payload as Row) };
        else rows.push({ id: (payload as Row).id ?? crypto.randomUUID(), ...(payload as Row) });
        return { data: null, error: null };
      }

      const matched = rows.filter(r => filters.every(f => f(r)));

      if (action === 'update') {
        for (const r of matched) Object.assign(r, payload);
        return { data: null, error: null };
      }
      if (action === 'delete') {
        tables[table] = rows.filter(r => !matched.includes(r));
        return { data: null, error: null };
      }
      return { data: single ? (matched[0] ?? null) : matched, error: null };
    };

    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select() {
        return builder;
      },
      insert(obj: Row) {
        action = 'insert';
        payload = obj;
        return builder;
      },
      update(obj: Row) {
        action = 'update';
        payload = obj;
        return builder;
      },
      upsert(obj: Row, opts?: { onConflict?: string }) {
        action = 'upsert';
        payload = obj;
        upsertConflictCol = opts?.onConflict ?? 'id';
        return builder;
      },
      delete() {
        action = 'delete';
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push(r => r[col] === val);
        return builder;
      },
      neq(col: string, val: unknown) {
        filters.push(r => r[col] !== val);
        return builder;
      },
      lte(col: string, val: unknown) {
        filters.push(r => (r[col] as string) <= (val as string));
        return builder;
      },
      gte(col: string, val: unknown) {
        filters.push(r => (r[col] as string) >= (val as string));
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      maybeSingle() {
        single = true;
        return builder;
      },
      single() {
        single = true;
        return builder;
      },
      then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
        try {
          resolve(exec());
        } catch (e) {
          reject(e);
        }
      },
    };
    return builder;
  }

  return {
    from(table: string) {
      return makeBuilder(table);
    },
    rpc(name: string, args: Record<string, unknown>) {
      return Promise.resolve(rpcImpl(name, args));
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}
