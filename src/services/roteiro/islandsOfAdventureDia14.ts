import { buildOperationalDay, type OperationalRow } from './shared';

/**
 * Universal's Islands of Adventure — 14/09/2026, dia operacional **de meio
 * período, com Universal Express Unlimited**.
 *
 * Este é o primeiro dia operacional do roteiro com fila paga. Os três dias
 * Disney (`epcotDia09.ts`, `animalKingdomDia11.ts`, `hollywoodStudiosDia12.ts`)
 * existiam justamente porque *não* havia Lightning Lane para reordenar o dia;
 * aqui o Express Unlimited vem incluso na diária do Loews Royal Pacific
 * (DEC-002, reserva 37654214702) e inverte a lógica: com fura-fila ilimitado,
 * a ordem dos blocos deixa de ser ditada por horário de menor fila e passa a
 * ser ditada por **geografia** — o que economiza a caminhada, não a espera.
 *
 * Quatro premissas moldam o dia:
 *
 * 1. **Começa às 12h, do hotel antigo.** A família está atrasada no
 *    Celebration Suites (Kissimmee) e o check-in do Royal Pacific é só às 16h.
 *    O bloco crítico do dia não é uma atração: é o balcão do Royal Pacific.
 *    O Express Unlimited é entregue no registro, junto com as chaves — sem
 *    passar lá primeiro, o resto do roteiro não existe. Dá para registrar
 *    antes das 16h e deixar as malas no Bell Services; o Express vale o dia
 *    inteiro do check-in.
 * 2. **Express Unlimited não vale para tudo.** Hagrid's Magical Creatures
 *    Motorbike Adventure e Pteranodon Flyers não aceitam Express. Hagrid's é
 *    a melhor montanha-russa do parque e a única que ainda exige estratégia
 *    de fila — por isso é o **último** bloco do dia: quem entra na fila antes
 *    do fechamento anda, mesmo que o parque feche no meio da espera.
 * 3. **14/09 (segunda) não é noite de Halloween Horror Nights.** As datas de
 *    setembro do HHN são 2-6, 9-13, 16-20, 23-27 e 30. Sem HHN, o Islands of
 *    Adventure tende a fechar mais cedo (18h ou 19h) do que nas noites de
 *    evento — daí o `planB` nos três últimos blocos.
 * 4. **Gabi tem 112cm.** Fica de fora de Hulk (137cm), Doctor Doom (132cm),
 *    VelociCoaster (130cm), Hagrid's e Forbidden Journey (122cm) — cinco das
 *    seis atrações mais fortes do parque. Com Express Unlimited o Child Swap
 *    fica barato (a sala de troca é na própria plataforma de embarque), mas o
 *    dia precisa dar a ela algo próprio: Seuss Landing entra logo na entrada,
 *    e a espera do Hagrid's vira o passeio dela pelo Seuss com o outro adulto.
 *
 * Jurassic Park River Adventure não entra: fechamento programado de 05/01 a
 * 19/11/2026 (ver `islandsOfAdventure.ts`).
 *
 * `reminderMinutesBefore: 0` desliga o aviso do item, mesma regra dos dias
 * anteriores — só 6 momentos de decisão avisam.
 */
