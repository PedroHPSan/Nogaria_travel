import { describe, expect, it } from 'vitest';
import type { ItineraryItem } from '../../types/database.types';
import { ISLANDS_OF_ADVENTURE_DIA_14_ITEMS } from './islandsOfAdventureDia14';
import { EPIC_UNIVERSE_DIA_15_ITEMS } from './epicUniverseDia15';
import { UNIVERSAL_STUDIOS_DIA_16_ITEMS } from './universalStudiosDia16';

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const porOrdem = (itens: ItineraryItem[]) =>
  [...itens].sort((a, b) => (a.base_order ?? 0) - (b.base_order ?? 0));

/** Altura da Gabi na fase Universal — a mesma de animalKingdomDia11/hollywoodStudiosDia12. */
const GABI_CM = 112;

/**
 * Atrações que barram a Gabi e mesmo assim NÃO são Child Swap, com o motivo.
 * Child Swap prende os dois adultos na atração: um anda, o outro espera na
 * sala de troca e anda em seguida. Só compensa quando a espera do segundo é
 * curta — com Express Unlimited, ~10 min. Onde não é, a família se divide de
 * verdade e o segundo adulto leva a Gabi para outro lugar; isso vive em
 * `notes`, não em `child_switch`, senão o app promete uma troca que não vai
 * acontecer.
 */
const BARRA_A_GABI_SEM_CHILD_SWAP = new Map([
  [
    "Hagrid's Magical Creatures Motorbike Adventure",
    "não aceita Express e é o último bloco do dia: a fila de ~40 min entra no fechamento do parque. Em vez de prender os dois adultos na sala de troca, a família se divide — Débora anda com um adulto e a Gabi fica com o outro nas lojas de Hogsmeade, que atendem depois do fechamento.",
  ],
]);

const DIAS = [
  { nome: 'Islands of Adventure 14/09', data: '2026-09-14', itens: ISLANDS_OF_ADVENTURE_DIA_14_ITEMS },
  { nome: 'Epic Universe 15/09', data: '2026-09-15', itens: EPIC_UNIVERSE_DIA_15_ITEMS },
  { nome: 'Universal Studios 16/09', data: '2026-09-16', itens: UNIVERSAL_STUDIOS_DIA_16_ITEMS },
] as const;

describe.each(DIAS)('$nome — invariantes do dia operacional', ({ data, itens }) => {
  it('roda inteiro na data do dia', () => {
    expect(itens.every(i => i.date === data)).toBe(true);
  });

  it('encadeia os blocos sem sobreposição', () => {
    porOrdem(itens).forEach((item, i, lista) => {
      expect(item.time_end, `${item.title} sem horário de fim`).toBeDefined();
      expect(minutos(item.time_end!)).toBeGreaterThan(minutos(item.time_start));
      const anterior = lista[i - 1];
      if (anterior) {
        expect(
          minutos(item.time_start),
          `${item.title} começa antes de ${anterior.title} terminar`,
        ).toBeGreaterThanOrEqual(minutos(anterior.time_end!));
      }
    });
  });

  it('todo bloco declara o aviso explicitamente', () => {
    // `undefined` cairia na cascata padrão do bot (60min) e um dia de ~25
    // blocos viraria ~25 mensagens por participante.
    expect(itens.every(i => typeof i.reminder_minutes_before === 'number')).toBe(true);
  });

  it('a janela de silêncio (6h–22h) contém todos os disparos', () => {
    porOrdem(itens)
      .filter(i => i.reminder_minutes_before !== 0)
      .forEach(item => {
        const disparo = minutos(item.time_start) - item.reminder_minutes_before!;
        expect(disparo, `aviso de ${item.title} cai antes das 6h`).toBeGreaterThanOrEqual(6 * 60);
        expect(disparo, `aviso de ${item.title} cai depois das 22h`).toBeLessThan(22 * 60);
      });
  });

  it('tira os blocos de logística da métrica de cobertura', () => {
    const logistica = itens.filter(i => i.category === 'transit' || i.category === 'rest');
    expect(logistica.length).toBeGreaterThan(0);
    expect(logistica.every(i => i.counts_toward_completion === false)).toBe(true);
    expect(logistica.every(i => i.item_type === undefined)).toBe(true);
  });

  it('marca Child Swap exatamente nas atrações que barram a Gabi (112cm)', () => {
    itens
      .filter(i => i.item_type === 'attraction' && typeof i.min_height_cm === 'number')
      .forEach(item => {
        const excecao = BARRA_A_GABI_SEM_CHILD_SWAP.get(item.title);
        const barra = item.min_height_cm! > GABI_CM && excecao === undefined;
        expect(
          item.child_switch,
          `${item.title} (${item.min_height_cm}cm) — Child Swap deveria ser ${barra}`,
        ).toBe(barra);
      });
  });

  it('explica no bloco o que a Gabi faz quando a divisão substitui o Child Swap', () => {
    itens
      .filter(i => BARRA_A_GABI_SEM_CHILD_SWAP.has(i.title))
      .forEach(item => {
        expect(item.min_height_cm!, `${item.title} não barra mais a Gabi — tirar da lista de exceções`)
          .toBeGreaterThan(GABI_CM);
        expect(item.notes, `${item.title} sem instrução da divisão da família`).toContain('Gabi');
      });
  });
});

