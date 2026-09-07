import { describe, expect, it } from 'vitest';
import { detectConflicts, suggestFreeSlot, type ScheduleSlot } from '../scheduleConflicts.ts';

describe('detectConflicts', () => {
  it('detecta sobreposição parcial', () => {
    const moved: ScheduleSlot = { id: 'moved', title: 'Almoço', timeStart: '12:30', timeEnd: '13:30' };
    const dayItems: ScheduleSlot[] = [{ id: 'a', title: 'Jantar cedo', timeStart: '13:00', timeEnd: '14:00' }];
    expect(detectConflicts(moved, dayItems).map(c => c.id)).toEqual(['a']);
  });

  it('não conflita quando os horários só se tocam na borda', () => {
    const moved: ScheduleSlot = { id: 'moved', title: 'A', timeStart: '12:00', timeEnd: '13:00' };
    const dayItems: ScheduleSlot[] = [{ id: 'b', title: 'B', timeStart: '13:00', timeEnd: '14:00' }];
    expect(detectConflicts(moved, dayItems)).toEqual([]);
  });

  it('item sem time_end usa 60min de duração default só pra checagem', () => {
    const moved: ScheduleSlot = { id: 'moved', title: 'A', timeStart: '12:00', timeEnd: null };
    const dayItems: ScheduleSlot[] = [{ id: 'b', title: 'B', timeStart: '12:30', timeEnd: '13:00' }];
    expect(detectConflicts(moved, dayItems).map(c => c.id)).toEqual(['b']);
  });

  it('exclui o próprio item movido da lista de conflitos', () => {
    const moved: ScheduleSlot = { id: 'x', title: 'A', timeStart: '12:00', timeEnd: '13:00' };
    const dayItems: ScheduleSlot[] = [{ id: 'x', title: 'A', timeStart: '12:00', timeEnd: '13:00' }];
    expect(detectConflicts(moved, dayItems)).toEqual([]);
  });

  it('não conflita quando os itens estão em horários distantes', () => {
    const moved: ScheduleSlot = { id: 'moved', title: 'A', timeStart: '09:00', timeEnd: '10:00' };
    const dayItems: ScheduleSlot[] = [{ id: 'b', title: 'B', timeStart: '15:00', timeEnd: '16:00' }];
    expect(detectConflicts(moved, dayItems)).toEqual([]);
  });
});

describe('suggestFreeSlot', () => {
  it('acha um horário livre depois do conflito, perto do horário pedido', () => {
    const moved: ScheduleSlot = { id: 'moved', title: 'Almoço', timeStart: '12:00', timeEnd: '13:00' };
    const dayItems: ScheduleSlot[] = [{ id: 'a', title: 'Reunião', timeStart: '12:00', timeEnd: '13:00' }];
    expect(suggestFreeSlot(moved, dayItems)).toBe('13:00');
  });

  it('sem conflito nenhum, sugere o próprio horário pedido', () => {
    const moved: ScheduleSlot = { id: 'moved', title: 'Almoço', timeStart: '12:00', timeEnd: '13:00' };
    expect(suggestFreeSlot(moved, [])).toBe('12:00');
  });

  it('retorna null quando o dia inteiro está ocupado na duração pedida', () => {
    const moved: ScheduleSlot = { id: 'moved', title: 'Bloco', timeStart: '00:00', timeEnd: '23:59' };
    const dayItems: ScheduleSlot[] = [{ id: 'a', title: 'Tudo', timeStart: '00:00', timeEnd: '23:59' }];
    expect(suggestFreeSlot(moved, dayItems)).toBeNull();
  });
});
