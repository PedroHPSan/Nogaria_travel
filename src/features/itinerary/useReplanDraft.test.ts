// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReplanDraft } from './useReplanDraft';
import type { ItineraryItem } from '../../types/database.types';

function item(partial: Partial<ItineraryItem> & Pick<ItineraryItem, 'id' | 'title' | 'date' | 'time_start'>): ItineraryItem {
  return {
    trip_id: 'trip1',
    time_end: undefined,
    city: 'Orlando',
    category: 'park',
    participant_ids: [],
    status: 'planned',
    child_friendly: true,
    ...partial,
  };
}

const baseItems: ItineraryItem[] = [
  item({ id: 'a', title: 'Café', date: '2026-09-14', time_start: '08:00', time_end: '08:30', base_order: 0 }),
  item({ id: 'b', title: 'EPCOT', date: '2026-09-14', time_start: '09:00', time_end: '18:00', base_order: 10, park: 'EPCOT' }),
  item({ id: 'c', title: 'Magic Kingdom', date: '2026-09-16', time_start: '08:00', time_end: '20:00', base_order: 0, park: 'Magic Kingdom' }),
];

function setup(onApply = vi.fn().mockResolvedValue({ ok: true, before: [] })) {
  const hook = renderHook(() => useReplanDraft({ items: baseItems, tripStart: '2026-09-01', tripEnd: '2026-09-20', onApply }));
  return { ...hook, onApply };
}

describe('useReplanDraft', () => {
  it('sem mudanças, proposal.changes é vazio', () => {
    const { result } = setup();
    expect(result.current.proposal.changes).toEqual([]);
  });

  it('shiftDay produz mudanças no diff', () => {
    const { result } = setup();
    act(() => result.current.shiftDay('2026-09-14', 30));
    expect(result.current.proposal.changes).toHaveLength(2);
    expect(result.current.draftItems.find(i => i.id === 'a')?.time_start).toBe('08:30');
  });

  it('diff é mínimo: arrastar e voltar produz zero mudanças (não composição)', () => {
    const { result } = setup();
    act(() => result.current.shiftDay('2026-09-14', 30));
    act(() => result.current.shiftDay('2026-09-14', -30));
    expect(result.current.proposal.changes).toEqual([]);
  });

  it('reset() descarta o rascunho e volta ao original', () => {
    const { result } = setup();
    act(() => result.current.shiftDay('2026-09-14', 45));
    expect(result.current.proposal.changes.length).toBeGreaterThan(0);

    act(() => result.current.reset());
    expect(result.current.proposal.changes).toEqual([]);
    expect(result.current.draftItems.find(i => i.id === 'a')?.time_start).toBe('08:00');
  });

  it('swapDays troca a data mantendo o horário', () => {
    const { result } = setup();
    act(() => result.current.swapDays('2026-09-14', '2026-09-16'));
    expect(result.current.draftItems.find(i => i.id === 'a')?.date).toBe('2026-09-16');
    expect(result.current.draftItems.find(i => i.id === 'c')?.date).toBe('2026-09-14');
  });

  it('apply() chama onApply com o diff serializado e reconstrói a proposta inversa a partir do before', async () => {
    const onApply = vi.fn().mockResolvedValue({
      ok: true,
      before: [{ item_id: 'a', date: '2026-09-14', time_start: '08:00:00', time_end: '08:30:00', base_order: 0 }],
    });
    const { result } = setup(onApply);

    act(() => result.current.shiftDay('2026-09-14', 30));
    let outcome: { ok: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.apply();
    });

    expect(outcome?.ok).toBe(true);
    expect(onApply).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ item_id: 'a', time_start: '08:30' })]));
    await waitFor(() => expect(result.current.canUndo).toBe(true));
    // Depois de aplicar, o baseline vira o próprio rascunho — o diff volta a zero.
    expect(result.current.proposal.changes).toEqual([]);
  });

  it('undo() reaplica o estado anterior via onApply e limpa canUndo', async () => {
    const onApply = vi.fn().mockResolvedValue({
      ok: true,
      before: [{ item_id: 'a', date: '2026-09-14', time_start: '08:00:00', time_end: '08:30:00', base_order: 0 }],
    });
    const { result } = setup(onApply);

    act(() => result.current.shiftDay('2026-09-14', 30));
    await act(async () => {
      await result.current.apply();
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.draftItems.find(i => i.id === 'a')?.time_start).toBe('08:00');
  });

  it('validateProposal anexa outside_trip quando o destino sai do período', () => {
    const { result } = setup();
    act(() => result.current.moveDay('2026-09-16', '2026-09-25'));
    expect(result.current.proposal.warnings.some(w => w.kind === 'outside_trip')).toBe(true);
  });
});
