// @vitest-environment jsdom
import { StrictMode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useParticipantsData } from './useParticipantsData';
import type { SupabaseLike } from './useTripsData';
import type { Participant } from '../types/database.types';

const TRIP = '22222222-2222-4222-8222-222222222222';
const TODAY = '2026-07-27';

const linhaDebora = {
  id: '11111111-1111-4111-8111-111111111111',
  trip_id: TRIP,
  full_name: 'Débora Palheta',
  nickname: 'Débora',
  birth_date: '2014-03-10',
  is_minor: true,
  relationship: 'Filha de Bárbara',
  responsible_participant_id: null,
  passport_number: 'AB123456',
  passport_expiry: '2030-01-01',
  visa_status: 'valid',
  dietary_restrictions: ['sem lactose'],
  height_cm: 150,
  notes: 'alérgica a amendoim',
  budget_limit_usd: 600,
  avatar_color: 'bg-purple-500',
};

const nova: Omit<Participant, 'id' | 'age' | 'is_minor'> = {
  trip_id: TRIP,
  full_name: 'Gabriela Palheta',
  nickname: 'Gabi',
  birth_date: '2022-05-01',
  relationship: 'Filha de Pedro',
  budget_limit_usd: 400,
  avatar_color: 'bg-orange-500',
};

function makeClient(opts: { rows?: unknown[]; error?: string } = {}): SupabaseLike {
  const err = opts.error ? { message: opts.error } : null;
  return {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: opts.rows ?? [], error: null }) }),
      insert: () => Promise.resolve({ error: err }),
      update: () => ({ eq: () => Promise.resolve({ error: err }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: err }) }),
    }),
  };
}

function deps(client: SupabaseLike, recordFailure = vi.fn()) {
  return { client, tripId: TRIP, today: TODAY, recordFailure };
}

describe('useParticipantsData', () => {
  afterEach(() => cleanup());

  it('carrega e deriva a idade da data de nascimento', async () => {
    const client = makeClient({ rows: [linhaDebora] });
    const { result } = renderHook(() => useParticipantsData(deps(client)));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.participants[0].age).toBe(12);
    expect(result.current.participants[0].is_minor).toBe(true);
  });

  it('adiciona no estado local imediatamente, com age derivada', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useParticipantsData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.addParticipant(nova); });

    expect(result.current.participants).toHaveLength(1);
    expect(result.current.participants[0].full_name).toBe('Gabriela Palheta');
    expect(result.current.participants[0].age).toBe(4);
    expect(result.current.participants[0].is_minor).toBe(true);
  });

  it('reverte a adição quando o insert falha e registra a falha', async () => {
    const recordFailure = vi.fn();
    const client = makeClient({ error: 'insert falhou' });
    const { result } = renderHook(() =>
      useParticipantsData(deps(client, recordFailure)),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.addParticipant(nova); });

    await waitFor(() => expect(result.current.participants).toHaveLength(0));
    expect(recordFailure.mock.calls[0][0]).toMatchObject({
      entity: 'Participante',
      operation: 'criar',
      label: 'Gabriela Palheta',
    });
  });

  it('aplica o update local na hora e recalcula a idade', async () => {
    const client = makeClient({ rows: [linhaDebora] });
    const { result } = renderHook(() => useParticipantsData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.updateParticipant(linhaDebora.id, { birth_date: '2000-01-01' }); });

    expect(result.current.participants[0].age).toBe(26);
    expect(result.current.participants[0].is_minor).toBe(false);
  });

  it('reverte o update para o valor ANTERIOR quando falha', async () => {
    const client = makeClient({ rows: [linhaDebora], error: 'update falhou' });
    const { result } = renderHook(() =>
      useParticipantsData(deps(client)),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.updateParticipant(linhaDebora.id, { full_name: 'Nome Errado' });
    });

    await waitFor(() => expect(result.current.participants[0].full_name).toBe('Débora Palheta'));
  });

  it('remove na hora e, se o delete falhar, devolve a linha COMPLETA', async () => {
    const client = makeClient({ rows: [linhaDebora], error: 'delete falhou' });
    const { result } = renderHook(() =>
      useParticipantsData(deps(client)),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.deleteParticipant(linhaDebora.id); });

    await waitFor(() => expect(result.current.participants).toHaveLength(1));
    const voltou = result.current.participants[0];
    expect(voltou.passport_number).toBe('AB123456');
    expect(voltou.dietary_restrictions).toEqual(['sem lactose']);
    expect(voltou.notes).toBe('alérgica a amendoim');
    expect(voltou.height_cm).toBe(150);
  });

  it('em StrictMode, updateParticipant chamado uma vez só dispara um update()', async () => {
    const updateSpy = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    const client: SupabaseLike = {
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: [linhaDebora], error: null }) }),
        insert: () => Promise.resolve({ error: null }),
        update: updateSpy,
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    };

    const { result } = renderHook(() => useParticipantsData(deps(client)), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.updateParticipant(linhaDebora.id, { full_name: 'Nome Novo' });
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('em StrictMode, deleteParticipant chamado uma vez só dispara um delete()', async () => {
    const deleteSpy = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    const client: SupabaseLike = {
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: [linhaDebora], error: null }) }),
        insert: () => Promise.resolve({ error: null }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        delete: deleteSpy,
      }),
    };

    const { result } = renderHook(() => useParticipantsData(deps(client)), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.deleteParticipant(linhaDebora.id);
    });

    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('não consulta o banco sem viagem ativa', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseLike;

    const { result } = renderHook(() =>
      useParticipantsData({ client, tripId: null, today: TODAY, recordFailure: vi.fn() }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(from).not.toHaveBeenCalled();
  });
});
