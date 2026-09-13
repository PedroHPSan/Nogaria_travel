// Status de parque (horário de funcionamento) e de atração (OPERATING /
// DOWN / CLOSED / REFURBISHMENT) via themeparks.wiki — API pública, sem
// chave, sem auth. Tratado sempre como DICA de fonte comunitária, nunca
// verdade: nada aqui sobrescreve itinerary_items.operational_status, que é o
// que a família declarou. Cache em public.external_conditions (ver migration
// 20260914130000) para não bater a API a cada mensagem do bot.
//
// Partes puras (mapLiveDataToItems, parkWindowFromSchedule, normalize*) não
// fazem I/O e são testadas sem rede em __tests__/parkStatus.test.ts. O I/O
// (fetch + leitura/escrita de cache) fica nas funções fetchParkDayStatus /
// resolveAttractionEntityIds — mesmo corte de _shared/weather.ts.

// Tipo estrutural mínimo do client, não o SupabaseClient completo de
// 'jsr:@supabase/supabase-js@2': este módulo é importado por src/ (via
// parkNames.test.ts, que varre o catálogo real de parques), e o resolvedor
// de módulos do Vite/tsc não entende especificadores `jsr:`. Mesmo padrão de
// SupabaseLike em src/data/useTripsData.ts.
interface CacheRow {
  payload: unknown;
  fetched_at: string;
  expires_at: string;
}

interface MinimalSupabaseClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: CacheRow | null }> };
    };
    upsert: (values: unknown, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    update: (values: unknown) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> };
  };
}

const API_BASE = 'https://api.themeparks.wiki/v1';
const REQUEST_TIMEOUT_MS = 8_000;

const TTL_MS = {
  park_schedule: 6 * 60 * 60_000,
  park_live: 15 * 60_000,
  resolve_attempt: 24 * 60 * 60_000,
} as const;

/**
 * park (itinerary_items.park, exatamente como src/services/roteiro/*.ts
 * grava — NÃO o nome de exibição da themeparks.wiki, que às vezes diverge:
 * "Disney's Animal Kingdom" no roteiro vs. "Disney's Animal Kingdom Theme
 * Park" na API; "Epic Universe" vs. "Universal Epic Universe") → id de
 * entidade PARK na themeparks.wiki, já normalizado por normalizeParkKey
 * (minúsculas, sem acento, SEM apóstrofo). Mapa estático e fechado — o
 * conjunto de parques que o roteiro cobre é conhecido, em vez de resolver
 * por nome em runtime: um rename upstream viraria falso match silencioso.
 * IDs coletados uma vez em GET /v1/destinations. Ver o guard em
 * src/services/roteiro/parkNames.test.ts, que falha se um parkName do
 * roteiro não tiver entrada aqui.
 */
export const PARK_ENTITY_IDS: Record<string, string> = {
  epcot: '47f90d2c-e191-4239-a466-5892ef59a88b',
  'magic kingdom': '75ea578a-adc8-4116-a54d-dccb60765ef9',
  'disneys hollywood studios': '288747d1-8b4f-4a64-867e-ea7c9b27bad8',
  'disneys animal kingdom': '1c84a229-8862-4648-9c71-378ddd2c7693',
  'universal studios florida': 'eb3f4560-2383-4a36-9152-6b3e5ed6bc57',
  'universals islands of adventure': '267615cc-8943-4c2a-ae2c-5da728ca591f',
  'epic universe': '12dbb85b-265f-44e6-bccf-f1faa17211fc',
};

/** minúsculas, sem acento, apóstrofo removido, espaços colapsados. */
export function normalizeParkKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** null = sem palpite — nunca um chute; o chamador deve degradar para web_search. */
export function resolveParkEntityId(park: string | null | undefined): string | null {
  if (!park) return null;
  return PARK_ENTITY_IDS[normalizeParkKey(park)] ?? null;
}

// Já em forma normalizada (sem acento) — o normalizeParkKey abaixo roda ANTES
// desta lista ser consultada, então "Almoço" já virou "almoco" quando a
// comparação acontece.
const TITLE_PREFIXES_TO_STRIP = ['fila ', 'almoco em ', 'jantar em ', 'deslocamento '];

/** Remove prefixos operacionais do roteiro e normaliza acento/apóstrofo para casar com o título da API. */
export function normalizeAttractionTitle(title: string): string {
  let normalized = normalizeParkKey(title);
  for (const prefix of TITLE_PREFIXES_TO_STRIP) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length);
      break;
    }
  }
  return normalized.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export interface LiveDataEntity {
  id: string;
  name: string;
  entityType: string;
  status?: string | null;
}

