import { describe, it, expect } from 'vitest';
import { tripFromRow, tripToInsert, type TripRow } from './tripMapper';

const row: TripRow = {
  id: '33333333-3333-4333-8333-333333333333',
  tenant_id: '44444444-4444-4444-8444-444444444444',
  title: 'Miami e Orlando 2026',
  destination_main: 'Orlando, Miami e Fort Lauderdale, EUA',
  start_date: '2026-09-05',
  end_date: '2026-09-20',
  cover_image: null,
  currency_base: 'USD',
  status: 'planning',
  created_at: '2026-07-27T10:00:00Z',
  updated_at: '2026-07-27T10:00:00Z',
};

describe('tripFromRow', () => {
  it('converte null em undefined nos campos opcionais', () => {
    expect(tripFromRow(row).cover_image).toBeUndefined();
  });

  it('preserva os campos obrigatórios', () => {
    const t = tripFromRow(row);
    expect(t.id).toBe(row.id);
    expect(t.tenant_id).toBe(row.tenant_id);
    expect(t.title).toBe('Miami e Orlando 2026');
    expect(t.start_date).toBe('2026-09-05');
    expect(t.currency_base).toBe('USD');
    expect(t.status).toBe('planning');
  });
});

describe('tripToInsert', () => {
  it('converte undefined em null', () => {
    const t = tripFromRow(row);
    expect(tripToInsert(t).cover_image).toBeNull();
  });

  it('faz ida e volta sem perder informação', () => {
    expect(tripToInsert(tripFromRow(row))).toEqual(row);
  });
});
