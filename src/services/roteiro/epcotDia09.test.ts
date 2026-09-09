import { describe, expect, it } from 'vitest';
import { EPCOT_DIA_09_ITEMS } from './epcotDia09';

const porOrdem = [...EPCOT_DIA_09_ITEMS].sort((a, b) => (a.base_order ?? 0) - (b.base_order ?? 0));
const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** As quatro atrações que a Gabi (100cm) não alcança. */
const ALTURA_MINIMA = new Map([
  ['Test Track', 102],
  ['Guardians of the Galaxy: Cosmic Rewind', 107],
  ['Mission: SPACE – Green Mission', 102],
  ["Soarin' Around the World", 102],
]);

describe('EPCOT 09/09/2026 — dia operacional', () => {
  it('roda inteiro em 2026-09-09', () => {
    expect(EPCOT_DIA_09_ITEMS.every(i => i.date === '2026-09-09')).toBe(true);
  });

  it('não usa Lightning Lane em nenhum item — é a premissa do dia', () => {
    expect(EPCOT_DIA_09_ITEMS.every(i => i.lightning_lane === 'none')).toBe(true);
    expect(EPCOT_DIA_09_ITEMS.every(i => i.lightning_lane_priority_rank === undefined)).toBe(true);
  });

  it('ancora o Akershus às 15h15 com horário travado', () => {
    const akershus = EPCOT_DIA_09_ITEMS.find(i => i.title.startsWith('Akershus'));
    expect(akershus?.time_start).toBe('15:15');
    expect(akershus?.time_is_estimated).toBe(false);
    expect(akershus?.status).toBe('confirmed');
    expect(akershus?.recommended_arrival_min_before).toBe(15);
  });

  it('encadeia os blocos sem sobreposição', () => {
    porOrdem.forEach((item, i) => {
      expect(item.time_end, `${item.title} sem horário de fim`).toBeDefined();
      expect(minutos(item.time_end!)).toBeGreaterThan(minutos(item.time_start));
      const anterior = porOrdem[i - 1];
      if (anterior) {
        expect(
          minutos(item.time_start),
          `${item.title} começa antes de ${anterior.title} terminar`,
        ).toBeGreaterThanOrEqual(minutos(anterior.time_end!));
      }
    });
  });

  it('só avisa nos momentos de decisão — os demais blocos têm o aviso desligado', () => {
    // `undefined` cairia na cascata padrão do bot: 32 blocos = 32 mensagens por
    // participante. Todo item precisa de um valor explícito.
    expect(EPCOT_DIA_09_ITEMS.every(i => typeof i.reminder_minutes_before === 'number')).toBe(true);

    const avisam = porOrdem.filter(i => i.reminder_minutes_before !== 0).map(i => i.title);
    expect(avisam).toEqual([
      'Acordar e preparação',
      'Saída do hotel rumo ao EPCOT',
      'Test Track',
      'Travessia para o World Showcase (sentido México)',
      'Akershus Royal Banquet Hall',
      'Frozen Ever After',
      "Remy's Ratatouille Adventure",
      'Operação Resgate — escolher UMA pendência',
      'Luminous: The Symphony of Us',
    ]);
  });

  it('nenhum aviso cai dentro da janela de silêncio padrão (22h–7h)', () => {
    porOrdem
      .filter(i => i.reminder_minutes_before !== 0)
      .forEach(item => {
        const disparo = minutos(item.time_start) - item.reminder_minutes_before!;
        expect(disparo, `aviso de ${item.title} cai antes das 7h`).toBeGreaterThanOrEqual(7 * 60);
        expect(disparo, `aviso de ${item.title} cai depois das 22h`).toBeLessThan(22 * 60);
      });
  });

  it('marca altura mínima e Rider Switch nas atrações que a Gabi não alcança', () => {
    ALTURA_MINIMA.forEach((altura, titulo) => {
      const item = EPCOT_DIA_09_ITEMS.find(i => i.title === titulo);
      expect(item?.min_height_cm, `${titulo} sem altura mínima`).toBe(altura);
      expect(item?.child_switch, `${titulo} sem Rider Switch`).toBe(true);
    });
  });

  it('tira os blocos de logística da métrica de cobertura', () => {
    const logistica = EPCOT_DIA_09_ITEMS.filter(i => i.category === 'transit' || i.category === 'rest');
    expect(logistica.length).toBeGreaterThan(0);
    expect(logistica.every(i => i.counts_toward_completion === false)).toBe(true);
    expect(logistica.every(i => i.item_type === undefined)).toBe(true);
  });

  it('mantém as atrações inegociáveis do dia no roteiro', () => {
    const titulos = EPCOT_DIA_09_ITEMS.map(i => i.title);
    [
      'Test Track',
      'Guardians of the Galaxy: Cosmic Rewind',
      "Soarin' Around the World",
      'Frozen Ever After',
      "Remy's Ratatouille Adventure",
      'Akershus Royal Banquet Hall',
    ].forEach(t => expect(titulos).toContain(t));
  });
});
