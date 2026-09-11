import { describe, expect, it } from 'vitest';
import { ANIMAL_KINGDOM_DIA_11_ITEMS } from './animalKingdomDia11';

const porOrdem = [...ANIMAL_KINGDOM_DIA_11_ITEMS].sort((a, b) => (a.base_order ?? 0) - (b.base_order ?? 0));
const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** As duas atrações em que a Gabi (112cm) passa por 2mm na barra de 44in/111,8cm. */
const ALTURA_MINIMA = new Map([
  ['Avatar Flight of Passage', 112],
  ['Expedition Everest – Legend of the Forbidden Mountain', 112],
]);

/**
 * Atrações que fecharam antes de 11/09/2026: DinoLand U.S.A. (02/02/2026),
 * It's Tough to Be a Bug! (03/2025) e Affection Section / The Animation
 * Experience (02/2026, viraram Bluey's Wild World). Nenhuma pode aparecer.
 */
const ATRACOES_ENCERRADAS = [
  'DINOSAUR',
  'The Boneyard',
  'TriceraTop Spin',
  "It's Tough to Be a Bug",
  'Affection Section',
  'Animation Experience',
];

describe('Animal Kingdom 11/09/2026 — dia operacional', () => {
  it('roda inteiro em 2026-09-11', () => {
    expect(ANIMAL_KINGDOM_DIA_11_ITEMS.every(i => i.date === '2026-09-11')).toBe(true);
  });

  it('não usa Lightning Lane em nenhum item — é a premissa do dia', () => {
    expect(ANIMAL_KINGDOM_DIA_11_ITEMS.every(i => i.lightning_lane === 'none')).toBe(true);
    expect(ANIMAL_KINGDOM_DIA_11_ITEMS.every(i => i.lightning_lane_priority_rank === undefined)).toBe(true);
  });

  it('não referencia nenhuma atração encerrada', () => {
    ANIMAL_KINGDOM_DIA_11_ITEMS.forEach(item => {
      ATRACOES_ENCERRADAS.forEach(encerrada => {
        expect(item.title, `"${item.title}" referencia atração encerrada`).not.toContain(encerrada);
      });
    });
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
    // `undefined` cairia na cascata padrão do bot (60min): 29 blocos = 29
    // mensagens por participante. Todo item precisa de um valor explícito.
    expect(ANIMAL_KINGDOM_DIA_11_ITEMS.every(i => typeof i.reminder_minutes_before === 'number')).toBe(true);

    const avisam = porOrdem.filter(i => i.reminder_minutes_before !== 0).map(i => i.title);
    expect(avisam).toEqual([
      'Acordar e preparação',
      'Saída do hotel rumo ao Animal Kingdom',
      'Posicionamento na entrada regular (rope drop)',
      'Festival of the Lion King',
      'Wildlife Express Train (ida)',
      'Almoço — Yak & Yeti Restaurant',
      'Feathered Friends in Flight!',
      'Finding Nemo: The Big Blue… and Beyond!',
      'Island Mercantile',
    ]);
  });

  it('o primeiro aviso do dia dispara às 6h — não na janela de silêncio padrão de 7h', () => {
    // A família pediu avisos a partir das 6h. Isso exige baixar
    // `whatsapp_configs.quiet_hours_end` de 07:00 para 06:00 antes de aplicar
    // o seed (ver o plano de implementação); por isso o piso aqui é 6h, não
    // os 7h que epcotDia09.test.ts usa.
    porOrdem
      .filter(i => i.reminder_minutes_before !== 0)
      .forEach(item => {
        const disparo = minutos(item.time_start) - item.reminder_minutes_before!;
        expect(disparo, `aviso de ${item.title} cai antes das 6h`).toBeGreaterThanOrEqual(6 * 60);
        expect(disparo, `aviso de ${item.title} cai depois das 22h`).toBeLessThan(22 * 60);
      });

    const primeiro = porOrdem.find(i => i.reminder_minutes_before !== 0)!;
    expect(minutos(primeiro.time_start) - primeiro.reminder_minutes_before!).toBe(6 * 60);
  });

  it('marca altura mínima e Rider Switch nas atrações em que a Gabi está no limite', () => {
    ALTURA_MINIMA.forEach((altura, titulo) => {
      const item = ANIMAL_KINGDOM_DIA_11_ITEMS.find(i => i.title === titulo);
      expect(item?.min_height_cm, `${titulo} sem altura mínima`).toBe(altura);
      expect(item?.child_switch, `${titulo} sem Rider Switch`).toBe(true);
    });
  });

  it('Kali River Rapids pede 97cm — a Gabi já alcança, sem Rider Switch', () => {
    const kali = ANIMAL_KINGDOM_DIA_11_ITEMS.find(i => i.title === 'Kali River Rapids');
    expect(kali?.min_height_cm).toBe(97);
    expect(kali?.child_switch).toBe(false);
  });

  it('tira os blocos de logística da métrica de cobertura', () => {
    const logistica = ANIMAL_KINGDOM_DIA_11_ITEMS.filter(i => i.category === 'transit' || i.category === 'rest');
    expect(logistica.length).toBeGreaterThan(0);
    expect(logistica.every(i => i.counts_toward_completion === false)).toBe(true);
    expect(logistica.every(i => i.item_type === undefined)).toBe(true);
  });

  it('mantém as atrações inegociáveis do dia no roteiro', () => {
    const titulos = ANIMAL_KINGDOM_DIA_11_ITEMS.map(i => i.title);
    [
      'Avatar Flight of Passage',
      "Na'vi River Journey",
      'Kilimanjaro Safaris',
      'Festival of the Lion King',
      'Expedition Everest – Legend of the Forbidden Mountain',
      "Finding Nemo: The Big Blue… and Beyond!",
    ].forEach(t => expect(titulos).toContain(t));
  });
});
