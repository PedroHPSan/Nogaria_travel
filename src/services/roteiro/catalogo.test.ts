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

const ALL = [
  ...MAGIC_KINGDOM_ITEMS,
  ...EPCOT_ITEMS,
  ...HOLLYWOOD_STUDIOS_ITEMS,
  ...ANIMAL_KINGDOM_ITEMS,
  ...UNIVERSAL_STUDIOS_FLORIDA_ITEMS,
  ...ISLANDS_OF_ADVENTURE_ITEMS,
  ...EPIC_UNIVERSE_ITEMS,
];

/**
 * Até a issue #31 nenhum item do catálogo tinha altura mínima, então o gate de
 * elegibilidade da cobertura e a auditoria de altura nunca disparavam com dado
 * real. Esta lista trava as atrações de maior impacto (as que barram crianças
 * de ~1,00–1,20m) — valores das páginas oficiais dos parques.
 */
const ALTURAS_CHAVE: Record<string, number> = {
  'Seven Dwarfs Mine Train': 97,
  'Space Mountain': 112,
  'TRON Lightcycle / Run': 122,
  'Test Track': 102,
  'Guardians of the Galaxy: Cosmic Rewind': 107,
  "Rock 'n' Roller Coaster Starring The Muppets": 122,
  'Slinky Dog Dash': 97,
  'Avatar Flight of Passage': 112,
  'Expedition Everest – Legend of the Forbidden Mountain': 112,
  'Jurassic World VelociCoaster': 130,
  'The Incredible Hulk Coaster': 137,
  "Hagrid's Magical Creatures Motorbike Adventure": 122,
  'Stardust Racers': 122,
  "Mario Kart: Bowser's Challenge": 102,
};

describe('catálogo de parques — alturas mínimas (#31)', () => {
  it.each(Object.entries(ALTURAS_CHAVE))('%s exige %scm', (titulo, cm) => {
    const item = ALL.find(i => i.title === titulo);
    expect(item, `${titulo} não está no catálogo`).toBeDefined();
    expect(item?.min_height_cm).toBe(cm);
  });

  it('toda altura cadastrada está numa faixa plausível (80–140cm)', () => {
    for (const item of ALL) {
      if (item.min_height_cm === undefined) continue;
      expect(item.min_height_cm, item.title).toBeGreaterThanOrEqual(80);
      expect(item.min_height_cm, item.title).toBeLessThanOrEqual(140);
    }
  });

  it('shows, experiências e personagens não têm restrição de altura', () => {
    const errados = ALL.filter(i => i.item_type !== 'attraction' && i.min_height_cm !== undefined);
    expect(errados.map(i => i.title)).toEqual([]);
  });

  it('pelo menos um terço das atrações do catálogo tem altura cadastrada', () => {
    const attractions = ALL.filter(i => i.item_type === 'attraction');
    const comAltura = attractions.filter(i => i.min_height_cm !== undefined);
    expect(comAltura.length / attractions.length).toBeGreaterThan(1 / 3);
  });
});
