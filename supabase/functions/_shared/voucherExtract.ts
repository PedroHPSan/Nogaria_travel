// Ingestão de voucher/confirmação por foto ou PDF (issue #28) — parte pura.
// O Gemini devolve JSON livre; aqui é a fronteira de dados: tudo que não bate
// com o formato esperado é rejeitado (null), nunca gravado. O que passa vira
// um preview pra família confirmar — a gravação em si acontece na tool
// create_*_from_document, em duas fases, como as outras escritas do bot.

export interface FlightExtraction {
  kind: 'flight';
  airline: string;
  flight_number: string;
  origin_airport: string;
  destination_airport: string;
  /** Hora local do aeroporto de origem, "YYYY-MM-DDTHH:MM". */
  departure_local: string;
  /** Hora local do aeroporto de destino, "YYYY-MM-DDTHH:MM". */
  arrival_local: string;
  booking_code: string;
  passengers: string[];
}

export interface HotelExtraction {
  kind: 'hotel';
  name: string;
  address: string;
  city: string;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  confirmation_code: string | null;
  guests: string[];
}

export type VoucherExtraction = FlightExtraction | HotelExtraction;

export const VOUCHER_PROMPT = [
  'Você lê confirmações de viagem (e-ticket de voo, voucher de hotel) em foto ou PDF e devolve SOMENTE um JSON, sem texto em volta.',
  'Se for um voo, devolva: {"kind":"flight","airline":"...","flight_number":"AD8702","origin_airport":"GRU","destination_airport":"MCO","departure_local":"YYYY-MM-DDTHH:MM","arrival_local":"YYYY-MM-DDTHH:MM","booking_code":"ABC123","passengers":["Nome Sobrenome"]}.',
  'Se for hospedagem, devolva: {"kind":"hotel","name":"...","address":"...","city":"...","check_in":"YYYY-MM-DD","check_out":"YYYY-MM-DD","confirmation_code":"..." ou null,"guests":["Nome"]}.',
  'Se houver vários trechos de voo, devolva só o PRIMEIRO trecho. Códigos de aeroporto em IATA (3 letras). Horários são os locais impressos no documento — não converta fuso.',
  'Se não for uma confirmação de voo nem de hotel, ou se faltar campo essencial, devolva {"kind":"unknown","reason":"..."}.',
].join('\n');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const IATA_RE = /^[A-Z]{3}$/;

const str = (v: unknown, max = 255): string | null =>
  typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null;

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim()).slice(0, 20) : [];

/** Valida o JSON do modelo. `null` = não dá pra confiar, peça a foto de novo. */
export function parseVoucherExtraction(raw: unknown): VoucherExtraction | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;

  if (v.kind === 'flight') {
    const airline = str(v.airline);
    const flightNumber = str(v.flight_number, 20)?.replace(/\s+/g, '').toUpperCase() ?? null;
    const origin = str(v.origin_airport, 3)?.toUpperCase() ?? null;
    const destination = str(v.destination_airport, 3)?.toUpperCase() ?? null;
    const dep = str(v.departure_local, 16);
    const arr = str(v.arrival_local, 16);
    const code = str(v.booking_code, 50)?.toUpperCase() ?? null;
    if (!airline || !flightNumber || !origin || !destination || !dep || !arr || !code) return null;
    if (!IATA_RE.test(origin) || !IATA_RE.test(destination) || !DATETIME_RE.test(dep) || !DATETIME_RE.test(arr)) return null;
    return {
      kind: 'flight',
      airline,
      flight_number: flightNumber,
      origin_airport: origin,
      destination_airport: destination,
      departure_local: dep,
      arrival_local: arr,
      booking_code: code,
      passengers: strList(v.passengers),
    };
  }

  if (v.kind === 'hotel') {
    const name = str(v.name);
    const checkIn = str(v.check_in, 10);
    const checkOut = str(v.check_out, 10);
    if (!name || !checkIn || !checkOut || !DATE_RE.test(checkIn) || !DATE_RE.test(checkOut) || checkOut <= checkIn) return null;
    return {
      kind: 'hotel',
      name,
      address: str(v.address, 500) ?? '',
      city: str(v.city) ?? '',
      check_in: checkIn,
      check_out: checkOut,
      confirmation_code: str(v.confirmation_code, 100),
      guests: strList(v.guests),
    };
  }

  return null;
}

/**
 * Fuso dos aeroportos que a família de fato usa. Um voo sai no fuso da
 * origem e chega no fuso do destino — gravar os dois como se fossem o fuso
 * do tenant daria horário de chegada errado em toda rota Brasil→EUA.
 */
