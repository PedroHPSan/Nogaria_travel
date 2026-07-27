// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

describe('ambiente de teste de hooks', () => {
  it('renderiza um hook e aplica atualizações de estado', () => {
    const { result } = renderHook(() => {
      const [n, setN] = useState(0);
      return { n, setN };
    });

    expect(result.current.n).toBe(0);
    act(() => result.current.setN(3));
    expect(result.current.n).toBe(3);
  });
});
