import { describe, expect, it, vi } from 'vitest';
import { createToolExecutor } from '../tripTools.ts';
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

function searchStub(rows: Record<string, unknown>[]) {
  return () => ({ data: rows, error: null });
}

describe('confirm_itinerary_outcome', () => {
  it('outcome=done marca todos os participantes e não fica pendente de confirmação', async () => {
    const supabase = createTestSupabase(
      { itinerary_items: [{ id: 'i1', title: 'Space Mountain', date: '2026-09-06', time_start: '10:00:00', participant_status: {} }] },
      searchStub([{ id: 'i1', title: 'Space Mountain', item_date: '2026-09-06', time_start: '10:00:00', score: 0.95 }]),
    );
    const executor = createToolExecutor(baseCtx(supabase));

    const result = (await executor('confirm_itinerary_outcome', { title: 'Space Mountain', outcome: 'done' })) as {
      found: boolean;
      outcome: string;
    };
    expect(result.found).toBe(true);
    expect(result.outcome).toBe('done');

    const item = (await new Promise(r => supabase.from('itinerary_items').eq('id', 'i1').maybeSingle().then(r))) as {
      data: { participant_status: Record<string, string> };
    };
    expect(item.data.participant_status).toEqual({ p1: 'done', p2: 'done' });
  });

  it('outcome=skipped guarda no banco de pendências, sem exigir segunda mensagem', async () => {
    const supabase = createTestSupabase(
      { itinerary_items: [{ id: 'i1', title: 'Test Track', date: '2026-09-06', time_start: '09:00:00', participant_status: {} }] },
      searchStub([{ id: 'i1', title: 'Test Track', item_date: '2026-09-06', time_start: '09:00:00', score: 0.95 }]),
    );
    const executor = createToolExecutor(baseCtx(supabase));

    const result = (await executor('confirm_itinerary_outcome', {
      title: 'Test Track',
      outcome: 'skipped',
      note: 'fila enorme',
    })) as { found: boolean; outcome: string; saved_for_later: boolean };
    expect(result.found).toBe(true);
    expect(result.outcome).toBe('skipped');
    expect(result.saved_for_later).toBe(true);

    const outcomes = (await new Promise(r => supabase.from('itinerary_item_outcomes').eq('itinerary_item_id', 'i1').then(r))) as {
      data: { status: string; note: string; resolved_by_participant_id: string }[];
    };
    expect(outcomes.data).toHaveLength(1);
    expect(outcomes.data[0]).toMatchObject({ status: 'skipped', note: 'fila enorme', resolved_by_participant_id: 'p1' });
  });

  it('resolve uma pendência de check-in já registrada (upsert em cima da linha pending)', async () => {
    const supabase = createTestSupabase(
      {
        itinerary_items: [{ id: 'i1', title: 'Test Track', date: '2026-09-06', time_start: '09:00:00', participant_status: {} }],
        itinerary_item_outcomes: [{ id: 'o1', itinerary_item_id: 'i1', trip_id: 'trip1', status: 'pending' }],
      },
      searchStub([{ id: 'i1', title: 'Test Track', item_date: '2026-09-06', time_start: '09:00:00', score: 0.95 }]),
    );
    const executor = createToolExecutor(baseCtx(supabase));

    await executor('confirm_itinerary_outcome', { title: 'Test Track', outcome: 'skipped' });

    const outcomes = (await new Promise(r => supabase.from('itinerary_item_outcomes').eq('itinerary_item_id', 'i1').then(r))) as {
      data: { status: string }[];
    };
    expect(outcomes.data).toHaveLength(1); // não duplicou a linha
    expect(outcomes.data[0].status).toBe('skipped');
  });

  it('rejeita outcome inválido', async () => {
    const supabase = createTestSupabase({}, searchStub([]));
    const executor = createToolExecutor(baseCtx(supabase));
    await expect(executor('confirm_itinerary_outcome', { title: 'X', outcome: 'talvez' })).rejects.toThrow('outcome deve ser');
  });
});

describe('list_unfulfilled_activities', () => {
  it('lista só os itens com status skipped', async () => {
    const supabase = createTestSupabase({
      itinerary_item_outcomes: [
        {
          id: 'o1',
          trip_id: 'trip1',
          status: 'skipped',
          note: 'fila enorme',
          resolved_at: '2026-09-06T20:00:00Z',
          itinerary_items: { title: 'Test Track', date: '2026-09-06', time_start: '09:00:00' },
        },
        { id: 'o2', trip_id: 'trip1', status: 'pending' },
        { id: 'o3', trip_id: 'trip1', status: 'cancelled' },
      ],
    });
    const executor = createToolExecutor(baseCtx(supabase));

    const result = (await executor('list_unfulfilled_activities', {})) as {
      pending: { title: string; note: string }[];
    };
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0]).toMatchObject({ title: 'Test Track', note: 'fila enorme' });
  });
});

describe('cancel_itinerary_item — confirmação em duas fases', () => {
  it('primeira chamada só devolve preview, sem cancelar', async () => {
    const supabase = createTestSupabase(
      { itinerary_items: [{ id: 'i1', title: 'Test Track', date: '2026-09-06', time_start: '09:00:00' }] },
      searchStub([{ id: 'i1', title: 'Test Track', item_date: '2026-09-06', time_start: '09:00:00', score: 0.95 }]),
    );
    const executor = createToolExecutor(baseCtx(supabase));

    const result = (await executor('cancel_itinerary_item', { title: 'Test Track' })) as { confirmation_needed: boolean; preview: string };
    expect(result.confirmation_needed).toBe(true);
    expect(result.preview).toContain('Test Track');

    const outcomes = (await new Promise(r => supabase.from('itinerary_item_outcomes').eq('itinerary_item_id', 'i1').then(r))) as {
      data: unknown[];
    };
    expect(outcomes.data).toEqual([]);
  });

  it('confirm=true marca a linha como cancelled', async () => {
    const supabase = createTestSupabase(
      { itinerary_items: [{ id: 'i1', title: 'Test Track', date: '2026-09-06', time_start: '09:00:00' }] },
      searchStub([{ id: 'i1', title: 'Test Track', item_date: '2026-09-06', time_start: '09:00:00', score: 0.95 }]),
    );
    const executor = createToolExecutor(baseCtx(supabase));

    await executor('cancel_itinerary_item', { title: 'Test Track' });
    const result = (await executor('cancel_itinerary_item', { confirm: true })) as { cancelled: boolean; title: string };
    expect(result.cancelled).toBe(true);
    expect(result.title).toBe('Test Track');

    const outcomes = (await new Promise(r => supabase.from('itinerary_item_outcomes').eq('itinerary_item_id', 'i1').then(r))) as {
      data: { status: string }[];
    };
    expect(outcomes.data[0].status).toBe('cancelled');
  });
});
