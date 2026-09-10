import { describe, expect, it } from 'vitest';
import { buildPtaxUrl, parsePtaxResponse, toOlindaDate } from '../ptax.ts';

describe('ptax (#32)', () => {
  it('converte data ISO para o formato MM-DD-YYYY do Olinda', () => {
    expect(toOlindaDate('2026-09-08')).toBe('09-08-2026');
  });

  it('monta a URL do período com formato json e ordenação decrescente', () => {
    const url = buildPtaxUrl('2026-09-01', '2026-09-08');
    expect(url).toContain("@dataInicial='09-01-2026'");
    expect(url).toContain("@dataFinalCotacao='09-08-2026'");
    expect(url).toContain('$format=json');
    expect(url).toContain('$orderby=dataHoraCotacao%20desc');
  });

  it('extrai uma taxa de venda por dia', () => {
    const rates = parsePtaxResponse({
      value: [
        { cotacaoCompra: 5.4, cotacaoVenda: 5.4106, dataHoraCotacao: '2026-09-08 13:09:31.123', tipoBoletim: 'Fechamento PTAX' },
        { cotacaoCompra: 5.38, cotacaoVenda: 5.3842, dataHoraCotacao: '2026-09-04 13:08:12.456', tipoBoletim: 'Fechamento PTAX' },
      ],
    });
    expect(rates).toEqual([
      { date: '2026-09-08', rate: 5.4106 },
      { date: '2026-09-04', rate: 5.3842 },
    ]);
  });

  it('ignora boletins intermediários e linhas malformadas sem lançar', () => {
    const rates = parsePtaxResponse({
      value: [
        { cotacaoCompra: 5.4, cotacaoVenda: 5.5, dataHoraCotacao: '2026-09-08 10:00:00.000', tipoBoletim: 'Abertura' },
        { cotacaoCompra: 5.4, cotacaoVenda: 5.41, dataHoraCotacao: '2026-09-08 13:09:31.123', tipoBoletim: 'Fechamento PTAX' },
        { cotacaoVenda: 'x', dataHoraCotacao: '2026-09-07 13:00:00.000' },
        { cotacaoVenda: -1, dataHoraCotacao: '2026-09-06 13:00:00.000' },
        null,
        'lixo',
      ],
    });
    expect(rates).toEqual([{ date: '2026-09-08', rate: 5.41 }]);
  });

  it('payload sem value (ou não-objeto) devolve lista vazia', () => {
    expect(parsePtaxResponse(null)).toEqual([]);
    expect(parsePtaxResponse({})).toEqual([]);
    expect(parsePtaxResponse({ value: 'nope' })).toEqual([]);
  });

  it('a primeira ocorrência (mais recente) de um dia vence quando há duplicata', () => {
    const rates = parsePtaxResponse({
      value: [
        { cotacaoCompra: 1, cotacaoVenda: 5.2, dataHoraCotacao: '2026-09-08 13:09:31.123' },
        { cotacaoCompra: 1, cotacaoVenda: 5.1, dataHoraCotacao: '2026-09-08 11:00:00.000' },
      ],
    });
    expect(rates).toEqual([{ date: '2026-09-08', rate: 5.2 }]);
  });
});
