import { buildOperationalDay, type OperationalRow } from './shared';

/**
 * Universal's Islands of Adventure — 14/09/2026, dia operacional **replanejado
 * no balcão do Royal Pacific, às 11h55, com Universal Express Unlimited e
 * Child Swap**.
 *
 * Terceira versão do dia. A primeira supunha saída do Celebration Suites ao
 * meio-dia e entrada no parque às 14h25; a segunda remontou o dia a partir das
 * 11h, com a família ainda no hotel antigo. Esta parte do fato de a família
 * **já estar no Royal Pacific às 11h52** — o check-out e a estrada saíram
 * adiantados e estão marcados como `completed`, não apagados: o dia mantém o
 * próprio histórico.
 *
 * O ganho real não vem dos 10 min de adiantamento. Vem de **paralelizar o
 * balcão com o almoço**: em vez de 35 min de registro seguidos de 25 min de
 * grab-and-go, um adulto fica na fila do check-in e o outro leva as meninas ao
 * Tuk Tuk Market ao mesmo tempo. Os dois blocos viram um de 35 min, e a
 * entrada no parque cai de 13h35 para **13h** — 7h de parque, contra as ~4h
 * do plano original.
 *
 * Os 35 min recuperados foram gastos em duas coisas, nesta ordem de
 * prioridade: o Seuss Trolley Train entra no bloco de abertura (a Gabi ganha
 * quatro atrações próprias em vez de três) e **abre-se uma pausa real de 20
 * min depois dos dois blocos molhados**. Uma criança de 4 anos das 13h às
 * 20h15 sem intervalo é o jeito mais confiável de perder Hogsmeade às 18h.
 *
 * Cinco fatos externos desenham o dia:
 *
 * 1. **O parque fecha às 20h hoje** (segunda, 9h–20h). A primeira versão
 *    trabalhava com 18h/19h e por isso encurtava Hogsmeade. Com 20h, cabe o
 *    Islands of Adventure inteiro.
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
 * Broomsticks (Hogsmeade): com o parque aberto até 20h, jantar às 17h30 dentro
 * do vilarejo elimina uma travessia inteira e põe a família em Hogsmeade para
 * as últimas 2h30 do dia, que é onde está o material mais forte que sobra.
 *
 * **Quarta versão, ao vivo dentro do parque:** Hulk e Doctor Doom saíram antes
 * do Homem-Aranha — a família chegou ao Marvel e foi direto nas duas que barram
 * a Gabi. Os blocos cumpridos viram `completed` com o horário real, e o
 * Homem-Aranha assume o lugar deles em vez de ser dado como perdido: ele é a
 * única das três em que os 4 andam juntos, e é a recompensa da Gabi depois de
 * duas trocas seguidas. Nada depois das 14h40 se move — o Ripsaw Falls continua
 * abrindo o Toon Lagoon no mesmo horário.
 *
 * `reminderMinutesBefore: 0` desliga o aviso do item — só 7 momentos de
 * decisão avisam.
 */
