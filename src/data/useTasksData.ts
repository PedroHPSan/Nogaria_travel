import { useCallback, useEffect, useState } from 'react';
import type { Task } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { taskFromRow, taskToInsert, type TaskRow } from './mappers/taskMapper';

export interface TasksDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  fallbackTasks?: Task[];
}

export function useTasksData({ client, tripId, recordFailure, fallbackTasks = [] }: TasksDataDeps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('tasks')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data && data.length > 0) {
          setTasks((data as TaskRow[]).map(taskFromRow));
        } else if (fallbackTasks.length > 0) {
          setTasks(fallbackTasks.filter(t => t.trip_id === tripId));
        } else {
          setTasks([]);
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  const addTask = useCallback(
    (data: Omit<Task, 'id' | 'created_at'>) => {
      const task: Task = { ...data, id: newId(), created_at: new Date().toISOString() };

      const escrever = () => {
        setTasks(prev => [...prev, task]);
        client
          .from('tasks')
          .insert(taskToInsert(task))
          .then(({ error }) => {
            if (!error) return;
            setTasks(prev => prev.filter(x => x.id !== task.id));
            recordFailure({
              entity: 'Tarefa',
              operation: 'criar',
              label: task.title,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      let anterior: Task | undefined;

      const escrever = () => {
        setTasks(prev => {
          anterior = prev.find(x => x.id === id);
          if (!anterior) return prev;
          return prev.map(x => (x.id === id ? { ...x, ...patch } : x));
        });

        if (!anterior) return;
        const atualizado = { ...anterior, ...patch };

        client
          .from('tasks')
          .update(taskToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !anterior) return;
            setTasks(prev => prev.map(x => (x.id === id ? anterior! : x)));
            recordFailure({
              entity: 'Tarefa',
              operation: 'atualizar',
              label: anterior.title,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const deleteTask = useCallback(
    (id: string) => {
      let removido: Task | undefined;

      const escrever = () => {
        setTasks(prev => {
          removido = prev.find(x => x.id === id);
          return prev.filter(x => x.id !== id);
        });

        if (!removido) return;

        client
          .from('tasks')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !removido) return;
            setTasks(prev => [...prev, removido!]);
            recordFailure({
              entity: 'Tarefa',
              operation: 'excluir',
              label: removido.title,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const toggleTaskStatus = useCallback(
    (id: string) => {
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      const nextStatus: Task['status'] = task.status === 'completed' ? 'pending' : 'completed';
      updateTask(id, { status: nextStatus });
    },
    [tasks, updateTask],
  );

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
  };
}
