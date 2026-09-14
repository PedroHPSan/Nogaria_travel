import { buildOperationalDay, type OperationalRow } from './shared';

/**
 * Epic Universe — 15/09/2026, dia operacional **com Early Park Admission e
 * SEM Express**.
 *
 * É o dia invertido em relação a 14 e 16/09, e a inversão é a razão de ele
 * ficar no meio: o Universal Express Unlimited incluso na diária do Loews
 * Royal Pacific vale para o Universal Studios Florida e para o Islands of
 * Adventure, **não para o Epic Universe** — o Express do Epic é vendido à
 * parte e não foi comprado. Sem fura-fila, a única moeda de troca é o
 * horário, e por isso este é o único dos três dias que precisa do dia
 * inteiro e de rope drop.
 *
 * Premissas:
 *
 * 1. **Early Park Admission às 9h.** Hóspedes dos hotéis Universal (o Royal
 *    Pacific incluído) entram 1h antes da abertura ao público. Em setembro de
 *    2026 o Epic Universe abre 10h e fecha 20h na maioria das datas — logo, a
 *    hora do EPA é ~10% do dia útil e vale por muito mais que isso: é a única
 *    janela do dia em que Super Nintendo World anda sem espera.
 * 2. **Super Nintendo World primeiro, Ministry of Magic na abertura.** SNW é
 *    a área de menor capacidade do parque e a que satura primeiro; Harry
 *    Potter and the Battle at the Ministry é a fila mais longa em regime
 *    normal. A ordem resolve os dois: SNW inteiro no EPA, e o Ministry às 10h,
 *    quando o público que acabou de entrar ainda está se distribuindo.
 * 3. **A tarde é a janela de trovoada.** Os dois shows fechados do dia (Le
 *    Cirque Arcanus, ~13h, e The Untrainable Dragon, ~15h20) e o bloco de
 *    Dark Universe ficam concentrados entre 13h e 17h de propósito.
 * 4. **Gabi tem 112cm.** Fica de fora de Mine-Cart Madness, Monsters
 *    Unchained, Curse of the Werewolf, Dragon Racer's Rally e Stardust Racers
 *    (todas 122cm) — cinco Child Swaps, e sem Express cada um custa uma fila
 *    inteira para o segundo adulto. Por isso cada bloco de 122cm tem, ao lado,
 *    o que ela faz enquanto espera.
 *
 * Power-Up Bands (~US$ 40 cada) não estão comprados: sem elas, Bowser Jr.
 * Shadow Showdown e os Key Challenges de Super Nintendo World não funcionam.
 * A decisão está no bloco do EPA — comprar na entrada da área ou abrir mão.
 *
 * `reminderMinutesBefore: 0` desliga o aviso do item — só 9 momentos de
 * decisão avisam.
 */
