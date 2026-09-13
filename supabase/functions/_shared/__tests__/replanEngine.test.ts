import { describe, expect, it } from 'vitest';
import {
  moveDay,
  moveItemToDay,
  resequence,
  shiftDay,
  summarizeProposal,
  swapDays,
  toRpcChanges,
  validateProposal,
  type ReplanItem,
} from '../replanEngine.ts';

function item(partial: Partial<ReplanItem> & Pick<ReplanItem, 'id' | 'title' | 'date' | 'time_start'>): ReplanItem {
  return {
    time_end: null,
    base_order: null,
    park: null,
    is_filler: false,
    locked: false,
    ...partial,
  };
}

describe('shiftDay', () => {
  it('empurra todos os itens preservando a duração', () => {
    const items = [
      item({ id: 'a', title: 'Café', date: '2026-09-14', time_start: '08:00', time_end: '08:30' }),
      item({ id: 'b', title: 'Parque', date: '2026-09-14', time_start: '09:00', time_end: '12:00' }),
    ];
    const proposal = shiftDay(items, { minutes: 30 });
    expect(proposal.changes).toEqual([
      { item_id: 'a', title: 'Café', from: { date: '2026-09-14', time_start: '08:00', time_end: '08:30', base_order: null }, to: { date: '2026-09-14', time_start: '08:30', time_end: '09:00', base_order: null } },
      { item_id: 'b', title: 'Parque', from: { date: '2026-09-14', time_start: '09:00', time_end: '12:00', base_order: null }, to: { date: '2026-09-14', time_start: '09:30', time_end: '12:30', base_order: null } },
    ]);
    expect(proposal.warnings).toEqual([]);
  });

  it('respeita fromTime — só move quem começa depois', () => {
    const items = [
      item({ id: 'a', title: 'Café', date: '2026-09-14', time_start: '08:00', time_end: '08:30' }),
      item({ id: 'b', title: 'Almoço', date: '2026-09-14', time_start: '12:00', time_end: '13:00' }),
    ];
    const proposal = shiftDay(items, { minutes: 60, fromTime: '10:00' });
    expect(proposal.changes.map(c => c.item_id)).toEqual(['b']);
  });

  it('recusa cruzar a meia-noite — vira warning, não change', () => {
    const items = [item({ id: 'a', title: 'Show noturno', date: '2026-09-14', time_start: '23:30', time_end: '23:59' })];
    const proposal = shiftDay(items, { minutes: 60 });
    expect(proposal.changes).toEqual([]);
    expect(proposal.warnings).toEqual([{ kind: 'crosses_midnight', item_id: 'a', message: expect.stringContaining('Show noturno') }]);
  });

  it('item locked fica parado e gera warning', () => {
    const items = [item({ id: 'a', title: 'Jantar reservado', date: '2026-09-14', time_start: '19:00', time_end: '20:30', locked: true })];
    const proposal = shiftDay(items, { minutes: 30 });
    expect(proposal.changes).toEqual([]);
    expect(proposal.warnings[0].kind).toBe('locked_item');
  });

  it('itens sem time_end não geram time_end no destino (preserva ausência)', () => {
    const items = [item({ id: 'a', title: 'Passeio livre', date: '2026-09-14', time_start: '10:00', time_end: null })];
    const proposal = shiftDay(items, { minutes: 15 });
    expect(proposal.changes[0].to.time_end).toBeNull();
  });
});

describe('swapDays', () => {
  it('troca a data mantendo a hora do dia de cada item', () => {
    const itemsA = [item({ id: 'a', title: 'EPCOT', date: '2026-09-14', time_start: '09:00', time_end: '18:00' })];
    const itemsB = [item({ id: 'b', title: 'Magic Kingdom', date: '2026-09-15', time_start: '08:00', time_end: '20:00' })];
    const proposal = swapDays(itemsA, itemsB, '2026-09-14', '2026-09-15');
    expect(proposal.changes).toEqual([
      { item_id: 'a', title: 'EPCOT', from: { date: '2026-09-14', time_start: '09:00', time_end: '18:00', base_order: null }, to: { date: '2026-09-15', time_start: '09:00', time_end: '18:00', base_order: null } },
      { item_id: 'b', title: 'Magic Kingdom', from: { date: '2026-09-15', time_start: '08:00', time_end: '20:00', base_order: null }, to: { date: '2026-09-14', time_start: '08:00', time_end: '20:00', base_order: null } },
    ]);
  });

  it('avisa quando os dois dias estão vazios', () => {
    const proposal = swapDays([], [], '2026-09-14', '2026-09-15');
    expect(proposal.warnings[0].kind).toBe('empty_day');
  });
});

describe('moveDay', () => {
  it('move o dia inteiro mantendo horário e nunca mescla sozinho', () => {
    const items = [item({ id: 'a', title: 'Hollywood Studios', date: '2026-09-14', time_start: '09:00', time_end: '18:00' })];
    const existing = [item({ id: 'x', title: 'Já marcado', date: '2026-09-16', time_start: '09:30', time_end: '10:00' })];
    const proposal = moveDay(items, '2026-09-16', existing);
    expect(proposal.changes[0].to.date).toBe('2026-09-16');
    expect(proposal.warnings.some(w => w.kind === 'conflict')).toBe(true);
  });
});

