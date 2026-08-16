import type { Task } from '../../types/database.types';

export interface TaskRow {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  assigned_to_id: string | null;
  due_date: string | null;
  priority: Task['priority'];
  category: Task['category'];
  status: Task['status'];
  created_at: string;
}

export function taskFromRow(row: TaskRow): Task {
  return {
    id: row.id,
    trip_id: row.trip_id,
    title: row.title,
    description: row.description ?? undefined,
    assigned_to_id: row.assigned_to_id ?? undefined,
    due_date: row.due_date ?? undefined,
    priority: row.priority,
    category: row.category,
    status: row.status,
    created_at: row.created_at,
  };
}

export function taskToInsert(t: Task): TaskRow {
  return {
    id: t.id,
    trip_id: t.trip_id,
    title: t.title,
    description: t.description ?? null,
    assigned_to_id: t.assigned_to_id ?? null,
    due_date: t.due_date ?? null,
    priority: t.priority,
    category: t.category,
    status: t.status,
    created_at: t.created_at,
  };
}
