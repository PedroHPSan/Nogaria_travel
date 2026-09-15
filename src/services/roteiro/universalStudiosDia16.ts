import { buildOperationalDay, type OperationalRow } from './shared';

/**
 * Universal Studios Florida — 16/09/2026, dia operacional **com Express
 * Unlimited, Early Park Admission e fechamento às 17h**, com um resgate do
 * Islands of Adventure embutido de manhã e emendado na estrada para Miami
 * Beach.
 *
 * Terceira versão do dia. A segunda supunha o Islands of Adventure coberto
 * **inteiro** no dia 14 e por isso deixava o Hogwarts Express ser só um
 * passeio de 45 min. Isso não aconteceu: um imprevisto tirou a família do
 * parque logo depois do Ripsaw Falls (15h05), e três atrações fortes ficaram
 * pra trás — Harry Potter and the Forbidden Journey, Hagrid's Magical
 * Creatures Motorbike Adventure e Jurassic World VelociCoaster (o pedido nº1
 * da Débora). Esta versão devolve o trem à função de resgate que ele já tinha
 * numa versão anterior do dia 14: em vez de ida-e-volta sem sair da estação,
 * a família desce em Hogsmeade, pega as três atrações e volta.
 *
 * **Bloco "Hogsmeade & Jurassic Park de resgate" (09h20–11h35, 2h15 em vez
 * dos 45 min originais).** A ordem dentro do bloco não é aleatória: Forbidden
 * Journey primeiro porque tem Express e libera rápido; Hagrid's em seguida
 * porque NÃO aceita Express e a fila da manhã ainda é curta — arriscar essa
 * fila mais tarde no dia é o erro que a versão anterior do dia 14 evitou
 * deixando-o por último; VelociCoaster por último porque também tem Express e
 * fecha o passeio com a atração mais forte. Ficam de fora, de propósito:
 * Skull Island: Reign of Kong, Popeye & Bluto's Bilge-Rat Barges, Camp
 * Jurassic, Flight of the Hippogriff e o Ollivanders de Hogsmeade — 2h15
 * já é o dobro do passeio original, e a Débora tem sua própria cerimônia da
 * varinha no Beco Diagonal daqui a pouco, no mesmo dia. Raptor Encounter
 * entra como bônus opcional (`status: 'optional'`) só se o grupo sair de
 * Hagrid's no horário: sem fila paga, é o primeiro a cair se atrasar.
 *
 * **O preço do resgate: quatro blocos saem do anel da tarde.** Fast & Furious
 * – Supercharged, o Horror Make-Up Show e Kang & Kodos' Twirl 'n' Hurl já
 * eram opcionais na versão anterior — cortá-los é barato. O quarto corte dói
 * mais: **E.T. Adventure** (prioridade A, a atração original de 1990 ainda de
 * pé) não tinha status opcional na versão passada e sai mesmo assim, porque
 * os outros três (80 min) não bastam para cobrir os 90 min a mais que o
 * resgate consome. Sem esse corte, o dia estoura o fechamento das 17h do
 * Halloween Horror Nights — que é inegociável, ao contrário de uma atração.
 *
 * O fato que organiza o resto do dia continua o mesmo: **16/09 é noite de
 * Halloween Horror Nights**. As datas de setembro de 2026 do evento são 2-6,
 * 9-13, **16**-20, 23-27 e 30, e em noite de HHN o Universal Studios Florida
 * fecha às 17h para quem tem ingresso normal — o parque é esvaziado e
 * reaberto às 18h30 só para quem pagou o evento (que não está incluído no
 * ingresso da família).
 *
 * Isso também resolve o conflito do dia: o check-out do Royal Pacific é às 11h
 * e o check-in do Casa Faena, em Miami Beach, é às 16h, com ~3h30 de estrada
 * no meio. Um parque que fecha às 17h entrega um dia completo **e** põe a
 * família na estrada às 17h30, chegando a Miami por volta das 22h em vez de
 * depois da meia-noite.
 *
 * Premissas:
 *
 * 1. **Express Unlimited vale até o fim do dia de check-out — no Universal
 *    Studios E no Islands of Adventure.** Os cartões emitidos em 14/09
 *    continuam válidos hoje nos dois parques: é o que sustenta tanto o anel
 *    da tarde quanto o resgate da manhã. Por isso o check-out é às 7h e não
 *    depois, e por isso os cartões não podem ir para a mala.
 * 2. **Early Park Admission às 8h no Beco Diagonal.** Gringotts é a única
 *    atração do parque em que o EPA vale mais que o Express: no EPA a área
 *    inteira está vazia, e o Beco Diagonal só é o Beco Diagonal sem multidão.
 * 3. **Com Express Unlimited, a ordem é geográfica, não de fila.** O anel da
 *    tarde percorre o parque sem repetir trecho — San Francisco, New York,
 *    Production Central/Minion Land, Hollywood, DreamWorks Land, Springfield,
 *    World Expo — e fecha de volta na loja da entrada, que é por onde se sai.
 * 4. **O Hogwarts Express fecha o ingresso Park-to-Park — e hoje ele é o
 *    veículo do resgate, não um passeio isolado.** A ida e a volta têm cenas
 *    diferentes e só são possíveis com Park-to-Park. Cai de manhã porque uma
 *    pane no trem à tarde arriscaria a saída às 17h.
 * 5. **Gabi tem 112cm.** No anel da tarde ela fica de fora de uma única
 *    atração — Revenge of the Mummy (122cm). No resgate da manhã ela fica de
 *    fora das três — Forbidden Journey e Hagrid's (122cm) e VelociCoaster
 *    (130cm) — por isso as três levam Child Swap, e não só uma como no resto
 *    do dia.
 *
 * Hollywood Rip Ride Rockit não aparece porque **fechou em definitivo** em
 * agosto de 2025, para dar lugar ao Fast & Furious: Hollywood Drift (2027) —
 * não é omissão do roteiro. O CineSational, o show noturno da lagoa, é
 * impossível hoje por definição: ele acontece depois do fechamento das 17h.
 *
 * `reminderMinutesBefore: 0` desliga o aviso do item — só os momentos de
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
    order: 7, start: '09:20', end: '09:35', title: "Hogwarts Express — King's Cross → Hogsmeade (ida), resgate do Islands of Adventure",
    category: 'park', area: 'London', itemType: 'attraction', priority: 'A',
    description: 'Fecha o ingresso Park-to-Park: o trem só embarca quem pode trocar de parque, e as cenas da ida são diferentes das da volta.',
    notes: 'Plataforma 9¾ com a passagem pela parede de tijolos — é a foto da Débora. Hoje o trem não é passeio isolado: leva ao resgate de Forbidden Journey, Hagrid\'s e VelociCoaster, que ficaram pra trás no dia 14.',
    planB: 'Se a fila de qualquer uma das pontas passar de 30 min, o resgate inteiro fica arriscado para o horário do HHN — pular direto para o anel do Universal Studios e aceitar a perda das três atrações.',
    reminderMinutesBefore: 15,
  },

  // ---------- Resgate: Hogsmeade & Jurassic Park (09h35–11h35) ----------
  {
    order: 8, start: '09:35', end: '09:55', title: 'Harry Potter and the Forbidden Journey',
    category: 'park', area: 'Hogsmeade', itemType: 'attraction', priority: 'S',
    location: "Universal's Islands of Adventure",
    minHeightCm: 122, childSwitch: true, lightningLane: 'express', lightningLaneRank: 2,
    description: 'Braço robótico dentro do castelo de Hogwarts — e a fila atravessa a estufa, o escritório do Dumbledore e a sala dos retratos falantes.',
    notes: 'Gabi (112cm) fora — primeira troca do resgate. Abre o bloco porque tem Express e libera rápido, deixando mais fila da manhã disponível para o Hagrid\'s logo depois.',
    reminderMinutesBefore: 0,
  },
  {
    order: 9, start: '09:55', end: '10:25', title: "Hagrid's Magical Creatures Motorbike Adventure",
    category: 'park', area: 'Hogsmeade', itemType: 'attraction', priority: 'S',
    location: "Universal's Islands of Adventure",
    minHeightCm: 122,
    description: 'Única atração forte do complexo que NÃO aceita Universal Express — e a melhor montanha-russa do Islands of Adventure.',
    notes: 'Entra logo depois do Forbidden Journey de propósito: às 10h a fila ainda é de manhã, não a de fim de tarde que fez este mesmo bloco virar o último do dia 14. Débora vai com um adulto; a Gabi fica com o outro nas lojas de Hogsmeade e o grupo se reencontra na saída.',
    planB: 'Se a fila publicada passar de 40 min, cortar aqui: sem Express, é o bloco mais caro do resgate, e VelociCoaster (também 130cm, também Child Swap, mas COM Express) é a prioridade seguinte se o relógio apertar.',
    recommendedWindow: 'Logo depois da abertura, antes de a fila da manhã crescer',
    reminderMinutesBefore: 0,
  },
  {
    order: 10, start: '10:25', end: '10:35', title: 'Travessia Hogsmeade → Jurassic Park',
    category: 'transit', area: 'Deslocamento', location: "Universal's Islands of Adventure",
    notes: 'A ponte de Jurassic Park cai direto no vilarejo de Hogsmeade — mesma travessia que fecharia o dia 14, só que na direção contrária.',
    reminderMinutesBefore: 0,
  },
  {
    order: 11, start: '10:35', end: '11:00', title: 'Jurassic World VelociCoaster',
    category: 'park', area: 'Jurassic Park', itemType: 'attraction', priority: 'S',
    location: "Universal's Islands of Adventure",
    minHeightCm: 130, childSwitch: true, lightningLane: 'express', lightningLaneRank: 1,
    description: 'A melhor montanha-russa do complexo Universal e o pedido nº1 da Débora desde o planejamento — a atração que este resgate existe para garantir.',
    notes: 'Gabi (112cm) fora — segunda e última troca do resgate. Com Express, ~10-15 min de custo real.',
    reminderMinutesBefore: 15,
  },
  {
    order: 12, start: '11:00', end: '11:15', title: 'Raptor Encounter',
    category: 'park', area: 'Jurassic Park', itemType: 'character', priority: 'A',
    location: "Universal's Islands of Adventure",
    description: 'Encontro com o velociraptor Blue, com tratador em cena — sem fila paga e sem altura mínima.',
    notes: 'Bônus do resgate, só se o grupo sair do VelociCoaster no horário: é o primeiro a cair se o dia atrasar, porque não custa uma atração forte, só tempo.',
    status: 'optional', reminderMinutesBefore: 0,
  },
  {
    order: 13, start: '11:15', end: '11:35', title: "Hogwarts Express — Hogsmeade → King's Cross (volta)",
    category: 'transit', area: 'Deslocamento',
    location: "Universal's Islands of Adventure → Universal Studios Florida",
    notes: 'Fecha o resgate e devolve a família ao Universal Studios para o anel da tarde, que começa direto em New York — sem repassar por San Francisco.',
    reminderMinutesBefore: 0,
  },

  // ---------- Anel do parque com Express Unlimited ----------
  {
    order: 14, start: '11:35', end: '12:10', title: 'Revenge of the Mummy',
    category: 'park', area: 'New York', itemType: 'attraction', priority: 'S',
    minHeightCm: 122, childSwitch: true, lightningLane: 'express', lightningLaneRank: 3,
    description: 'Montanha-russa fechada com fogo real — o pedido da Débora desde o planejamento.',
    notes: 'Única atração do anel da tarde em que a Gabi (112cm) fica de fora: Child Swap na plataforma, ~10 min com Express. Enquanto isso, a Gabi e um adulto veem o The Blues Brothers Show, que toca na esquina da Delancey Street.',
    reminderMinutesBefore: 0,
  },
  {
    order: 15, start: '12:10', end: '12:30', title: 'Race Through New York Starring Jimmy Fallon',
    category: 'park', area: 'New York', itemType: 'attraction', priority: 'B',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 7,
    notes: 'Família junta (102cm). Simulador suave — bom bloco logo depois da Múmia, e o saguão com os cenários do Tonight Show vale a espera.',
    reminderMinutesBefore: 0,
  },
  {
    order: 16, start: '12:30', end: '13:00', title: 'TRANSFORMERS: The Ride-3D',
    category: 'park', area: 'Production Central', itemType: 'attraction', priority: 'S',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 4,
    description: 'Simulador sobre trilho com telas 3D de 18m — a melhor atração de tela do complexo e a que mais se aproxima do VelociCoaster em intensidade sem tirar a Gabi.',
    notes: 'Os 4 andam juntos (102cm): é a atração forte de maior alcance da tarde. Movimento brusco — se a Gabi enjoar no Fallon, pular esta.',
    reminderMinutesBefore: 0,
  },
  {
    order: 17, start: '13:00', end: '13:25', title: "Illumination's Villain-Con Minion Blast",
    category: 'park', area: 'Minion Land', itemType: 'attraction', priority: 'A',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 6,
    notes: 'Tiro ao alvo em esteira rolante — pontuação por pessoa, e a Gabi entra (102cm).',
    reminderMinutesBefore: 0,
  },
  {
    order: 18, start: '13:25', end: '13:50', title: 'Despicable Me Minion Mayhem',
    category: 'park', area: 'Minion Land', itemType: 'attraction', priority: 'A',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 5,
    notes: 'Simulador dos Minions. Há fileira estática para quem não quer movimento — pedir na entrada se a Gabi já estiver cansada de tela.',
    reminderMinutesBefore: 0,
  },
  {
    order: 19, start: '13:50', end: '14:30', title: 'Almoço — Minion Cafe',
    category: 'restaurant', area: 'Minion Land',
    description: 'Quick service climatizado na própria Minion Land, com salão grande.',
    notes: 'Mobile order pelo app ainda na fila do Minion Mayhem. ~US$ 80 para os 4. É a última refeição sentada antes de Fort Pierce, às 19h — comer de verdade aqui.',
    recommendedArrivalMinBefore: 10, timeIsEstimated: false, reminderMinutesBefore: 15,
  },

  // ---------- Hollywood e DreamWorks Land ----------
  {
    order: 20, start: '14:30', end: '15:00', title: 'The Bourne Stuntacular',
    category: 'park', area: 'Hollywood', itemType: 'show', priority: 'S',
    description: 'Teatro fechado, ~25 min, dublês ao vivo sobre tela LED — o melhor show do complexo Universal.',
    notes: 'Express dá entrada prioritária. CONFERIR o horário da sessão no app logo cedo: é o único bloco do dia com hora marcada de verdade, e tudo entre ele e o resgate da manhã desliza para encaixá-lo. E.T. Adventure não entra mais nesta versão do dia — saiu para abrir espaço ao resgate do Islands of Adventure; se sobrar tempo depois do Bourne, é a única atração que ainda cabe (86cm, ~20 min).',
    showDurationMin: 25, recommendedArrivalMinBefore: 15,
    lightningLane: 'express', timeIsEstimated: false, reminderMinutesBefore: 20,
  },
  {
    order: 21, start: '15:00', end: '15:25', title: "DreamWorks Land — Trolls Trollercoaster e Shrek's Swamp",
    category: 'park', area: 'DreamWorks Land', itemType: 'attraction', priority: 'B',
    minHeightCm: 91,
    description: 'Área infantil inteira: montanha-russa leve (91cm), a praça de água do Shrek e o Po\'s Kung Fu Training Camp.',
    notes: 'O bloco da Gabi na tarde, e o único em que ela lidera. Roupa de troca no carro, não na mochila: a praça de água molha.',
    reminderMinutesBefore: 0,
  },

  // ---------- Springfield e World Expo, fechando o anel ----------
  {
    order: 22, start: '15:25', end: '15:50', title: 'The Simpsons Ride',
    category: 'park', area: 'Springfield', itemType: 'attraction', priority: 'A',
    minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 8,
    notes: 'Simulador em cúpula, movimento forte para quem enjoa — se a Gabi já estiver cansada, é melhor ela e um adulto pularem e ficarem em Springfield mesmo, olhando a área (Moe\'s, Kwik-E-Mart, a estátua do Jebediah).',
    reminderMinutesBefore: 0,
  },
  {
    order: 23, start: '15:50', end: '16:15', title: 'MEN IN BLACK Alien Attack',
    category: 'park', area: 'World Expo', itemType: 'attraction', priority: 'A',
    minHeightCm: 107, lightningLane: 'express', lightningLaneRank: 9,
    description: 'Última atração do dia e da fase Orlando inteira.',
    notes: 'Tiro ao alvo competitivo — a pontuação final aparece no fim, e é a melhor disputa da viagem entre Pedro e Débora. A Gabi entra (107cm). Kang & Kodos\' Twirl \'n\' Hurl (ao lado, sem Express, 91cm) não entra mais nesta versão do dia — sai junto com o Fast & Furious e o Horror Make-Up Show para abrir espaço ao resgate da manhã.',
    reminderMinutesBefore: 0,
  },

  // ---------- Saída antes do Halloween Horror Nights ----------
  {
    order: 24, start: '16:15', end: '16:40', title: 'Compras finais — Universal Studios Store',
    category: 'shopping', area: 'Production Central',
    notes: 'Caminhada do World Expo até a loja da entrada é ~8 min e fecha o anel do dia sem repetir trecho. Última loja da fase Orlando: comprar aqui e não na saída, porque perto das 17h o fluxo em direção aos portões já trava.',
    reminderMinutesBefore: 10,
  },
  {
    order: 25, start: '16:40', end: '17:00', title: 'Saída do parque antes do fechamento para o Halloween Horror Nights',
    category: 'transit', area: 'Saída', location: 'Universal Studios Florida',
    description: 'Hoje é noite de HHN: às 17h o parque é esvaziado de quem tem ingresso normal e reabre às 18h30 só para quem pagou o evento.',
    notes: 'Não é horário flexível — a equipe varre o parque das áreas do fundo para a frente, e World Expo/Springfield são as primeiras a serem limpas. Estar fora dos portões às 17h. O resgate da manhã consumiu quase toda a folga do dia original: estes 20 min (dobro dos 10 min da versão anterior) são o único amortecedor que sobrou — se o dia atrasar em qualquer bloco anterior, é aqui que o atraso aparece primeiro.',
    planB: 'Se o esvaziamento começar antes, sair pelo CityWalk e esperar no estacionamento; o roteiro já tinha as compras como último bloco descartável.',
    timeIsEstimated: false, reminderMinutesBefore: 20,
  },
  {
    order: 26, start: '17:00', end: '17:30', title: 'CityWalk → carro, banheiro e abastecimento',
    category: 'transit', area: 'Deslocamento', location: 'Universal Orlando Resort',
    notes: 'Abastecer antes da Turnpike (posto mais barato fora do complexo, na Kirkman). Banheiro agora — a primeira parada da estrada é a 1h30 daqui. Roupa de troca da Gabi antes de entrar no carro.',
    reminderMinutesBefore: 0,
  },

  // ---------- Estrada para Miami Beach ----------
  {
    order: 27, start: '17:30', end: '19:00', title: "Estrada Orlando → Fort Pierce (Florida's Turnpike)",
    category: 'transit', area: 'Estrada', city: 'Orlando → Fort Pierce',
    location: "Universal Orlando Resort → Florida's Turnpike",
    description: 'Primeira metade dos ~385 km até Miami Beach. SunPass já ativado na minivan (reserva 53YH2M).',
    notes: 'Saída às 17h30 pega o contrafluxo: o trânsito pesado da noite é de quem está CHEGANDO ao HHN. Casa Faena avisado de check-in tarde (+1 305-604-8485).',
    planB: 'Se a I-4/Turnpike travar, a alternativa é a US-192 até a Turnpike em Yeehaw Junction — mais longa em km, mas sem o gargalo de Orlando.',
    timeIsEstimated: false, reminderMinutesBefore: 20,
  },
  {
    order: 28, start: '19:00', end: '19:45', title: 'Jantar na estrada — Fort Pierce Service Plaza',
    category: 'restaurant', area: 'Estrada', city: 'Fort Pierce',
    location: "Fort Pierce Service Plaza, Florida's Turnpike",
    notes: 'Praça de serviço com banheiro, combustível e praça de alimentação — a última boa antes de Miami. Trocar de motorista aqui.',
    reminderMinutesBefore: 0,
  },
  {
    order: 29, start: '19:45', end: '21:45', title: 'Fort Pierce → Miami Beach',
    category: 'transit', area: 'Estrada', city: 'Fort Pierce → Miami Beach',
    location: 'Casa Faena Miami Beach',
    notes: 'Turnpike até a I-195 e a Julia Tuttle Causeway. Estacionamento do Casa Faena é valet — conferir a diária no check-in.',
    reminderMinutesBefore: 0,
  },
  {
    order: 30, start: '21:45', end: '22:15', title: 'Check-in no Casa Faena Miami Beach',
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
