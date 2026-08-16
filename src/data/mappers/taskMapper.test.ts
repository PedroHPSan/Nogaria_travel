import { describe, expect, it } from 'vitest';
import { taskFromRow, taskToInsert, type TaskRow } from './taskMapper';
import type { Task } from '../../types/database.types';

describe('taskMapper', () => {
  const mockRow: TaskRow = {
    id: 'task-1',
    trip_id: 'trip-1',
    title: 'Emitir autorização de menor',
    description: 'Levar ao cartório para autenticar firma',
    assigned_to_id: 'p-1',
    due_date: '2026-08-20',
    priority: 'high',
    category: 'documents',
    status: 'pending',
    created_at: '2026-07-25T00:00:00Z',
  };

  it('converte TaskRow para Task', () => {
    const task = taskFromRow(mockRow);
    expect(task.id).toBe('task-1');
    expect(task.title).toBe('Emitir autorização de menor');
    expect(task.priority).toBe('high');
    expect(task.category).toBe('documents');
  });

  it('serializa Task para TaskRow sem perda', () => {
    const task: Task = {
      id: 'task-1',
      trip_id: 'trip-1',
      title: 'Comprar ingressos',
      priority: 'medium',
      category: 'tickets',
      status: 'pending',
      created_at: '2026-07-25T00:00:00Z',
    };

    const row = taskToInsert(task);
    expect(row.id).toBe('task-1');
    expect(row.description).toBeNull();
    expect(row.assigned_to_id).toBeNull();
  });
});