export const AIRPORT_TZ: Record<string, string> = {
  GRU: 'America/Sao_Paulo', CGH: 'America/Sao_Paulo', VCP: 'America/Sao_Paulo', GIG: 'America/Sao_Paulo',
  SDU: 'America/Sao_Paulo', CNF: 'America/Sao_Paulo', BSB: 'America/Sao_Paulo', CWB: 'America/Sao_Paulo',
  POA: 'America/Sao_Paulo', FLN: 'America/Sao_Paulo', SSA: 'America/Bahia', REC: 'America/Recife',
  FOR: 'America/Fortaleza', BEL: 'America/Belem', MAO: 'America/Manaus',
  MCO: 'America/New_York', MIA: 'America/New_York', FLL: 'America/New_York', JFK: 'America/New_York',
  EWR: 'America/New_York', LGA: 'America/New_York', BOS: 'America/New_York', ATL: 'America/New_York',
  IAD: 'America/New_York', DCA: 'America/New_York', PHL: 'America/New_York', CLT: 'America/New_York',
  TPA: 'America/New_York', ORD: 'America/Chicago', DFW: 'America/Chicago', IAH: 'America/Chicago',
  DEN: 'America/Denver', LAX: 'America/Los_Angeles', SFO: 'America/Los_Angeles', LAS: 'America/Los_Angeles',
  SEA: 'America/Los_Angeles', YYZ: 'America/Toronto', MEX: 'America/Mexico_City', CUN: 'America/Cancun',
  PTY: 'America/Panama', BOG: 'America/Bogota', LIM: 'America/Lima', SCL: 'America/Santiago',
  EZE: 'America/Argentina/Buenos_Aires', MVD: 'America/Montevideo', LIS: 'Europe/Lisbon', MAD: 'Europe/Madrid',
  BCN: 'Europe/Madrid', CDG: 'Europe/Paris', AMS: 'Europe/Amsterdam', FRA: 'Europe/Berlin', FCO: 'Europe/Rome',
  LHR: 'Europe/London',
};

function tzOffsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return (asUtc - utcMs) / 60_000;
}

/** "YYYY-MM-DDTHH:MM" no fuso informado → ISO UTC. Ajusta uma vez pra cobrir virada de horário de verão. */
export function zonedLocalToUtcIso(local: string, timeZone: string): string {
  const [date, time] = local.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - tzOffsetMinutes(guess, timeZone) * 60_000;
  utc = guess - tzOffsetMinutes(utc, timeZone) * 60_000;
  return new Date(utc).toISOString();
}

export function airportTimeZone(iata: string, fallback: string): string {
  return AIRPORT_TZ[iata.toUpperCase()] ?? fallback;
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);

/**
 * Casa nomes do documento com participantes por sobreposição de tokens
 * (primeiro nome + qualquer sobrenome). Lista vazia no documento = todos —
 * é o caso comum de voucher de hotel, que só lista o titular.
 */
export function matchParticipants(
  names: string[],
  participants: { id: string; full_name: string; nickname?: string | null }[],
): string[] {
  if (names.length === 0) return participants.map(p => p.id);
  const matched = new Set<string>();
  for (const name of names) {
    const tokens = normalize(name);
    if (tokens.length === 0) continue;
    for (const p of participants) {
      const pTokens = new Set([...normalize(p.full_name), ...normalize(p.nickname ?? '')]);
      const hits = tokens.filter(t => pTokens.has(t)).length;
      if (hits >= Math.min(2, tokens.length)) matched.add(p.id);
    }
  }
  return matched.size > 0 ? Array.from(matched) : participants.map(p => p.id);
}

const fmtLocal = (local: string) => {
  const [date, time] = local.split('T');
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y} ${time}`;
};

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** Resumo curto que a família confirma antes de gravar. */
export function buildVoucherPreview(x: VoucherExtraction, participantNames: string[]): string {
  const who = participantNames.length > 0 ? ` • ${participantNames.join(', ')}` : '';
  if (x.kind === 'flight') {
    return `✈️ Voo ${x.airline} ${x.flight_number}: ${x.origin_airport} ${fmtLocal(x.departure_local)} → ${x.destination_airport} ${fmtLocal(x.arrival_local)} (horários locais), localizador ${x.booking_code}${who}. Cadastro esse voo?`;
  }
  return `🏨 ${x.name}${x.city ? ` (${x.city})` : ''}: check-in ${fmtDate(x.check_in)}, check-out ${fmtDate(x.check_out)}${x.confirmation_code ? `, confirmação ${x.confirmation_code}` : ''}${who}. Cadastro essa hospedagem?`;
}