const ROWS: OperationalRow[] = [
  // ---------- Manhã: sair antes do Early Park Admission ----------
  {
    order: 1, start: '07:00', end: '07:30', title: 'Acordar e preparação',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    notes: 'Dia mais longo dos três (11h de parque) e o único sem fura-fila. Tênis fechado, protetor solar, poncho, garrafas e carregador. Carrinho da Gabi é obrigatório hoje.',
    reminderMinutesBefore: 15,
  },
  {
    order: 2, start: '07:30', end: '08:00', title: 'Café da manhã no hotel',
    category: 'restaurant', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    notes: 'Café reforçado — o primeiro bloco de comida dentro do parque só é às 12h20.',
    reminderMinutesBefore: 0,
  },
  {
    order: 3, start: '08:00', end: '08:30', title: 'Royal Pacific → Epic Universe (ônibus do resort)',
    category: 'transit', area: 'Deslocamento',
    location: "Universal's Loews Royal Pacific Resort → Epic Universe",
    description: 'O Epic Universe fica fora do complexo original: não há barco nem caminhada, só o ônibus do resort (~15 min) ou carro.',
    notes: 'Os ônibus para o Epic começam a rodar cerca de 1h antes do Early Park Admission e enchem. Estar no ponto às 8h, não às 8h15.',
    planB: 'Fila de ônibus grande: ir de carro (estacionamento próprio do Epic, ~US$ 35) — 12 min pela Universal Blvd / Kirkman Extension.',
    timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 4, start: '08:30', end: '09:00', title: 'Entrada, segurança e posicionamento para o Early Park Admission',
    category: 'transit', area: 'Entrada', location: 'Epic Universe',
    notes: 'Confirmar no app que o EPA de hoje inclui Super Nintendo World. Atravessar o Celestial Park sem parar — as fontes e os jardins ficam para o fim do dia.',
    planB: 'Se o EPA de hoje abrir Isle of Berk em vez de Super Nintendo World, inverter: Hiccup\'s Wing Gliders e Dragon Racer\'s Rally no EPA e Super Nintendo World às 10h.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },

  // ---------- Early Park Admission: Super Nintendo World ----------
  {
    order: 5, start: '09:00', end: '09:40', title: 'Mine-Cart Madness',
    category: 'park', area: 'Super Nintendo World', itemType: 'attraction', priority: 'S',
    minHeightCm: 122, childSwitch: true,
    description: 'A atração de maior demanda do Epic Universe. Sem Express, a hora do EPA é a única em que ela anda em menos de 20 min.',
    notes: 'Gabi (112cm) fica de fora — Child Swap. Decidir aqui sobre as Power-Up Bands (~US$ 40 cada): sem elas, os Key Challenges e o Bowser Jr. não funcionam.',
    recommendedWindow: 'Primeiros 40 minutos do Early Park Admission',
    timeIsEstimated: false, reminderMinutesBefore: 20,
  },
  {
    order: 6, start: '09:40', end: '10:10', title: "Mario Kart: Bowser's Challenge",
    category: 'park', area: 'Super Nintendo World', itemType: 'attraction', priority: 'S',
    minHeightCm: 102,
    notes: 'Toda a família anda junto (102cm). Os óculos de realidade aumentada ficam sobre o boné do Mario — ajustar antes de embarcar, é o que mais atrapalha criança pequena.',
    reminderMinutesBefore: 0,
  },
  {
    order: 7, start: '10:10', end: '10:35', title: "Yoshi's Adventure",
    category: 'park', area: 'Super Nintendo World', itemType: 'attraction', priority: 'A',
    minHeightCm: 86,
    notes: 'Barra de 86cm — a atração mais acessível do parque para a Gabi, e a vista de cima é a melhor foto da área.',
    reminderMinutesBefore: 0,
  },

  // ---------- Abertura ao público: Ministry of Magic ----------
  {
    order: 8, start: '10:35', end: '10:55', title: 'Travessia Super Nintendo World → Ministry of Magic',
    category: 'transit', area: 'Deslocamento',
    notes: 'Sai pelo portal, atravessa o Celestial Park e entra pelo portal da Paris bruxa — ~12 min a pé.',
    reminderMinutesBefore: 0,
  },
  {
    order: 9, start: '10:55', end: '11:55', title: 'Harry Potter and the Battle at the Ministry',
    category: 'park', area: 'Ministry of Magic', itemType: 'attraction', priority: 'S',
    minHeightCm: 102,
    description: 'A atração-âncora do Epic Universe: 102cm, então a família inteira anda junta — rara entre as fortes do dia.',
    notes: 'Sem Express: 60 min de fila é o cenário realista às 11h. Ir agora mesmo assim — à tarde passa de 90.',
    planB: 'Se a fila estiver acima de 75 min, trocar por Le Cirque Arcanus e a exploração da Paris bruxa e voltar aqui às 19h, na última hora do parque.',
    reminderMinutesBefore: 0,
  },
  {
    order: 10, start: '11:55', end: '12:20', title: 'Paris bruxa — vitrines, varinhas e fachadas',
    category: 'park', area: 'Ministry of Magic', itemType: 'experience', priority: 'A',
    notes: 'A área tem interações de varinha espalhadas pelas fachadas — se a varinha interativa foi comprada ontem no Hogsmeade, ela funciona aqui também.',
    reminderMinutesBefore: 0,
  },
  {
    order: 11, start: '12:20', end: '13:05', title: "Almoço — Café L'air De La Sirène",
    category: 'restaurant', area: 'Ministry of Magic',
    description: 'Quick service temático da Paris bruxa, salão interno e climatizado.',
    notes: 'Mobile order pelo app assim que sair da atração. ~US$ 85 para os 4.',
    recommendedArrivalMinBefore: 10, timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 12, start: '13:10', end: '13:35', title: 'Le Cirque Arcanus',
    category: 'park', area: 'Ministry of Magic', itemType: 'show', priority: 'S',
    description: 'Espetáculo fechado com bonecos e criaturas mágicas, ~20 min. Primeiro bloco coberto da tarde.',
    notes: 'Horário sujeito à programação do dia — conferir no app de manhã e ajustar este bloco se preciso.',
    showDurationMin: 20, recommendedArrivalMinBefore: 15,
    timeIsEstimated: false, reminderMinutesBefore: 20,
  },

  // ---------- Isle of Berk ----------
  {
    order: 13, start: '13:35', end: '13:55', title: 'Travessia Ministry of Magic → Isle of Berk',
    category: 'transit', area: 'Deslocamento',
    reminderMinutesBefore: 0,
  },
  {
    order: 14, start: '13:55', end: '14:30', title: "Hiccup's Wing Gliders",
    category: 'park', area: 'Isle of Berk', itemType: 'attraction', priority: 'S',
    minHeightCm: 102,
    notes: 'Família inteira junta (102cm). É a melhor montanha-russa do Epic dentro da altura da Gabi.',
    reminderMinutesBefore: 0,
  },
  {
    order: 15, start: '14:30', end: '14:55', title: 'Fyre Drill',
    category: 'park', area: 'Isle of Berk', itemType: 'attraction', priority: 'A',
    notes: 'Sem altura mínima e interativa (jatos de água) — molha. Bloco leve entre duas de 122cm.',
    reminderMinutesBefore: 0,
  },
  {
    order: 16, start: '14:55', end: '15:20', title: "Dragon Racer's Rally",
    category: 'park', area: 'Isle of Berk', itemType: 'attraction', priority: 'A',
    minHeightCm: 122, childSwitch: true,
    notes: 'Gabi (112cm) fica de fora — enquanto Débora anda, ela e um adulto fazem o Viking Training Camp, ali ao lado.',
    reminderMinutesBefore: 0,
  },
  {
    order: 17, start: '15:20', end: '15:50', title: 'The Untrainable Dragon',
    category: 'park', area: 'Isle of Berk', itemType: 'show', priority: 'S',
    description: 'Teatro fechado, ~25 min, boneco animatrônico do Banguela em escala real. Segundo abrigo da tarde.',
    notes: 'Sentar no meio, não na frente — o dragão é grande demais para as primeiras fileiras. Confirmar o horário no app.',
    showDurationMin: 25, recommendedArrivalMinBefore: 15,
    timeIsEstimated: false, reminderMinutesBefore: 20,
  },

  // ---------- Dark Universe ----------
  {
    order: 18, start: '15:50', end: '16:10', title: 'Travessia Isle of Berk → Dark Universe',
    category: 'transit', area: 'Deslocamento',
    notes: 'Dark Universe é a área mais pesada do parque em tema (monstros clássicos, penumbra, sustos ambientais). Combinar com a Gabi antes de entrar.',
    reminderMinutesBefore: 0,
  },
  {
    order: 19, start: '16:10', end: '16:55', title: 'Monsters Unchained: The Frankenstein Experiment',
    category: 'park', area: 'Dark Universe', itemType: 'attraction', priority: 'S',
    minHeightCm: 122, childSwitch: true,
    description: 'A dark ride mais intensa do Epic Universe.',
    notes: 'Gabi (112cm) fica de fora — e o tema aqui não é só altura: a fila já é assustadora. Melhor que ela e um adulto esperem fora da área, na praça do portal.',
    reminderMinutesBefore: 0,
  },
  {
    order: 20, start: '16:55', end: '17:25', title: 'Curse of the Werewolf',
    category: 'park', area: 'Dark Universe', itemType: 'attraction', priority: 'A',
    minHeightCm: 122, childSwitch: true,
    notes: 'Segunda de 122cm seguida. Se a espera do adulto que ficou com a Gabi estiver longa demais, este é o bloco a cortar — é o de menor prioridade da área.',
    status: 'optional', reminderMinutesBefore: 0,
  },
  {
    order: 21, start: '17:25', end: '17:50', title: 'Darkmoor Monster Makeup Experience',
    category: 'park', area: 'Dark Universe', itemType: 'experience', priority: 'B',
    notes: 'Sem altura mínima e mais teatral que assustador — reencaixa a Gabi na área depois de duas atrações que ela não pôde fazer.',
    reminderMinutesBefore: 0,
  },

  // ---------- Celestial Park e noite ----------
  {
    order: 22, start: '17:50', end: '18:10', title: 'Travessia Dark Universe → Celestial Park',
    category: 'transit', area: 'Deslocamento',
    reminderMinutesBefore: 0,
  },
  {
    order: 23, start: '18:10', end: '18:55', title: 'Jantar no Celestial Park',
    category: 'restaurant', area: 'Celestial Park',
    description: 'The Oak & Star Tavern (quick service) ou Atlantic (table service, exige reserva).',
    notes: 'Mobile order no quick service — table service sem reserva às 18h não entra. ~US$ 90 para os 4.',
    recommendedArrivalMinBefore: 10, timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 24, start: '18:55', end: '19:25', title: 'Stardust Racers',
    category: 'park', area: 'Celestial Park', itemType: 'attraction', priority: 'S',
    minHeightCm: 122, childSwitch: true,
    description: 'Montanha-russa dupla de lançamento do Celestial Park — a mais rápida do Epic.',
    notes: 'Gabi (112cm) fica de fora — Child Swap. À noite a fila cai e a vista das fontes iluminadas compensa ter deixado para o fim.',
    reminderMinutesBefore: 0,
  },
  {
    order: 25, start: '19:25', end: '19:45', title: 'Constellation Carousel',
    category: 'park', area: 'Celestial Park', itemType: 'attraction', priority: 'A',
    notes: 'Sem altura mínima — o último bloco em que a Gabi anda, e de propósito é o penúltimo do dia.',
    reminderMinutesBefore: 0,
  },
  {
    order: 26, start: '19:45', end: '20:00', title: 'The Cosmos Fountain Show',
    category: 'park', area: 'Celestial Park', itemType: 'show', priority: 'A',
    description: 'Show de fontes, luz e música no lago central, ~8 min, no fechamento do parque.',
    notes: 'Melhor ponto: a escadaria do lado do portal do Super Nintendo World, de costas para a saída — já encaminha a debandada.',
    showDurationMin: 8, lastShowtimeOfDay: true,
    timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 27, start: '20:00', end: '20:40', title: 'Saída e retorno ao Royal Pacific',
    category: 'transit', area: 'Deslocamento',
    location: "Epic Universe → Universal's Loews Royal Pacific Resort",
    notes: 'A fila do ônibus no fechamento é o pior gargalo do dia — sair durante o show de fontes economiza ~20 min.',
    reminderMinutesBefore: 0,
  },
  {
    order: 28, start: '20:40', end: '21:20', title: 'Encerramento e malas fechadas para o dia 16',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    notes: 'Amanhã tem check-out às 7h15 com as malas no carro antes do parque — fechar tudo hoje. Separar o Express Unlimited: ele ainda vale o dia inteiro amanhã.',
    reminderMinutesBefore: 15,
  },
];

export const EPIC_UNIVERSE_DIA_15_ITEMS = buildOperationalDay(
  {
    parkKey: 'eu15',
    parkName: 'Epic Universe',
    city: 'Orlando',
    date: '2026-09-15',
  },
  ROWS
);
