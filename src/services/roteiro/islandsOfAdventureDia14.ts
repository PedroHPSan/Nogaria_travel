import { buildOperationalDay, type OperationalRow } from './shared';

/**
 * Universal's Islands of Adventure — 14/09/2026, dia operacional **replanejado
 * às 11h, com Universal Express Unlimited e Child Swap**.
 *
 * Esta é a segunda versão do dia. A primeira supunha saída do Celebration
 * Suites ao meio-dia e entrada no parque às 14h25; a família passou a manhã no
 * hotel e o replanejamento começa **agora**, às 11h — o que, contra a
 * intuição, *ganha* tempo de parque: a saída antecipada põe o grupo dentro do
 * Islands of Adventure por volta das 13h30, quase uma hora antes do plano
 * anterior.
 *
 * Cinco fatos externos desenham o dia:
 *
 * 1. **O parque fecha às 20h hoje** (segunda, 9h–20h). A versão anterior
 *    trabalhava com 18h/19h e por isso encurtava Hogsmeade. Com 20h o dia
 *    útil de parque passa de ~4h para **6h30**, e o roteiro deixa de ser um
 *    recorte: cabe o Islands of Adventure inteiro.
 * 2. **Express Unlimited, retirado no balcão do Royal Pacific.** Vem incluso
 *    na diária (DEC-002, reserva 37654214702) e é entregue no registro, junto
 *    com as chaves. É o bloco crítico do dia — sem ele o resto não existe. Dá
 *    para registrar antes das 16h e deixar as malas no Bell Services.
 * 3. **Com fura-fila ilimitado a ordem é geográfica, não de fila.** O dia
 *    percorre o parque em anel horário — Seuss Landing, Marvel, Toon Lagoon,
 *    Skull Island, Jurassic Park, Hogsmeade — em vez de saltar atrás da menor
 *    espera. O que se economiza é caminhada.
 * 4. **Duas atrações não aceitam Express: Hagrid's e Pteranodon Flyers.**
 *    Hagrid's é a melhor montanha-russa do parque e a única que ainda exige
 *    estratégia de fila — por isso é o **último** bloco: quem entra na fila
 *    antes das 20h anda, mesmo que o parque feche no meio da espera.
 *    Pteranodon Flyers cobra 30-40 min de fila por 1 min de voo e por isso
 *    vive numa nota, não num bloco.
 * 5. **Gabi tem 112cm.** Fica de fora de Hulk (137), Doctor Doom (132),
 *    VelociCoaster (130), Forbidden Journey (122) e Hagrid's (122) — cinco
 *    das seis atrações mais fortes. É aqui que entra o **Child Swap (rider
 *    switch)**: com Express, o grupo inteiro sobe pela fila expressa até a
 *    plataforma, um adulto fica com a Gabi na sala de troca climatizada e
 *    troca com o outro na volta — custo real de ~10 min por atração, não uma
 *    fila inteira. As quatro trocas do dia estão marcadas com `childSwitch`.
 *
 * Jurassic Park River Adventure não entra: fechamento programado de 05/01 a
 * 19/11/2026 (ver `islandsOfAdventure.ts`).
 *
 * O jantar saiu do Thunder Falls Terrace (Jurassic Park) para o Three
 * Broomsticks (Hogsmeade): com o parque aberto até 20h, jantar às 17h35 dentro
 * do vilarejo elimina uma travessia inteira e põe a família em Hogsmeade para
 * as últimas 2h30 do dia, que é onde está o material mais forte que sobra.
 *
 * `reminderMinutesBefore: 0` desliga o aviso do item — só 8 momentos de
 * decisão avisam.
 */
