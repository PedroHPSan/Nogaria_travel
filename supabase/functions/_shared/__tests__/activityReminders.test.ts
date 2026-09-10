import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  isWithinQuietHours,
  localMinutesOfDay,
  parseHhMm,
  resolveLeadMinutes,
  selectDueReminders,
  type ReminderCandidate,
} from '../reminderScheduler.ts';
import { formatActivityReminder, formatLeadTime } from '../formatter.ts';

function item(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    id: 'i1',
    date: '2026-09-10',
    time_start: '14:00',
    title: 'Space Mountain',
    category: 'park',
    park: 'Magic Kingdom',
    city: 'Orlando',
    notes: null,
    min_height_cm: null,
    reminder_minutes_before: null,
    recommended_arrival_min_before: null,
    ...overrides,
  };
}

describe('parseHhMm', () => {
  it('aceita HH:MM e HH:MM:SS', () => {
    expect(parseHhMm('09:30')).toBe(570);
    expect(parseHhMm('09:30:00')).toBe(570);
    expect(parseHhMm('00:00')).toBe(0);
    expect(parseHhMm('23:59')).toBe(1439);
  });

  it('rejeita entradas inválidas', () => {
    expect(parseHhMm(null)).toBeNull();
    expect(parseHhMm('')).toBeNull();
    expect(parseHhMm('25:00')).toBeNull();
    expect(parseHhMm('09:70')).toBeNull();
    expect(parseHhMm('manhã')).toBeNull();
  });
});

describe('localMinutesOfDay', () => {
  it('converte para o relógio local do fuso informado', () => {
    // 17:30 UTC = 14:30 em São Paulo (UTC-3).
    const now = new Date('2026-09-10T17:30:00Z');
    expect(localMinutesOfDay(now, 'America/Sao_Paulo')).toBe(14 * 60 + 30);
    expect(localMinutesOfDay(now, 'UTC')).toBe(17 * 60 + 30);
  });

  it('trata a meia-noite local como minuto 0', () => {
    expect(localMinutesOfDay(new Date('2026-09-10T03:00:00Z'), 'America/Sao_Paulo')).toBe(0);
  });
});

describe('resolveLeadMinutes', () => {
  it('usa o padrão do tenant quando o item não pede nada especial', () => {
    expect(resolveLeadMinutes(item(), 60)).toBe(60);
  });

  it('respeita o override explícito do item, inclusive zero', () => {
    expect(resolveLeadMinutes(item({ reminder_minutes_before: 20 }), 60)).toBe(20);
    expect(resolveLeadMinutes(item({ reminder_minutes_before: 0 }), 60)).toBe(0);
  });

  it('eleva a antecedência quando o item pede chegada antecipada', () => {
    // Show que pede 90 min de chegada não pode ser avisado com 60.
    expect(resolveLeadMinutes(item({ recommended_arrival_min_before: 90 }), 60)).toBe(105);
    // Chegada curta não reduz o padrão do tenant.
    expect(resolveLeadMinutes(item({ recommended_arrival_min_before: 20 }), 60)).toBe(60);
  });
});

describe('isWithinQuietHours', () => {
  it('trata janelas que cruzam a meia-noite', () => {
    const start = '22:00';
    const end = '07:00';
    expect(isWithinQuietHours(23 * 60, start, end)).toBe(true);
    expect(isWithinQuietHours(3 * 60, start, end)).toBe(true);
    expect(isWithinQuietHours(6 * 60 + 59, start, end)).toBe(true);
    expect(isWithinQuietHours(7 * 60, start, end)).toBe(false);
    expect(isWithinQuietHours(12 * 60, start, end)).toBe(false);
    expect(isWithinQuietHours(21 * 60 + 59, start, end)).toBe(false);
  });

  it('trata janelas dentro do mesmo dia', () => {
    expect(isWithinQuietHours(14 * 60, '13:00', '15:00')).toBe(true);
    expect(isWithinQuietHours(16 * 60, '13:00', '15:00')).toBe(false);
  });

  it('desliga o silêncio quando início e fim coincidem', () => {
    expect(isWithinQuietHours(3 * 60, '00:00', '00:00')).toBe(false);
  });
});