describe('resequence', () => {
  it('preserva os slots existentes e a duração de cada item, reescreve base_order', () => {
    const items = [
      item({ id: 'a', title: 'A', date: '2026-09-14', time_start: '09:00', time_end: '10:00' }),
      item({ id: 'b', title: 'B', date: '2026-09-14', time_start: '10:30', time_end: '11:00' }),
    ];
    const proposal = resequence(items, ['b', 'a']);
    // 'b' assume o slot das 09:00 mantendo sua duração de 30min
    expect(proposal.changes.find(c => c.item_id === 'b')?.to).toEqual({ date: '2026-09-14', time_start: '09:00', time_end: '09:30', base_order: 0 });
    // 'a' assume o slot das 10:30 mantendo sua duração de 60min
    expect(proposal.changes.find(c => c.item_id === 'a')?.to).toEqual({ date: '2026-09-14', time_start: '10:30', time_end: '11:30', base_order: 10 });
  });

  it('item locked mantém o horário original', () => {
    const items = [
      item({ id: 'a', title: 'Reserva', date: '2026-09-14', time_start: '09:00', time_end: '10:00', locked: true }),
      item({ id: 'b', title: 'B', date: '2026-09-14', time_start: '10:30', time_end: '11:00' }),
    ];
    const proposal = resequence(items, ['b', 'a']);
    expect(proposal.changes.some(c => c.item_id === 'a')).toBe(false);
    expect(proposal.warnings.some(w => w.item_id === 'a' && w.kind === 'locked_item')).toBe(true);
  });
});

describe('moveItemToDay', () => {
  it('encaixa entre dois vizinhos quando há brecha', () => {
    const moved = item({ id: 'm', title: 'Novo item', date: '2026-09-14', time_start: '09:00', time_end: '09:30' });
    const target = [
      item({ id: 'x', title: 'Antes', date: '2026-09-16', time_start: '10:00', time_end: '10:30' }),
      item({ id: 'y', title: 'Depois', date: '2026-09-16', time_start: '12:00', time_end: '12:30' }),
    ];
    const proposal = moveItemToDay(moved, target, '2026-09-16', 1);
    expect(proposal.changes[0].to.date).toBe('2026-09-16');
    expect(proposal.changes[0].to.time_start).toBe('10:30');
    expect(proposal.warnings).toEqual([]);
  });

  it('avisa quando não há brecha suficiente', () => {
    const moved = item({ id: 'm', title: 'Novo item', date: '2026-09-14', time_start: '09:00', time_end: '10:00' });
    const target = [
      item({ id: 'x', title: 'Antes', date: '2026-09-16', time_start: '10:00', time_end: '10:30' }),
      item({ id: 'y', title: 'Depois', date: '2026-09-16', time_start: '10:35', time_end: '11:00' }),
    ];
    const proposal = moveItemToDay(moved, target, '2026-09-16', 1);
    expect(proposal.warnings.some(w => w.kind === 'conflict')).toBe(true);
  });
});

describe('validateProposal', () => {
  it('anexa outside_trip quando o destino sai do período da viagem', () => {
    const proposal = shiftDay([item({ id: 'a', title: 'A', date: '2026-09-20', time_start: '09:00', time_end: '10:00' })], { minutes: 30 });
    const validated = validateProposal(proposal, { tripStart: '2026-09-01', tripEnd: '2026-09-10' });
    expect(validated.warnings.some(w => w.kind === 'outside_trip')).toBe(true);
  });

  it('anexa conflict contra itens existentes no dia de destino', () => {
    const proposal = moveDay([item({ id: 'a', title: 'A', date: '2026-09-14', time_start: '09:00', time_end: '10:00' })], '2026-09-15');
    const validated = validateProposal(proposal, {
      tripStart: '2026-09-01',
      tripEnd: '2026-09-30',
      dayItemsByDate: { '2026-09-15': [item({ id: 'b', title: 'B', date: '2026-09-15', time_start: '09:30', time_end: '10:30' })] },
    });
    expect(validated.warnings.some(w => w.kind === 'conflict')).toBe(true);
  });

  it('anexa park_closed quando a janela do parque diz fechado', () => {
    const proposal = moveDay([item({ id: 'a', title: 'A', date: '2026-09-14', time_start: '09:00', time_end: '10:00', park: 'EPCOT' })], '2026-09-15');
    const validated = validateProposal(proposal, {
      tripStart: '2026-09-01',
      tripEnd: '2026-09-30',
      parkWindows: [{ park: 'EPCOT', date: '2026-09-15', opening: null, closing: null, closed: true }],
    });
    expect(validated.warnings.some(w => w.kind === 'park_closed')).toBe(true);
  });
});

describe('toRpcChanges / summarizeProposal', () => {
  it('serializa só os campos que a RPC precisa', () => {
    const proposal = shiftDay([item({ id: 'a', title: 'A', date: '2026-09-14', time_start: '09:00', time_end: '10:00' })], { minutes: 15 });
    expect(toRpcChanges(proposal)).toEqual([{ item_id: 'a', date: '2026-09-14', time_start: '09:15', time_end: '10:15', base_order: null }]);
  });

  it('resumo cita o número de mudanças e cada warning bloqueante', () => {
    const proposal = shiftDay(
      [
        item({ id: 'a', title: 'A', date: '2026-09-14', time_start: '09:00', time_end: '10:00' }),
        item({ id: 'b', title: 'Jantar reservado', date: '2026-09-14', time_start: '19:00', time_end: '20:00', locked: true }),
      ],
      { minutes: 30 },
    );
    const summary = summarizeProposal(proposal);
    expect(summary).toContain('1 atividade muda');
    expect(summary).toContain('Jantar reservado');
  });
});
