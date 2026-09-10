import { describe, expect, it, vi } from 'vitest';
import {
  airportTimeZone,
  buildVoucherPreview,
  matchParticipants,
  parseVoucherExtraction,
  zonedLocalToUtcIso,
} from '../voucherExtract.ts';
import { createToolExecutor } from '../tripTools.ts';
import { createTestSupabase } from './testSupabase.ts';

vi.mock('../whatsappClient.ts', () => ({
  sendTextMessage: vi.fn().mockResolvedValue({ waMessageId: 'wamid.fake' }),
  downloadMedia: vi.fn(),
}));

const flightJson = {
  kind: 'flight',
  airline: 'Azul',
  flight_number: 'ad 8702',
  origin_airport: 'vcp',
  destination_airport: 'MCO',
  departure_local: '2026-09-05T23:55',
  arrival_local: '2026-09-06T06:40',
  booking_code: 'xk7p2q',
  passengers: ['Pedro Santos', 'Gabriela Santos'],
};

describe('parseVoucherExtraction', () => {
  it('normaliza um voo válido (maiúsculas, sem espaços)', () => {
    const x = parseVoucherExtraction(flightJson);
    expect(x).toMatchObject({ kind: 'flight', flight_number: 'AD8702', origin_airport: 'VCP', booking_code: 'XK7P2Q' });
  });

  it('rejeita voo com campo essencial faltando ou fora do formato', () => {
    expect(parseVoucherExtraction({ ...flightJson, booking_code: '' })).toBeNull();
    expect(parseVoucherExtraction({ ...flightJson, departure_local: '05/09/2026 23:55' })).toBeNull();
    expect(parseVoucherExtraction({ ...flightJson, origin_airport: 'Campinas' })).toBeNull();
  });

  it('aceita hotel e rejeita check-out antes do check-in', () => {
    const ok = parseVoucherExtraction({ kind: 'hotel', name: 'All-Star Movies', city: 'Orlando', check_in: '2026-09-06', check_out: '2026-09-12', confirmation_code: null, guests: [] });
    expect(ok).toMatchObject({ kind: 'hotel', name: 'All-Star Movies', confirmation_code: null });
    expect(parseVoucherExtraction({ kind: 'hotel', name: 'X', check_in: '2026-09-12', check_out: '2026-09-06' })).toBeNull();
  });

  it('rejeita unknown, lixo e não-objetos', () => {
    expect(parseVoucherExtraction({ kind: 'unknown', reason: 'recibo de padaria' })).toBeNull();
    expect(parseVoucherExtraction('texto')).toBeNull();
    expect(parseVoucherExtraction(null)).toBeNull();
  });
});

describe('fuso por aeroporto', () => {
  it('converte hora local da origem e do destino separadamente', () => {
    // 23:55 em Campinas (UTC-3) = 02:55Z do dia seguinte; 06:40 em Orlando (EDT, UTC-4) = 10:40Z.
    expect(zonedLocalToUtcIso('2026-09-05T23:55', airportTimeZone('VCP', 'UTC'))).toBe('2026-09-06T02:55:00.000Z');
    expect(zonedLocalToUtcIso('2026-09-06T06:40', airportTimeZone('MCO', 'UTC'))).toBe('2026-09-06T10:40:00.000Z');
  });

  it('aeroporto desconhecido cai no fuso do tenant', () => {
    expect(airportTimeZone('XYZ', 'America/Sao_Paulo')).toBe('America/Sao_Paulo');
  });
});

describe('matchParticipants', () => {
  const people = [
    { id: 'p1', full_name: 'Pedro Henrique Palheta Santos', nickname: 'Pedro' },
    { id: 'p2', full_name: 'Gabriela Santos', nickname: 'Gabi' },
    { id: 'p3', full_name: 'Débora Nogueira', nickname: 'Dé' },
  ];

  it('casa por nome + sobrenome, ignorando acento e caixa', () => {
    expect(matchParticipants(['PEDRO SANTOS', 'gabriela santos'], people).sort()).toEqual(['p1', 'p2']);
  });

  it('lista vazia ou sem casamento = todos (voucher de hotel só lista o titular às vezes nem isso)', () => {
    expect(matchParticipants([], people)).toHaveLength(3);
    expect(matchParticipants(['Fulano de Tal'], people)).toHaveLength(3);
  });
});

describe('buildVoucherPreview', () => {
  it('resume o voo com horários locais e quem viaja', () => {
    const text = buildVoucherPreview(parseVoucherExtraction(flightJson)!, ['Pedro', 'Gabi']);
    expect(text).toContain('AD8702');
    expect(text).toContain('VCP 05/09/2026 23:55 → MCO 06/09/2026 06:40');
    expect(text).toContain('Pedro, Gabi');
  });
});

describe('create_flight_from_document — segunda fase', () => {
  const ctx = (supabase: ReturnType<typeof createTestSupabase>) => ({
    supabase,
    tenantId: 't1',
    tripId: 'trip1',
    todayIso: '2026-09-06',
    participants: [],
    timeZone: 'America/New_York',
    senderPhone: '5511999990001',
    phoneNumberId: 'pn1',
    metaAccessToken: 'token',
    googleMapsApiKey: null,
  });

  it('sem confirm não grava nada e explica que precisa do documento', async () => {
    const supabase = createTestSupabase({ flights: [] });
    const result = (await createToolExecutor(ctx(supabase))('create_flight_from_document', { confirm: false })) as { created: boolean };
    expect(result.created).toBe(false);
  });

  it('confirm=true sem pendência não grava', async () => {
    const supabase = createTestSupabase({ flights: [], pending_writes: [] });
    const result = (await createToolExecutor(ctx(supabase))('create_flight_from_document', { confirm: true })) as { created: boolean };
    expect(result.created).toBe(false);
  });

  it('confirm=true grava exatamente o que o webhook deixou pendente', async () => {
    const payload = {
      airline: 'Azul', flight_number: 'AD8702', origin_airport: 'VCP', destination_airport: 'MCO',
      departure_time: '2026-09-06T02:55:00.000Z', arrival_time: '2026-09-06T10:40:00.000Z',
      booking_code: 'XK7P2Q', passenger_ids: ['p1'], summary: 'Voo Azul AD8702',
    };
    const supabase = createTestSupabase({
      flights: [],
      pending_writes: [{ id: 'pw1', sender_phone: '5511999990001', tool_name: 'create_flight_from_document', payload, expires_at: new Date(Date.now() + 60_000).toISOString() }],
    });
    const result = (await createToolExecutor(ctx(supabase))('create_flight_from_document', { confirm: true })) as { created: boolean; kind: string };
    expect(result).toMatchObject({ created: true, kind: 'flight' });

    const flights = (await new Promise(r => supabase.from('flights').then(r))) as { data: Record<string, unknown>[] };
    expect(flights.data).toHaveLength(1);
    expect(flights.data[0]).toMatchObject({ trip_id: 'trip1', flight_number: 'AD8702', status: 'confirmed', passenger_ids: ['p1'] });

    const pending = (await new Promise(r => supabase.from('pending_writes').then(r))) as { data: unknown[] };
    expect(pending.data).toEqual([]);
  });
});
