import { useCallback, useEffect, useState } from 'react';
import type { Expense } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import type { RealtimeClientLike } from './useRealtimeTable';
import { useRealtimeTable } from './useRealtimeTable';
import { newId } from '../services/ids';
import {
  expenseFromRow,
  expenseToInsert,
  type ExpenseRow,
} from './mappers/expenseMapper';

export interface ExpensesDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  realtime?: RealtimeClientLike | null;
}

export function useExpensesData({
  client,
  tripId,
  recordFailure,
  realtime,
}: ExpensesDataDeps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('expenses')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data) {
          setExpenses((data as ExpenseRow[]).map(expenseFromRow));
        } else {
          setExpenses([]);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelado) {
          setExpenses([]);
          setLoading(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  useRealtimeTable<ExpenseRow>({
    client: realtime ?? null,
    table: 'expenses',
    filter: tripId ? `trip_id=eq.${tripId}` : null,
    onInsert: row => {
      const expense = expenseFromRow(row);
      setExpenses(prev => (prev.some(x => x.id === expense.id) ? prev : [expense, ...prev]));
    },
    onUpdate: row => {
      const expense = expenseFromRow(row);
      setExpenses(prev => prev.map(x => (x.id === expense.id ? expense : x)));
    },
    onDelete: old => {
      setExpenses(prev => prev.filter(x => x.id !== old.id));
    },
  });

  const addExpense = useCallback(
    (data: Omit<Expense, 'id'>) => {
      const e: Expense = { ...data, id: newId() };

      const escrever = () => {
        setExpenses(prev => [e, ...prev]);
        client
          .from('expenses')
          .insert(expenseToInsert(e))
          .then(({ error }) => {
            if (!error) return;
            setExpenses(prev => prev.filter(x => x.id !== e.id));
            recordFailure({
              entity: 'Despesa',
              operation: 'criar',
              label: e.description,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure],
  );

  const updateExpense = useCallback(
    (id: string, patch: Partial<Expense>) => {
      const anterior = expenses.find(x => x.id === id);
      if (!anterior) return;

      const atualizado: Expense = { ...anterior, ...patch };

      const escrever = () => {
        setExpenses(atual => atual.map(x => (x.id === id ? atualizado : x)));
        client
          .from('expenses')
          .update(expenseToInsert(atualizado))
          .eq('id', id)
          .then(({ error }) => {
            if (!error) return;
            setExpenses(atual => atual.map(x => (x.id === id ? anterior : x)));
            recordFailure({
              entity: 'Despesa',
              operation: 'atualizar',
              label: anterior.description,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure, expenses],
  );

  const deleteExpense = useCallback(
    (id: string) => {
      const removido = expenses.find(x => x.id === id);
      if (!removido) return;

      const escrever = () => {
        setExpenses(atual => atual.filter(x => x.id !== id));
        client
          .from('expenses')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (!error) return;
            setExpenses(atual => [removido, ...atual]);
            recordFailure({
              entity: 'Despesa',
              operation: 'excluir',
              label: removido.description,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, recordFailure, expenses],
  );

  return {
    expenses,
    setExpenses,
    loading,
    addExpense,
    updateExpense,
    deleteExpense,
  };
}