const ROWS: OperationalRow[] = [
  // ---------- Celebration Suites → Royal Pacific ----------
  {
    order: 1, start: '12:00', end: '12:25', title: 'Check-out do Celebration Suites e carga do carro',
    category: 'rest', area: 'Hotel', city: 'Kissimmee', location: 'Celebration Suites',
    notes: 'Já passou do horário de check-out: avisar a recepção, pagar a taxa de late check-out se houver e sair. Varrer gavetas, cofre e carregadores antes de fechar a porta.',
    reminderMinutesBefore: 0,
  },
  {
    order: 2, start: '12:25', end: '13:05', title: 'Kissimmee → Loews Royal Pacific Resort',
    category: 'transit', area: 'Deslocamento', city: 'Kissimmee → Orlando',
    location: "Celebration Suites → Universal's Loews Royal Pacific Resort",
    notes: 'I-4 sentido norte, saída 74/75. ~35 min sem trânsito. Reserva 37654214702.',
    reminderMinutesBefore: 10,
  },
  {
    order: 3, start: '13:05', end: '13:45', title: 'Registro no Royal Pacific e retirada do Express Unlimited',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    description: 'O bloco mais importante do dia. O Universal Express Unlimited dos 4 hóspedes é entregue no balcão, junto com as chaves — é o que sustenta os dias 14 e 16.',
    notes: 'Check-in do quarto é às 16h, mas dá para registrar agora: pedir os cartões Express Unlimited e deixar as malas no Bell Services. Conferir se saíram 4 cartões e se valem para hoje e para 16/09 (dia do check-out).',
    planB: 'Se o balcão se recusar a emitir o Express antes das 16h, insistir com o gerente de plantão — o benefício é do dia de chegada. Sem isso, o dia inteiro muda: ir para o Seuss Landing e o Hogsmeade primeiro e deixar as filas grandes para o dia 16.',
    timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 4, start: '13:45', end: '14:05', title: 'Almoço rápido no hotel (grab-and-go)',
    category: 'restaurant', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    notes: 'Orchid Court / Tuk Tuk Market. Comer aqui em vez de dentro do parque salva ~30 min de uma tarde que já é curta. ~US$ 45 para os 4.',
    reminderMinutesBefore: 0,
  },
  {
    order: 5, start: '14:05', end: '14:25', title: 'Royal Pacific → Islands of Adventure',
    category: 'transit', area: 'Deslocamento',
    location: "Universal's Loews Royal Pacific Resort → Universal's Islands of Adventure",
    notes: 'Water taxi (sai na doca do hotel) ou caminhada pela trilha até o CityWalk — os dois dão ~12 min. Com carrinho da Gabi, a caminhada é mais previsível que a fila do barco.',
    reminderMinutesBefore: 10,
  },
  {
    order: 6, start: '14:25', end: '14:35', title: 'Entrada e segurança',
    category: 'transit', area: 'Entrada', location: "Universal's Islands of Adventure",
    notes: 'Ingresso Park-to-Park no app Universal Orlando Resort. Deixar o Express Unlimited na mesma carteira digital.',
    reminderMinutesBefore: 0,
  },

  // ---------- Seuss Landing: o pedaço da Gabi, logo na entrada ----------
  {
    order: 7, start: '14:35', end: '15:05', title: 'Seuss Landing — Caro-Seuss-el, One Fish Two Fish e Trolley Train',
    category: 'park', area: 'Seuss Landing', itemType: 'attraction', priority: 'B',
    minHeightCm: 91,
    description: 'Três atrações leves em sequência, todas dentro da altura da Gabi (91cm). Fica logo à direita do Port of Entry.',
    notes: 'A área é o oposto do resto do dia: nada aqui tem fila longa à tarde. É o único bloco em que a Gabi lidera.',
    reminderMinutesBefore: 0,
  },

  // ---------- Marvel e Toon Lagoon: Express Unlimited ----------
  {
    order: 8, start: '15:05', end: '15:30', title: 'The Amazing Adventures of Spider-Man',
    category: 'park', area: 'Marvel Super Hero Island', itemType: 'attraction', priority: 'S',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 3,
    notes: 'Toda a família anda junto — é a atração forte de maior alcance do dia (102cm).',
    reminderMinutesBefore: 0,
  },
  {
    order: 9, start: '15:30', end: '15:55', title: 'The Incredible Hulk Coaster',
    category: 'park', area: 'Marvel Super Hero Island', itemType: 'attraction', priority: 'S',
    minHeightCm: 137, childSwitch: true, lightningLane: 'express', lightningLaneRank: 4,
    notes: 'Gabi (112cm) fica de fora. Child Swap na própria plataforma: Débora anda com um adulto, troca, o outro anda em seguida — com Express isso custa ~10 min, não uma fila inteira.',
    reminderMinutesBefore: 0,
  },
  {
    order: 10, start: '15:55', end: '16:20', title: "Dudley Do-Right's Ripsaw Falls",
    category: 'park', area: 'Toon Lagoon', itemType: 'attraction', priority: 'A',
    minHeightCm: 112, lightningLane: 'express', lightningLaneRank: 5,
    description: 'Queda de 15m em tronco. Molha de verdade — não é respingo.',
    notes: 'Barra de 44in = 111,8cm: a Gabi passa por 2mm, com tênis. Medir na entrada antes de entrar na fila. Poncho ou locker para celulares e a mochila.',
    planB: 'Se a Gabi não passar na medição, ela e um adulto seguem para Me Ship, the Olive (sem altura mínima, ao lado) e o grupo se reencontra na saída.',
    reminderMinutesBefore: 0,
  },

  // ---------- Jurassic Park ----------
  {
    order: 11, start: '16:20', end: '16:50', title: 'Jurassic World VelociCoaster',
    category: 'park', area: 'Jurassic Park', itemType: 'attraction', priority: 'S',
    minHeightCm: 130, childSwitch: true, lightningLane: 'express', lightningLaneRank: 1,
    description: 'A melhor montanha-russa do complexo Universal e o pedido nº 1 da Débora desde o planejamento.',
    notes: 'Gabi (112cm) fica de fora — Child Swap. Bolsos vazios: nada solto é permitido, há lockers gratuitos na entrada.',
    recommendedWindow: 'Antes do jantar, enquanto ainda há luz para a vista do topo',
    reminderMinutesBefore: 20,
  },
  {
    order: 12, start: '16:50', end: '17:10', title: 'Raptor Encounter',
    category: 'park', area: 'Jurassic Park', itemType: 'character', priority: 'A',
    notes: 'Sem altura mínima e sem fila paga — encontro com o velociraptor, o melhor bloco do dia para foto com a Gabi.',
    reminderMinutesBefore: 0,
  },
  {
    order: 13, start: '17:10', end: '17:55', title: 'Jantar antecipado — Thunder Falls Terrace',
    category: 'restaurant', area: 'Jurassic Park',
    description: 'Quick service com churrasco e frango grelhado, salão amplo e climatizado, vista para a queda do River Adventure.',
    notes: 'Mobile order pelo app antes de sair do Raptor Encounter. Jantar às 17h parece cedo, mas libera as últimas 2h para Hogsmeade e Hagrid\'s. ~US$ 80 para os 4.',
    recommendedArrivalMinBefore: 10, timeIsEstimated: false, reminderMinutesBefore: 15,
  },

  // ---------- Hogsmeade no fim da tarde ----------
  {
    order: 14, start: '17:55', end: '18:10', title: 'Travessia Jurassic Park → Hogsmeade',
    category: 'transit', area: 'Deslocamento',
    notes: 'A ponte de Jurassic Park cai direto no Hogsmeade — melhor entrada do parque, vale chegar olhando para o castelo.',
    reminderMinutesBefore: 10,
  },
  {
    order: 15, start: '18:10', end: '18:40', title: 'Harry Potter and the Forbidden Journey',
    category: 'park', area: 'Hogsmeade', itemType: 'attraction', priority: 'S',
    minHeightCm: 122, childSwitch: true, lightningLane: 'express', lightningLaneRank: 2,
    notes: 'Gabi (112cm) fica de fora — Child Swap. A fila atravessa o interior do castelo de Hogwarts e vale por si só: quem faz o Child Swap deve pedir para percorrer a fila mesmo sem andar.',
    reminderMinutesBefore: 0,
  },
  {
    order: 16, start: '18:40', end: '19:00', title: 'Flight of the Hippogriff',
    category: 'park', area: 'Hogsmeade', itemType: 'attraction', priority: 'A',
    minHeightCm: 91, lightningLane: 'express', lightningLaneRank: 6,
    notes: 'Montanha-russa infantil — a única de Hogsmeade em que a Gabi anda. Passa pela cabana do Hagrid.',
    reminderMinutesBefore: 0,
  },
  {
    order: 17, start: '19:00', end: '19:25', title: 'Hogsmeade — Butterbeer, Ollivanders e lojas',
    category: 'park', area: 'Hogsmeade', itemType: 'experience', priority: 'A',
    description: 'Ollivanders (escolha da varinha), Honeydukes e Dervish & Banges, com o vilarejo já iluminado.',
    notes: 'Butterbeer gelada, não a frozen, se a fila da frozen estiver grande. Varinha interativa (~US$ 65) aciona as vitrines do vilarejo — decidir aqui, é o pedido recorrente da Débora.',
    reminderMinutesBefore: 0,
  },
  {
    order: 18, start: '19:25', end: '20:05', title: "Hagrid's Magical Creatures Motorbike Adventure",
    category: 'park', area: 'Hogsmeade', itemType: 'attraction', priority: 'S',
    minHeightCm: 122,
    description: 'Única atração forte do parque que NÃO aceita Universal Express — por isso é a última do dia.',
    notes: 'Entrar na fila antes do fechamento: quem já está na fila anda, mesmo que o parque feche. Débora vai com um adulto; o outro leva a Gabi de volta ao Seuss Landing (10 min a pé) e todos se reencontram no Port of Entry.',
    planB: 'Se o parque fechar às 18h ou 19h hoje (segunda não é noite de Halloween Horror Nights), este bloco cai e a família sai depois do Hogsmeade — o Hagrid\'s então só é possível voltando de Hogwarts Express no dia 16.',
    recommendedWindow: 'Últimos 30 minutos antes do fechamento',
    reminderMinutesBefore: 15,
  },

  // ---------- Volta ----------
  {
    order: 19, start: '20:05', end: '20:35', title: 'Saída do parque e retorno ao Royal Pacific',
    category: 'transit', area: 'Deslocamento',
    location: "Universal's Islands of Adventure → Universal's Loews Royal Pacific Resort",
    notes: 'Water taxi encerra pouco depois do fechamento do parque — se já tiver parado, a trilha a pé leva ~15 min e é iluminada.',
    reminderMinutesBefore: 0,
  },
  {
    order: 20, start: '20:35', end: '21:15', title: 'Check-in do quarto, malas e ceia leve',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    notes: 'Retirar as malas do Bell Services. Amanhã é Epic Universe com Early Park Admission às 9h — separar roupa e mochila hoje à noite.',
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