const ROWS: OperationalRow[] = [
  // ---------- Celebration Suites → Royal Pacific: sair agora ----------
  {
    order: 1, start: '11:00', end: '11:25', title: 'Check-out do Celebration Suites e carga do carro',
    category: 'rest', area: 'Hotel', city: 'Kissimmee', location: 'Celebration Suites',
    description: 'Bloco de partida do replanejamento das 11h — o check-out contratado é 11h e o relógio do dia começa a contar aqui.',
    notes: 'Varrer cofre, gavetas, banheiro e carregadores antes de fechar a porta. Se houver taxa de late check-out, pagar e seguir: 20 min discutindo no balcão custam uma atração em Hogsmeade.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },
  {
    order: 2, start: '11:25', end: '12:05', title: 'Kissimmee → Loews Royal Pacific Resort',
    category: 'transit', area: 'Deslocamento', city: 'Kissimmee → Orlando',
    location: "Celebration Suites → Universal's Loews Royal Pacific Resort",
    notes: 'I-4 sentido norte, saída 74B/75A. ~35 min sem trânsito, e às 11h30 de segunda não há. Reserva 37654214702.',
    planB: 'Se a I-4 travar, a alternativa é a Turnpike até a saída 259 e a Kirkman — mais km, sem o gargalo da International Drive.',
    reminderMinutesBefore: 10,
  },
  {
    order: 3, start: '12:05', end: '12:40', title: 'Registro no Royal Pacific e retirada do Express Unlimited',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    description: 'O bloco mais importante do dia. O Universal Express Unlimited dos 4 hóspedes é entregue no balcão, junto com as chaves — é o que sustenta os dias 14 e 16.',
    notes: 'Check-in do quarto é às 16h, mas dá para registrar agora: pedir os cartões Express Unlimited e deixar as malas no Bell Services. Conferir se saíram 4 cartões e se valem hoje E em 16/09 (dia do check-out).',
    planB: 'Se o balcão se recusar a emitir o Express antes das 16h, insistir com o gerente de plantão — o benefício é do dia de chegada. Sem ele, inverter o dia: Seuss Landing e Hogsmeade primeiro, filas grandes só depois das 16h com os cartões na mão.',
    timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 4, start: '12:40', end: '13:05', title: 'Almoço rápido no hotel (grab-and-go)',
    category: 'restaurant', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    notes: 'Tuk Tuk Market ou Orchid Court. Comer aqui em vez de dentro do parque salva ~30 min e ~US$ 35 — o jantar de hoje já está reservado ao Three Broomsticks. ~US$ 45 para os 4.',
    reminderMinutesBefore: 0,
  },
  {
    order: 5, start: '13:05', end: '13:25', title: 'Royal Pacific → Islands of Adventure',
    category: 'transit', area: 'Deslocamento',
    location: "Universal's Loews Royal Pacific Resort → Universal's Islands of Adventure",
    notes: 'Water taxi na doca do hotel ou a trilha a pé até o CityWalk — os dois dão ~12 min. Com o carrinho da Gabi, a caminhada é mais previsível que a fila do barco.',
    reminderMinutesBefore: 10,
  },
  {
    order: 6, start: '13:25', end: '13:35', title: 'Entrada, segurança e conferência do horário de fechamento',
    category: 'transit', area: 'Entrada', location: "Universal's Islands of Adventure",
    description: 'Ingresso Park-to-Park no app Universal Orlando Resort, com os cartões Express na mesma carteira digital.',
    notes: 'Conferir no app o fechamento de hoje (previsto 20h) — é o número que decide a hora de entrar na fila do Hagrid\'s no fim do dia. Anotar também o horário das sessões do Ollivanders.',
    planB: 'Se o fechamento for antes das 20h, cortar o bloco do Camp Jurassic e antecipar o jantar em 30 min: tudo depois dele desliza junto e o Hagrid\'s continua sendo o último.',
    reminderMinutesBefore: 0,
  },

  // ---------- Seuss Landing: o pedaço da Gabi, logo na entrada ----------
  {
    order: 7, start: '13:35', end: '14:05', title: 'Seuss Landing — Caro-Seuss-el, One Fish Two Fish e The Cat in the Hat',
    category: 'park', area: 'Seuss Landing', itemType: 'attraction', priority: 'B',
    minHeightCm: 91, lightningLane: 'express', lightningLaneRank: 10,
    description: 'Três atrações leves em sequência, todas dentro da altura da Gabi (91cm), a 5 min do Port of Entry.',
    notes: 'Único bloco em que a Gabi lidera, e é de propósito que ele venha ANTES da sequência de 137/132/130cm que a barra. The Cat in the Hat gira no fim — se ela enjoar, pular e fazer o If I Ran the Zoo ao lado.',
    reminderMinutesBefore: 0,
  },

  // ---------- Marvel Super Hero Island ----------
  {
    order: 8, start: '14:05', end: '14:25', title: 'The Amazing Adventures of Spider-Man',
    category: 'park', area: 'Marvel Super Hero Island', itemType: 'attraction', priority: 'S',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 3,
    description: 'Simulador 3D sobre trilho — a atração forte de maior alcance do dia.',
    notes: 'Os 4 andam juntos (102cm). Inclui a travessia Seuss → Marvel pelo Port of Entry, ~6 min.',
    reminderMinutesBefore: 0,
  },
  {
    order: 9, start: '14:25', end: '14:50', title: 'The Incredible Hulk Coaster',
    category: 'park', area: 'Marvel Super Hero Island', itemType: 'attraction', priority: 'S',
    minHeightCm: 137, childSwitch: true, lightningLane: 'express', lightningLaneRank: 4,
    description: 'Lançamento de 0 a 65 km/h dentro do tubo verde — a primeira das quatro trocas do dia.',
    notes: 'Gabi (112cm) fica de fora. Child Swap: avisar o atendente na entrada da fila Express, subir os 4 até a plataforma, um adulto espera com a Gabi na sala de troca e anda na volta do outro. Com Express, ~10 min de custo. Bolsos vazios — lockers gratuitos na entrada.',
    reminderMinutesBefore: 0,
  },
  {
    order: 10, start: '14:50', end: '15:10', title: "Doctor Doom's Fearfall",
    category: 'park', area: 'Marvel Super Hero Island', itemType: 'attraction', priority: 'A',
    minHeightCm: 132, childSwitch: true, lightningLane: 'express', lightningLaneRank: 8,
    description: 'Torre de lançamento de 61m — curta, e a melhor vista do parque no topo.',
    notes: 'Gabi (112cm) fora, Child Swap de novo. Enquanto isso, quem estiver com ela faz o Storm Force Accelatron ao lado (sem altura mínima, xícaras giratórias) e o encontro dos heróis Marvel, que costuma acontecer na esquina da Cafe 4.',
    reminderMinutesBefore: 0,
  },

  // ---------- Toon Lagoon: os dois blocos molhados, no pico do calor ----------
  {
    order: 11, start: '15:10', end: '15:35', title: "Dudley Do-Right's Ripsaw Falls",
    category: 'park', area: 'Toon Lagoon', itemType: 'attraction', priority: 'A',
    minHeightCm: 112, lightningLane: 'express', lightningLaneRank: 5,
    description: 'Queda de 15m em tronco. Molha de verdade — não é respingo.',
    notes: 'Barra de 44in = 111,8cm: a Gabi passa por 2mm, de tênis. Medir na entrada ANTES de entrar na fila, para não descobrir na plataforma. Celulares e a mochila no locker, não no colo. É o pico do calor do dia — é agora que os dois blocos molhados fazem sentido.',
    planB: 'Se ela não passar na medição, ela e um adulto vão ao Me Ship, the Olive (sem altura mínima, ao lado, com canhões de água) e o grupo se reencontra na saída do tronco.',
    reminderMinutesBefore: 0,
  },
  {
    order: 12, start: '15:35', end: '15:55', title: "Popeye & Bluto's Bilge-Rat Barges",
    category: 'park', area: 'Toon Lagoon', itemType: 'attraction', priority: 'A',
    minHeightCm: 107, lightningLane: 'express', lightningLaneRank: 6,
    description: 'Bote circular em corredeira — o mais molhado do complexo Universal, sem exagero.',
    notes: 'Gabi (112cm) passa. Encharca todo mundo, então é o primeiro bloco a cair se alguém estiver reclamando do frio do ar-condicionado. Poncho ajuda pouco aqui.',
    status: 'optional',
    planB: 'Se o grupo não topar molhar de novo, pular e usar os 20 min para o Camp Jurassic com calma mais tarde.',
    reminderMinutesBefore: 0,
  },

  // ---------- Skull Island e Jurassic Park ----------
  {
    order: 13, start: '15:55', end: '16:15', title: 'Skull Island: Reign of Kong',
    category: 'park', area: 'Skull Island', itemType: 'attraction', priority: 'A',
    minHeightCm: 91, lightningLane: 'express', lightningLaneRank: 7,
    description: 'Caminhão-simulador em meio a animatrônicos em tamanho real. Escuro, alto e com sustos reais.',
    notes: 'A Gabi passa na altura (91cm), mas 4 anos é a idade em que esta atração assusta de verdade. Decidir na entrada, olhando a fila temática — se ela travar ali, já é resposta.',
    planB: 'Se a Gabi recusar, ela e um adulto seguem direto para o Camp Jurassic (5 min adiante) e o grupo se reencontra na saída do Kong.',
    reminderMinutesBefore: 0,
  },
  {
    order: 14, start: '16:15', end: '16:45', title: 'Jurassic World VelociCoaster',
    category: 'park', area: 'Jurassic Park', itemType: 'attraction', priority: 'S',
    minHeightCm: 130, childSwitch: true, lightningLane: 'express', lightningLaneRank: 1,
    description: 'A melhor montanha-russa do complexo Universal e o pedido nº 1 da Débora desde o planejamento.',
    notes: 'Gabi (112cm) fora — terceira troca do dia, e a que mais compensa fazer com calma: a sala de Child Swap fica com vista para o lançamento. Nada solto nos bolsos; lockers gratuitos na entrada.',
    recommendedWindow: 'Meio da tarde, com luz para a vista do topo e antes da fila de fim de dia',
    reminderMinutesBefore: 20,
  },
  {
    order: 15, start: '16:45', end: '17:00', title: 'Raptor Encounter',
    category: 'park', area: 'Jurassic Park', itemType: 'character', priority: 'A',
    description: 'Encontro com o velociraptor Blue, com tratador em cena — o melhor bloco do dia para foto com a Gabi.',
    notes: 'Sem altura mínima e sem fila paga. O raptor avança na direção de quem se mexe: segurar a Gabi no colo na primeira aproximação.',
    reminderMinutesBefore: 0,
  },
  {
    order: 16, start: '17:00', end: '17:20', title: 'Camp Jurassic e Discovery Center',
    category: 'park', area: 'Jurassic Park', itemType: 'experience', priority: 'B',
    description: 'Playground temático em três níveis (redes, cavernas, canhões de água) e o centro de visitantes com o laboratório de DNA.',
    notes: 'Bloco de secagem e de folga entre o VelociCoaster e Hogsmeade — o Camp Jurassic é onde a Gabi gasta energia sem fila. O Pteranodon Flyers fica ao lado e a Gabi habilita um adulto (regra é 92-137cm), mas cobra 30-40 min de fila SEM Express por 1 min de voo: só se a espera estiver abaixo de 20 min.',
    status: 'optional', reminderMinutesBefore: 0,
  },

  // ---------- Hogsmeade: as últimas 2h40 ----------
  {
    order: 17, start: '17:20', end: '17:35', title: 'Travessia Jurassic Park → Hogsmeade',
    category: 'transit', area: 'Deslocamento',
    notes: 'A ponte de Jurassic Park cai direto no vilarejo — é a melhor entrada do parque, vale chegar olhando para o castelo e não para o celular.',
    reminderMinutesBefore: 10,
  },
  {
    order: 18, start: '17:35', end: '18:15', title: 'Jantar no Three Broomsticks + Butterbeer',
    category: 'restaurant', area: 'Hogsmeade',
    description: 'Quick service dentro do salão do Três Vassouras: frango assado, costela e shepherd\'s pie. O restaurante temático mais bem resolvido de Orlando.',
    notes: 'Mobile order pelo app ainda na travessia — às 17h35 o salão enche. Butterbeer gelada (não a frozen) se a fila da frozen estiver grande. ~US$ 90 para os 4. Jantar aqui elimina uma travessia inteira e entrega Hogsmeade iluminado para o resto da noite.',
    recommendedArrivalMinBefore: 10, timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 19, start: '18:15', end: '18:45', title: 'Harry Potter and the Forbidden Journey',
    category: 'park', area: 'Hogsmeade', itemType: 'attraction', priority: 'S',
    minHeightCm: 122, childSwitch: true, lightningLane: 'express', lightningLaneRank: 2,
    description: 'Braço robótico dentro do castelo de Hogwarts — e a fila atravessa a estufa, o escritório do Dumbledore e a sala dos retratos falantes.',
    notes: 'Gabi (112cm) fora — quarta e última troca do dia. Quem fizer o Child Swap deve pedir para percorrer a fila do castelo mesmo sem andar: ela vale por si só, e é a única parte que a Gabi pode ver.',
    reminderMinutesBefore: 0,
  },
  {
    order: 20, start: '18:45', end: '19:05', title: 'Flight of the Hippogriff',
    category: 'park', area: 'Hogsmeade', itemType: 'attraction', priority: 'A',
    minHeightCm: 91, lightningLane: 'express', lightningLaneRank: 9,
    description: 'Montanha-russa familiar que passa pela cabana do Hagrid e pelo Bicuço.',
    notes: 'A única de Hogsmeade em que a Gabi anda — e a compensação direta das três atrações que acabaram de barrá-la.',
    reminderMinutesBefore: 0,
  },
  {
    order: 21, start: '19:05', end: '19:30', title: 'Ollivanders, Honeydukes e Dervish & Banges',
    category: 'park', area: 'Hogsmeade', itemType: 'experience', priority: 'A',
    description: 'Cerimônia de escolha da varinha (uma criança por sessão), doces do Honeydukes e o vilarejo já sob a luz noturna.',
    notes: 'Conferir o horário da última sessão do Ollivanders ao entrar na loja — em noite de fechamento às 20h costuma ser por volta das 19h40. Varinha interativa ~US$ 65: decidir aqui, é o pedido recorrente da Débora, e ela volta a funcionar no Beco Diagonal no dia 16.',
    reminderMinutesBefore: 0,
  },
  {
    order: 22, start: '19:30', end: '20:10', title: "Hagrid's Magical Creatures Motorbike Adventure",
    category: 'park', area: 'Hogsmeade', itemType: 'attraction', priority: 'S',
    minHeightCm: 122,
    description: 'Única atração forte do parque que NÃO aceita Universal Express — por isso é o último bloco do dia.',
    notes: 'Entrar na fila até 19h50, com folga sobre o fechamento das 20h: quem já está na fila anda, mesmo depois de o parque fechar. Débora vai com um adulto; a Gabi fica com o outro nas lojas de Hogsmeade, que atendem ~30 min depois do fechamento, e todos se reencontram na saída do vilarejo.',
    planB: 'Se a fila do Hagrid\'s já estiver fechada (acontece quando a espera ultrapassa o horário do parque) ou se ele estiver em pane — o que é frequente —, a alternativa é o Hogwarts Express no dia 16, que devolve a família ao Hogsmeade; mas aí é sem Express e com o relógio do Halloween Horror Nights correndo.',
    recommendedWindow: 'Últimos 30 minutos antes do fechamento das 20h',
    reminderMinutesBefore: 15,
  },

  // ---------- Volta ----------
  {
    order: 23, start: '20:10', end: '20:45', title: 'Saída pelo Lost Continent e Port of Entry',
    category: 'transit', area: 'Deslocamento',
    location: "Universal's Islands of Adventure → Universal's Loews Royal Pacific Resort",
    notes: 'Caminho de saída passa pelo Lost Continent — parar 2 min na Mystic Fountain, a fonte que conversa com quem passa, é o melhor fecho de dia para a Gabi. Compras de última hora na Islands of Adventure Trading Co., no Port of Entry, que fica aberta depois do fechamento.',
    reminderMinutesBefore: 10,
  },
  {
    order: 24, start: '20:45', end: '21:30', title: 'Check-in do quarto, malas e preparação do dia 15',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    notes: 'Retirar as malas do Bell Services. Amanhã é Epic Universe com Early Park Admission às 9h e SEM Express — despertador às 7h, roupa e mochila separadas hoje à noite, e os cartões Express guardados fora da mala (eles voltam a valer no dia 16).',
    reminderMinutesBefore: 0,
  },
];

export const ISLANDS_OF_ADVENTURE_DIA_14_ITEMS = buildOperationalDay(
  {
    parkKey: 'ioa14',
    parkName: "Universal's Islands of Adventure",
    city: 'Orlando',
    date: '2026-09-14',
  },
  ROWS
);