export interface AttractionStatus {
  itemId: string;
  title: string;
  status: 'OPERATING' | 'DOWN' | 'CLOSED' | 'REFURBISHMENT';
}

const KNOWN_STATUSES = new Set(['OPERATING', 'DOWN', 'CLOSED', 'REFURBISHMENT']);

/**
 * Casa liveData[] (filhos do parque) com os itens do roteiro que já têm
 * external_entity_id resolvido. NUNCA casa por título no caminho quente —
 * isso é responsabilidade de resolveAttractionEntityIds, executado à parte e
 * uma vez só. Itens sem external_entity_id, ou cujo status vier fora do
 * enum conhecido, são omitidos do resultado.
 */
export function mapLiveDataToItems(
  liveData: LiveDataEntity[],
  items: { id: string; title: string; external_entity_id: string | null }[],
): AttractionStatus[] {
  const byEntityId = new Map(liveData.map(e => [e.id, e]));
  const result: AttractionStatus[] = [];
  for (const item of items) {
    if (!item.external_entity_id) continue;
    const entity = byEntityId.get(item.external_entity_id);
    if (!entity?.status || !KNOWN_STATUSES.has(entity.status)) continue;
    result.push({ itemId: item.id, title: item.title, status: entity.status as AttractionStatus['status'] });
  }
  return result;
}

export interface ScheduleEntry {
  date: string;
  type: string;
  openingTime?: string | null;
  closingTime?: string | null;
}

/**
 * Janela do parque num dia, a partir do schedule[] bruto. `type` costuma vir
 * como 'OPERATING' para o horário público padrão — 'TICKETED_EVENT' é
 * eventos à parte (ex.: Early Entry) e é ignorado aqui. Sem entrada
 * 'OPERATING' para a data = considerado fechado (parque sem operação normal
 * naquele dia, ex. manutenção geral ou fora de temporada).
 */
export function parkWindowFromSchedule(
  schedule: ScheduleEntry[],
  dateIso: string,
): { opening: string | null; closing: string | null; closed: boolean } {
  const entry = schedule.find(e => e.date === dateIso && e.type === 'OPERATING');
  if (!entry) return { opening: null, closing: null, closed: true };
  return {
    opening: entry.openingTime ? entry.openingTime.slice(11, 16) : null,
    closing: entry.closingTime ? entry.closingTime.slice(11, 16) : null,
    closed: false,
  };
}