describe('selectDueReminders', () => {
  const base = {
    nowLocalDateIso: '2026-09-10',
    defaultLeadMinutes: 60,
    // Sem cooldown por padrão nestes testes — o cooldown em si tem describe próprio.
    minutesSinceLastReminder: null as number | null,
    cooldownMinutes: 0,
  };

  it('seleciona o item cujo início entrou na janela de antecedência', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ time_start: '14:00' })],
      nowLocalMinutes: 13 * 60 + 30, // faltam 30 min
    });
    expect(due).toHaveLength(1);
    expect(due[0].minutesUntil).toBe(30);
    expect(due[0].leadMinutes).toBe(60);
  });

  it('ignora item ainda fora da janela', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ time_start: '14:00' })],
      nowLocalMinutes: 12 * 60, // faltam 120 min, lead 60
    });
    expect(due).toEqual([]);
  });

  it('ignora atividade que já começou — aviso atrasado não vira aviso errado', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ time_start: '14:00' })],
      nowLocalMinutes: 14 * 60,
    });
    expect(due).toEqual([]);
  });

  it('recupera aviso de execução perdida enquanto a atividade não começou', () => {
    // Janela ideal era 13:00; o cron só rodou 13:50. O aviso ainda sai.
    const due = selectDueReminders({
      ...base,
      items: [item({ time_start: '14:00' })],
      nowLocalMinutes: 13 * 60 + 50,
    });
    expect(due).toHaveLength(1);
    expect(due[0].minutesUntil).toBe(10);
  });

  it('avisa atividade da madrugada seguinte antes da virada do dia', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ date: '2026-09-11', time_start: '00:30' })],
      nowLocalMinutes: 23 * 60 + 45, // 23:45 de hoje, faltam 45 min
    });
    expect(due).toHaveLength(1);
    expect(due[0].minutesUntil).toBe(45);
  });

  it('ignora datas fora de hoje e amanhã', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ date: '2026-09-15' })],
      nowLocalMinutes: 13 * 60 + 30,
    });
    expect(due).toEqual([]);
  });

  it('respeita o override por item', () => {
    const items = [
      item({ id: 'jantar', time_start: '19:00', reminder_minutes_before: 15 }),
      item({ id: 'parque', time_start: '19:00' }),
    ];
    // 18:30: só o parque (lead 60) entrou; o jantar (lead 15) ainda não.
    const due = selectDueReminders({ ...base, items, nowLocalMinutes: 18 * 60 + 30 });
    expect(due.map(d => d.item.id)).toEqual(['parque']);
  });

  it('nunca avisa item com aviso desligado', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ time_start: '14:00', reminder_minutes_before: 0 })],
      nowLocalMinutes: 13 * 60 + 59,
    });
    expect(due).toEqual([]);
  });

  it('entre vários itens na janela, só dispara o mais próximo — evita rajada de avisos', () => {
    const items = [
      item({ id: 'depois', time_start: '14:00' }),
      item({ id: 'agora', time_start: '13:15' }),
    ];
    const due = selectDueReminders({ ...base, items, nowLocalMinutes: 13 * 60 });
    expect(due.map(d => d.item.id)).toEqual(['agora']);
  });

  it('descarta item com horário ilegível em vez de quebrar', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ time_start: 'de manhã' })],
      nowLocalMinutes: 13 * 60,
    });
    expect(due).toEqual([]);
  });
});

describe('selectDueReminders — cooldown entre avisos (roteiro "touring plan" excessivo)', () => {
  const base = { nowLocalDateIso: '2026-09-10', defaultLeadMinutes: 60, cooldownMinutes: 40 };

  it('suprime um aviso normal enquanto o cooldown não estourou', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ time_start: '14:00' })],
      nowLocalMinutes: 13 * 60 + 30, // faltam 30 min, dentro da janela
      minutesSinceLastReminder: 10, // último aviso há 10 min, cooldown é 40
    });
    expect(due).toEqual([]);
  });

  it('libera o aviso assim que o cooldown estoura', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ time_start: '14:00' })],
      nowLocalMinutes: 13 * 60 + 30,
      minutesSinceLastReminder: 41,
    });
    expect(due).toHaveLength(1);
  });

  it('nunca suprime quando nunca houve aviso anterior', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ time_start: '14:00' })],
      nowLocalMinutes: 13 * 60 + 30,
      minutesSinceLastReminder: null,
    });
    expect(due).toHaveLength(1);
  });

  it('override explícito do item fura o cooldown', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ time_start: '14:00', reminder_minutes_before: 30 })],
      nowLocalMinutes: 13 * 60 + 30,
      minutesSinceLastReminder: 5,
    });
    expect(due).toHaveLength(1);
  });

  it('atividade a <=10min do início sempre fura o cooldown — nunca esconde um aviso iminente', () => {
    const due = selectDueReminders({
      ...base,
      items: [item({ time_start: '14:00' })],
      nowLocalMinutes: 13 * 60 + 51, // faltam 9 min
      minutesSinceLastReminder: 2,
    });
    expect(due).toHaveLength(1);
  });

  it('cooldownMinutes <= 0 desliga o cooldown', () => {
    const due = selectDueReminders({
      ...base,
      cooldownMinutes: 0,
      items: [item({ time_start: '14:00' })],
      nowLocalMinutes: 13 * 60 + 30,
      minutesSinceLastReminder: 1,
    });
    expect(due).toHaveLength(1);
  });
});