describe('Express Unlimited — onde vale e onde não vale', () => {
  /**
   * O benefício do Loews Royal Pacific cobre Universal Studios Florida e
   * Islands of Adventure, e NÃO cobre o Epic Universe (vendido à parte). É a
   * premissa que põe o Epic no dia do meio, com Early Park Admission e dia
   * inteiro em vez de meia tarde.
   */
  it('nenhum bloco do Epic Universe usa fila paga', () => {
    expect(EPIC_UNIVERSE_DIA_15_ITEMS.every(i => i.lightning_lane === 'none')).toBe(true);
    expect(EPIC_UNIVERSE_DIA_15_ITEMS.every(i => i.lightning_lane_priority_rank === undefined)).toBe(true);
  });

  it('as atrações fortes do IOA e do USF entram como express', () => {
    // Forbidden Journey e VelociCoaster saíram do dia 14 (a família teve que
    // deixar o parque depois do Ripsaw Falls) e viraram o resgate do dia 16 —
    // ver o bloco "Hogsmeade & Jurassic Park de resgate" em
    // universalStudiosDia16.ts. Continuam com Express, só que num dia diferente.
    [
      [ISLANDS_OF_ADVENTURE_DIA_14_ITEMS, 'The Incredible Hulk Coaster'],
      [UNIVERSAL_STUDIOS_DIA_16_ITEMS, 'Jurassic World VelociCoaster'],
      [UNIVERSAL_STUDIOS_DIA_16_ITEMS, 'Harry Potter and the Forbidden Journey'],
      [UNIVERSAL_STUDIOS_DIA_16_ITEMS, 'Revenge of the Mummy'],
      [UNIVERSAL_STUDIOS_DIA_16_ITEMS, 'Harry Potter and the Escape from Gringotts'],
    ].forEach(([itens, titulo]) => {
      const item = (itens as ItineraryItem[]).find(i => i.title === titulo);
      expect(item?.lightning_lane, `${titulo} sem Express`).toBe('express');
    });
  });

  it("Hagrid's não aceita Express, mesmo no resgate do dia 16", () => {
    // No dia 14 original, Hagrid's era o último bloco do dia justamente por
    // não aceitar Express. No resgate do dia 16 ele entra CEDO de propósito
    // (a fila da manhã é mais curta que a de fim de tarde), mas continua sem
    // fila paga — isso não mudou, só o horário em que a família paga o preço.
    const hagrid = UNIVERSAL_STUDIOS_DIA_16_ITEMS.find(i => i.title.startsWith("Hagrid's"));
    expect(hagrid?.lightning_lane).toBe('none');
  });
});

