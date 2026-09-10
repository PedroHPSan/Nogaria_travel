import { describe, expect, it } from 'vitest';
import { selectOverdueItemsForCheckin, type CheckinCandidate } from '../checkinScheduler.ts';
import { formatItineraryCheckin } from '../formatter.ts';

function item(overrides: Partial<CheckinCandidate> = {}): CheckinCandidate {
  return {
    id: 'i1',
    date: '2026-09-10',
    time_start: '14:00',
    time_end: '14:30',
    title: 'Space Mountain',
    ...overrides,
  };
}

describe('selectOverdueItemsForCheckin', () => {
  const base = { nowLocalDateIso: '2026-09-10', graceMinutes: 20, minutesSinceLastCheckin: null as number | null, cooldownMinutes: 0 };

  it('ignora item ainda dentro da graça após o fim', () => {
    const due = selectOverdueItemsForCheckin({
      ...base,
      items: [item({ time_end: '14:30' })],
      nowLocalMinutes: 14 * 60 + 45, // 15 min depois do fim, graça é 20
    });
    expect(due).toEqual([]);
  });

  it('inclui item que já passou da graça', () => {
    const due = selectOverdueItemsForCheckin({
      ...base,
      items: [item({ time_end: '14:30' })],
      nowLocalMinutes: 14 * 60 + 55, // 25 min depois do fim
    });
    expect(due.map(i => i.id)).toEqual(['i1']);
  });

  it('sem time_end, usa início + 30min como fim estimado', () => {
    const due = selectOverdueItemsForCheckin({
      ...base,
      items: [item({ time_start: '14:00', time_end: null })],
      nowLocalMinutes: 14 * 60 + 51, // 51 min depois do início = 21 min depois do fim estimado (14:30)
    });
    expect(due).toHaveLength(1);
  });

  it('ignora item que ainda não começou', () => {
    const due = selectOverdueItemsForCheckin({
      ...base,
      items: [item({ time_start: '15:00', time_end: '15:30' })],
      nowLocalMinutes: 14 * 60,
    });
    expect(due).toEqual([]);
  });

  it('considera item de ontem que ainda não foi resolvido', () => {
    const due = selectOverdueItemsForCheckin({
      ...base,
      items: [item({ date: '2026-09-09', time_start: '23:00', time_end: '23:30' })],
      nowLocalMinutes: 6 * 60, // 06:00 de hoje
    });
    expect(due).toHaveLength(1);
  });

  it('ignora datas fora de ontem/hoje', () => {
    const due = selectOverdueItemsForCheckin({
      ...base,
      items: [item({ date: '2026-09-01', time_end: '14:30' })],
      nowLocalMinutes: 14 * 60 + 55,
    });
    expect(due).toEqual([]);
  });

  it('ordena do mais antigo pro mais recente', () => {
    const items = [
      item({ id: 'recente', time_start: '13:50', time_end: '14:00' }),
      item({ id: 'antigo', time_start: '10:00', time_end: '10:30' }),
    ];
    const due = selectOverdueItemsForCheckin({ ...base, items, nowLocalMinutes: 14 * 60 + 30 });
    expect(due.map(i => i.id)).toEqual(['antigo', 'recente']);
  });

  it('limita a 8 itens numa única mensagem', () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      item({ id: `i${i}`, time_start: `0${Math.floor(i / 2)}:${i % 2 === 0 ? '00' : '30'}`, time_end: null }),
    );
    const due = selectOverdueItemsForCheckin({ ...base, items, nowLocalMinutes: 20 * 60 });
    expect(due.length).toBeLessThanOrEqual(8);
  });

  it('cooldown ativo suprime tudo, mesmo com itens vencidos', () => {
    const due = selectOverdueItemsForCheckin({
      ...base,
      items: [item({ time_end: '14:30' })],
      nowLocalMinutes: 15 * 60,
      cooldownMinutes: 90,
      minutesSinceLastCheckin: 30,
    });
    expect(due).toEqual([]);
  });

  it('libera assim que o cooldown estoura', () => {
    const due = selectOverdueItemsForCheckin({
      ...base,
      items: [item({ time_end: '14:30' })],
      nowLocalMinutes: 15 * 60,
      cooldownMinutes: 90,
      minutesSinceLastCheckin: 91,
    });
    expect(due).toHaveLength(1);
  });

  it('nunca suprime quando nunca houve check-in anterior', () => {
    const due = selectOverdueItemsForCheckin({
      ...base,
      items: [item({ time_end: '14:30' })],
      nowLocalMinutes: 15 * 60,
      cooldownMinutes: 90,
      minutesSinceLastCheckin: null,
    });
    expect(due).toHaveLength(1);
  });
});

describe('formatItineraryCheckin', () => {
  it('lista os itens em lote e pergunta o que aconteceu', () => {
    const text = formatItineraryCheckin([
      { time_start: '14:00:00', title: 'Space Mountain' },
      { time_start: '15:30:00', title: 'Almoço' },
    ]);
    expect(text).toContain('*14:00* • Space Mountain');
    expect(text).toContain('*15:30* • Almoço');
    expect(text).toContain('Rolou tudo?');
  });
});
