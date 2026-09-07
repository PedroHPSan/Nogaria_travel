import { describe, expect, it } from 'vitest';
import { buildDirectionsUrl, computeLeaveBy, formatEta, resolveOrigin } from '../maps.ts';

describe('buildDirectionsUrl', () => {
  it('monta link com origem e destino em texto livre', () => {
    const url = buildDirectionsUrl({
      origin: { text: 'Hilton Bonnet Creek, Orlando' },
      destination: { text: 'Magic Kingdom, Orlando' },
    });
    expect(url).toContain('https://www.google.com/maps/dir/?');
    expect(url).toContain('origin=Hilton+Bonnet+Creek%2C+Orlando');
    expect(url).toContain('destination=Magic+Kingdom%2C+Orlando');
    expect(url).toContain('travelmode=driving');
  });

  it('funciona sem origem — o app usa o GPS do celular nesse caso', () => {
    const url = buildDirectionsUrl({ destination: { text: 'Epcot' } });
    expect(url).not.toContain('origin=');
    expect(url).toContain('destination=Epcot');
  });

  it('inclui place_id quando disponível, sem descartar o texto', () => {
    const url = buildDirectionsUrl({ destination: { text: 'Epcot', placeId: 'ChIJabc123' } });
    expect(url).toContain('destination_place_id=ChIJabc123');
    expect(url).toContain('destination=Epcot');
  });

  it('respeita o travelMode pedido', () => {
    const url = buildDirectionsUrl({ destination: { text: 'Epcot' }, travelMode: 'walking' });
    expect(url).toContain('travelmode=walking');
  });
});

describe('formatEta', () => {
  it('formata minutos e km com vírgula (pt-BR)', () => {
    expect(formatEta(1620, 18400)).toBe('27 min (18,4 km)');
  });

  it('arredonda minutos', () => {
    expect(formatEta(90, 500)).toBe('2 min (0,5 km)');
  });
});

describe('computeLeaveBy', () => {
  it('subtrai deslocamento e antecedência recomendada do horário da atividade', () => {
    // Atividade às 14:00, 27min de trajeto, 15min de antecedência recomendada.
    expect(computeLeaveBy({ activityTimeStart: '14:00', etaSeconds: 27 * 60, recommendedArrivalMinBefore: 15 })).toBe('13:18');
  });

  it('sem antecedência recomendada, só desconta o trajeto', () => {
    expect(computeLeaveBy({ activityTimeStart: '09:00', etaSeconds: 30 * 60 })).toBe('08:30');
  });

  it('nunca cruza para o dia anterior — satura em 00:00', () => {
    expect(computeLeaveBy({ activityTimeStart: '00:10', etaSeconds: 40 * 60, recommendedArrivalMinBefore: 0 })).toBe('00:00');
  });
});

describe('resolveOrigin', () => {
  const now = new Date('2026-09-06T14:00:00Z');

  it('local dito no texto tem prioridade sobre tudo', () => {
    const result = resolveOrigin({
      explicit: { text: 'do Epcot' },
      pin: { lat: 1, lng: 2, sharedAt: now.toISOString() },
      accommodation: { text: 'Hotel X' },
      now,
    });
    expect(result).toEqual({ kind: 'text', label: 'do Epcot', point: { text: 'do Epcot' } });
  });

  it('pin recente (<90min) tem prioridade sobre a hospedagem', () => {
    const sharedAt = new Date(now.getTime() - 30 * 60_000).toISOString();
    const result = resolveOrigin({ explicit: null, pin: { lat: 28.4, lng: -81.5, sharedAt }, accommodation: { text: 'Hotel X' }, now });
    expect(result.kind).toBe('coords');
    expect(result.point).toEqual({ text: '28.4,-81.5' });
  });

  it('pin velho (>90min) não é usado — cai pra hospedagem', () => {
    const sharedAt = new Date(now.getTime() - 120 * 60_000).toISOString();
    const result = resolveOrigin({ explicit: null, pin: { lat: 28.4, lng: -81.5, sharedAt }, accommodation: { text: 'Hotel X' }, now });
    expect(result).toEqual({ kind: 'text', label: 'Hotel X', point: { text: 'Hotel X' } });
  });

  it('sem nada resolvido, pede a localização em vez de inventar uma origem', () => {
    const result = resolveOrigin({ explicit: null, pin: null, accommodation: null, now });
    expect(result).toEqual({ kind: 'ask' });
  });
});
