import { describe, expect, it } from 'vitest';
import type { ItineraryItem } from '../types/database.types';
import {
  normalizeTime,
  sortItineraryChronologically,
} from './itinerarySort';

const baseItem: ItineraryItem = {
  id: 'item-1',
  trip_id: 'trip-1',
  date: '2026-09-08',
  time_start: '09:00',
  city: 'Orlando',
  title: 'Atividade Base',
  category: 'park',
  participant_ids: ['p1'],
  status: 'planned',
  child_friendly: true,
};

describe('normalizeTime', () => {
  it('converte horários de 1 dígito de hora para 2 dígitos', () => {
    expect(normalizeTime('8:30')).toBe('08:30');
    expect(normalizeTime('9:05')).toBe('09:05');
  });

  it('mantém horários já formatados', () => {
    expect(normalizeTime('08:30')).toBe('08:30');
    expect(normalizeTime('14:45')).toBe('14:45');
  });

  it('lida com segundos extras truncando partes', () => {
    expect(normalizeTime('08:40:00')).toBe('08:40');
  });

  it('lida com nulos e vazios', () => {
    expect(normalizeTime('')).toBe('00:00');
    expect(normalizeTime(null)).toBe('00:00');
    expect(normalizeTime(undefined)).toBe('00:00');
  });
});

describe('sortItineraryChronologically', () => {
  it('ordena primariamente por data', () => {
    const item1 = { ...baseItem, id: '1', date: '2026-09-10', time_start: '08:00' };
    const item2 = { ...baseItem, id: '2', date: '2026-09-06', time_start: '20:00' };
    const item3 = { ...baseItem, id: '3', date: '2026-09-08', time_start: '12:00' };

    const sorted = sortItineraryChronologically([item1, item2, item3]);
    expect(sorted.map(i => i.id)).toEqual(['2', '3', '1']);
  });

  it('ordena por horário de início dentro do mesmo dia mesmo com formatos variados (8:00 vs 09:00 vs 14:00)', () => {
    const itemTarde = { ...baseItem, id: 'tarde', time_start: '14:00' };
    const itemManhaCedo = { ...baseItem, id: 'cedo', time_start: '8:15' };
    const itemManha = { ...baseItem, id: 'manha', time_start: '09:00' };

    const sorted = sortItineraryChronologically([itemTarde, itemManha, itemManhaCedo]);
    expect(sorted.map(i => i.id)).toEqual(['cedo', 'manha', 'tarde']);
  });

  it('usa base_order como critério de desempate quando horário é igual', () => {
    const item1 = { ...baseItem, id: 'order-3', time_start: '09:00', base_order: 3 };
    const item2 = { ...baseItem, id: 'order-1', time_start: '09:00', base_order: 1 };
    const item3 = { ...baseItem, id: 'order-2', time_start: '09:00', base_order: 2 };

    const sorted = sortItineraryChronologically([item1, item2, item3]);
    expect(sorted.map(i => i.id)).toEqual(['order-1', 'order-2', 'order-3']);
  });

  it('usa time_end e título como desempates subsequentes', () => {
    const itemA = { ...baseItem, id: 'a', time_start: '09:00', time_end: '10:30', title: 'Zebra' };
    const itemB = { ...baseItem, id: 'b', time_start: '09:00', time_end: '09:30', title: 'Alpha' };
    const itemC = { ...baseItem, id: 'c', time_start: '09:00', time_end: '09:30', title: 'Beta' };

    const sorted = sortItineraryChronologically([itemA, itemC, itemB]);
    expect(sorted.map(i => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('não muta o array original', () => {
    const original = [{ ...baseItem, id: '2', date: '2026-09-09' }, { ...baseItem, id: '1', date: '2026-09-05' }];
    const copy = [...original];
    sortItineraryChronologically(original);
    expect(original).toEqual(copy);
  });
});
