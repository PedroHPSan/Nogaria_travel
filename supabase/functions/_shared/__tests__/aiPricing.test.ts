import { describe, expect, it } from 'vitest';
import { FALLBACK_RATE, estimateCostUsd, rateForModel } from '../aiPricing.ts';

const DURANTE_PROMO = new Date('2026-09-12T12:00:00Z');
const DEPOIS_DA_PROMO = new Date('2027-01-01T00:00:00Z');

describe('rateForModel', () => {
  it('usa a tarifa promocional da geração 3.6+ enquanto ela vale', () => {
    expect(rateForModel('gemini-3.8-flash', DURANTE_PROMO)).toEqual({ input: 0.75, output: 3.75 });
    expect(rateForModel('gemini-3.7-flash', DURANTE_PROMO)).toEqual({ input: 0.75, output: 3.75 });
    expect(rateForModel('gemini-3.6-flash', DURANTE_PROMO)).toEqual({ input: 0.75, output: 3.75 });
  });

  it('vira para a tarifa padrão em 01/01/2027 sem precisar de novo deploy', () => {
    expect(rateForModel('gemini-3.8-flash', DEPOIS_DA_PROMO)).toEqual({ input: 1.5, output: 7.5 });
    expect(rateForModel('gemini-3.8-flash', new Date('2026-12-31T23:00:00Z'))).toEqual({ input: 0.75, output: 3.75 });
  });

  it('cobra o 3.5-flash pela tarifa dele, que não tem promoção e é mais cara na saída', () => {
    expect(rateForModel('gemini-3.5-flash', DURANTE_PROMO)).toEqual({ input: 1.5, output: 9 });
    expect(rateForModel('gemini-3.5-flash', DEPOIS_DA_PROMO)).toEqual({ input: 1.5, output: 9 });
  });

  it('ignora espaço em volta do nome vindo do campo de texto livre da UI', () => {
    expect(rateForModel('  gemini-3.8-flash  ', DURANTE_PROMO)).toEqual({ input: 0.75, output: 3.75 });
  });
});

describe('modelo desconhecido', () => {
  // resolveGeminiModel deixa passar qualquer `gemini-*` novo de propósito, então
  // a tabela precisa ter uma resposta para um modelo que ela não conhece.
  it('cobra pelo teto conhecido, nunca pelo piso', () => {
    const desconhecido = rateForModel('gemini-4-pro', DURANTE_PROMO);
    expect(desconhecido).toEqual(FALLBACK_RATE);
    expect(desconhecido.input).toBe(1.5);
    expect(desconhecido.output).toBe(9);
  });

  it('o teto é >= a tarifa de todo modelo conhecido, em qualquer data', () => {
    for (const modelo of ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']) {
      for (const quando of [DURANTE_PROMO, DEPOIS_DA_PROMO]) {
        const r = rateForModel(modelo, quando);
        expect(FALLBACK_RATE.input).toBeGreaterThanOrEqual(r.input);
        expect(FALLBACK_RATE.output).toBeGreaterThanOrEqual(r.output);
      }
    }
  });
});

describe('estimateCostUsd', () => {
  it('calcula entrada e saída pela tarifa do modelo', () => {
    // 1M de entrada a 0,75 + 0,5M de saída a 3,75 = 0,75 + 1,875
    expect(estimateCostUsd('gemini-3.8-flash', 1_000_000, 500_000, DURANTE_PROMO)).toBe(2.625);
  });

  it('arredonda para as 6 casas que ai_usage_logs guarda', () => {
    const custo = estimateCostUsd('gemini-3.8-flash', 1234, 567, DURANTE_PROMO);
    expect(custo).toBe(Number(custo.toFixed(6)));
    // Arredondado em 6 casas, então a comparação com o valor exato só vale nessa precisão.
    expect(custo).toBeCloseTo(1234 / 1e6 * 0.75 + 567 / 1e6 * 3.75, 6);
  });

  it('zero token custa zero', () => {
    expect(estimateCostUsd('gemini-3.8-flash', 0, 0, DURANTE_PROMO)).toBe(0);
  });

  it('trocar 3.5-flash por 3.8-flash reduz o custo da mesma conversa', () => {
    const conversa = { entrada: 40_000, saida: 800 };
    const antes = estimateCostUsd('gemini-3.5-flash', conversa.entrada, conversa.saida, DURANTE_PROMO);
    const depois = estimateCostUsd('gemini-3.8-flash', conversa.entrada, conversa.saida, DURANTE_PROMO);
    expect(depois).toBeLessThan(antes);
  });

  it('o custo antigo hardcoded subestimava o 3.5-flash em uma ordem de grandeza', () => {
    const entrada = 1_000_000;
    const saida = 1_000_000;
    const hardcodedAntigo = (entrada / 1e6) * 0.075 + (saida / 1e6) * 0.3;
    const real = estimateCostUsd('gemini-3.5-flash', entrada, saida, DURANTE_PROMO);
    expect(real / hardcodedAntigo).toBeGreaterThan(10);
  });
});
