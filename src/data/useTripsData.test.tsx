// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useTripsData, type SupabaseLike } from './useTripsData';
import type { Trip } from '../types/database.types';

const TENANT = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-07-27T10:00:00.000Z';

const novaViagem: Omit<Trip, 'id' | 'created_at' | 'updated_at'> = {
  tenant_id: TENANT,
  title: 'Miami e Orlando 2026',
  destination_main: 'Orlando, EUA',
  start_date: '2026-09-05',
  end_date: '2026-09-20',
  currency_base: 'USD',
  status: 'planning',
};

/** Cliente de mentira: sem rede, com falha controlável. */
function makeClient(opts: { rows?: unknown[]; insertError?: string } = {}): SupabaseLike {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: opts.rows ?? [], error: null }),
      }),
      insert: () =>
        Promise.resolve({
          error: opts.insertError ? { message: opts.insertError } : null,
        }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  };
}

function deps(client: SupabaseLike, recordFailure = vi.fn()) {
  return { client, tenantId: TENANT, nowIso: () => NOW, recordFailure };
}

describe('useTripsData', () => {
  // Sem isto, componentes de testes anteriores continuam montados e reagindo
  // a re-renders, o que produz "Maximum update depth exceeded" em testes
  // subsequentes que usam waitFor/act assíncrono (vitest.config.ts não usa
  // `test.globals: true`, então o auto-cleanup do @testing-library/react
  // nunca se registra sozinho).
  afterEach(() => cleanup());

  it('carrega as viagens do tenant', async () => {
    const client = makeClient({
      rows: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          tenant_id: TENANT,
          title: 'Miami e Orlando 2026',
          destination_main: 'Orlando, EUA',
          start_date: '2026-09-05',
          end_date: '2026-09-20',
          cover_image: null,
          currency_base: 'USD',
          status: 'planning',
          created_at: NOW,
          updated_at: NOW,
        },
      ],
    });

    const { result } = renderHook(() => useTripsData(deps(client)));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trips).toHaveLength(1);
    expect(result.current.trips[0].title).toBe('Miami e Orlando 2026');
    expect(result.current.trips[0].cover_image).toBeUndefined();
  });

  it('aplica a criação no estado local ANTES da resposta do servidor', async () => {
    let resolver: (v: { error: null }) => void = () => {};
    const client: SupabaseLike = {
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        insert: () => new Promise(r => { resolver = r; }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    };

    const { result } = renderHook(() => useTripsData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.createTrip(novaViagem); });

    // O insert ainda não respondeu, mas a viagem já está na tela.
    expect(result.current.trips).toHaveLength(1);
    expect(result.current.trips[0].title).toBe('Miami e Orlando 2026');

    await act(async () => { resolver({ error: null }); });
    expect(result.current.trips).toHaveLength(1);
  });

  it('devolve o uuid gerado, e ele é o id da viagem criada', async () => {
    // client precisa ser criado uma vez fora do callback de renderHook: se
    // criado dentro (`deps(makeClient())` inline), cada render gera um objeto
    // `client` novo, e como o efeito de carga depende de `[client, tenantId]`,
    // isso reexecuta o efeito a cada render — um loop só interrompido de fato
    // no unmount, mascarado pelo waitFor "pegar" um instante com loading=false.
    const client = makeClient();
    const { result } = renderHook(() => useTripsData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let devolvido = '';
    await act(async () => { devolvido = await result.current.createTrip(novaViagem); });

    expect(devolvido).toBeTruthy();
    expect(result.current.trips[0].id).toBe(devolvido);
  });

  it('reverte a criação quando o insert falha', async () => {
    const client = makeClient({ insertError: 'permission denied' });
    const { result } = renderHook(() => useTripsData(deps(client)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.createTrip(novaViagem).catch(() => {}); });

    await waitFor(() => expect(result.current.trips).toHaveLength(0));
  });

  it('registra a falha nomeando a viagem', async () => {
    const recordFailure = vi.fn();
    const client = makeClient({ insertError: 'permission denied' });
    const { result } = renderHook(() => useTripsData(deps(client, recordFailure)));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.createTrip(novaViagem).catch(() => {}); });

    await waitFor(() => expect(recordFailure).toHaveBeenCalledTimes(1));
    expect(recordFailure.mock.calls[0][0]).toMatchObject({
      entity: 'Viagem',
      operation: 'criar',
      label: 'Miami e Orlando 2026',
    });
  });

  it('não consulta o banco sem tenant ativo', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseLike;

    const { result } = renderHook(() =>
      useTripsData({ client, tenantId: null, nowIso: () => NOW, recordFailure: vi.fn() }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(from).not.toHaveBeenCalled();
    expect(result.current.trips).toEqual([]);
  });
});
