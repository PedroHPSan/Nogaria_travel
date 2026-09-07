import { describe, expect, it, vi } from 'vitest';
import { createToolExecutor, resolveRescheduleTarget, type ItineraryItemRow } from '../tripTools.ts';
import type { ParticipantRow } from '../tripContext.ts';
import { createTestSupabase } from './testSupabase.ts';

vi.mock('../whatsappClient.ts', () => ({
  sendTextMessage: vi.fn().mockResolvedValue({ waMessageId: 'wamid.fake' }),
}));

const participants: ParticipantRow[] = [
  { id: 'p1', full_name: 'Pedro', nickname: 'Pedro', is_minor: false, height_cm: 180, whatsapp_phone: '5511999990001' },
  { id: 'p2', full_name: 'Débora', nickname: 'Dé', is_minor: false, height_cm: 165, whatsapp_phone: '5511999990002' },
];

function baseCtx(supabase: ReturnType<typeof createTestSupabase>) {
  return {
    supabase,
    tenantId: 't1',
    tripId: 'trip1',
    todayIso: '2026-09-06',
    participants,
    timeZone: 'America/New_York',
    senderPhone: '5511999990001',
    phoneNumberId: 'pn1',
    metaAccessToken: 'token',
    googleMapsApiKey: null,
  };
}

describe('resolveRescheduleTarget', () => {
  const item: ItineraryItemRow = { id: 'i1', title: 'Almoço', date: '2026-09-06', time_start: '12:00:00', time_end: '13:00:00' };

  it('shift_minutes preserva a duração original', () => {
    const target = resolveRescheduleTarget(item, { newDate: null, newTimeStart: null, shiftMinutes: 40 });
    expect(target).toEqual({ newDate: '2026-09-06', newTimeStart: '12:40', newTimeEnd: '13:40' });
  });

  it('shift_minutes que cruza a meia-noite é rejeitado', () => {
    expect(() => resolveRescheduleTarget(item, { newDate: null, newTimeStart: null, shiftMinutes: 800 })).toThrow('meia-noite');
  });

  it('new_time_start direto também preserva a duração', () => {
    const target = resolveRescheduleTarget(item, { newDate: null, newTimeStart: '15:00', shiftMinutes: null });
    expect(target).toEqual({ newDate: '2026-09-06', newTimeStart: '15:00', newTimeEnd: '16:00' });
  });

  it('shift_minutes combinado com new_date é rejeitado — um ou outro, não os dois', () => {
    expect(() => resolveRescheduleTarget(item, { newDate: '2026-09-07', newTimeStart: null, shiftMinutes: 30 })).toThrow(
      'shift_minutes OU new_date',
    );
  });

  it('item sem time_end não define novo time_end', () => {
    const noEnd: ItineraryItemRow = { ...item, time_end: null };
    const target = resolveRescheduleTarget(noEnd, { newDate: null, newTimeStart: null, shiftMinutes: 30 });
    expect(target.newTimeEnd).toBeNull();
  });
});

