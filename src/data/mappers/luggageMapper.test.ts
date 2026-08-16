import { describe, expect, it } from 'vitest';
import { luggageFromRow, luggageToInsert, type LuggageRow } from './luggageMapper';
import type { Luggage } from '../../types/database.types';

describe('luggageMapper', () => {
  const mockRow: LuggageRow = {
    id: 'lug-1',
    trip_id: 'trip-1',
    participant_id: 'p-1',
    type: 'checked',
    bag_identifier: 'Mala Grande Preta Samsonite',
    max_weight_kg: '23.00',
    current_weight_kg: '18.50',
    description: 'Mala principal Bárbara',
    shopping_space_reserved_pct: '40.00',
  };

  it('converte LuggageRow para Luggage', () => {
    const lug = luggageFromRow(mockRow);
    expect(lug.id).toBe('lug-1');
    expect(lug.bag_identifier).toBe('Mala Grande Preta Samsonite');
    expect(lug.max_weight_kg).toBe(23);
    expect(lug.current_weight_kg).toBe(18.5);
    expect(lug.shopping_space_reserved_pct).toBe(40);
  });

  it('serializa Luggage para LuggageRow sem perda', () => {
    const lug: Luggage = {
      id: 'lug-1',
      trip_id: 'trip-1',
      participant_id: 'p-1',
      type: 'carry_on',
      bag_identifier: 'Mala Bordo Azul',
      max_weight_kg: 10,
    };

    const row = luggageToInsert(lug);
    expect(row.id).toBe('lug-1');
    expect(row.current_weight_kg).toBeNull();
    expect(row.description).toBeNull();
  });
});
