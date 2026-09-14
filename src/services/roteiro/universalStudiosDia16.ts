import { buildOperationalDay, type OperationalRow } from './shared';

/**
 * Universal Studios Florida — 16/09/2026, dia operacional **com Express
 * Unlimited, Early Park Admission e fechamento às 17h**, emendado na estrada
 * para Miami Beach.
 *
 * Segunda versão do dia, refeita junto com o replanejamento do 14/09. O que
 * mudou na premissa: com o Islands of Adventure coberto **inteiro** no dia 14
 * (o parque ficou aberto até 20h e o dia rendeu 6h30 em vez de 4h), o dia 16
 * deixa de ter que guardar folga para terminar Hogsmeade. O Hogwarts Express
 * volta a ser o que ele é — um passeio de 45 min, não um plano de resgate — e
 * a folga que sobrou entra em três atrações que a versão anterior não cobria:
 * **Transformers: The Ride-3D**, o **Horror Make-Up Show** e o bloco da
 * **DreamWorks Land**.
 *
 * O fato que organiza o dia inteiro continua o mesmo: **16/09 é noite de
 * Halloween Horror Nights**. As datas de setembro de 2026 do evento são 2-6,
 * 9-13, **16**-20, 23-27 e 30, e em noite de HHN o Universal Studios Florida
 * fecha às 17h para quem tem ingresso normal — o parque é esvaziado e
 * reaberto às 18h30 só para quem pagou o evento (que não está incluído no
 * ingresso da família).
 *
 * Em vez de um problema, isso resolve o conflito do dia: o check-out do Royal
 * Pacific é às 11h e o check-in do Casa Faena, em Miami Beach, é às 16h, com
 * ~3h30 de estrada no meio. Um parque que fecha às 17h entrega um dia
 * completo **e** põe a família na estrada às 17h30, chegando a Miami por volta
 * das 22h em vez de depois da meia-noite.
 *
 * Premissas:
 *
 * 1. **Express Unlimited vale até o fim do dia de check-out.** Os cartões
 *    emitidos em 14/09 continuam válidos hoje — por isso o check-out é às 7h
 *    e não depois, e por isso os cartões não podem ir para a mala.
 * 2. **Early Park Admission às 8h no Beco Diagonal.** Gringotts é a única
 *    atração do parque em que o EPA vale mais que o Express: no EPA a área
 *    inteira está vazia, e o Beco Diagonal só é o Beco Diagonal sem multidão.
 * 3. **Com Express Unlimited, a ordem é geográfica, não de fila.** O roteiro
 *    percorre o parque em um anel só, sem repetir trecho — London/Diagon
 *    Alley, San Francisco, New York, Production Central/Minion Land,
 *    Hollywood, DreamWorks Land, Springfield, World Expo — e fecha de volta
 *    na loja da entrada, que é por onde se sai.
 * 4. **O Hogwarts Express fecha o ingresso Park-to-Park.** A ida e a volta têm
 *    cenas diferentes e só são possíveis com Park-to-Park. Cai de manhã
 *    porque uma pane no trem à tarde arriscaria a saída às 17h.
 * 5. **Gabi tem 112cm.** No Universal Studios ela fica de fora de uma única
 *    atração — Revenge of the Mummy (122cm). É o parque mais generoso dos três
 *    para ela, e é por isso que ele é o último dia: Child Swap uma vez, não
 *    quatro como no dia 14.
 *
 * Hollywood Rip Ride Rockit não aparece porque **fechou em definitivo** em
 * agosto de 2025, para dar lugar ao Fast & Furious: Hollywood Drift (2027) —
 * não é omissão do roteiro. O CineSational, o show noturno da lagoa, é
 * impossível hoje por definição: ele acontece depois do fechamento das 17h.
 *
 * `reminderMinutesBefore: 0` desliga o aviso do item — só 10 momentos de
 * decisão avisam, e dois deles (a saída antes do HHN e a partida para Miami)
 * são os mais críticos dos três dias.
 */