describe('cadência do cron vs. horários redondos do roteiro — bug real em produção', () => {
  // Bug observado: TODO aviso saía com "Daqui a 57 min!", não importa a
  // atividade. Causa: o cron batia em minutos fixos (3,13,23,...,53) — passo
  // de 10 min, mesmo fator dos horários redondos do roteiro (17:20, 18:00,
  // 19:30, ...) e da antecedência padrão (60min, múltiplo de 10). O primeiro
  // tick depois de (horário - 60min) caía sempre 3min depois do limiar, dando
  // minutesUntil = 57 em todo item, todo dia — não uma coincidência pontual.
  const lead = 60;
  const roundActivities = [17 * 60 + 20, 18 * 60, 19 * 60 + 30, 20 * 60, 20 * 60 + 30]; // 17:20, 18:00, 19:30, 20:00, 20:30

  function minutesUntilAtFirstTick(activityStart: number, tickOffsets: number[]): number {
    const threshold = activityStart - lead;
    // Primeiro tick (em qualquer hora,ripetido a cada hora) >= o minuto do limiar dentro da hora.
    const thresholdMinuteOfHour = ((threshold % 60) + 60) % 60;
    const nextTickOffset = tickOffsets.find(t => t >= thresholdMinuteOfHour) ?? tickOffsets[0] + 60;
    const tickMinute = threshold - thresholdMinuteOfHour + nextTickOffset;
    return activityStart - tickMinute;
  }

  it('cadência antiga (passo de 10min, offset 3) trava sempre no mesmo minutesUntil — o bug', () => {
    const oldTicks = [3, 13, 23, 33, 43, 53];
    const results = roundActivities.map(a => minutesUntilAtFirstTick(a, oldTicks));
    expect(new Set(results).size).toBe(1); // sempre o mesmo valor — reproduz o bug
    expect(results[0]).toBe(57);
  });

  it('cadência nova (passo de 7min) varia o minutesUntil entre atividades — o fix', () => {
    const newTicks = [2, 9, 16, 23, 30, 37, 44, 51, 58];
    const results = roundActivities.map(a => minutesUntilAtFirstTick(a, newTicks));
    expect(new Set(results).size).toBeGreaterThan(1); // deixa de ser um valor fixo
  });
});

describe('addDaysIso', () => {
  it('atravessa a virada de mês', () => {
    expect(addDaysIso('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysIso('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('formatLeadTime', () => {
  it('formata minutos, horas cheias e horas quebradas', () => {
    expect(formatLeadTime(45)).toBe('45 min');
    expect(formatLeadTime(60)).toBe('1h');
    expect(formatLeadTime(90)).toBe('1h30');
    expect(formatLeadTime(125)).toBe('2h05');
  });
});

describe('formatActivityReminder', () => {
  const reminderItem = {
    time_start: '14:00:00',
    title: 'Space Mountain',
    category: 'park',
    park: 'Magic Kingdom',
    city: 'Orlando',
    notes: null,
    min_height_cm: 112,
  };

  it('monta o aviso com antecedência, horário e local', () => {
    const text = formatActivityReminder({ item: reminderItem, minutesUntil: 30, child: null });
    expect(text).toContain('*Daqui a 30 min!*');
    expect(text).toContain('*14:00* • Space Mountain');
    expect(text).toContain('📍 Magic Kingdom');
  });

  it('alerta altura mínima quando a criança não alcança', () => {
    const text = formatActivityReminder({
      item: reminderItem,
      minutesUntil: 60,
      child: { nickname: 'Gabi', height_cm: 100 },
    });
    expect(text).toContain('Altura mínima 112cm');
    expect(text).toContain('Rider Switch');
  });

  it('não alerta quando a criança alcança a altura', () => {
    const text = formatActivityReminder({
      item: reminderItem,
      minutesUntil: 60,
      child: { nickname: 'Débora', height_cm: 150 },
    });
    expect(text).not.toContain('Rider Switch');
  });

  it('arredonda a antecedência pra múltiplo de 5 — o número exato do cron não é o que soa "certo" pra família', () => {
    expect(formatActivityReminder({ item: reminderItem, minutesUntil: 57, child: null })).toContain('*Daqui a 55 min!*');
    expect(formatActivityReminder({ item: reminderItem, minutesUntil: 58, child: null })).toContain('*Daqui a 1h!*');
    expect(formatActivityReminder({ item: reminderItem, minutesUntil: 3, child: null })).toContain('*Daqui a 5 min!*');
  });

  it('cai para a cidade quando não há parque', () => {
    const text = formatActivityReminder({
      item: { ...reminderItem, park: null },
      minutesUntil: 15,
      child: null,
    });
    expect(text).toContain('📍 Orlando');
  });
});
