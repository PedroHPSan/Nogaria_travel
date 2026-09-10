import type { ItineraryItem, Participant, Trip } from '../types/database.types';

/**
 * Exportação do roteiro em .ics (RFC 5545), JSON portável (LGPD) e impressão
 * (via `window.print()` + CSS `@media print`, não implementada aqui). Sem
 * dependências novas.
 */

/** Regiões cujo `destination_main` indica horário dos EUA (leste). */
const US_EASTERN_DESTINATION_RE = /orlando|miami|eua|usa|florida/i;

/**
 * Infere o fuso horário da viagem a partir do destino, já que `Trip` não
 * carrega um campo de timezone. Padrão: `America/Sao_Paulo`.
 */
export function inferTripTimeZone(trip: Pick<Trip, 'destination_main'>): string {
  if (US_EASTERN_DESTINATION_RE.test(trip.destination_main ?? '')) {
    return 'America/New_York';
  }
  return 'America/Sao_Paulo';
}

const ICS_LINE_FOLD_LIMIT = 75;

/** Escapa vírgula, ponto e vírgula, barra invertida e quebras de linha conforme RFC 5545 §3.3.11. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

/** Dobra uma linha ICS a 75 octetos, com continuação iniciada por um espaço, terminando em CRLF. */
function foldIcsLine(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= ICS_LINE_FOLD_LIMIT) {
    return line;
  }

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = bytes.encode(char).length;
    const limit = chunks.length === 0 ? ICS_LINE_FOLD_LIMIT : ICS_LINE_FOLD_LIMIT - 1;
    if (currentBytes + charBytes > limit) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  if (current) chunks.push(current);

  return chunks.join('\r\n ');
}

function buildIcsLines(lines: string[]): string {
  return lines.map(foldIcsLine).join('\r\n');
}

function toIcsDateTime(date: string, time: string): string {
  const compactDate = date.replace(/-/g, '');
  const [hStr, mStr] = time.split(':');
  const h = (hStr ?? '00').padStart(2, '0');
  const m = (mStr ?? '00').padStart(2, '0');
  return `${compactDate}T${h}${m}00`;
}

function nowAsIcsUtc(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Monta um VCALENDAR (RFC 5545) com um VEVENT por item do roteiro.
 * `date`+`time_start` viram DTSTART; DTEND usa `time_end` quando presente,
 * senão `time_start + 60min`.
 */
export function buildIcs(trip: Trip, items: ItineraryItem[], opts: { timeZone: string }): string {
  const dtstamp = nowAsIcsUtc();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nogaria Travel Platform//Itinerary Export//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(trip.title)}`,
  ];

  for (const item of items) {
    const dtStart = toIcsDateTime(item.date, item.time_start);
    const dtEndTime = item.time_end ?? addMinutesToTimeFormatted(item.time_start);
    const dtEnd = toIcsDateTime(item.date, dtEndTime);
    const location = item.location ?? item.park ?? item.city;
    const description = item.description ?? item.notes;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${item.id}@nogaria`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;TZID=${opts.timeZone}:${dtStart}`);
    lines.push(`DTEND;TZID=${opts.timeZone}:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(item.title)}`);
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
    if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return buildIcsLines(lines) + '\r\n';
}

/** `time_start` (HH:mm) + 60min, formatado como HH:mm para reuso em `time_end`. */
function addMinutesToTimeFormatted(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  const total = (h * 60 + m + 60) % (24 * 60);
  const outH = Math.floor(total / 60);
  const outM = total % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
}

export interface ItineraryJsonExport {
  schema: 'nogaria.itinerary.v1';
  exported_at: string;
  trip: Trip;
  participants: Participant[];
  items: ItineraryItem[];
}

/** Objeto portável (LGPD) com trip + participants + items do roteiro exportado. */
export function buildItineraryJson(
  trip: Trip,
  items: ItineraryItem[],
  participants: Participant[],
): ItineraryJsonExport {
  return {
    schema: 'nogaria.itinerary.v1',
    exported_at: new Date().toISOString(),
    trip,
    participants,
    items,
  };
}