const ROWS: OperationalRow[] = [
  // ---------- Já feito: Celebration Suites → Royal Pacific ----------
  {
    order: 1, start: '11:00', end: '11:25', title: 'Check-out do Celebration Suites e carga do carro',
    category: 'rest', area: 'Hotel', city: 'Kissimmee', location: 'Celebration Suites',
    status: 'completed',
    description: 'Feito. Fica no roteiro como histórico do dia — apagar blocos cumpridos esconde o que a família já gastou de relógio.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },
  {
    order: 2, start: '11:25', end: '11:55', title: 'Kissimmee → Loews Royal Pacific Resort',
    category: 'transit', area: 'Deslocamento', city: 'Kissimmee → Orlando',
    location: "Celebration Suites → Universal's Loews Royal Pacific Resort",
    status: 'completed',
    description: 'Feito, com ~10 min de adiantamento sobre o plano. Reserva 37654214702.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },

  // ---------- Agora: o balcão e o almoço, em paralelo ----------
  {
    order: 3, start: '11:55', end: '12:30',
    title: 'Registro no Royal Pacific + Express Unlimited (com o almoço em paralelo)',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    description: 'O bloco mais importante do dia. O Universal Express Unlimited dos 4 hóspedes é entregue no balcão, junto com as chaves — é o que sustenta os dias 14 e 16.',
    notes: 'DIVIDIR: um adulto fica na fila do balcão, o outro leva as meninas ao Tuk Tuk Market e compra o almoço para levar (~US$ 45). Fazer em série custaria 60 min; em paralelo custa 35, e são esses 35 min que compram a entrada no parque às 13h em vez de 13h35. No balcão: pedir os 4 cartões Express, conferir que valem HOJE e em 16/09 (dia do check-out), e deixar as malas no Bell Services — o quarto só libera às 16h.',
    status: 'completed',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },
  {
    order: 4, start: '12:30', end: '12:50', title: 'Royal Pacific → Islands of Adventure',
    category: 'transit', area: 'Deslocamento',
    location: "Universal's Loews Royal Pacific Resort → Universal's Islands of Adventure",
    status: 'completed',
    notes: 'Water taxi na doca do hotel ou a trilha a pé até o CityWalk — os dois dão ~12 min. Comer o grab-and-go no caminho ou nos bancos do Port of Entry.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },
  {
    order: 5, start: '12:50', end: '13:00', title: 'Entrada, segurança e conferência do horário de fechamento',
    category: 'transit', area: 'Entrada', location: "Universal's Islands of Adventure",
    description: 'Ingresso Park-to-Park no app Universal Orlando Resort, com os cartões Express na mesma carteira digital.',
    status: 'completed',
    notes: 'CONFERIR AINDA o fechamento de hoje no app (previsto 20h) — é o número que decide a hora de entrar na fila do Hagrid\'s. Anotar também o horário das sessões do Ollivanders.',
    planB: 'Se o fechamento for antes das 20h, cortar o bloco do Camp Jurassic e antecipar o jantar em 30 min: tudo depois dele desliza junto e o Hagrid\'s continua sendo o último.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },

  // ---------- Seuss Landing: o pedaço da Gabi, logo na entrada ----------
  {
    order: 6, start: '13:00', end: '13:35',
    title: 'Seuss Landing — Caro-Seuss-el, One Fish Two Fish, The Cat in the Hat e Trolley Train',
    category: 'park', area: 'Seuss Landing', itemType: 'attraction', priority: 'B',
    minHeightCm: 91, lightningLane: 'express', lightningLaneRank: 10,
    status: 'completed',
    description: 'Quatro atrações leves em sequência, todas dentro da altura da Gabi (91cm), a 5 min do Port of Entry.',
    notes: 'Marcado como feito junto com o Hulk e o Doctor Doom. SE ficou para trás na pressa de chegar ao Marvel, a recuperação já existe no fim do dia: o Seuss fica a 8 min de Hogsmeade, e é exatamente para lá que a Gabi vai com um adulto enquanto a Débora anda no Hagrid\'s às 19h25.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },

  // ---------- Marvel Super Hero Island ----------
  {
    order: 7, start: '13:35', end: '14:00', title: 'The Incredible Hulk Coaster',
    category: 'park', area: 'Marvel Super Hero Island', itemType: 'attraction', priority: 'S',
    minHeightCm: 137, childSwitch: true, lightningLane: 'express', lightningLaneRank: 4,
    status: 'completed',
    description: 'Feito. Primeira das quatro trocas do dia — Gabi (112cm) ficou de fora.',
    notes: 'Gabi (112cm) fica de fora. Child Swap na plataforma, ~10 min de custo com Express.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },
  {
    order: 8, start: '14:00', end: '14:20', title: "Doctor Doom's Fearfall",
    category: 'park', area: 'Marvel Super Hero Island', itemType: 'attraction', priority: 'A',
    minHeightCm: 132, childSwitch: true, lightningLane: 'express', lightningLaneRank: 8,
    status: 'completed',
    description: 'Feito. Segunda troca do dia.',
    notes: 'Gabi (112cm) fora, Child Swap. Se o Storm Force Accelatron e o encontro dos heróis Marvel não saíram durante a troca, eles ficam aqui ao lado — 10 min, sem fila, e valem a volta se sobrar tempo antes do Toon Lagoon.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },

  // ---------- AGORA ----------
  {
    order: 9, start: '14:20', end: '14:40', title: 'The Amazing Adventures of Spider-Man',
    category: 'park', area: 'Marvel Super Hero Island', itemType: 'attraction', priority: 'S',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 3,
    description: 'Simulador 3D sobre trilho — a atração forte de maior alcance do dia, e a primeira em que os 4 andam juntos.',
    notes: 'Bloco de agora. Saiu da frente do Hulk e do Doctor Doom para o lugar deles: a família chegou ao Marvel e foi direto nas duas que barram a Gabi, então o Homem-Aranha vira a recompensa dela logo depois das duas trocas seguidas. Ainda dentro do Marvel — nenhuma caminhada extra.',
    reminderMinutesBefore: 0,
  },

  // ---------- Toon Lagoon: os dois blocos molhados, no pico do calor ----------
  {
    order: 10, start: '14:40', end: '15:05', title: "Dudley Do-Right's Ripsaw Falls",
    category: 'park', area: 'Toon Lagoon', itemType: 'attraction', priority: 'A',
    minHeightCm: 112, lightningLane: 'express', lightningLaneRank: 5,
    description: 'Queda de 15m em tronco. Molha de verdade — não é respingo.',
    notes: 'Barra de 44in = 111,8cm: a Gabi passa por 2mm, de tênis. Medir na entrada ANTES de entrar na fila, para não descobrir na plataforma. Celulares e a mochila no locker, não no colo. É o pico do calor do dia — é agora que os dois blocos molhados fazem sentido.',
    planB: 'Se ela não passar na medição, ela e um adulto vão ao Me Ship, the Olive (sem altura mínima, ao lado, com canhões de água) e o grupo se reencontra na saída do tronco.',
    reminderMinutesBefore: 0,
  },
  {
    order: 11, start: '15:05', end: '15:25', title: "Popeye & Bluto's Bilge-Rat Barges",
    category: 'park', area: 'Toon Lagoon', itemType: 'attraction', priority: 'A',
    minHeightCm: 107, lightningLane: 'express', lightningLaneRank: 6,
    description: 'Bote circular em corredeira — o mais molhado do complexo Universal, sem exagero.',
    notes: 'Gabi (112cm) passa. Encharca todo mundo, então é o primeiro bloco a cair se alguém estiver reclamando do frio do ar-condicionado. Poncho ajuda pouco aqui.',
    status: 'optional',
    planB: 'Se o grupo não topar molhar de novo, pular e alongar a pausa seguinte para 40 min.',
    reminderMinutesBefore: 0,
  },
  {
    order: 12, start: '15:25', end: '15:45', title: 'Pausa — secar, banheiro e sorvete',
    category: 'rest', area: 'Toon Lagoon',
    description: 'Bloco novo, comprado com os 35 min ganhos no balcão do hotel.',
    notes: 'Não é folga: é o que segura a Gabi (4 anos) de pé até as 20h. Banheiro, troca de camiseta, garrafas cheias e protetor solar. Se o dia estourar o relógio, este bloco encolhe antes de qualquer atração.',
    reminderMinutesBefore: 0,
  },

  // ---------- Skull Island e Jurassic Park ----------
  {
    order: 13, start: '15:45', end: '16:05', title: 'Skull Island: Reign of Kong',
    category: 'park', area: 'Skull Island', itemType: 'attraction', priority: 'A',
    minHeightCm: 91, lightningLane: 'express', lightningLaneRank: 7,
    description: 'Caminhão-simulador em meio a animatrônicos em tamanho real. Escuro, alto e com sustos reais.',
    notes: 'A Gabi passa na altura (91cm), mas 4 anos é a idade em que esta atração assusta de verdade. Decidir na entrada, olhando a fila temática — se ela travar ali, já é resposta.',
    planB: 'Se a Gabi recusar, ela e um adulto seguem direto para o Camp Jurassic (5 min adiante) e o grupo se reencontra na saída do Kong.',
    reminderMinutesBefore: 0,
  },
  {
    order: 14, start: '16:05', end: '16:35', title: 'Jurassic World VelociCoaster',
    category: 'park', area: 'Jurassic Park', itemType: 'attraction', priority: 'S',
    minHeightCm: 130, childSwitch: true, lightningLane: 'express', lightningLaneRank: 1,
    description: 'A melhor montanha-russa do complexo Universal e o pedido nº 1 da Débora desde o planejamento.',
    notes: 'Gabi (112cm) fora — terceira troca do dia, e a que mais compensa fazer com calma: a sala de Child Swap fica com vista para o lançamento. Nada solto nos bolsos; lockers gratuitos na entrada.',
    recommendedWindow: 'Meio da tarde, com luz para a vista do topo e antes da fila de fim de dia',
    reminderMinutesBefore: 20,
  },
  {
    order: 15, start: '16:35', end: '16:50', title: 'Raptor Encounter',
    category: 'park', area: 'Jurassic Park', itemType: 'character', priority: 'A',
    description: 'Encontro com o velociraptor Blue, com tratador em cena — o melhor bloco do dia para foto com a Gabi.',
    notes: 'Sem altura mínima e sem fila paga. O raptor avança na direção de quem se mexe: segurar a Gabi no colo na primeira aproximação.',
    reminderMinutesBefore: 0,
  },
  {
    order: 16, start: '16:50', end: '17:15', title: 'Camp Jurassic e Discovery Center',
    category: 'park', area: 'Jurassic Park', itemType: 'experience', priority: 'B',
    description: 'Playground temático em três níveis (redes, cavernas, canhões de água) e o centro de visitantes com o laboratório de DNA.',
    notes: 'Onde a Gabi gasta energia sem fila, antes das 2h30 finais em Hogsmeade. O Pteranodon Flyers fica ao lado e a Gabi habilita um adulto (a regra é 92-137cm), mas cobra 30-40 min de fila SEM Express por 1 min de voo: só se a espera estiver abaixo de 20 min.',
    status: 'optional', reminderMinutesBefore: 0,
  },

  // ---------- Hogsmeade: as últimas 2h50 ----------
  {
    order: 17, start: '17:15', end: '17:30', title: 'Travessia Jurassic Park → Hogsmeade',
    category: 'transit', area: 'Deslocamento',
    notes: 'A ponte de Jurassic Park cai direto no vilarejo — é a melhor entrada do parque, vale chegar olhando para o castelo e não para o celular.',
    reminderMinutesBefore: 10,
  },
  {
    order: 18, start: '17:30', end: '18:10', title: 'Jantar no Three Broomsticks + Butterbeer',
    category: 'restaurant', area: 'Hogsmeade',
    description: 'Quick service dentro do salão do Três Vassouras: frango assado, costela e shepherd\'s pie. O restaurante temático mais bem resolvido de Orlando.',
    notes: 'Mobile order pelo app ainda na travessia — às 17h30 o salão enche. Butterbeer gelada (não a frozen) se a fila da frozen estiver grande. ~US$ 90 para os 4. Jantar aqui elimina uma travessia inteira e entrega Hogsmeade iluminado para o resto da noite.',
    recommendedArrivalMinBefore: 10, timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 19, start: '18:10', end: '18:40', title: 'Harry Potter and the Forbidden Journey',
    category: 'park', area: 'Hogsmeade', itemType: 'attraction', priority: 'S',
    minHeightCm: 122, childSwitch: true, lightningLane: 'express', lightningLaneRank: 2,
    description: 'Braço robótico dentro do castelo de Hogwarts — e a fila atravessa a estufa, o escritório do Dumbledore e a sala dos retratos falantes.',
    notes: 'Gabi (112cm) fora — quarta e última troca do dia. Quem fizer o Child Swap deve pedir para percorrer a fila do castelo mesmo sem andar: ela vale por si só, e é a única parte que a Gabi pode ver.',
    reminderMinutesBefore: 0,
  },
  {
    order: 20, start: '18:40', end: '19:00', title: 'Flight of the Hippogriff',
    category: 'park', area: 'Hogsmeade', itemType: 'attraction', priority: 'A',
    minHeightCm: 91, lightningLane: 'express', lightningLaneRank: 9,
    description: 'Montanha-russa familiar que passa pela cabana do Hagrid e pelo Bicuço.',
    notes: 'A única de Hogsmeade em que a Gabi anda — e a compensação direta das três atrações que acabaram de barrá-la.',
    reminderMinutesBefore: 0,
  },
  {
    order: 21, start: '19:00', end: '19:25', title: 'Ollivanders, Honeydukes e Dervish & Banges',
    category: 'park', area: 'Hogsmeade', itemType: 'experience', priority: 'A',
    description: 'Cerimônia de escolha da varinha (uma criança por sessão), doces do Honeydukes e o vilarejo já sob a luz noturna.',
    notes: 'Conferir o horário da última sessão do Ollivanders ao entrar na loja — em noite de fechamento às 20h costuma ser por volta das 19h40. Varinha interativa ~US$ 65: decidir aqui, é o pedido recorrente da Débora, e ela volta a funcionar no Beco Diagonal no dia 16.',
    reminderMinutesBefore: 0,
  },
  {
    order: 22, start: '19:25', end: '20:05', title: "Hagrid's Magical Creatures Motorbike Adventure",
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
    order: 23, start: '20:05', end: '20:40', title: 'Saída pelo Lost Continent e Port of Entry',
    category: 'transit', area: 'Deslocamento',
    location: "Universal's Islands of Adventure → Universal's Loews Royal Pacific Resort",
    notes: 'Caminho de saída passa pelo Lost Continent — parar 2 min na Mystic Fountain, a fonte que conversa com quem passa, é o melhor fecho de dia para a Gabi. Compras de última hora na Islands of Adventure Trading Co., no Port of Entry, que fica aberta depois do fechamento.',
    reminderMinutesBefore: 10,
  },
  {
    order: 24, start: '20:40', end: '21:20', title: 'Check-in do quarto, malas e preparação do dia 15',
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
