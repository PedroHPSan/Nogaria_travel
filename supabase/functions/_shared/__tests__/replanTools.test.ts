import { describe, expect, it, vi } from 'vitest';
import { createToolExecutor } from '../tripTools.ts';
import type { ParticipantRow } from '../tripContext.ts';
import { createTestSupabase } from './testSupabase.ts';

vi.mock('../whatsappClient.ts', () => ({
  sendTextMessage: vi.fn().mockResolvedValue({ waMessageId: 'wamid.fake' }),
}));

vi.mock('../weather.ts', () => ({
  fetchDailyWeather: vi.fn().mockResolvedValue({ tempMaxC: 32, tempMinC: 24, precipitationProbabilityMax: 20, description: 'poucas nuvens' }),
}));

vi.mock('../parkStatus.ts', () => ({
  fetchParkDayStatus: vi.fn().mockResolvedValue(null),
}));

const organizer: ParticipantRow = { id: 'p1', full_name: 'Pedro', nickname: 'Pedro', is_minor: false, height_cm: 180, whatsapp_phone: '5511999990001', can_manage_itinerary: true };
const nonOrganizer: ParticipantRow = { id: 'p2', full_name: 'Débora', nickname: 'Dé', is_minor: false, height_cm: 165, whatsapp_phone: '5511999990002', can_manage_itinerary: false };

function baseCtx(supabase: ReturnType<typeof createTestSupabase>, senderPhone = organizer.whatsapp_phone!) {
  return {
    supabase,
    tenantId: 't1',
    tripId: 'trip1',
    todayIso: '2026-09-14',
    participants: [organizer, nonOrganizer],
    timeZone: 'America/New_York',
    senderPhone,
    phoneNumberId: 'pn1',
    metaAccessToken: 'token',
    googleMapsApiKey: null,
    geminiApiKey: 'fake-key',
    geminiModel: 'gemini-3.8-flash',
  };
}

type Row = Record<string, unknown>;

/**
 * Simula o efeito de public.apply_itinerary_changes sobre o mesmo objeto de
 * seed usado pelo fake supabase (mutação por referência) — o mock de `rpc()`
 * do testSupabase não interpreta SQL, então sem isto o teste de `confirm`
 * jamais veria a linha mudar.
 */
function fakeApplyItineraryChanges(seed: Record<string, Row[]>) {
  return (name: string, args: Record<string, unknown>) => {
    if (name !== 'apply_itinerary_changes') return { data: [], error: null };
    const changes = args.p_changes as { item_id: string; date: string; time_start: string; time_end: string | null; base_order: number | null }[];
    const items = seed.itinerary_items ?? [];
    const applied = [];
    for (const c of changes) {
      const row = items.find(r => r.id === c.item_id);
      if (!row) continue;
      Object.assign(row, { date: c.date, time_start: c.time_start, time_end: c.time_end, base_order: c.base_order });
      applied.push({ item_id: c.item_id, title: row.title, date: row.date, time_start: row.time_start });
    }
    seed.activity_reminders = (seed.activity_reminders ?? []).filter(
      r => !(changes.some(c => c.item_id === r.itinerary_item_id) && r.kind === 'lead'),
    );
    return { data: { applied, count: changes.length }, error: null };
  };
}

function seedDay() {
  const seed = {
    trips: [{ id: 'trip1', start_date: '2026-09-01', end_date: '2026-09-20', destination_main: 'Orlando' }],
    itinerary_items: [
      { id: 'i1', trip_id: 'trip1', title: 'Café', date: '2026-09-14', time_start: '08:00:00', time_end: '08:30:00', base_order: 0, park: null, status: 'planned', show_block_start: null, counts_toward_completion: true },
      { id: 'i2', trip_id: 'trip1', title: 'EPCOT', date: '2026-09-14', time_start: '09:00:00', time_end: '18:00:00', base_order: 10, park: 'EPCOT', status: 'planned', show_block_start: null, counts_toward_completion: true, external_entity_id: null },
    ],
  };
  return { seed, supabase: createTestSupabase(seed, fakeApplyItineraryChanges(seed)) };
}

describe('get_day_conditions', () => {
  it('devolve clima, itens do dia e o aviso de fonte comunitária', async () => {
    const { supabase } = seedDay();
    const executor = createToolExecutor(baseCtx(supabase));

    const result = (await executor('get_day_conditions', { date: '2026-09-14' })) as {
      date: string;
      weather: { tempMaxC: number } | null;
      items_count: number;
      note: string;
    };

    expect(result.date).toBe('2026-09-14');
    expect(result.weather?.tempMaxC).toBe(32);
    expect(result.items_count).toBe(2);
    expect(result.note).toContain('themeparks.wiki');
    expect(result.note).toContain('web_search');
  });
});

describe('replan_day — permissão', () => {
  it('recusa ANTES de encenar pendência quando o telefone não é organizador', async () => {
    const { supabase } = seedDay();
    const executor = createToolExecutor(baseCtx(supabase, nonOrganizer.whatsapp_phone!));

    const result = (await executor('replan_day', { operation: 'shift', date: '2026-09-14', shift_minutes: 30 })) as { allowed: boolean };
    expect(result.allowed).toBe(false);

    // Nada foi encenado: confirmar depois não acha pendência nenhuma.
    const confirmResult = (await executor('replan_day', { confirm: true })) as { confirmed: boolean };
    expect(confirmResult.confirmed).toBe(false);
  });

  it('recusa quando o telefone não pertence a nenhum participante', async () => {
    const { supabase } = seedDay();
    const executor = createToolExecutor(baseCtx(supabase, '5511900000000'));

    const result = (await executor('replan_day', { operation: 'shift', date: '2026-09-14', shift_minutes: 30 })) as { allowed: boolean };
    expect(result.allowed).toBe(false);
  });
});

