import { describe, it, expect } from 'vitest';
import { monthsToRender } from './MonthCalendar';

describe('monthsToRender (#33 — viagem que cruza o mês)', () => {
  it('viagem 28/12–05/01 rende dezembro e janeiro, nessa ordem', () => {
    expect(monthsToRender('2026-12-28', '2027-01-05', [])).toEqual(['2026-12', '2027-01']);
  });

  it('viagem dentro de um só mês rende um único bloco', () => {
    expect(monthsToRender('2026-09-05', '2026-09-20', [])).toEqual(['2026-09']);
  });

  it('cobre todos os meses intermediários de uma viagem longa', () => {
    expect(monthsToRender('2026-11-20', '2027-02-03', [])).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('inclui meses de itens fora do intervalo da viagem (voo de conexão na véspera)', () => {
    expect(monthsToRender('2026-10-01', '2026-10-10', ['2026-09-30', '2026-10-02'])).toEqual(['2026-09', '2026-10']);
  });

  it('volta anterior à ida não gera loop nem grade vazia', () => {
    expect(monthsToRender('2026-10-01', '2026-09-10', [])).toEqual(['2026-10']);
  });

  it('ignora datas malformadas', () => {
    expect(monthsToRender('2026-10-01', '2026-10-10', ['', 'abc'])).toEqual(['2026-10']);
  });
});
