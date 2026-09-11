import { buildOperationalDay, type OperationalRow } from './shared';

/**
 * Disney's Animal Kingdom — 11/09/2026, dia operacional **sem Early Entry e
 * sem Lightning Lane**.
 *
 * Três premissas moldam a ordem dos blocos:
 *
 * 1. **Sem Early Entry.** De 07 a 14/09 a família está no Celebration Suites
 *    (Kissimmee, hotel fora da rede Disney) — a única noite Disney da viagem
 *    foi 06→07/09. O rope drop é na abertura regular das 8h, não nos 7h30 de
 *    Early Entry que um hotel Disney daria.
 * 2. **Sem Lightning Lane** — decisão explícita, mesma premissa do dia do
 *    EPCOT (`epcotDia09.ts`): o roteiro é reordenado por fila, não por passe
 *    pago. Avatar Flight of Passage e Expedition Everest entram no rope drop
 *    justamente para não pagar essa conta em fila às 15h.
 * 3. **O parque fecha 19h, não 18h.** Em 11/09 o Animal Kingdom tem uma hora
 *    a mais que os dias vizinhos, mas o pôr do sol é 19h35 — não dá tempo de
 *    escurecer dentro do parque, então não há Tree of Life Awakenings nem
 *    Pandora bioluminescente hoje.
 *
 * Três blocos do roteiro original apontavam para atrações que não existem
 * mais e foram removidos: **DinoLand U.S.A. fechou em definitivo em
 * 02/02/2026** (DINOSAUR, The Boneyard, TriceraTop Spin) e Tropical Americas
 * só abre em 2027; **It's Tough to Be a Bug!** virou *Zootopia: Better
 * Zoogether!* (Tree of Life Theater, ~9 min, desde 07/11/2025); **Affection
 * Section** e **The Animation Experience** viraram **Bluey's Wild World** em
 * Conservation Station (desde 26/05/2026, só acessível pelo Wildlife Express
 * Train, que reabriu na mesma data). Festival of the Lion King dura 40 min
 * (não 25) e Finding Nemo dura 25 (não 40) — os blocos abaixo usam a duração
 * real de cada show.
 *
 * Gabi tem 112cm: a barra de Avatar Flight of Passage e Expedition Everest é
 * 44in = 111,8cm — ela passa por 2mm. Os dois levam `minHeightCm` +
 * `childSwitch`, para o bot anexar o aviso de Rider Switch se a medição da
 * manhã reprovar. Kali River Rapids pede só 97cm: ela já alcança.
 *
 * `reminderMinutesBefore: 0` desliga o aviso do item, pelo mesmo motivo do
 * dia do EPCOT: um dia de ~29 blocos sem isso viraria ~29 mensagens por
 * participante. Só 9 momentos de decisão avisam.
 *
 * **O primeiro aviso dispara às 6h da manhã** (não às 7h, como no EPCOT): a
 * família pediu que os lembretes comecem no horário de acordar, e isso exige
 * baixar `whatsapp_configs.quiet_hours_end` de `07:00` para `06:00` antes de
 * aplicar este seed (ver o plano de implementação). O teste da janela de
 * silêncio deste arquivo usa esse limiar de 6h, não o padrão de 7h.
 */