describe('mark_itinerary_item_done — confirmação em duas fases', () => {
  it('primeira chamada (sem confirm) não escreve, só devolve preview', async () => {
    const supabase = createTestSupabase(
      { itinerary_items: [{ id: 'i1', title: 'Space Mountain', date: '2026-09-06', time_start: '10:00:00', participant_status: {} }] },
      () => ({
        data: [{ id: 'i1', title: 'Space Mountain', item_date: '2026-09-06', time_start: '10:00:00', participant_status: {}, score: 0.95 }],
        error: null,
      }),
    );
    const executor = createToolExecutor(baseCtx(supabase));

    const result = (await executor('mark_itinerary_item_done', { title: 'Space Mountain' })) as { confirmation_needed: boolean; preview: string };
    expect(result.confirmation_needed).toBe(true);
    expect(result.preview).toContain('Space Mountain');

    // Nada foi escrito ainda.
    const raw = (await new Promise(r => supabase.from('itinerary_items').eq('id', 'i1').maybeSingle().then(r))) as {
      data: { participant_status: Record<string, string> };
    };
    expect(raw.data.participant_status).toEqual({});
  });

  it('segunda chamada com confirm=true aplica exatamente o que foi mostrado no preview', async () => {
    const supabase = createTestSupabase(
      { itinerary_items: [{ id: 'i1', title: 'Space Mountain', date: '2026-09-06', time_start: '10:00:00', participant_status: {} }] },
      () => ({
        data: [{ id: 'i1', title: 'Space Mountain', item_date: '2026-09-06', time_start: '10:00:00', participant_status: {}, score: 0.95 }],
        error: null,
      }),
    );
    const executor = createToolExecutor(baseCtx(supabase));

    await executor('mark_itinerary_item_done', { title: 'Space Mountain' });
    const result = (await executor('mark_itinerary_item_done', { confirm: true })) as { updated: boolean; markedFor: string[] };

    expect(result.updated).toBe(true);
    expect(result.markedFor).toEqual(['Pedro', 'Dé']);

    const after = (await new Promise(r => supabase.from('itinerary_items').eq('id', 'i1').maybeSingle().then(r))) as {
      data: { participant_status: Record<string, string> };
    };
    expect(after.data.participant_status).toEqual({ p1: 'done', p2: 'done' });
  });

  it('confirm=true sem pendência aberta não aplica nada', async () => {
    const supabase = createTestSupabase({ itinerary_items: [] }, () => ({ data: [], error: null }));
    const executor = createToolExecutor(baseCtx(supabase));

    const result = (await executor('mark_itinerary_item_done', { confirm: true })) as { confirmed: boolean };
    expect(result.confirmed).toBe(false);
  });

  it('resultado ambíguo não fica pendente — não precisa de confirmação pra perguntar', async () => {
    const supabase = createTestSupabase({}, () => ({
      data: [
        { id: 'i1', title: 'Jantar no Be Our Guest', item_date: '2026-09-06', time_start: '19:00:00', participant_status: {}, score: 0.8 },
        { id: 'i2', title: 'Jantar no Cinderella', item_date: '2026-09-06', time_start: '19:30:00', participant_status: {}, score: 0.75 },
      ],
      error: null,
    }));
    const executor = createToolExecutor(baseCtx(supabase));

    const result = (await executor('mark_itinerary_item_done', { title: 'Jantar' })) as { ambiguous: boolean };
    expect(result.ambiguous).toBe(true);

    // Confirmar depois de um resultado ambíguo não acha nada pendente.
    const confirmResult = (await executor('mark_itinerary_item_done', { confirm: true })) as { confirmed: boolean };
    expect(confirmResult.confirmed).toBe(false);
  });
});

describe('reschedule_itinerary_item — conflito e confirmação', () => {
  function seedReschedule() {
    return createTestSupabase(
      {
        itinerary_items: [
          { id: 'i1', trip_id: 'trip1', title: 'Almoço', date: '2026-09-06', time_start: '12:00:00', time_end: '13:00:00' },
          { id: 'i2', trip_id: 'trip1', title: 'Reunião de família', date: '2026-09-06', time_start: '13:00:00', time_end: '14:00:00' },
        ],
        trips: [{ id: 'trip1', start_date: '2026-09-01', end_date: '2026-09-15' }],
        activity_reminders: [{ id: 'r1', itinerary_item_id: 'i1', participant_id: 'p1', kind: 'lead' }],
      },
      () => ({
        data: [{ id: 'i1', title: 'Almoço', item_date: '2026-09-06', time_start: '12:00:00', participant_status: {}, score: 0.95 }],
        error: null,
      }),
    );
  }

  it('avisa conflito no preview em vez de aplicar em silêncio', async () => {
    const supabase = seedReschedule();
    const executor = createToolExecutor(baseCtx(supabase));

    const result = (await executor('reschedule_itinerary_item', { title: 'Almoço', new_time_start: '13:30' })) as { preview: string };
    expect(result.preview).toContain('Conflita com "Reunião de família"');
  });

  it('confirmar aplica a mudança e limpa o lembrete agendado pro horário antigo', async () => {
    const supabase = seedReschedule();
    const executor = createToolExecutor(baseCtx(supabase));

    await executor('reschedule_itinerary_item', { title: 'Almoço', new_time_start: '16:00' });
    const result = (await executor('reschedule_itinerary_item', { confirm: true })) as {
      rescheduled: boolean;
      to: { date: string; time: string };
      notified: string[];
    };

    expect(result.rescheduled).toBe(true);
    expect(result.to).toEqual({ date: '2026-09-06', time: '16:00' });
    expect(result.notified).toEqual(['Dé']); // avisa os outros, não quem pediu

    const item = (await new Promise(r => supabase.from('itinerary_items').eq('id', 'i1').maybeSingle().then(r))) as {
      data: { time_start: string; time_end: string };
    };
    expect(item.data.time_start).toBe('16:00');
    expect(item.data.time_end).toBe('17:00');

    const reminders = (await new Promise(r => supabase.from('activity_reminders').eq('itinerary_item_id', 'i1').then(r))) as {
      data: unknown[];
    };
    expect(reminders.data).toEqual([]);
  });

  it('rejeita nova data fora do período da viagem', async () => {
    const supabase = seedReschedule();
    const executor = createToolExecutor(baseCtx(supabase));

    await expect(executor('reschedule_itinerary_item', { title: 'Almoço', new_date: '2026-10-01' })).rejects.toThrow(
      'fora do período da viagem',
    );
  });
});
