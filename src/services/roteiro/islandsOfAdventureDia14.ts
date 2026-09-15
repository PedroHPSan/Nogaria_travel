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
 * **Quinta versão, dia interrompido no Toon Lagoon:** a família precisou
 * deixar o parque por um imprevisto logo depois do Ripsaw Falls (15h05) e não
 * conseguiu voltar — o dia para de vez aqui, em vez de manter o resto do
 * plano como se fosse acontecer. Ripsaw Falls e tudo antes dele viram
 * `completed`; nada depois disso é reagendado dentro do próprio 14/09, porque
 * não há mais parque hoje para reagendar.
 *
 * A pergunta real não é "o que fazer à tarde" — é o que fazer com o resto do
 * Islands of Adventure que ficou pra trás: Popeye & Bluto's Bilge-Rat Barges,
 * Skull Island: Reign of Kong, Camp Jurassic, Flight of the Hippogriff,
 * Ollivanders/Honeydukes de Hogsmeade e o passeio final pelo Lost Continent.
 * Três atrações fortes viram resgate deliberado no dia 16
 * (`universalStudiosDia16.ts`, bloco "Hogsmeade & Jurassic Park de resgate"):
 * Harry Potter and the Forbidden Journey, Hagrid's Magical Creatures
 * Motorbike Adventure e Jurassic World VelociCoaster — nessa ordem de
 * prioridade, porque o VelociCoaster é o pedido nº1 da Débora e o Hagrid's é a
 * melhor montanha-russa do parque, mas os dois cabem no Hogwarts Express desde
 * que o Forbidden Journey (rápido, com Express) abra caminho. As demais —
 * Bilge-Rat Barges, Reign of Kong, Camp Jurassic, Hippogriff e o Ollivanders
 * de Hogsmeade — ficam de fora da viagem: o dia 16 já é um dia de embarque
 * para Miami com deadline duro (Halloween Horror Nights às 17h), e a Débora
 * tem sua própria versão do Ollivanders no Beco Diagonal no mesmo dia. Não é
 * negação do que se perdeu — é a mesma disciplina do resto do roteiro, que
 * corta o B/C antes de arriscar o S.
 *
 * `reminderMinutesBefore: 0` desliga o aviso do item — só 5 momentos de
 * decisão avisam nesta versão (o dia encolheu junto com os blocos).
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

  // ---------- Último bloco cumprido ----------
  {
    order: 9, start: '14:20', end: '14:40', title: 'The Amazing Adventures of Spider-Man',
    category: 'park', area: 'Marvel Super Hero Island', itemType: 'attraction', priority: 'S',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 3,
    description: 'Simulador 3D sobre trilho — a atração forte de maior alcance do dia, e a primeira em que os 4 andam juntos.',
    notes: 'Feito. Saiu da frente do Hulk e do Doctor Doom para o lugar deles: a família chegou ao Marvel e foi direto nas duas que barram a Gabi, então o Homem-Aranha virou a recompensa dela logo depois das duas trocas seguidas.',
    status: 'completed',
    reminderMinutesBefore: 0,
  },
  {
    order: 10, start: '14:40', end: '15:05', title: "Dudley Do-Right's Ripsaw Falls",
    category: 'park', area: 'Toon Lagoon', itemType: 'attraction', priority: 'A',
    minHeightCm: 112, lightningLane: 'express', lightningLaneRank: 5,
    description: 'Queda de 15m em tronco. Molha de verdade — não é respingo.',
    notes: 'Feito — última atração do dia. Barra de 44in = 111,8cm: a Gabi passou por 2mm, de tênis.',
    status: 'completed',
    reminderMinutesBefore: 0,
  },

  // ---------- Saída por imprevisto ----------
  {
    order: 11, start: '15:05', end: '15:40', title: 'Saída do parque por imprevisto e volta ao Royal Pacific',
    category: 'transit', area: 'Deslocamento',
    location: "Universal's Islands of Adventure → Universal's Loews Royal Pacific Resort",
    description: 'O dia parou aqui: a família precisou deixar o Islands of Adventure logo depois do Ripsaw Falls e não conseguiu voltar hoje.',
    notes: 'Water taxi ou trilha a pé de volta ao hotel, ~12 min. Os cartões Express Unlimited dos 4 continuam valendo no dia 16 (DEC-002/37654214702) — nada se perde por não terem sido usados hoje.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },
  {
    order: 12, start: '15:40', end: '16:00', title: 'Check-in do quarto e malas do Bell Services',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    description: 'O quarto libera às 16h — a saída antecipada do parque coincide quase exatamente com o horário normal de check-in.',
    notes: 'Retirar as malas deixadas no Bell Services pela manhã.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },
  {
    order: 13, start: '16:00', end: '18:30', title: 'Tarde livre no resort — piscina e Wantilan Luau (se houver vaga)',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    description: 'A tarde que ninguém planejou vira folga de verdade em vez de tempo perdido: piscina com tobogã, praia artificial e lazy river do Royal Pacific.',
    notes: 'Vale ligar para a recepção perguntando se há mesa no Wantilan Luau desta noite (luau havaiano com jantar, às quintas e domingos normalmente — conferir o dia de hoje) como alternativa ao jantar simples. Gabi (4 anos) se beneficia mais de um fim de tarde parado do que de mais estímulo.',
    status: 'optional', reminderMinutesBefore: 0,
  },
  {
    order: 14, start: '18:30', end: '19:30', title: 'Jantar — Bahama Breeze ou Jake\'s American Bar no CityWalk',
    category: 'restaurant', area: 'CityWalk',
    description: 'O Three Broomsticks ficou para trás com o resto de Hogsmeade — CityWalk fica a 10 min a pé do hotel e cobre o jantar sem exigir outro deslocamento de carro.',
    notes: 'Mobile order não se aplica fora dos parques; reservar pelo app do Universal Orlando Resort ou chegar sem fila por volta das 18h30. Butterbeer não está disponível fora dos parques.',
    recommendedArrivalMinBefore: 10, reminderMinutesBefore: 15,
  },
  {
    order: 15, start: '19:30', end: '20:30', title: 'Malas, roupas e preparação do dia 15',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    notes: 'Amanhã é Epic Universe com Early Park Admission às 9h e SEM Express — despertador às 7h, roupa e mochila separadas hoje à noite, e os cartões Express guardados fora da mala (eles voltam a valer no dia 16, no Universal Studios/Islands of Adventure).',
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
