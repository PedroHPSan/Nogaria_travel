import { describe, expect, it } from 'vitest';
import { formatConditionsAlertMessage, selectConditionAlerts, type ConditionsAlertInput } from '../conditionsAlert.ts';

function base(overrides: Partial<ConditionsAlertInput> = {}): ConditionsAlertInput {
  return {
    items: [],
    weather: null,
    parkStatus: null,
    localMinutes: 9 * 60,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    alreadyAlertedToday: false,
    ...overrides,
  };
}

describe('selectConditionAlerts', () => {
  it('sem nenhuma condição, nenhum alerta', () => {
    expect(selectConditionAlerts(base())).toEqual([]);
  });

  it('chuva alta com atividades ao ar livre gera alerta', () => {
    const alerts = selectConditionAlerts(
      base({
        weather: { precipitationProbabilityMax: 80 },
        items: [{ park: 'EPCOT' }, { park: 'EPCOT' }, { park: 'EPCOT' }],
      }),
    );
    expect(alerts.map(a => a.reason)).toEqual(['rain']);
  });

  it('chuva alta mas dia todo indoor (shopping) NÃO gera alerta — falso positivo mais irritante', () => {
    const alerts = selectConditionAlerts(
      base({
        weather: { precipitationProbabilityMax: 90 },
        items: [{ park: null }, { park: null }, { park: null }],
      }),
    );
    expect(alerts).toEqual([]);
  });

  it('chuva abaixo do limiar não gera alerta mesmo com atividades ao ar livre', () => {
    const alerts = selectConditionAlerts(
      base({ weather: { precipitationProbabilityMax: 50 }, items: [{ park: 'EPCOT' }, { park: 'EPCOT' }, { park: 'EPCOT' }] }),
    );
    expect(alerts).toEqual([]);
  });

  it('parque fechado com itens naquele parque gera alerta', () => {
    const alerts = selectConditionAlerts(
      base({ items: [{ park: 'EPCOT' }], parkStatus: { park: 'EPCOT', closed: true, attractions: [] } }),
    );
    expect(alerts.map(a => a.reason)).toEqual(['park_closed']);
  });

  it('atrações sinalizadas: no máximo 3 no alerta', () => {
    const alerts = selectConditionAlerts(
      base({
        items: [{ park: 'EPCOT' }],
        parkStatus: {
          park: 'EPCOT',
          closed: false,
          attractions: [
            { title: 'A', status: 'REFURBISHMENT' },
            { title: 'B', status: 'CLOSED' },
            { title: 'C', status: 'DOWN' },
            { title: 'D', status: 'REFURBISHMENT' },
            { title: 'E', status: 'OPERATING' },
          ],
        },
      }),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain('A');
    expect(alerts[0].message).toContain('B');
    expect(alerts[0].message).toContain('C');
    expect(alerts[0].message).not.toContain('D');
    expect(alerts[0].message).not.toContain('E');
  });

  it('agrega múltiplas condições numa lista só (o chamador manda UMA mensagem)', () => {
    const alerts = selectConditionAlerts(
      base({
        weather: { precipitationProbabilityMax: 90 },
        items: [{ park: 'EPCOT' }, { park: 'EPCOT' }, { park: 'EPCOT' }],
        parkStatus: { park: 'EPCOT', closed: true, attractions: [] },
      }),
    );
    expect(alerts.map(a => a.reason)).toEqual(['rain', 'park_closed']);
  });

  it('silêncio (quiet hours) suprime tudo', () => {
    const alerts = selectConditionAlerts(
      base({ localMinutes: 23 * 60, weather: { precipitationProbabilityMax: 90 }, items: [{ park: 'EPCOT' }, { park: 'EPCOT' }, { park: 'EPCOT' }] }),
    );
    expect(alerts).toEqual([]);
  });

  it('cooldown (já alertado) suprime tudo', () => {
    const alerts = selectConditionAlerts(
      base({ alreadyAlertedToday: true, weather: { precipitationProbabilityMax: 90 }, items: [{ park: 'EPCOT' }, { park: 'EPCOT' }, { park: 'EPCOT' }] }),
    );
    expect(alerts).toEqual([]);
  });
});

describe('formatConditionsAlertMessage', () => {
  it('sempre uma mensagem só, com convite explícito à NLP', () => {
    const text = formatConditionsAlertMessage([{ reason: 'rain', message: '☔ chuva' }, { reason: 'park_closed', message: '🎢 fechado' }]);
    expect(text).toContain('☔ chuva');
    expect(text).toContain('🎢 fechado');
    expect(text).toContain('empurre o dia');
  });
});
