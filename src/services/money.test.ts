import { describe, expect, it } from 'vitest';
import { fxMultiplier, round2 } from './money';
import { newId } from './ids';

describe('round2', () => {
  it('arredonda para duas casas', () => {
    expect(round2(97.929999)).toBe(97.93);
    expect(round2(47.8772)).toBe(47.88);
  });

  it('arredonda meio centavo para cima', () => {
    expect(round2(382.225)).toBe(382.23);
  });

  it('preserva zero e negativos', () => {
    expect(round2(0)).toBe(0);
    expect(round2(-1.234)).toBe(-1.23);
  });
});

describe('fxMultiplier', () => {
  it('soma IOF e spread ao câmbio', () => {
    expect(fxMultiplier(5.62, 3.38, 0)).toBeCloseTo(5.809956, 6);
  });

  it('devolve o câmbio puro quando não há IOF nem spread', () => {
    expect(fxMultiplier(5.62, 0, 0)).toBeCloseTo(5.62, 6);
  });
});

describe('newId', () => {
  it('gera identificadores distintos em chamadas consecutivas', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()));
    expect(ids.size).toBe(100);
  });

  it('gera um UUID válido', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