describe('Islands of Adventure 14/09 — replanejado no balcão às 11h55, parque até 20h', () => {
  it('começa às 11h, no hotel antigo, e não antes', () => {
    // Replanejamento do dia: a família passou a manhã no hotel e o dia foi
    // remontado a partir das 11h, o horário de check-out do Celebration Suites.
    const primeiro = porOrdem(ISLANDS_OF_ADVENTURE_DIA_14_ITEMS)[0];
    expect(primeiro.time_start).toBe('11:00');
    expect(primeiro.city).toBe('Kissimmee');
  });

  it('preserva como concluído o que a família já fez, em vez de apagar', () => {
    // O seed apaga e reinsere o dia inteiro; sem marcar `completed` aqui, um
    // replanejamento no meio do dia faria o app esquecer o que já rolou.
    const ordenado = porOrdem(ISLANDS_OF_ADVENTURE_DIA_14_ITEMS);
    const primeiroPendente = ordenado.find(i => i.status !== 'completed');
    expect(primeiroPendente?.title).toBe('Saída do parque por imprevisto e volta ao Royal Pacific');

    // O que está feito tem que ser um PREFIXO do dia: um bloco concluído depois
    // de um pendente significa buraco na linha do tempo, e é assim que o app
    // (e o check-in do bot) passa a cobrar item que já rolou.
    ordenado
      .filter(i => i.status === 'completed')
      .forEach(item => {
        expect(item.base_order!, `${item.title} concluído depois de um bloco pendente`)
          .toBeLessThan(primeiroPendente!.base_order!);
      });
  });

  it('entra no parque às 13h — o balcão e o almoço rodaram em paralelo', () => {
    const primeiroParque = porOrdem(ISLANDS_OF_ADVENTURE_DIA_14_ITEMS).find(i => i.item_type !== undefined);
    expect(primeiroParque?.time_start).toBe('13:00');
    // O bloco do Express carrega as duas tarefas: se alguém voltar a separá-las
    // em dois blocos, a entrada no parque escorrega para 13h35 de novo.
    const balcao = ISLANDS_OF_ADVENTURE_DIA_14_ITEMS.find(i => i.title.includes('Express Unlimited'));
    expect(balcao?.notes).toContain('DIVIDIR');
  });

  it('mantém todo bloco de parque dentro do horário de funcionamento (9h–20h)', () => {
    // Sem exceção nesta versão: o dia terminou de vez no Ripsaw Falls
    // (15h05), muito antes do fechamento das 20h — não sobrou nenhum bloco
    // (Hagrid's incluído) disputando o limite do horário do parque.
    porOrdem(ISLANDS_OF_ADVENTURE_DIA_14_ITEMS)
      .filter(i => i.item_type !== undefined)
      .forEach(item => {
        expect(minutos(item.time_start), `${item.title} começa antes da abertura`).toBeGreaterThanOrEqual(9 * 60);
        expect(minutos(item.time_end!), `${item.title} passa das 20h`).toBeLessThanOrEqual(20 * 60);
      });
  });

  it('cobre as duas atrações que barram a Gabi com Child Swap — as outras duas viraram resgate no dia 16', () => {
    const trocas = ISLANDS_OF_ADVENTURE_DIA_14_ITEMS.filter(i => i.child_switch).map(i => i.title);
    expect(trocas).toEqual(['The Incredible Hulk Coaster', "Doctor Doom's Fearfall"]);
  });

  it('põe a retirada do Express Unlimited antes de qualquer bloco de parque', () => {
    const retirada = ISLANDS_OF_ADVENTURE_DIA_14_ITEMS.find(i => i.title.includes('Express Unlimited'));
    expect(retirada, 'dia 14 sem o bloco de retirada do Express').toBeDefined();
    const primeiroParque = porOrdem(ISLANDS_OF_ADVENTURE_DIA_14_ITEMS).find(i => i.item_type !== undefined);
    expect(minutos(retirada!.time_end!)).toBeLessThanOrEqual(minutos(primeiroParque!.time_start));
    // O plano B só faz sentido enquanto a retirada não aconteceu: depois de
    // `completed`, exigir fallback de um fato consumado é ruído.
    if (retirada!.status !== 'completed') {
      expect(retirada!.plan_b, 'retirada do Express sem plano B').toBeDefined();
    }
  });

  it('não inclui o Jurassic Park River Adventure (fechado até 19/11/2026)', () => {
    expect(ISLANDS_OF_ADVENTURE_DIA_14_ITEMS.some(i => i.title.includes('River Adventure'))).toBe(false);
  });

  it('dá à Gabi um bloco próprio antes das atrações que a barram', () => {
    const seuss = ISLANDS_OF_ADVENTURE_DIA_14_ITEMS.find(i => i.area === 'Seuss Landing');
    expect(seuss?.min_height_cm).toBe(91);
    const primeiraBarrada = porOrdem(ISLANDS_OF_ADVENTURE_DIA_14_ITEMS).find(i => i.child_switch);
    expect(seuss!.base_order!).toBeLessThan(primeiraBarrada!.base_order!);
  });
});

