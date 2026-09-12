import { describe, expect, it } from 'vitest';
import { HOLLYWOOD_STUDIOS_DIA_12_ITEMS } from './hollywoodStudiosDia12';

const porOrdem = [...HOLLYWOOD_STUDIOS_DIA_12_ITEMS].sort((a, b) => (a.base_order ?? 0) - (b.base_order ?? 0));
const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Alturas mínimas travadas — fonte: wdwinfo.com/guia de alturas 2026. */
const ALTURA_MINIMA = new Map([
  ['Star Wars: Rise of the Resistance', 102],
  ['Millennium Falcon: Smugglers Run', 97],
  ['Slinky Dog Dash', 97],
  ['Alien Swirling Saucers', 81],
  ['Star Tours – The Adventures Continue', 102],
  ['The Twilight Zone Tower of Terror', 102],
  ["Rock 'n' Roller Coaster Starring The Muppets", 122],
]);

/**
 * Atrações/espaços que fecharam antes de 12/09/2026: Muppet*Vision 3D,
 * PizzeRizzo e Mama Melrose's (2025, para dar lugar a Monstropolis, que só
 * abre em 2027); Star Wars Launch Bay e Lightning McQueen's Racing Academy
 * (deram lugar ao Roy E. Disney Animation Building). Magic of Disney
 * Animation só reabre em 14/09/2026 — dois dias depois deste roteiro.
 */
const ATRACOES_ENCERRADAS_OU_AINDA_NAO_ABERTAS = [
  'Muppet*Vision',
  'PizzeRizzo',
  'Mama Melrose',
  'Star Wars Launch Bay',
  "Lightning McQueen's Racing Academy",
  'Magic of Disney Animation',
];

describe('Hollywood Studios 12/09/2026 — dia operacional', () => {
  it('roda inteiro em 2026-09-12', () => {
    expect(HOLLYWOOD_STUDIOS_DIA_12_ITEMS.every(i => i.date === '2026-09-12')).toBe(true);
  });

  it('não usa Lightning Lane em nenhum item — é a premissa do dia', () => {
    expect(HOLLYWOOD_STUDIOS_DIA_12_ITEMS.every(i => i.lightning_lane === 'none')).toBe(true);
    expect(HOLLYWOOD_STUDIOS_DIA_12_ITEMS.every(i => i.lightning_lane_priority_rank === undefined)).toBe(true);
  });

  it('não referencia nenhuma atração encerrada ou ainda não aberta', () => {
    HOLLYWOOD_STUDIOS_DIA_12_ITEMS.forEach(item => {
      ATRACOES_ENCERRADAS_OU_AINDA_NAO_ABERTAS.forEach(encerrada => {
        expect(item.title, `"${item.title}" referencia atração encerrada/ainda não aberta`).not.toContain(encerrada);
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
    // `undefined` cairia na cascata padrão do bot (60min): 30 blocos = 30
    // mensagens por participante. Todo item precisa de um valor explícito.
    expect(HOLLYWOOD_STUDIOS_DIA_12_ITEMS.every(i => typeof i.reminder_minutes_before === 'number')).toBe(true);

    const avisam = porOrdem.filter(i => i.reminder_minutes_before !== 0).map(i => i.title);
    expect(avisam).toEqual([
      'Acordar e preparação',
      'Saída do hotel rumo ao Hollywood Studios',
      'Star Wars: Rise of the Resistance',
      "Travessia Galaxy's Edge → Toy Story Land",
      "Almoço — Woody's Lunch Box",
      'Indiana Jones Epic Stunt Spectacular!',
      'Jantar — Backlot Express',
      "Rock 'n' Roller Coaster Starring The Muppets",
      'Posicionamento no Hollywood Hills Amphitheater',
    ]);
  });

  it('a janela de silêncio (6h–22h, já baixada para o dia do AK) contém todos os disparos', () => {
    // `whatsapp_configs.quiet_hours_end` já está em 06:00 desde o dia do
    // Animal Kingdom (animalKingdomDia11.ts) — não precisa baixar de novo.
    porOrdem
      .filter(i => i.reminder_minutes_before !== 0)
      .forEach(item => {
        const disparo = minutos(item.time_start) - item.reminder_minutes_before!;
        expect(disparo, `aviso de ${item.title} cai antes das 6h`).toBeGreaterThanOrEqual(6 * 60);
        expect(disparo, `aviso de ${item.title} cai depois das 22h`).toBeLessThan(22 * 60);
      });
  });

  it('marca altura mínima nas atrações do dia, e Rider Switch onde a Gabi (112cm) fica no limite', () => {
    ALTURA_MINIMA.forEach((altura, titulo) => {
      const item = HOLLYWOOD_STUDIOS_DIA_12_ITEMS.find(i => i.title === titulo);
      expect(item?.min_height_cm, `${titulo} sem altura mínima`).toBe(altura);
    });

    const muppets = HOLLYWOOD_STUDIOS_DIA_12_ITEMS.find(i => i.title === "Rock 'n' Roller Coaster Starring The Muppets");
    expect(muppets?.child_switch, "Rock 'n' Roller Coaster sem Rider Switch — a Gabi (112cm) não alcança 122cm").toBe(true);
  });

  it('Alien Swirling Saucers pede 81cm — a Gabi já alcança, sem Rider Switch', () => {
    const alien = HOLLYWOOD_STUDIOS_DIA_12_ITEMS.find(i => i.title === 'Alien Swirling Saucers');
    expect(alien?.min_height_cm).toBe(81);
    expect(alien?.child_switch).toBe(false);
  });

  it('tira os blocos de logística da métrica de cobertura', () => {
    const logistica = HOLLYWOOD_STUDIOS_DIA_12_ITEMS.filter(i => i.category === 'transit' || i.category === 'rest');
    expect(logistica.length).toBeGreaterThan(0);
    expect(logistica.every(i => i.counts_toward_completion === false)).toBe(true);
    expect(logistica.every(i => i.item_type === undefined)).toBe(true);
  });

  it('mantém as atrações inegociáveis do dia no roteiro', () => {
    const titulos = HOLLYWOOD_STUDIOS_DIA_12_ITEMS.map(i => i.title);
    [
      'Star Wars: Rise of the Resistance',
      'Millennium Falcon: Smugglers Run',
      'Slinky Dog Dash',
      "Mickey & Minnie's Runaway Railway",
      'The Twilight Zone Tower of Terror',
      "Rock 'n' Roller Coaster Starring The Muppets",
      'Fantasmic!',
    ].forEach(t => expect(titulos).toContain(t));
  });
});