export interface ParkDayStatus {
  park: string;
  entityId: string | null;
  opening: string | null;
  closing: string | null;
  closed: boolean;
  attractions: AttractionStatus[];
  source: 'live' | 'cache' | 'unavailable';
  fetchedAt: string | null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function readCache(supabase: MinimalSupabaseClient, cacheKey: string, allowExpired: boolean): Promise<{ payload: unknown; fetchedAt: string } | null> {
  const { data } = await supabase
    .from('external_conditions')
    .select('payload, fetched_at, expires_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  if (!data) return null;
  if (!allowExpired && new Date(data.expires_at).getTime() < Date.now()) return null;
  return { payload: data.payload, fetchedAt: data.fetched_at };
}

async function writeCache(supabase: MinimalSupabaseClient, cacheKey: string, source: 'themeparks', scope: string, payload: unknown, ttlMs: number): Promise<void> {
  await supabase.from('external_conditions').upsert(
    { cache_key: cacheKey, source, scope, payload, fetched_at: new Date().toISOString(), expires_at: new Date(Date.now() + ttlMs).toISOString() },
    { onConflict: 'cache_key' },
  );
}

/**
 * Horário do parque + status das atrações do roteiro naquele dia, para o dia
 * predominante de um conjunto de itens. Degradação em cascata: cache válido
 * → API → cache expirado (rotulado source:'cache', melhor um dado velho
 * rotulado que nada) → null (o chamador deve orientar web_search).
 */
export async function fetchParkDayStatus(
  supabase: MinimalSupabaseClient,
  input: { park: string; dateIso: string; items: { id: string; title: string; external_entity_id: string | null }[] },
): Promise<ParkDayStatus | null> {
  const entityId = resolveParkEntityId(input.park);
  if (!entityId) return null;

  const month = input.dateIso.slice(0, 7);
  const scheduleKey = `themeparks:park_schedule:${entityId}:${month}`;
  const liveKey = `themeparks:park_live:${entityId}`;

  try {
    const [scheduleCache, liveCache] = await Promise.all([
      readCache(supabase, scheduleKey, false),
      readCache(supabase, liveKey, false),
    ]);

    let schedulePayload = scheduleCache?.payload as { schedule?: ScheduleEntry[] } | undefined;
    let livePayload = liveCache?.payload as { liveData?: LiveDataEntity[] } | undefined;
    let fetchedAt = scheduleCache?.fetchedAt ?? liveCache?.fetchedAt ?? null;
    let source: ParkDayStatus['source'] = scheduleCache && liveCache ? 'cache' : 'live';

    if (!schedulePayload) {
      const [year, monthNum] = month.split('-');
      schedulePayload = (await fetchJson(`${API_BASE}/entity/${entityId}/schedule/${year}/${monthNum}`)) as { schedule?: ScheduleEntry[] };
      await writeCache(supabase, scheduleKey, 'themeparks', 'park_schedule', schedulePayload, TTL_MS.park_schedule);
      fetchedAt = new Date().toISOString();
      source = 'live';
    }
    if (!livePayload) {
      livePayload = (await fetchJson(`${API_BASE}/entity/${entityId}/live`)) as { liveData?: LiveDataEntity[] };
      await writeCache(supabase, liveKey, 'themeparks', 'park_live', livePayload, TTL_MS.park_live);
      fetchedAt = new Date().toISOString();
      source = 'live';
    }

    const window = parkWindowFromSchedule(schedulePayload.schedule ?? [], input.dateIso);
    const attractions = mapLiveDataToItems(livePayload.liveData ?? [], input.items);

    return { park: input.park, entityId, ...window, attractions, source, fetchedAt };
  } catch (err) {
    console.warn(`[parkStatus] Falha ao buscar status de "${input.park}":`, err instanceof Error ? err.message : err);
    // Última tentativa: cache expirado é melhor que nada, rotulado como tal.
    try {
      const [scheduleCache, liveCache] = await Promise.all([
        readCache(supabase, scheduleKey, true),
        readCache(supabase, liveKey, true),
      ]);
      if (!scheduleCache && !liveCache) return null;
      const schedulePayload = scheduleCache?.payload as { schedule?: ScheduleEntry[] } | undefined;
      const livePayload = liveCache?.payload as { liveData?: LiveDataEntity[] } | undefined;
      const window = parkWindowFromSchedule(schedulePayload?.schedule ?? [], input.dateIso);
      const attractions = mapLiveDataToItems(livePayload?.liveData ?? [], input.items);
      return { park: input.park, entityId, ...window, attractions, source: 'cache', fetchedAt: scheduleCache?.fetchedAt ?? liveCache?.fetchedAt ?? null };
    } catch {
      return null;
    }
  }
}

/**
 * Resolução preguiçosa e persistida de external_entity_id para os itens de
 * um parque que ainda não têm. Roda no máximo uma vez por parque por dia
 * (marca a tentativa em external_conditions mesmo sem match, para não
 * rebater a API a cada mensagem por um item sem correspondência confiável).
 * Casa por igualdade do título normalizado, ou não casa — sem fuzzy score
 * aqui: a lista de filhos de um parque (~100) tem baixo risco de colisão por
 * igualdade exata, e um match errado em produção é pior que ficar sem.
 */
export async function resolveAttractionEntityIds(
  supabase: MinimalSupabaseClient,
  input: { park: string; items: { id: string; title: string; external_entity_id: string | null }[] },
): Promise<number> {
  const pending = input.items.filter(i => !i.external_entity_id);
  if (pending.length === 0) return 0;

  const entityId = resolveParkEntityId(input.park);
  if (!entityId) return 0;

  const attemptKey = `themeparks:resolve:${entityId}`;
  const attemptCache = await readCache(supabase, attemptKey, false);
  if (attemptCache) return 0;

  let resolved = 0;
  try {
    const data = (await fetchJson(`${API_BASE}/entity/${entityId}/children`)) as { children?: { id: string; name: string }[] };
    const children = data.children ?? [];
    const byNormalizedTitle = new Map(children.map(c => [normalizeAttractionTitle(c.name), c.id]));

    for (const item of pending) {
      const match = byNormalizedTitle.get(normalizeAttractionTitle(item.title));
      if (!match) continue;
      const { error } = await supabase.from('itinerary_items').update({ external_entity_id: match }).eq('id', item.id);
      if (!error) resolved += 1;
    }
  } catch (err) {
    console.warn(`[parkStatus] Falha ao resolver atrações de "${input.park}":`, err instanceof Error ? err.message : err);
  } finally {
    await writeCache(supabase, attemptKey, 'themeparks', 'park_live', { attemptedAt: new Date().toISOString() }, TTL_MS.resolve_attempt);
  }
  return resolved;
}
