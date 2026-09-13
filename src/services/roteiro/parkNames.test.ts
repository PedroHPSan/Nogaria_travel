import { describe, it, expect } from 'vitest';
import {
  MAGIC_KINGDOM_ITEMS,
  EPCOT_ITEMS,
  HOLLYWOOD_STUDIOS_ITEMS,
  ANIMAL_KINGDOM_ITEMS,
  UNIVERSAL_STUDIOS_FLORIDA_ITEMS,
  ISLANDS_OF_ADVENTURE_ITEMS,
  EPIC_UNIVERSE_ITEMS,
} from './index';
import { normalizeParkKey, PARK_ENTITY_IDS, resolveParkEntityId } from '../../../supabase/functions/_shared/parkStatus';

// Guard: todo `park` distinto que o roteiro grava em produção precisa de uma
// entrada em PARK_ENTITY_IDS (_shared/parkStatus.ts), senão a tool de
// condições e o digest nunca conseguem afirmar horário/status daquele
// parque — silenciosamente, sem erro. Este teste falha assim que alguém
// adicionar um dia operacional de um parque novo sem atualizar o mapa.
const ALL = [
  ...MAGIC_KINGDOM_ITEMS,
  ...EPCOT_ITEMS,
  ...HOLLYWOOD_STUDIOS_ITEMS,
  ...ANIMAL_KINGDOM_ITEMS,
  ...UNIVERSAL_STUDIOS_FLORIDA_ITEMS,
  ...ISLANDS_OF_ADVENTURE_ITEMS,
  ...EPIC_UNIVERSE_ITEMS,
];

const PARK_NAMES = [...new Set(ALL.map(i => i.park).filter((p): p is string => Boolean(p)))];

describe('mapeamento park → entidade themeparks.wiki', () => {
  it('todo parkName do catálogo real tem entrada em PARK_ENTITY_IDS', () => {
    expect(PARK_NAMES.length).toBeGreaterThan(0);
    for (const park of PARK_NAMES) {
      expect(resolveParkEntityId(park), `park "${park}" (normalizado: "${normalizeParkKey(park)}") sem entrada em PARK_ENTITY_IDS`).not.toBeNull();
    }
  });

  it('desconhecido resolve null — nunca um chute', () => {
    expect(resolveParkEntityId('Parque Inventado')).toBeNull();
    expect(resolveParkEntityId(null)).toBeNull();
    expect(resolveParkEntityId(undefined)).toBeNull();
  });

  it('todas as entradas do mapa são UUIDs não vazios', () => {
    for (const id of Object.values(PARK_ENTITY_IDS)) {
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
