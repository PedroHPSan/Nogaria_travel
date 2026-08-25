import { describe, it, expect } from 'vitest';
import {
  deriveAge,
  participantFromRow,
  participantToInsert,
  type ParticipantRow,
} from './participantMapper';

const row: ParticipantRow = {
  id: '11111111-1111-4111-8111-111111111111',
  trip_id: '22222222-2222-4222-8222-222222222222',
  full_name: 'Débora Palheta',
  nickname: 'Débora',
  birth_date: '2014-03-10',
  is_minor: false,
  relationship: 'Filha de Bárbara',
  responsible_participant_id: null,
  passport_number: null,
  passport_expiry: null,
  visa_status: 'valid',
  dietary_restrictions: null,
  height_cm: null,
  whatsapp_phone: null,
  notes: null,
  budget_limit_usd: 600,
  avatar_color: 'bg-purple-500',
};

describe('deriveAge', () => {
  it('conta o aniversário já ocorrido no ano', () => {
    expect(deriveAge('2014-03-10', '2026-07-27')).toBe(12);
  });

  it('não conta o aniversário que ainda não chegou', () => {
    expect(deriveAge('2014-12-25', '2026-07-27')).toBe(11);
  });

  it('conta o aniversário que é exatamente hoje', () => {
    expect(deriveAge('2014-07-27', '2026-07-27')).toBe(12);
  });

  it('trata 29 de fevereiro em ano não bissexto', () => {
    expect(deriveAge('2016-02-29', '2026-02-28')).toBe(9);
    expect(deriveAge('2016-02-29', '2026-03-01')).toBe(10);
  });

  it('devolve 0 para data de nascimento no futuro em vez de número negativo', () => {
    expect(deriveAge('2030-01-01', '2026-07-27')).toBe(0);
  });

  it('devolve 0 para data vazia', () => {
    expect(deriveAge('', '2026-07-27')).toBe(0);
  });
});

describe('participantFromRow', () => {
  it('deriva age e is_minor da data de nascimento, ignorando a coluna is_minor', () => {
    const p = participantFromRow(row, '2026-07-27');
    expect(p.age).toBe(12);
    expect(p.is_minor).toBe(true);
  });

  it('converte null do banco em undefined do TS', () => {
    const p = participantFromRow(row, '2026-07-27');
    expect(p.responsible_participant_id).toBeUndefined();
    expect(p.passport_number).toBeUndefined();
    expect(p.dietary_restrictions).toBeUndefined();
  });

  it('preserva os campos que atravessam sem tradução', () => {
    const p = participantFromRow(row, '2026-07-27');
    expect(p.id).toBe(row.id);
    expect(p.trip_id).toBe(row.trip_id);
    expect(p.full_name).toBe('Débora Palheta');
    expect(p.budget_limit_usd).toBe(600);
    expect(p.avatar_color).toBe('bg-purple-500');
  });
});

describe('participantToInsert', () => {
  it('não envia age, que não é coluna', () => {
    const p = participantFromRow(row, '2026-07-27');
    const insert = participantToInsert(p, '2026-07-27');
    expect('age' in insert).toBe(false);
  });

  it('não envia quota_eligible, que não é coluna', () => {
    const p = { ...participantFromRow(row, '2026-07-27'), quota_eligible: false };
    const insert = participantToInsert(p, '2026-07-27');
    expect('quota_eligible' in insert).toBe(false);
  });

  it('recalcula is_minor na escrita para a coluna nunca contradizer a data', () => {
    const p = { ...participantFromRow(row, '2026-07-27'), is_minor: false };
    expect(participantToInsert(p, '2026-07-27').is_minor).toBe(true);
  });

  it('converte undefined do TS em null do banco', () => {
    const p = participantFromRow(row, '2026-07-27');
    const insert = participantToInsert(p, '2026-07-27');
    expect(insert.nickname).toBe('Débora');
    expect(insert.passport_number).toBeNull();
    expect(insert.height_cm).toBeNull();
  });
});
