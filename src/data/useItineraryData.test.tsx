// @vitest-environment jsdom
import { StrictMode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useItineraryData } from './useItineraryData';
import type { SupabaseLike } from './useTripsData';
import type { ItineraryItem } from '../types/database.types';

const TRIP = '9a8b7c6d-5e4f-4321-8765-4321fedcba09';

const linhaSevenDwarfs = {
  id: '25ac18d6-1db3-4a35-9ac1-30397dc02b45',
  trip_id: TRIP,
  date: '2026-09-07',
  time_start: '08:40:00',
  time_end: null,
  city: 'Lake Buena Vista',
  title: 'Seven Dwarfs Mine Train',
  category: 'park',
  description: null,
  location: 'Magic Kingdom',
  participant_ids: ['11111111-1111-4111-8111-111111111111'],
  estimated_cost: null,
  currency: null,
  payment_method_id: null,
  status: 'planned',
  min_height_cm: null,
  min_age_years: null,
  child_friendly: true,
  notes: null,
  park: 'Magic Kingdom',
  area: 'Fantasyland',
  base_order: 1,
  item_type: 'attraction',
  priority_tier: 'S',
  lightning_lane: 'individual',
  lightning_lane_priority_rank: null,
  single_rider: false,
  child_switch: false,
  recommended_window: null,
  early_closure_risk: false,
  operational_status: 'operating',
  counts_toward_completion: true,
  participant_status: {},
  plan_b: null,
  time_is_estimated: true,
  show_block_start: null,
  show_block_end: null,
  recommended_arrival_min_before: null,
  last_showtime_of_day: false,
};

const novoItem: Omit<ItineraryItem, 'id'> = {
  trip_id: TRIP,
  date: '2026-09-08',
  time_start: '09:00',
  city: 'Orlando',
  title: 'Café da manhã no hotel',
  category: 'restaurant',
  participant_ids: ['11111111-1111-4111-8111-111111111111'],
  status: 'planned',
  child_friendly: true,
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
  return { client, tripId: TRIP, recordFailure };
}