describe('replan_day — shift, confirmação em duas fases', () => {
  it('primeira chamada devolve preview sem aplicar', async () => {
    const { supabase } = seedDay();
    const executor = createToolExecutor(baseCtx(supabase));

    const result = (await executor('replan_day', { operation: 'shift', date: '2026-09-14', shift_minutes: 30 })) as { confirmation_needed: boolean; preview: string };
    expect(result.confirmation_needed).toBe(true);
    expect(result.preview).toContain('atividades mudam');

    const raw = (await new Promise(r => supabase.from('itinerary_items').eq('id', 'i1').maybeSingle().then(r))) as { data: { time_start: string } };
    expect(raw.data.time_start).toBe('08:00:00');
  });

  it('confirmar aplica via apply_itinerary_changes e avisa os outros participantes', async () => {
    const { supabase } = seedDay();
    const rpcSpy = vi.spyOn(supabase, 'rpc');
    const executor = createToolExecutor(baseCtx(supabase));

    await executor('replan_day', { operation: 'shift', date: '2026-09-14', shift_minutes: 30 });
    const result = (await executor('replan_day', { confirm: true })) as { replanned: boolean; count: number; notified: string[] };

    expect(result.replanned).toBe(true);
    expect(rpcSpy).toHaveBeenCalledWith(
      'apply_itinerary_changes',
      expect.objectContaining({
        p_trip_id: 'trip1',
        p_changes: expect.arrayContaining([expect.objectContaining({ item_id: 'i1', time_start: '08:30' })]),
      }),
    );
    // Quem pediu (organizer) não recebe aviso de si mesmo — só o outro participante.
    expect(result.notified).toEqual(['Dé']);

    const raw = (await new Promise(r => supabase.from('itinerary_items').eq('id', 'i1').maybeSingle().then(r))) as { data: { time_start: string } };
    expect(raw.data.time_start).toBe('08:30');
  });

  it('troca de assunto entre as duas mensagens não aplica nada', async () => {
    const { supabase } = seedDay();
    const executor = createToolExecutor(baseCtx(supabase));

    await executor('replan_day', { operation: 'shift', date: '2026-09-14', shift_minutes: 30 });
    // Pediu outra coisa no meio — reschedule_itinerary_item não casa com a pendência de replan_day.
    const result = (await executor('reschedule_itinerary_item', { confirm: true })) as { confirmed: boolean };
    expect(result.confirmed).toBe(false);
  });

  it('rejeita args incoerentes (shift sem shift_minutes)', async () => {
    const { supabase } = seedDay();
    const executor = createToolExecutor(baseCtx(supabase));
    await expect(executor('replan_day', { operation: 'shift', date: '2026-09-14' })).rejects.toThrow('shift_minutes');
  });

  it('nada muda: dia vazio devolve resposta resolvida, sem pendência', async () => {
    const { supabase } = seedDay();
    const executor = createToolExecutor(baseCtx(supabase));
    const result = (await executor('replan_day', { operation: 'shift', date: '2026-09-01', shift_minutes: 30 })) as { found: boolean };
    expect(result.found).toBe(false);
  });
});

describe('replan_day — swap', () => {
  it('troca a data entre dois dias mantendo o horário', async () => {
    const seed = {
      trips: [{ id: 'trip1', start_date: '2026-09-01', end_date: '2026-09-20', destination_main: 'Orlando' }],
      itinerary_items: [
        { id: 'i1', trip_id: 'trip1', title: 'EPCOT', date: '2026-09-14', time_start: '09:00:00', time_end: '18:00:00', base_order: 0, park: 'EPCOT', status: 'planned', show_block_start: null, counts_toward_completion: true },
        { id: 'i2', trip_id: 'trip1', title: 'Magic Kingdom', date: '2026-09-16', time_start: '08:00:00', time_end: '20:00:00', base_order: 0, park: 'Magic Kingdom', status: 'planned', show_block_start: null, counts_toward_completion: true },
      ],
    };
    const supabase = createTestSupabase(seed, fakeApplyItineraryChanges(seed));
    const executor = createToolExecutor(baseCtx(supabase));

    await executor('replan_day', { operation: 'swap', date: '2026-09-14', other_date: '2026-09-16' });
    await executor('replan_day', { confirm: true });

    const itemA = (await new Promise(r => supabase.from('itinerary_items').eq('id', 'i1').maybeSingle().then(r))) as { data: { date: string; time_start: string } };
    const itemB = (await new Promise(r => supabase.from('itinerary_items').eq('id', 'i2').maybeSingle().then(r))) as { data: { date: string; time_start: string } };
    expect(itemA.data.date).toBe('2026-09-16');
    expect(itemA.data.time_start).toBe('09:00');
    expect(itemB.data.date).toBe('2026-09-14');
    expect(itemB.data.time_start).toBe('08:00');
  });
});
