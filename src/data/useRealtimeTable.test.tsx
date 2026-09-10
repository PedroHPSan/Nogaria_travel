// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useRealtimeTable } from './useRealtimeTable';
import type { RealtimeChannelLike, RealtimeClientLike, RealtimePostgresChangePayload } from './useRealtimeTable';

afterEach(() => {
  cleanup();
});

/** Fake de cliente Realtime: captura o handler passado a `.on()` para o teste disparar eventos. */
function fakeClient() {
  let handler: ((payload: RealtimePostgresChangePayload) => void) | null = null;
  const removeChannel = vi.fn();

  const channel: RealtimeChannelLike = {
    on: vi.fn((_event, _filter, callback) => {
      handler = callback;
      return channel;
    }),
    subscribe: vi.fn(),
  };

  const client: RealtimeClientLike = {
    channel: vi.fn(() => channel),
    removeChannel,
  };

  return {
    client,
    channel,
    removeChannel,
    emit: (payload: RealtimePostgresChangePayload) => handler?.(payload),
  };
}

describe('useRealtimeTable', () => {
  it('assina o canal com o nome derivado de table+filter e chama subscribe', () => {
    const { client, channel } = fakeClient();

    renderHook(() =>
      useRealtimeTable({
        client,
        table: 'tasks',
        filter: 'trip_id=eq.trip-1',
        onInsert: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(client.channel).toHaveBeenCalledWith('rt:tasks:trip_id=eq.trip-1');
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: 'trip_id=eq.trip-1' },
      expect.any(Function),
    );
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it('não assina quando client é null', () => {
    const { client } = fakeClient();
    client.channel = vi.fn();

    renderHook(() =>
      useRealtimeTable({
        client: null,
        table: 'tasks',
        filter: 'trip_id=eq.trip-1',
        onInsert: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(client.channel).not.toHaveBeenCalled();
  });

  it('não assina quando filter é null', () => {
    const { client } = fakeClient();

    renderHook(() =>
      useRealtimeTable({
        client,
        table: 'tasks',
        filter: null,
        onInsert: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    expect(client.channel).not.toHaveBeenCalled();
  });

  it('despacha INSERT/UPDATE/DELETE para os callbacks corretos', () => {
    const { client, emit } = fakeClient();
    const onInsert = vi.fn();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();

    renderHook(() =>
      useRealtimeTable({
        client,
        table: 'tasks',
        filter: 'trip_id=eq.trip-1',
        onInsert,
        onUpdate,
        onDelete,
      }),
    );

    act(() => {
      emit({ eventType: 'INSERT', new: { id: 'task-1' }, old: {} });
      emit({ eventType: 'UPDATE', new: { id: 'task-1', title: 'x' }, old: { id: 'task-1' } });
      emit({ eventType: 'DELETE', new: {}, old: { id: 'task-1' } });
    });

    expect(onInsert).toHaveBeenCalledWith({ id: 'task-1' });
    expect(onUpdate).toHaveBeenCalledWith({ id: 'task-1', title: 'x' });
    expect(onDelete).toHaveBeenCalledWith({ id: 'task-1' });
  });

  it('remove o canal no cleanup', () => {
    const { client, channel, removeChannel } = fakeClient();

    const { unmount } = renderHook(() =>
      useRealtimeTable({
        client,
        table: 'tasks',
        filter: 'trip_id=eq.trip-1',
        onInsert: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    unmount();

    expect(removeChannel).toHaveBeenCalledWith(channel);
  });

  it('não lança e apenas avisa quando client.channel lança uma exceção', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client: RealtimeClientLike = {
      channel: vi.fn(() => {
        throw new Error('falha de rede');
      }),
      removeChannel: vi.fn(),
    };

    expect(() =>
      renderHook(() =>
        useRealtimeTable({
          client,
          table: 'tasks',
          filter: 'trip_id=eq.trip-1',
          onInsert: vi.fn(),
          onUpdate: vi.fn(),
          onDelete: vi.fn(),
        }),
      ),
    ).not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