const ROWS: OperationalRow[] = [
  // ---------- Hotel → Animal Kingdom ----------
  {
    order: 1, start: '06:10', end: '06:25', title: 'Acordar e preparação',
    category: 'rest', area: 'Hotel', city: 'Kissimmee',
    location: 'Celebration Suites',
    notes: 'Mochila: protetor solar, poncho, garrafas e carregador. Tênis fechado. Medir a Gabi antes de sair.',
    reminderMinutesBefore: 10,
  },
  {
    order: 2, start: '06:25', end: '06:45', title: 'Café da manhã no apartamento',
    category: 'restaurant', area: 'Hotel', city: 'Kissimmee',
    location: 'Celebration Suites',
    notes: 'Café rápido — sem parada para café dentro do parque hoje.',
    reminderMinutesBefore: 0,
  },
  {
    order: 3, start: '06:45', end: '07:15', title: 'Saída do hotel rumo ao Animal Kingdom',
    category: 'transit', area: 'Deslocamento', city: 'Kissimmee → Lake Buena Vista',
    location: 'Celebration Suites → Disney’s Animal Kingdom',
    notes: 'Sem Early Entry: chegar cedo na fila é o único jeito de ganhar tempo na abertura.',
    planB: 'Trânsito pesado na I-4: sair até 6h50 no mais tardar para não perder o rope drop.',
    timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 4, start: '07:15', end: '07:45', title: 'Estacionamento e segurança',
    category: 'transit', area: 'Entrada', location: "Animal Kingdom — Entrada Principal",
    notes: 'Fotografar a placa da vaga. Ingressos já abertos no My Disney Experience.',
    reminderMinutesBefore: 0,
  },
  {
    order: 5, start: '07:45', end: '08:00', title: 'Posicionamento na entrada regular (rope drop)',
    category: 'transit', area: 'Entrada', location: "Animal Kingdom — Entrada Principal",
    notes: 'Sem Early Entry hoje: estar na frente da catraca antes das 8h vale a manhã inteira. Ir direto para Pandora.',
    timeIsEstimated: false, reminderMinutesBefore: 15,
  },

  // ---------- Pandora e África: 8h–10h35 ----------
  {
    order: 6, start: '08:00', end: '08:45', title: 'Avatar Flight of Passage',
    category: 'park', area: 'Pandora', itemType: 'attraction', priority: 'S',
    minHeightCm: 112, childSwitch: true,
    recommendedWindow: 'Primeiros 30 minutos do dia',
    notes: 'Prioridade absoluta do dia. Ir direto, sem fotos.',
    planB: 'Se a Gabi não passar na medição, Rider Switch: um adulto vai com a Débora primeiro, o outro espera com a Gabi.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },
  {
    order: 7, start: '08:45', end: '09:15', title: "Na'vi River Journey",
    category: 'park', area: 'Pandora', itemType: 'attraction', priority: 'S',
    notes: 'Sem restrição de altura: todo mundo anda junto.',
    reminderMinutesBefore: 0,
  },
  {
    order: 8, start: '09:15', end: '09:25', title: 'Atalho de Pandora para África',
    category: 'transit', area: 'Deslocamento',
    notes: 'Ir direto para o Kilimanjaro Safaris — os animais ficam mais ativos de manhã.',
    reminderMinutesBefore: 0,
  },
  {
    order: 9, start: '09:25', end: '10:05', title: 'Kilimanjaro Safaris',
    category: 'park', area: 'África', itemType: 'attraction', priority: 'S',
    notes: 'Fazer o safári ainda pela manhã, antes do calor deixar os animais parados.',
    reminderMinutesBefore: 0,
  },
  {
    order: 10, start: '10:05', end: '10:35', title: 'Gorilla Falls Exploration Trail',
    category: 'park', area: 'África', itemType: 'experience', priority: 'A',
    notes: 'Trilha inteira, sem pressa — sombreada.',
    reminderMinutesBefore: 0,
  },

  // ---------- Festival of the Lion King ----------
  {
    order: 11, start: '10:35', end: '10:50', title: 'Deslocamento até o Harambe Theatre',
    category: 'transit', area: 'Deslocamento',
    reminderMinutesBefore: 0,
  },
  {
    order: 12, start: '10:50', end: '11:35', title: 'Festival of the Lion King',
    category: 'park', area: 'África', itemType: 'show', priority: 'S',
    status: 'planned', location: 'Animal Kingdom — Harambe Theatre',
    description: 'Show completo, 40 minutos — não 25 como no roteiro original.',
    notes: 'Chegar com folga: é o espetáculo mais concorrido do parque.',
    showDurationMin: 40, timeIsEstimated: false, recommendedArrivalMinBefore: 20,
    reminderMinutesBefore: 20,
  },

  // ---------- Wildlife Express Train / Bluey's Wild World ----------
  {
    order: 13, start: '11:35', end: '11:45', title: "Deslocamento até a estação do trem (África)",
    category: 'transit', area: 'Deslocamento',
    reminderMinutesBefore: 0,
  },
  {
    order: 14, start: '11:45', end: '12:05', title: 'Wildlife Express Train (ida)',
    category: 'park', area: "Rafiki's Planet Watch", itemType: 'experience', priority: 'B',
    description: 'Narração do Robert Irwin no trajeto — reaberto em 26/05/2026 junto com Bluey’s Wild World.',
    notes: 'Só se chega a Conservation Station de trem.',
    reminderMinutesBefore: 15,
  },
  {
    order: 15, start: '12:05', end: '13:00', title: "Bluey's Wild World",
    category: 'park', area: "Rafiki's Planet Watch", itemType: 'experience', priority: 'B',
    location: 'Conservation Station',
    description: 'Experiência interativa com Bluey e Bingo — substituiu Affection Section e The Animation Experience.',
    notes: 'Fecha às 15h45 — não deixar para mais tarde. Área coberta e com ar-condicionado.',
    reminderMinutesBefore: 0,
  },
  {
    order: 16, start: '13:00', end: '13:15', title: 'Wildlife Express Train (volta)',
    category: 'park', area: "Rafiki's Planet Watch", itemType: 'experience', priority: 'B',
    reminderMinutesBefore: 0,
  },

  // ---------- Almoço (âncora) ----------
  {
    order: 17, start: '13:15', end: '14:30', title: 'Almoço — Yak & Yeti Restaurant',
    category: 'restaurant', area: 'Asia', itemType: 'character',
    status: 'planned', location: 'Animal Kingdom — Ásia',
    description: 'Pausa longa do meio do dia — reserva a confirmar antes da viagem.',
    notes: 'Chegar 13h05 no balcão. Ambiente fechado e com ar-condicionado: melhor horário para a Gabi descansar.',
    planB: 'Sem reserva: Yak & Yeti Local Food Cafés (balcão, sem reserva) ou Satu’li Canteen em Pandora — nesse caso a pausa encolhe.',
    timeIsEstimated: false, recommendedArrivalMinBefore: 10, reminderMinutesBefore: 30,
  },

  // ---------- Ásia ----------
  {
    order: 18, start: '14:30', end: '14:45', title: 'Deslocamento até o Anandapur Theater',
    category: 'transit', area: 'Deslocamento',
    reminderMinutesBefore: 0,
  },
  {
    order: 19, start: '14:45', end: '15:15', title: 'Feathered Friends in Flight!',
    category: 'park', area: 'Asia', itemType: 'show', priority: 'A',
    location: 'Animal Kingdom — Anandapur Theater',
    description: 'Show de 25 minutos, ao ar livre mas coberto — bom plano se a tarde fechar tempestade.',
    showDurationMin: 25,
    reminderMinutesBefore: 15,
  },
  {
    order: 20, start: '15:15', end: '15:50', title: 'Maharajah Jungle Trek',
    category: 'park', area: 'Asia', itemType: 'experience', priority: 'A',
    notes: 'Trilha sombreada — bom horário para o pico de calor.',
    reminderMinutesBefore: 0,
  },
  {
    order: 21, start: '15:50', end: '16:25', title: 'Kali River Rapids',
    category: 'park', area: 'Asia', itemType: 'attraction', priority: 'A',
    minHeightCm: 97,
    notes: 'Levar capa de chuva. Fecha com raio nas proximidades — é a atração mais sujeita à tempestade de setembro.',
    planB: 'Se fechar por tempestade, trocar pela repetição livre das 18h40.',
    reminderMinutesBefore: 0,
  },
  {
    order: 22, start: '16:25', end: '16:35', title: 'Deslocamento até o Expedition Everest',
    category: 'transit', area: 'Deslocamento',
    reminderMinutesBefore: 0,
  },
  {
    order: 23, start: '16:35', end: '17:15', title: 'Expedition Everest – Legend of the Forbidden Mountain',
    category: 'park', area: 'Asia', itemType: 'attraction', priority: 'S',
    minHeightCm: 112, childSwitch: true,
    notes: 'A fila single rider foi descontinuada em 2026 — não contar com ela para agilizar.',
    planB: 'Se a Gabi não passar na medição, Rider Switch aqui também.',
    reminderMinutesBefore: 0,
  },

  // ---------- Discovery Island e fechamento ----------
  {
    order: 24, start: '17:15', end: '17:35', title: 'Zootopia: Better Zoogether!',
    category: 'park', area: 'Discovery Island', itemType: 'show', priority: 'A',
    location: 'Animal Kingdom — Tree of Life Theater',
    description: 'Substituiu It’s Tough to Be a Bug! em 07/11/2025 — show de ~9 minutos.',
    showDurationMin: 9,
    reminderMinutesBefore: 0,
  },
  {
    order: 25, start: '17:50', end: '18:20', title: "Finding Nemo: The Big Blue… and Beyond!",
    category: 'park', area: 'Discovery Island', itemType: 'show', priority: 'S',
    location: 'Animal Kingdom — Theater in the Wild',
    description: 'Show completo, 25 minutos — não 40 como no roteiro original.',
    showDurationMin: 25, lastShowtimeOfDay: true,
    reminderMinutesBefore: 15,
  },
  {
    order: 26, start: '18:20', end: '18:40', title: 'Discovery Island Trails e Árvore da Vida',
    category: 'park', area: 'Discovery Island', itemType: 'experience', priority: 'B',
    notes: 'Fotos na Tree of Life. O parque fecha às 19h — sem escurecer, não há Awakenings hoje.',
    reminderMinutesBefore: 0,
  },
  {
    order: 27, start: '18:40', end: '19:00', title: 'Repetição livre (Everest, Na’vi ou Flight of Passage)',
    category: 'park', area: 'Pandora / Asia', itemType: 'attraction',
    status: 'optional',
    notes: 'Filas mais curtas perto do fechamento — escolher pela fila do My Disney Experience.',
    countsTowardCompletion: false,
    reminderMinutesBefore: 0,
  },
  {
    order: 28, start: '19:00', end: '19:20', title: 'Island Mercantile',
    category: 'shopping', area: 'Discovery Island',
    notes: 'A loja opera um pouco além do horário de fechamento do parque.',
    reminderMinutesBefore: 15,
  },
  {
    order: 29, start: '19:20', end: '20:00', title: 'Saída do Animal Kingdom e retorno ao hotel',
    category: 'transit', area: 'Deslocamento', city: 'Lake Buena Vista → Kissimmee',
    location: "Disney's Animal Kingdom → Celebration Suites",
    notes: 'Fluxo de saída pesado. A vaga foi fotografada de manhã.',
    reminderMinutesBefore: 0,
  },
];

export const ANIMAL_KINGDOM_DIA_11_ITEMS = buildOperationalDay(
  {
    parkKey: 'ak11',
    parkName: "Disney's Animal Kingdom",
    city: 'Lake Buena Vista',
    date: '2026-09-11',
  },
  ROWS
);
