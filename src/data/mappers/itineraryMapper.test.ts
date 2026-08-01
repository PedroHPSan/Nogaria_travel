import { describe, it, expect } from 'vitest';
import { itineraryFromRow, itineraryToInsert, type ItineraryItemRow } from './itineraryMapper';

const linhaAtracao: ItineraryItemRow = {
  id: '25ac18d6-1db3-4a35-9ac1-30397dc02b45',
  trip_id: '9a8b7c6d-5e4f-4321-8765-4321fedcba09',
  date: '2026-09-07',
  time_start: '08:40:00',
  time_end: null,
  city: 'Lake Buena Vista',
  title: 'Seven Dwarfs Mine Train',
  category: 'park',
  description: null,
  location: 'Magic Kingdom',
  participant_ids: ['11111111-1111-4111-8111-111111111111'],
  estimated_cost: null,
  currency: null,
  payment_method_id: null,
  status: 'planned',
  min_height_cm: null,
  min_age_years: null,
  child_friendly: true,
  notes: null,
  park: 'Magic Kingdom',
  area: 'Fantasyland',
  base_order: 1,
  item_type: 'attraction',
  priority_tier: 'S',
  lightning_lane: 'individual',
  lightning_lane_priority_rank: null,
  single_rider: false,
  child_switch: false,
  recommended_window: null,
  early_closure_risk: false,
  operational_status: 'operating',
  counts_toward_completion: true,
  participant_status: {},
  plan_b: null,
  time_is_estimated: true,
  show_block_start: null,
  show_block_end: null,
  recommended_arrival_min_before: null,
  last_showtime_of_day: false,
};

const linhaShow: ItineraryItemRow = {
  ...linhaAtracao,
  id: 'a1111111-1111-4111-8111-111111111111',
  title: 'Disney Adventure Friends Cavalcade',
  item_type: 'show',
  time_start: '19:35:00',
  time_end: '19:45:00',
  show_block_start: '19:35:00',
  show_block_end: '19:45:00',
};

describe('itineraryFromRow', () => {
  it('trunca time_start de HH:MM:SS para HH:MM', () => {
    expect(itineraryFromRow(linhaAtracao).time_start).toBe('08:40');
  });

  it('trunca time_end quando presente, e devolve undefined quando null', () => {
    expect(itineraryFromRow(linhaAtracao).time_end).toBeUndefined();
    expect(itineraryFromRow(linhaShow).time_end).toBe('19:45');
  });

  it('trunca show_block_start e show_block_end de HH:MM:SS para HH:MM', () => {
    const item = itineraryFromRow(linhaShow);
    expect(item.show_block_start).toBe('19:35');
    expect(item.show_block_end).toBe('19:45');
  });

  it('devolve show_block_start/end undefined quando null no banco', () => {
    const item = itineraryFromRow(linhaAtracao);
    expect(item.show_block_start).toBeUndefined();
    expect(item.show_block_end).toBeUndefined();
  });

  it('converte demais colunas null do banco em undefined do TS', () => {
    const item = itineraryFromRow(linhaAtracao);
    expect(item.description).toBeUndefined();
    expect(item.estimated_cost).toBeUndefined();
    expect(item.min_height_cm).toBeUndefined();
    expect(item.lightning_lane_priority_rank).toBeUndefined();
    expect(item.plan_b).toBeUndefined();
  });

  it('preserva os campos que atravessam sem tradução, incluindo os da fatia 1', () => {
    const item = itineraryFromRow(linhaAtracao);
    expect(item.id).toBe(linhaAtracao.id);
    expect(item.trip_id).toBe(linhaAtracao.trip_id);
    expect(item.title).toBe('Seven Dwarfs Mine Train');
    expect(item.park).toBe('Magic Kingdom');
    expect(item.area).toBe('Fantasyland');
    expect(item.item_type).toBe('attraction');
    expect(item.priority_tier).toBe('S');
    expect(item.lightning_lane).toBe('individual');
    expect(item.counts_toward_completion).toBe(true);
    expect(item.participant_status).toEqual({});
    expect(item.time_is_estimated).toBe(true);
    expect(item.participant_ids).toEqual(['11111111-1111-4111-8111-111111111111']);
  });
});

describe('itineraryToInsert', () => {
  it('não precisa reverter o truncamento — HH:MM é uma entrada válida para a coluna time', () => {
    const item = itineraryFromRow(linhaShow);
    const insert = itineraryToInsert(item);
    expect(insert.time_start).toBe('19:35');
    expect(insert.show_block_start).toBe('19:35');
    expect(insert.show_block_end).toBe('19:45');
  });

  it('converte undefined do TS em null do banco', () => {
    const item = itineraryFromRow(linhaAtracao);
    const insert = itineraryToInsert(item);
    expect(insert.description).toBeNull();
    expect(insert.estimated_cost).toBeNull();
    expect(insert.show_block_start).toBeNull();
    expect(insert.plan_b).toBeNull();
  });

  it('aplica os defaults not-null de booleanos quando o TS não os define', () => {
    const item = itineraryFromRow(linhaAtracao);
    const semBooleanosOpcionais = { ...item, single_rider: undefined, child_switch: undefined, early_closure_risk: undefined, time_is_estimated: undefined, last_showtime_of_day: undefined };
    const insert = itineraryToInsert(semBooleanosOpcionais);
    expect(insert.single_rider).toBe(false);
    expect(insert.child_switch).toBe(false);
    expect(insert.early_closure_risk).toBe(false);
    expect(insert.time_is_estimated).toBe(false);
    expect(insert.last_showtime_of_day).toBe(false);
  });

  it('round-trip preserva os valores', () => {
    const item = itineraryFromRow(linhaAtracao);
    const insert = itineraryToInsert(item);
    expect(insert.id).toBe(linhaAtracao.id);
    expect(insert.title).toBe(linhaAtracao.title);
    expect(insert.park).toBe(linhaAtracao.park);
    expect(insert.participant_ids).toEqual(linhaAtracao.participant_ids);
  });
});
