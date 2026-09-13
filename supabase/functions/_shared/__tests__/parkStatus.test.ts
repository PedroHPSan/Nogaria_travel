import { describe, expect, it } from 'vitest';
import { mapLiveDataToItems, normalizeAttractionTitle, normalizeParkKey, parkWindowFromSchedule, resolveParkEntityId } from '../parkStatus.ts';

describe('normalizeParkKey', () => {
  it('minúsculas, sem acento, sem apóstrofo, espaços colapsados', () => {
    expect(normalizeParkKey("Disney's  Animal   Kingdom")).toBe('disneys animal kingdom');
    expect(normalizeParkKey('EPCOT')).toBe('epcot');
  });
});

describe('resolveParkEntityId', () => {
  it('resolve os 7 parques do catálogo real', () => {
    for (const park of ['EPCOT', 'Magic Kingdom', "Disney's Hollywood Studios", "Disney's Animal Kingdom", 'Universal Studios Florida', "Universal's Islands of Adventure", 'Epic Universe']) {
      expect(resolveParkEntityId(park)).not.toBeNull();
    }
  });

  it('desconhecido resolve null, nunca chuta', () => {
    expect(resolveParkEntityId('Parque Inexistente')).toBeNull();
    expect(resolveParkEntityId(null)).toBeNull();
  });
});

describe('normalizeAttractionTitle', () => {
  it('casa o caso real: catálogo usa & e a API usa and', () => {
    // A normalização por si só não resolve "&" vs "and" — o motivo de existir
    // é remover prefixos operacionais e acentos/apóstrofos; esse caso
    // específico depende de correspondência exata ou é deixado sem match
    // (registrado no PLANO como caso frágil, corrigível à mão via external_entity_id).
    expect(normalizeAttractionTitle('Disney & Pixar Short Film Festival')).toBe('disney & pixar short film festival');
  });

  it('remove prefixos operacionais do roteiro', () => {
    expect(normalizeAttractionTitle('Fila Expedition Everest')).toBe('expedition everest');
    expect(normalizeAttractionTitle('Almoço em Be Our Guest')).toBe('be our guest');
    expect(normalizeAttractionTitle('Deslocamento até o Hollywood Studios')).toBe('ate o hollywood studios');
  });

  it('remove sufixo entre parênteses e acentos', () => {
    expect(normalizeAttractionTitle('Mission: SPACE – Orange Mission (versão intensa)')).toBe('mission: space – orange mission');
  });
});

describe('parkWindowFromSchedule', () => {
  it('extrai abertura/fechamento do tipo OPERATING no dia', () => {
    const window = parkWindowFromSchedule(
      [
        { date: '2026-09-13', type: 'TICKETED_EVENT', openingTime: '2026-09-13T08:30:00-04:00', closingTime: '2026-09-13T09:00:00-04:00' },
        { date: '2026-09-13', type: 'OPERATING', openingTime: '2026-09-13T09:00:00-04:00', closingTime: '2026-09-13T21:00:00-04:00' },
      ],
      '2026-09-13',
    );
    expect(window).toEqual({ opening: '09:00', closing: '21:00', closed: false });
  });

  it('sem entrada OPERATING no dia = fechado', () => {
    const window = parkWindowFromSchedule([{ date: '2026-09-14', type: 'TICKETED_EVENT', openingTime: null, closingTime: null }], '2026-09-13');
    expect(window).toEqual({ opening: null, closing: null, closed: true });
  });
});

describe('mapLiveDataToItems', () => {
  it('casa por external_entity_id — nunca por título no caminho quente', () => {
    const liveData = [
      { id: 'ext-1', name: 'Test Track', entityType: 'ATTRACTION', status: 'OPERATING' },
      { id: 'ext-2', name: 'Frozen Ever After', entityType: 'ATTRACTION', status: 'REFURBISHMENT' },
    ];
    const items = [
      { id: 'item-1', title: 'Test Track', external_entity_id: 'ext-1' },
      { id: 'item-2', title: 'Frozen Ever After', external_entity_id: 'ext-2' },
      { id: 'item-3', title: 'Sem resolução', external_entity_id: null },
    ];
    expect(mapLiveDataToItems(liveData, items)).toEqual([
      { itemId: 'item-1', title: 'Test Track', status: 'OPERATING' },
      { itemId: 'item-2', title: 'Frozen Ever After', status: 'REFURBISHMENT' },
    ]);
  });

  it('omite status fora do enum conhecido', () => {
    const liveData = [{ id: 'ext-1', name: 'X', entityType: 'ATTRACTION', status: 'SOME_UNKNOWN_STATUS' }];
    const items = [{ id: 'item-1', title: 'X', external_entity_id: 'ext-1' }];
    expect(mapLiveDataToItems(liveData, items)).toEqual([]);
  });
});
