// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useTasksData } from './useTasksData';
import type { Task } from '../types/database.types';
import type { SupabaseLike } from './useTripsData';

afterEach(() => {
  cleanup();
});

function mockClient(initialData: unknown[] = []): SupabaseLike {
  return {
    from: () => ({
      select: () => ({
        eq: vi.fn().mockResolvedValue({ data: initialData, error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
}

describe('useTasksData', () => {
  const initialTask: Task = {
    id: 'task-1',
    trip_id: 'trip-1',
    title: 'Comprar ingressos',
    priority: 'high',
    category: 'tickets',
    status: 'pending',
    created_at: '2026-07-25T00:00:00Z',
  };

  it('carrega tarefas do Supabase no mount', async () => {
    const client = mockClient([initialTask]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useTasksData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tasks.length).toBe(1);
    expect(result.current.tasks[0].title).toBe('Comprar ingressos');
  });

  it('alterna status de tarefa entre completed e pending', async () => {
    const client = mockClient([initialTask]);
    const recordFailure = vi.fn();

    const { result } = renderHook(() =>
      useTasksData({ client, tripId: 'trip-1', recordFailure }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.toggleTaskStatus('task-1');
    });

    expect(result.current.tasks[0].status).toBe('completed');
  });
});