describe('useItineraryData', () => {
  afterEach(() => cleanup());

  it('carrega e trunca os campos de horário para HH:MM', async () => {
    const client = makeClient({ rows: [linhaSevenDwarfs] });
    const { result } = renderHook(() => useItineraryData(deps(client)));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.itinerary[0].time_start).toBe('08:40');
  });

  it('adiciona no estado local imediatamente', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useItineraryData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.addItineraryItem(novoItem); });

    expect(result.current.itinerary).toHaveLength(1);
    expect(result.current.itinerary[0].title).toBe('Café da manhã no hotel');
  });

  it('reverte a adição quando o insert falha e registra a falha', async () => {
    const recordFailure = vi.fn();
    const client = makeClient({ error: 'insert falhou' });
    const { result } = renderHook(() => useItineraryData(deps(client, recordFailure)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.addItineraryItem(novoItem); });

    await waitFor(() => expect(result.current.itinerary).toHaveLength(0));
    expect(recordFailure.mock.calls[0][0]).toMatchObject({
      entity: 'Item de roteiro',
      operation: 'criar',
      label: 'Café da manhã no hotel',
    });
  });

  it('aplica o update local na hora, ex.: marcar participant_status', async () => {
    const client = makeClient({ rows: [linhaSevenDwarfs] });
    const { result } = renderHook(() => useItineraryData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateItineraryItem(linhaSevenDwarfs.id, {
        participant_status: { '11111111-1111-4111-8111-111111111111': 'done' },
      });
    });

    expect(result.current.itinerary[0].participant_status).toEqual({
      '11111111-1111-4111-8111-111111111111': 'done',
    });
  });

  it('reverte o update para o valor ANTERIOR quando falha', async () => {
    const client = makeClient({ rows: [linhaSevenDwarfs], error: 'update falhou' });
    const { result } = renderHook(() => useItineraryData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.updateItineraryItem(linhaSevenDwarfs.id, { title: 'Título Errado' });
    });

    await waitFor(() => expect(result.current.itinerary[0].title).toBe('Seven Dwarfs Mine Train'));
  });

  it('remove na hora e, se o delete falhar, devolve a linha COMPLETA', async () => {
    const client = makeClient({ rows: [linhaSevenDwarfs], error: 'delete falhou' });
    const { result } = renderHook(() => useItineraryData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.deleteItineraryItem(linhaSevenDwarfs.id); });

    await waitFor(() => expect(result.current.itinerary).toHaveLength(1));
    const voltou = result.current.itinerary[0];
    expect(voltou.park).toBe('Magic Kingdom');
    expect(voltou.area).toBe('Fantasyland');
    expect(voltou.item_type).toBe('attraction');
    expect(voltou.priority_tier).toBe('S');
  });

  it('em StrictMode, updateItineraryItem chamado uma vez só dispara um update()', async () => {
    const updateSpy = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    const client: SupabaseLike = {
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: [linhaSevenDwarfs], error: null }) }),
        insert: () => Promise.resolve({ error: null }),
        update: updateSpy,
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    };

    const { result } = renderHook(() => useItineraryData(deps(client)), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.updateItineraryItem(linhaSevenDwarfs.id, { title: 'Título Novo' });
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('em StrictMode, deleteItineraryItem chamado uma vez só dispara um delete()', async () => {
    const deleteSpy = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    const client: SupabaseLike = {
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: [linhaSevenDwarfs], error: null }) }),
        insert: () => Promise.resolve({ error: null }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        delete: deleteSpy,
      }),
    };

    const { result } = renderHook(() => useItineraryData(deps(client)), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.deleteItineraryItem(linhaSevenDwarfs.id); });

    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('ordena os itens carregados por date, depois time_start, depois base_order', async () => {
    const itemTarde = { ...linhaSevenDwarfs, id: 'a', date: '2026-09-08', time_start: '14:00:00', base_order: 5, title: 'Tarde' };
    const itemManha = { ...linhaSevenDwarfs, id: 'b', date: '2026-09-08', time_start: '08:00:00', base_order: 1, title: 'Manhã' };
    const itemDiaAnterior = { ...linhaSevenDwarfs, id: 'c', date: '2026-09-07', time_start: '20:00:00', base_order: 1, title: 'Dia anterior' };
    const itemMesmoHorarioOrderMaior = { ...linhaSevenDwarfs, id: 'd', date: '2026-09-08', time_start: '08:00:00', base_order: 9, title: 'Mesmo horário, order maior' };

    const client = makeClient({ rows: [itemTarde, itemManha, itemDiaAnterior, itemMesmoHorarioOrderMaior] });
    const { result } = renderHook(() => useItineraryData(deps(client)));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.itinerary.map(i => i.title)).toEqual([
      'Dia anterior',
      'Manhã',
      'Mesmo horário, order maior',
      'Tarde',
    ]);
  });

  it('reinsere a linha revertida do delete na posição cronológica correta, não só no fim', async () => {
    const itemManha = { ...linhaSevenDwarfs, id: 'a', date: '2026-09-07', time_start: '07:00:00', base_order: 1, title: 'Manhã' };
    const itemTarde = { ...linhaSevenDwarfs, id: 'b', date: '2026-09-07', time_start: '18:00:00', base_order: 1, title: 'Tarde' };
    // linhaSevenDwarfs (id 25ac...) é 08:40 — deve ficar entre Manhã e Tarde após o rollback do delete.
    const client = makeClient({ rows: [itemManha, itemTarde, linhaSevenDwarfs], error: 'delete falhou' });
    const { result } = renderHook(() => useItineraryData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { result.current.deleteItineraryItem(linhaSevenDwarfs.id); });

    await waitFor(() => expect(result.current.itinerary).toHaveLength(3));
    expect(result.current.itinerary.map(i => i.title)).toEqual(['Manhã', 'Seven Dwarfs Mine Train', 'Tarde']);
  });

  it('não consulta o banco sem viagem ativa', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseLike;

    const { result } = renderHook(() =>
      useItineraryData({ client, tripId: null, recordFailure: vi.fn() }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(from).not.toHaveBeenCalled();
  });
});
