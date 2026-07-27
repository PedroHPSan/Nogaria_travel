// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWriteFailures } from './useWriteFailures';

describe('useWriteFailures', () => {
  it('começa vazio', () => {
    const { result } = renderHook(() => useWriteFailures());
    expect(result.current.failures).toEqual([]);
  });

  it('registra uma falha com id próprio', () => {
    const { result } = renderHook(() => useWriteFailures());

    act(() =>
      result.current.recordFailure({
        entity: 'Participante',
        operation: 'atualizar',
        label: 'Gabriela',
        retry: () => {},
      }),
    );

    expect(result.current.failures).toHaveLength(1);
    expect(result.current.failures[0].entity).toBe('Participante');
    expect(result.current.failures[0].label).toBe('Gabriela');
    expect(result.current.failures[0].id).toBeTruthy();
  });

  it('acumula falhas em vez de substituir a anterior', () => {
    const { result } = renderHook(() => useWriteFailures());

    act(() => {
      result.current.recordFailure({ entity: 'Viagem', operation: 'criar', label: 'A', retry: () => {} });
      result.current.recordFailure({ entity: 'Participante', operation: 'criar', label: 'B', retry: () => {} });
    });

    expect(result.current.failures).toHaveLength(2);
  });

  it('descartar remove só a falha pedida', () => {
    const { result } = renderHook(() => useWriteFailures());

    act(() => {
      result.current.recordFailure({ entity: 'Viagem', operation: 'criar', label: 'A', retry: () => {} });
      result.current.recordFailure({ entity: 'Viagem', operation: 'criar', label: 'B', retry: () => {} });
    });
    const primeiro = result.current.failures[0].id;
    act(() => result.current.dismissFailure(primeiro));

    expect(result.current.failures).toHaveLength(1);
    expect(result.current.failures[0].label).toBe('B');
  });

  it('tentar de novo chama o retry guardado e remove a falha da lista', () => {
    const { result } = renderHook(() => useWriteFailures());
    const retry = vi.fn();

    act(() =>
      result.current.recordFailure({ entity: 'Viagem', operation: 'criar', label: 'A', retry }),
    );
    const id = result.current.failures[0].id;
    act(() => result.current.retryFailure(id));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(result.current.failures).toHaveLength(0);
  });

  it('tentar de novo com id inexistente não quebra', () => {
    const { result } = renderHook(() => useWriteFailures());
    act(() => result.current.retryFailure('nao-existe'));
    expect(result.current.failures).toEqual([]);
  });
});