const ROWS: OperationalRow[] = [
  // ---------- Check-out antes do parque ----------
  {
    order: 1, start: '06:30', end: '07:00', title: 'Acordar e fechar as malas',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    notes: 'Hoje as malas vão para o carro antes do parque — não dá para voltar ao quarto. Varrer cofre, gavetas e carregadores.',
    reminderMinutesBefore: 20,
  },
  {
    order: 2, start: '07:00', end: '07:30', title: 'Check-out do Royal Pacific e carga do carro',
    category: 'rest', area: 'Hotel', location: "Universal's Loews Royal Pacific Resort",
    description: 'Check-out oficial é às 11h, mas a família sai antes para pegar o Early Park Admission das 8h.',
    notes: 'ATENÇÃO: separar os 4 cartões do Express Unlimited ANTES de fechar as malas — eles valem o dia inteiro de hoje e são o que sustenta o roteiro até as 17h. Conferir também a varinha interativa comprada no Hogsmeade: ela volta a funcionar hoje, no Beco Diagonal.',
    planB: 'Se a fila do check-out estiver grande, fazer express check-out pela TV/app e deixar as chaves na urna — a fatura chega por e-mail.',
    timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 3, start: '07:30', end: '07:50', title: 'Royal Pacific → Universal Studios Florida',
    category: 'transit', area: 'Deslocamento',
    location: "Universal's Loews Royal Pacific Resort → Universal Studios Florida",
    notes: 'Deixar o carro no estacionamento do complexo (e não na doca do hotel): a saída às 17h já sai direto para a estrada. Anotar o andar e a fileira — às 17h o estacionamento estará enchendo de público do HHN.',
    reminderMinutesBefore: 0,
  },
  {
    order: 4, start: '07:50', end: '08:10', title: 'Early Park Admission — entrada e ida direta ao Beco Diagonal',
    category: 'transit', area: 'Entrada', location: 'Universal Studios Florida',
    notes: 'Sem parar em Production Central. O Beco Diagonal fica no fundo à direita, depois da fachada de Londres — a entrada é o vão de tijolos entre as casas, não tem placa.',
    planB: 'Se o Early Park Admission de hoje for no Islands of Adventure em vez do Universal Studios (a Universal alterna), entrar mesmo assim às 9h e começar pelo Gringotts com Express: perde-se o Beco vazio, não a atração.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },

  // ---------- Beco Diagonal no Early Park Admission ----------
  {
    order: 5, start: '08:10', end: '08:50', title: 'Harry Potter and the Escape from Gringotts',
    category: 'park', area: 'Diagon Alley', itemType: 'attraction', priority: 'S',
    minHeightCm: 107, lightningLane: 'express', lightningLaneRank: 1,
    description: 'Único bloco do dia em que o Early Park Admission vale mais que o Express: a fila atravessa o saguão do banco, e vazia ela é metade da atração.',
    notes: 'Gabi (112cm) passa (107cm) — a família anda junta e não há Child Swap aqui. Bolsos vazios, lockers gratuitos na entrada.',
    recommendedWindow: 'Primeira hora, ainda no Early Park Admission',
    timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 6, start: '08:50', end: '09:20', title: 'Beco Diagonal — Ollivanders, Travessa do Tranco e o dragão do Gringotts',
    category: 'park', area: 'Diagon Alley', itemType: 'experience', priority: 'A',
    description: 'A versão do Ollivanders aqui é maior que a de Hogsmeade, e a Knockturn Alley é a única rua coberta e noturna do complexo.',
    notes: 'Com a varinha interativa do dia 14, as vitrines do Beco reagem a ela — é o melhor uso do brinquedo em toda a viagem, e os medalhões de bronze no chão marcam onde cada feitiço funciona. O dragão no topo do Gringotts cospe fogo a cada ~10 min. Se passarem shows de rua (Tales of Beedle the Bard, Celestina Warbeck), eles acontecem no palco do Carkitt Market — 15 min cada, sem fila.',
    reminderMinutesBefore: 0,
  },
  {
    order: 7, start: '09:20', end: '10:05', title: "Hogwarts Express — King's Cross ↔ Hogsmeade (ida e volta)",
    category: 'park', area: 'London', itemType: 'attraction', priority: 'A',
    description: 'Fecha o ingresso Park-to-Park: o trem só embarca quem pode trocar de parque, e as cenas da ida são diferentes das da volta.',
    notes: 'Ida, ~10 min na plataforma do Hogsmeade e volta pelo mesmo trem. Plataforma 9¾ com a passagem pela parede de tijolos — é a foto da Débora. Com Hogsmeade já feito no dia 14, aqui não se sai da estação.',
    planB: 'Se o Hagrid\'s não saiu no dia 14, esta é a única segunda chance — mas custa ~1h30 no Hogsmeade SEM Express e derruba Hollywood inteiro do dia. Decidir no café da manhã, não na plataforma. Se a fila de uma das pontas passar de 30 min, fazer só a ida e voltar a pé é impossível (parques diferentes): então é pular o trem inteiro.',
    reminderMinutesBefore: 15,
  },

  // ---------- Anel do parque com Express Unlimited ----------
  {
    order: 8, start: '10:05', end: '10:30', title: 'Fast & Furious – Supercharged',
    category: 'park', area: 'San Francisco', itemType: 'attraction', priority: 'C',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 8,
    description: 'A mais fraca do parque, mas fica exatamente no caminho entre Londres e New York — só entra por isso.',
    notes: 'Primeira a cair se o dia atrasar. Os Beat Builders (percussão com ferramentas, 15 min) tocam na fachada da San Francisco ali ao lado, de hora em hora — se estiverem tocando, valem mais que a atração.',
    status: 'optional', reminderMinutesBefore: 0,
  },
  {
    order: 9, start: '10:30', end: '11:05', title: 'Revenge of the Mummy',
    category: 'park', area: 'New York', itemType: 'attraction', priority: 'S',
    minHeightCm: 122, childSwitch: true, lightningLane: 'express', lightningLaneRank: 2,
    description: 'Montanha-russa fechada com fogo real — o pedido da Débora desde o planejamento.',
    notes: 'Única atração do parque em que a Gabi (112cm) fica de fora, e a única troca do dia inteiro: Child Swap na plataforma, ~10 min com Express. Enquanto isso, a Gabi e um adulto veem o The Blues Brothers Show, que toca na esquina da Delancey Street.',
    reminderMinutesBefore: 0,
  },
  {
    order: 10, start: '11:05', end: '11:25', title: 'Race Through New York Starring Jimmy Fallon',
    category: 'park', area: 'New York', itemType: 'attraction', priority: 'B',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 7,
    notes: 'Família junta (102cm). Simulador suave — bom bloco logo depois da Múmia, e o saguão com os cenários do Tonight Show vale a espera.',
    reminderMinutesBefore: 0,
  },
  {
    order: 11, start: '11:25', end: '11:55', title: 'TRANSFORMERS: The Ride-3D',
    category: 'park', area: 'Production Central', itemType: 'attraction', priority: 'S',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 3,
    description: 'Simulador sobre trilho com telas 3D de 18m — a melhor atração de tela do complexo e a que mais se aproxima do VelociCoaster em intensidade sem tirar a Gabi.',
    notes: 'Entra nesta versão do roteiro justamente porque o dia 14 cobriu o IOA inteiro e sobrou folga aqui. Os 4 andam juntos (102cm): é a atração forte de maior alcance do dia. Movimento brusco — se a Gabi enjoar no Fallon, pular esta.',
    reminderMinutesBefore: 0,
  },
  {
    order: 12, start: '11:55', end: '12:20', title: "Illumination's Villain-Con Minion Blast",
    category: 'park', area: 'Minion Land', itemType: 'attraction', priority: 'A',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 6,
    notes: 'Tiro ao alvo em esteira rolante — pontuação por pessoa, e a Gabi entra (102cm).',
    reminderMinutesBefore: 0,
  },
  {
    order: 13, start: '12:20', end: '12:45', title: 'Despicable Me Minion Mayhem',
    category: 'park', area: 'Minion Land', itemType: 'attraction', priority: 'A',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 5,
    notes: 'Simulador dos Minions. Há fileira estática para quem não quer movimento — pedir na entrada se a Gabi já estiver cansada de tela.',
    reminderMinutesBefore: 0,
  },
  {
    order: 14, start: '12:45', end: '13:25', title: 'Almoço — Minion Cafe',
    category: 'restaurant', area: 'Minion Land',
    description: 'Quick service climatizado na própria Minion Land, com salão grande.',
    notes: 'Mobile order pelo app ainda na fila do Minion Mayhem. ~US$ 80 para os 4. É a última refeição sentada antes de Fort Pierce, às 19h — comer de verdade aqui.',
    recommendedArrivalMinBefore: 10, timeIsEstimated: false, reminderMinutesBefore: 15,
  },

  // ---------- Hollywood e DreamWorks Land ----------
  {
    order: 15, start: '13:25', end: '13:55', title: 'The Bourne Stuntacular',
    category: 'park', area: 'Hollywood', itemType: 'show', priority: 'S',
    description: 'Teatro fechado, ~25 min, dublês ao vivo sobre tela LED — o melhor show do complexo Universal.',
    notes: 'Express dá entrada prioritária. CONFERIR o horário da sessão no app logo cedo: é o único bloco do dia com hora marcada de verdade, e tudo entre ele e o almoço desliza para encaixá-lo.',
    showDurationMin: 25, recommendedArrivalMinBefore: 15,
    lightningLane: 'express', timeIsEstimated: false, reminderMinutesBefore: 20,
  },
  {
    order: 16, start: '13:55', end: '14:20', title: 'E.T. Adventure',
    category: 'park', area: 'Hollywood', itemType: 'attraction', priority: 'A',
    minHeightCm: 86, lightningLane: 'express', lightningLaneRank: 9,
    notes: 'Barra de 86cm e a única atração original de 1990 ainda de pé no parque. Dizem o nome da Gabi no fim do passeio se for informado na entrada — falar o nome soletrado, senão sai errado.',
    reminderMinutesBefore: 0,
  },
  {
    order: 17, start: '14:20', end: '14:50', title: "Universal Orlando's Horror Make-Up Show",
    category: 'park', area: 'Hollywood', itemType: 'show', priority: 'A',
    description: 'Demonstração de efeitos práticos de maquiagem, ~25 min, em teatro climatizado. É comédia, não terror — o humor é o ponto.',
    notes: 'Bloco novo nesta versão do dia. Tem sangue cenográfico e uma faca de brinquedo em cena: para a Gabi (4 anos) é assustador em dois momentos pontuais, e é o primeiro a cair se o dia estiver puxado. Sentar no fundo ajuda. Se houver "Animal Actors" programado hoje, ele é a alternativa segura no mesmo horário e no mesmo bairro.',
    showDurationMin: 25, status: 'optional', reminderMinutesBefore: 0,
  },
  {
    order: 18, start: '14:50', end: '15:15', title: "DreamWorks Land — Trolls Trollercoaster e Shrek's Swamp",
    category: 'park', area: 'DreamWorks Land', itemType: 'attraction', priority: 'B',
    minHeightCm: 91,
    description: 'Área infantil inteira: montanha-russa leve (91cm), a praça de água do Shrek e o Po\'s Kung Fu Training Camp.',
    notes: 'O bloco da Gabi no dia, e o único em que ela lidera — vem logo depois do único Child Swap. Se o DreamWorks Imagination Celebration estiver programado, ele acontece no anfiteatro da própria área. Roupa de troca no carro, não na mochila: a praça de água molha.',
    reminderMinutesBefore: 0,
  },

  // ---------- Springfield e World Expo, fechando o anel ----------
  {
    order: 19, start: '15:15', end: '15:40', title: 'The Simpsons Ride',
    category: 'park', area: 'Springfield', itemType: 'attraction', priority: 'A',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 4,
    notes: 'Simulador em cúpula, movimento forte para quem enjoa — se a Gabi já estiver cansada, é melhor ela e um adulto pularem e ficarem no Kang & Kodos ao lado.',
    reminderMinutesBefore: 0,
  },
  {
    order: 20, start: '15:40', end: '16:00', title: "Kang & Kodos' Twirl 'n' Hurl e Springfield",
    category: 'park', area: 'Springfield', itemType: 'attraction', priority: 'B',
    minHeightCm: 91,
    notes: 'Bloco de folga: a Gabi anda, e Springfield é a área com mais detalhe para fotografar do parque (Moe\'s, Kwik-E-Mart, a estátua do Jebediah). Duff Brewery para os adultos se o relógio permitir.',
    status: 'optional', reminderMinutesBefore: 0,
  },
  {
    order: 21, start: '16:00', end: '16:25', title: 'MEN IN BLACK Alien Attack',
    category: 'park', area: 'World Expo', itemType: 'attraction', priority: 'A',
    minHeightCm: 107, lightningLane: 'express', lightningLaneRank: 10,
    description: 'Última atração do dia e da fase Orlando inteira.',
    notes: 'Tiro ao alvo competitivo — a pontuação final aparece no fim, e é a melhor disputa da viagem entre Pedro e Débora. A Gabi entra (107cm).',
    reminderMinutesBefore: 0,
  },

  // ---------- Saída antes do Halloween Horror Nights ----------
  {
    order: 22, start: '16:25', end: '16:50', title: 'Compras finais — Universal Studios Store',
    category: 'shopping', area: 'Production Central',
    notes: 'Caminhada do World Expo até a loja da entrada é ~8 min e fecha o anel do dia sem repetir trecho. Última loja da fase Orlando: comprar aqui e não na saída, porque às 16h50 o fluxo em direção aos portões já trava.',
    reminderMinutesBefore: 10,
  },
  {
    order: 23, start: '16:50', end: '17:00', title: 'Saída do parque antes do fechamento para o Halloween Horror Nights',
    category: 'transit', area: 'Saída', location: 'Universal Studios Florida',
    description: 'Hoje é noite de HHN: às 17h o parque é esvaziado de quem tem ingresso normal e reabre às 18h30 só para quem pagou o evento.',
    notes: 'Não é horário flexível — a equipe varre o parque das áreas do fundo para a frente, e World Expo/Springfield são as primeiras a serem limpas. Estar fora dos portões às 17h.',
    planB: 'Se o esvaziamento começar antes, sair pelo CityWalk e esperar no estacionamento; o roteiro já tinha as compras como último bloco descartável.',
    timeIsEstimated: false, reminderMinutesBefore: 20,
  },
  {
    order: 24, start: '17:00', end: '17:30', title: 'CityWalk → carro, banheiro e abastecimento',
    category: 'transit', area: 'Deslocamento', location: 'Universal Orlando Resort',
    notes: 'Abastecer antes da Turnpike (posto mais barato fora do complexo, na Kirkman). Banheiro agora — a primeira parada da estrada é a 1h30 daqui. Roupa de troca da Gabi antes de entrar no carro.',
    reminderMinutesBefore: 0,
  },

  // ---------- Estrada para Miami Beach ----------
  {
    order: 25, start: '17:30', end: '19:00', title: "Estrada Orlando → Fort Pierce (Florida's Turnpike)",
    category: 'transit', area: 'Estrada', city: 'Orlando → Fort Pierce',
    location: "Universal Orlando Resort → Florida's Turnpike",
    description: 'Primeira metade dos ~385 km até Miami Beach. SunPass já ativado na minivan (reserva 53YH2M).',
    notes: 'Saída às 17h30 pega o contrafluxo: o trânsito pesado da noite é de quem está CHEGANDO ao HHN. Casa Faena avisado de check-in tarde (+1 305-604-8485).',
    planB: 'Se a I-4/Turnpike travar, a alternativa é a US-192 até a Turnpike em Yeehaw Junction — mais longa em km, mas sem o gargalo de Orlando.',
    timeIsEstimated: false, reminderMinutesBefore: 20,
  },
  {
    order: 26, start: '19:00', end: '19:45', title: 'Jantar na estrada — Fort Pierce Service Plaza',
    category: 'restaurant', area: 'Estrada', city: 'Fort Pierce',
    location: "Fort Pierce Service Plaza, Florida's Turnpike",
    notes: 'Praça de serviço com banheiro, combustível e praça de alimentação — a última boa antes de Miami. Trocar de motorista aqui.',
    reminderMinutesBefore: 0,
  },
  {
    order: 27, start: '19:45', end: '21:45', title: 'Fort Pierce → Miami Beach',
    category: 'transit', area: 'Estrada', city: 'Fort Pierce → Miami Beach',
    location: 'Casa Faena Miami Beach',
    notes: 'Turnpike até a I-195 e a Julia Tuttle Causeway. Estacionamento do Casa Faena é valet — conferir a diária no check-in.',
    reminderMinutesBefore: 0,
  },
  {
    order: 28, start: '21:45', end: '22:15', title: 'Check-in no Casa Faena Miami Beach',
    category: 'rest', area: 'Hotel', city: 'Miami Beach', location: 'Casa Faena Miami Beach',
    description: 'Reserva PPHHBQBQ, 3 noites, quarto familiar. Encerra a fase Orlando da viagem.',
    notes: 'Avisar por telefone quando passar de Fort Lauderdale. 22.000 pontos ALL Reward já aplicados — conferir se a reserva entrou como pré-paga.',
    reminderMinutesBefore: 15,
  },
];

export const UNIVERSAL_STUDIOS_DIA_16_ITEMS = buildOperationalDay(
  {
    parkKey: 'usf16',
    parkName: 'Universal Studios Florida',
    city: 'Orlando',
    date: '2026-09-16',
  },
  ROWS
);
