import { describe, expect, it } from 'vitest';
import type { ItineraryItem, Participant, Trip } from '../types/database.types';
import { buildIcs, buildItineraryJson, inferTripTimeZone } from './itineraryExport';

const trip: Trip = {
  id: 'trip-1',
  tenant_id: 'tenant-1',
  title: 'Orlando 2026',
  destination_main: 'Orlando, FL - EUA',
  start_date: '2026-09-19',
  end_date: '2026-09-30',
  currency_base: 'USD',
  status: 'planning',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const baseItem: ItineraryItem = {
  id: 'item-1',
  trip_id: 'trip-1',
  date: '2026-09-19',
  time_start: '17:30',
  city: 'Orlando',
  title: 'Expedition Everest',
  category: 'park',
  participant_ids: [],
  status: 'planned',
  child_friendly: true,
};

const participants: Participant[] = [
  {
    id: 'p1',
    trip_id: 'trip-1',
    full_name: 'Pedro Santos',
    birth_date: '1990-01-01',
    age: 36,
    is_minor: false,
    relationship: 'pai',
    budget_limit_usd: 1000,
  },
];

describe('inferTripTimeZone', () => {
  it('retorna America/New_York para destinos nos EUA', () => {
    expect(inferTripTimeZone({ destination_main: 'Orlando, FL - EUA' })).toBe('America/New_York');
    expect(inferTripTimeZone({ destination_main: 'Miami' })).toBe('America/New_York');
    expect(inferTripTimeZone({ destination_main: 'Florida Keys' })).toBe('America/New_York');
    expect(inferTripTimeZone({ destination_main: 'Las Vegas, USA' })).toBe('America/New_York');
  });

  it('retorna America/Sao_Paulo como padrão', () => {
    expect(inferTripTimeZone({ destination_main: 'Paris, França' })).toBe('America/Sao_Paulo');
    expect(inferTripTimeZone({ destination_main: '' })).toBe('America/Sao_Paulo');
  });
});

describe('buildIcs', () => {
  it('produz um VCALENDAR válido com BEGIN/END e um VEVENT por item', () => {
    const ics = buildIcs(trip, [baseItem], { timeZone: 'America/New_York' });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('UID:item-1@nogaria');
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260919T173000');
  });

  it('usa DTEND = time_start + 60min quando time_end está ausente', () => {
    const ics = buildIcs(trip, [baseItem], { timeZone: 'America/New_York' });
    expect(ics).toContain('DTEND;TZID=America/New_York:20260919T183000');
  });

  it('usa time_end quando presente', () => {
    const item: ItineraryItem = { ...baseItem, time_end: '20:00' };
    const ics = buildIcs(trip, [item], { timeZone: 'America/New_York' });
    expect(ics).toContain('DTEND;TZID=America/New_York:20260919T200000');
  });

  it('escapa vírgula, ponto e vírgula e barra invertida em SUMMARY/DESCRIPTION/LOCATION', () => {
    const item: ItineraryItem = {
      ...baseItem,
      title: 'Almoço, rápido; c\\ chip',
      location: 'Disney; Magic, Kingdom',
      description: 'Levar protetor, chapéu; e\\água',
    };
    const ics = buildIcs(trip, [item], { timeZone: 'America/New_York' });
    expect(ics).toContain('SUMMARY:Almoço\\, rápido\\; c\\\\ chip');
    expect(ics).toContain('LOCATION:Disney\\; Magic\\, Kingdom');
    expect(ics).toContain('DESCRIPTION:Levar protetor\\, chapéu\\; e\\\\água');
  });

  it('dobra linhas maiores que 75 octetos com continuação em CRLF + espaço', () => {
    const longTitle = 'A'.repeat(120);
    const item: ItineraryItem = { ...baseItem, title: longTitle };
    const ics = buildIcs(trip, [item], { timeZone: 'America/New_York' });
    const summaryLineStart = ics.indexOf('SUMMARY:');
    const nextCrlf = ics.indexOf('\r\n', summaryLineStart);
    const firstPhysicalLine = ics.slice(summaryLineStart, nextCrlf);
    expect(new TextEncoder().encode(firstPhysicalLine).length).toBeLessThanOrEqual(75);
    expect(ics).toMatch(/SUMMARY:A+\r\n A+/);
  });

  it('usa location ?? park ?? city quando location está ausente', () => {
    const item: ItineraryItem = { ...baseItem, location: undefined, park: 'Animal Kingdom' };
    const ics = buildIcs(trip, [item], { timeZone: 'America/New_York' });
    expect(ics).toContain('LOCATION:Animal Kingdom');
  });

  it('gera um VEVENT por item de uma lista com múltiplos itens', () => {
    const items: ItineraryItem[] = [
      baseItem,
      { ...baseItem, id: 'item-2', title: 'Jantar', category: 'restaurant' },
      { ...baseItem, id: 'item-3', title: 'Compras', category: 'shopping' },
    ];
    const ics = buildIcs(trip, items, { timeZone: 'America/New_York' });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });
});

describe('buildItineraryJson', () => {
  it('retorna schema, exported_at e as contagens corretas de items/participants', () => {
    const items = [baseItem, { ...baseItem, id: 'item-2' }];
    const result = buildItineraryJson(trip, items, participants);
    expect(result.schema).toBe('nogaria.itinerary.v1');
    expect(typeof result.exported_at).toBe('string');
    expect(new Date(result.exported_at).toString()).not.toBe('Invalid Date');
    expect(result.trip).toEqual(trip);
    expect(result.items).toHaveLength(2);
    expect(result.participants).toHaveLength(1);
  });
});