describe('Epic Universe 15/09 — Early Park Admission sem Express', () => {
  it('abre o dia de parque às 9h, no Early Park Admission, com horário travado', () => {
    const primeiraAtracao = porOrdem(EPIC_UNIVERSE_DIA_15_ITEMS).find(i => i.item_type === 'attraction');
    expect(primeiraAtracao?.title).toBe('Mine-Cart Madness');
    expect(primeiraAtracao?.time_start).toBe('09:00');
    expect(primeiraAtracao?.time_is_estimated).toBe(false);
  });

  it('encerra dentro do horário do parque (fecha 20h em setembro/2026)', () => {
    const ultimoNoParque = porOrdem(EPIC_UNIVERSE_DIA_15_ITEMS)
      .filter(i => i.item_type !== undefined)
      .at(-1);
    expect(minutos(ultimoNoParque!.time_end!)).toBeLessThanOrEqual(20 * 60);
  });

  it('cobre a janela de trovoada da tarde com dois shows fechados', () => {
    const shows = EPIC_UNIVERSE_DIA_15_ITEMS.filter(
      i => i.item_type === 'show' && minutos(i.time_start) >= 13 * 60 && minutos(i.time_start) < 17 * 60,
    );
    expect(shows.map(i => i.title)).toEqual(['Le Cirque Arcanus', 'The Untrainable Dragon']);
  });
});

describe('Universal Studios 16/09 — Halloween Horror Nights e a estrada para Miami', () => {
  it('não deixa nenhum bloco dentro do parque depois das 17h', () => {
    // 16/09 é data do HHN (setembro: 2-6, 9-13, 16-20, 23-27, 30): o parque é
    // esvaziado às 17h para quem tem ingresso normal.
    UNIVERSAL_STUDIOS_DIA_16_ITEMS.filter(i => i.park === 'Universal Studios Florida' && i.item_type !== undefined)
      .forEach(item => {
        expect(minutos(item.time_end!), `${item.title} passa das 17h no dia do HHN`).toBeLessThanOrEqual(17 * 60);
      });
  });

  it('trava o horário da saída do parque e o da partida para Miami', () => {
    const saida = UNIVERSAL_STUDIOS_DIA_16_ITEMS.find(i => i.title.includes('Halloween Horror Nights'));
    expect(saida?.time_end).toBe('17:00');
    expect(saida?.time_is_estimated).toBe(false);

    const estrada = UNIVERSAL_STUDIOS_DIA_16_ITEMS.find(i => i.area === 'Estrada' && i.category === 'transit');
    expect(estrada?.time_start).toBe('17:30');
    expect(estrada?.time_is_estimated).toBe(false);
  });

  it('faz o check-out do hotel antes do parque, com aviso sobre os cartões Express', () => {
    const checkout = UNIVERSAL_STUDIOS_DIA_16_ITEMS.find(i => i.title.includes('Check-out'));
    const primeiroParque = porOrdem(UNIVERSAL_STUDIOS_DIA_16_ITEMS).find(i => i.item_type !== undefined);
    expect(minutos(checkout!.time_end!)).toBeLessThanOrEqual(minutos(primeiroParque!.time_start));
    expect(checkout?.notes).toContain('Express Unlimited');
  });

  it('termina no check-in do Casa Faena, em Miami Beach', () => {
    const ultimo = porOrdem(UNIVERSAL_STUDIOS_DIA_16_ITEMS).at(-1);
    expect(ultimo?.city).toBe('Miami Beach');
    expect(ultimo?.location).toBe('Casa Faena Miami Beach');
  });

  it('usa o ingresso Park-to-Park no Hogwarts Express', () => {
    const trem = UNIVERSAL_STUDIOS_DIA_16_ITEMS.find(i => i.title.includes('Hogwarts Express'));
    expect(trem?.description).toContain('Park-to-Park');
    expect(trem?.plan_b, 'Hogwarts Express sem plano B para pane/fila').toBeDefined();
  });
});
