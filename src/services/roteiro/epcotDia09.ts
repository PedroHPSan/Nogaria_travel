import { buildOperationalDay, type OperationalRow } from './shared';

/**
 * EPCOT — 09/09/2026, dia operacional **sem Early Entry e sem Lightning Lane**.
 *
 * Três premissas moldam a ordem dos blocos:
 *
 * 1. **Entrada regular às 9h.** Sem Early Entry, os primeiros 90 minutos são o
 *    único recurso barato do dia: as filas caras (Test Track, Guardians) vão
 *    para o rope drop, e o resto do dia trabalha em torno disso.
 * 2. **Akershus às 15h15 é âncora, não bloco móvel.** A reserva está confirmada
 *    (ver `epcot.ts`, roteiro original), e ela fica na Noruega — a **segunda**
 *    parada do World Showcase no sentido México → Canadá. Por isso o World
 *    Showcase é percorrido a partir do México, e não a partir do Canadá: o
 *    sentido inverso obrigaria a atravessar a lagoa duas vezes para chegar na
 *    reserva no horário.
 * 3. **Uma volta só.** Terminar no Canadá deixa o grupo colado na ponte para o
 *    Future World, que é exatamente onde a "Operação Resgate" das 20h20
 *    precisa acontecer para pegar a última fila antes das 21h.
 *
 * Gabi tem 100cm: não atinge 102cm (Test Track, Mission: SPACE, Soarin') nem
 * 107cm (Guardians). Esses quatro itens levam `minHeightCm` + `childSwitch`,
 * o que faz o bot anexar sozinho o aviso de Rider Switch na mensagem.
 *
 * `reminderMinutesBefore: 0` desliga o aviso do item. Ele é o default aqui
 * justamente porque o bot dispara um WhatsApp por item **para cada
 * participante**: sem desligar os blocos de passagem, um dia de 32 blocos
 * viraria 32 mensagens por pessoa. Só 9 momentos de decisão avisam.
 */
const ROWS: OperationalRow[] = [
  // ---------- Hotel → EPCOT ----------
  {
    order: 1, start: '07:15', end: '07:40', title: 'Acordar e preparação',
    category: 'rest', area: 'Hotel', city: 'Kissimmee',
    location: 'Vacation Village at Parkway',
    notes: 'Mochila: protetor solar, poncho, garrafas e carregador. Tênis fechado.',
    reminderMinutesBefore: 15,
  },
  {
    order: 2, start: '07:40', end: '08:00', title: 'Café da manhã no Vacation Village at Parkway',
    category: 'restaurant', area: 'Hotel', city: 'Kissimmee',
    location: 'Vacation Village at Parkway',
    notes: 'Café rápido no apartamento — não há parada para café dentro do parque hoje.',
    reminderMinutesBefore: 0,
  },
  {
    order: 3, start: '08:00', end: '08:20', title: 'Saída do hotel rumo ao EPCOT',
    category: 'transit', area: 'Deslocamento', city: 'Kissimmee → Lake Buena Vista',
    location: 'Vacation Village at Parkway → EPCOT',
    notes: 'Sair às 8h em ponto: ~20 min até o estacionamento e ~25 min de segurança e catracas.',
    planB: 'Depois de 8h15, cortar a foto na Spaceship Earth e ir direto para o Test Track.',
    timeIsEstimated: false, reminderMinutesBefore: 20,
  },
  {
    order: 4, start: '08:20', end: '08:45', title: 'Estacionamento, segurança e catracas',
    category: 'transit', area: 'Entrada', location: 'EPCOT — Entrada Principal',
    notes: 'Fotografar a placa da vaga. Ingressos já abertos no My Disney Experience.',
    reminderMinutesBefore: 0,
  },
  {
    order: 5, start: '08:45', end: '09:00', title: 'Posicionamento na entrada regular (rope drop)',
    category: 'transit', area: 'Entrada', location: 'EPCOT — Entrada Principal',
    notes: 'Sem Early Entry hoje: estar na frente da catraca antes das 9h vale a manhã inteira.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },

  // ---------- Janela crítica: 9h–11h35 ----------
  {
    order: 6, start: '09:00', end: '09:35', title: 'Test Track',
    category: 'park', area: 'World Discovery', itemType: 'attraction', priority: 'S',
    minHeightCm: 102, childSwitch: true,
    recommendedWindow: 'Primeiros 30 minutos do dia',
    notes: 'Primeira atração do dia. Ir direto: sem fotos, sem loja, sem desvio.',
    planB: 'Se estiver em manutenção na abertura, inverter com Guardians e voltar às 20h20.',
    timeIsEstimated: false, reminderMinutesBefore: 30,
  },
  {
    order: 7, start: '09:35', end: '10:20', title: 'Guardians of the Galaxy: Cosmic Rewind',
    category: 'park', area: 'World Discovery', itemType: 'attraction', priority: 'S',
    minHeightCm: 107, childSwitch: true,
    notes: 'Conferir a espera antes de entrar na fila.',
    planB: 'Fila acima de 75 min: pular agora e recuperar na Operação Resgate das 20h20.',
    reminderMinutesBefore: 0,
  },
  {
    order: 8, start: '10:20', end: '10:45', title: 'Mission: SPACE – Green Mission',
    category: 'park', area: 'World Discovery', itemType: 'attraction', priority: 'B',
    minHeightCm: 102, childSwitch: true,
    notes: 'Versão Green (familiar). Quem quiser intensidade faz a Orange, que pede 112cm.',
    reminderMinutesBefore: 0,
  },
  {
    order: 9, start: '10:45', end: '11:10', title: 'Spaceship Earth',
    category: 'park', area: 'World Celebration', itemType: 'attraction', priority: 'A',
    notes: 'Sem restrição de altura: todo mundo anda junto, inclusive a Gabi.',
    reminderMinutesBefore: 0,
  },
  {
    order: 10, start: '11:10', end: '11:35', title: 'Journey Into Imagination with Figment',
    category: 'park', area: 'World Celebration', itemType: 'attraction', priority: 'B',
    status: 'optional',
    notes: 'Primeiro item a ser sacrificado se a manhã atrasar.',
    reminderMinutesBefore: 0,
  },

  // ---------- World Nature: 11h35–13h35 ----------
  {
    order: 11, start: '11:35', end: '12:10', title: "Soarin' Around the World",
    category: 'park', area: 'World Nature', itemType: 'attraction', priority: 'S',
    minHeightCm: 102, childSwitch: true,
    notes: 'Fila até 40 min: fazer agora. Acima disso, adiar.',
    planB: 'Fila acima de 40 min: adiar para a Operação Resgate das 20h20.',
    reminderMinutesBefore: 0,
  },
  {
    order: 12, start: '12:10', end: '12:35', title: 'Living with the Land',
    category: 'park', area: 'World Nature', itemType: 'attraction', priority: 'A',
    notes: 'Barco com ar-condicionado — bom respiro no pico de calor.',
    reminderMinutesBefore: 0,
  },
  {
    order: 13, start: '12:35', end: '12:55', title: 'The Seas with Nemo & Friends',
    category: 'park', area: 'World Nature', itemType: 'attraction', priority: 'A',
    reminderMinutesBefore: 0,
  },
  {
    order: 14, start: '12:55', end: '13:10', title: 'SeaBase Aquarium',
    category: 'park', area: 'World Nature', itemType: 'experience', priority: 'B',
    status: 'optional',
    notes: 'Pausa, banheiro e água. Teto rígido de 15 minutos.',
    reminderMinutesBefore: 0,
  },
  {
    order: 15, start: '13:10', end: '13:35', title: 'Journey of Water, Inspired by Moana',
    category: 'park', area: 'World Nature', itemType: 'experience', priority: 'B',
    notes: 'Percurso a pé, sem fila e sem restrição — tranquilo para a Gabi.',
    reminderMinutesBefore: 0,
  },

  // ---------- World Showcase, sentido México → Canadá ----------
  {
    order: 16, start: '13:35', end: '14:00', title: 'Travessia para o World Showcase (sentido México)',
    category: 'transit', area: 'Deslocamento',
    notes: 'Atravessar direto até o México. Só voltamos ao Future World às 20h20.',
    reminderMinutesBefore: 15,
  },
  {
    order: 17, start: '14:00', end: '14:30', title: 'Gran Fiesta Tour Starring The Three Caballeros',
    category: 'park', area: 'México', itemType: 'attraction', priority: 'A',
    notes: 'Dentro da pirâmide: fila curta e ar-condicionado.',
    reminderMinutesBefore: 0,
  },
  {
    order: 18, start: '14:30', end: '14:55', title: 'Exploração do Pavilhão do México',
    category: 'park', area: 'México', itemType: 'experience', priority: 'C',
    status: 'optional',
    notes: 'Mercado interno e fotos. Teto de 25 min: o Akershus é às 15h15.',
    reminderMinutesBefore: 0,
  },
  {
    order: 19, start: '15:15', end: '16:30', title: 'Akershus Royal Banquet Hall',
    category: 'restaurant', area: 'Noruega', itemType: 'character',
    status: 'confirmed', location: 'EPCOT — Pavilhão da Noruega',
    description: 'Reserva confirmada às 15h15. Refeição com as princesas, ~75 minutos.',
    notes: 'Âncora do dia. Chegar 15h00 no balcão — o resto do roteiro se move, esta reserva não.',
    timeIsEstimated: false, recommendedArrivalMinBefore: 15, reminderMinutesBefore: 45,
  },
  {
    order: 20, start: '16:30', end: '17:15', title: 'Frozen Ever After',
    category: 'park', area: 'Noruega', itemType: 'attraction', priority: 'S',
    notes: 'Não sair da Noruega sem fazer: voltar aqui depois custa a travessia inteira.',
    reminderMinutesBefore: 15,
  },
  {
    order: 21, start: '17:15', end: '17:35', title: 'China — exploração e loja',
    category: 'park', area: 'China', itemType: 'experience', priority: 'C',
    status: 'optional', reminderMinutesBefore: 0,
  },
  {
    order: 22, start: '17:35', end: '17:55', title: 'Alemanha — exploração',
    category: 'park', area: 'Alemanha', itemType: 'experience', priority: 'C',
    status: 'optional', reminderMinutesBefore: 0,
  },
  {
    order: 23, start: '17:55', end: '18:10', title: 'Itália — fotos e exploração',
    category: 'park', area: 'Itália', itemType: 'experience', priority: 'C',
    status: 'optional', reminderMinutesBefore: 0,
  },
  {
    order: 24, start: '18:10', end: '18:30', title: 'Estados Unidos — pausa, água e banheiro',
    category: 'rest', area: 'Estados Unidos',
    notes: 'Última pausa longa do dia. Carregar celular antes do trecho final.',
    reminderMinutesBefore: 0,
  },
  {
    order: 25, start: '18:30', end: '18:55', title: 'Japão — Mitsukoshi (seção japonesa e Pokémon)',
    category: 'park', area: 'Japão', itemType: 'experience', priority: 'C',
    status: 'optional',
    notes: 'Teto de 25 minutos: o Remy é às 19h10 e é a última atração-chave.',
    reminderMinutesBefore: 0,
  },
  {
    order: 26, start: '18:55', end: '19:10', title: 'Marrocos — travessia rápida',
    category: 'park', area: 'Marrocos', itemType: 'experience', priority: 'C',
    status: 'optional', reminderMinutesBefore: 0,
  },
  {
    order: 27, start: '19:10', end: '20:05', title: "Remy's Ratatouille Adventure",
    category: 'park', area: 'França', itemType: 'attraction', priority: 'S',
    notes: 'Obrigatória. Aceitar a fila: sem Lightning Lane não existe segunda janela hoje.',
    planB: 'Fila acima de 70 min: entrar mesmo assim e trocar a Operação Resgate pelo Luminous.',
    reminderMinutesBefore: 30,
  },
  {
    order: 28, start: '20:05', end: '20:20', title: 'Reino Unido e Canadá — travessia',
    category: 'park', area: 'Reino Unido / Canadá', itemType: 'experience', priority: 'C',
    status: 'optional',
    notes: 'Só passagem e foto. Sem loja: a Operação Resgate começa às 20h20.',
    reminderMinutesBefore: 0,
  },

  // ---------- Fechamento ----------
  {
    order: 29, start: '20:20', end: '20:35', title: 'Operação Resgate — escolher UMA pendência',
    category: 'event', area: 'Fechamento',
    notes: 'Abrir o My Disney Experience. Prioridade: Guardians › Soarin’ › Test Track › Remy › Frozen.',
    planB: 'Se nada ficou pendente, ir direto para o Luminous no World Showcase Lagoon.',
    reminderMinutesBefore: 20,
  },
  {
    order: 30, start: '20:35', end: '21:00', title: 'Fila final da pendência prioritária',
    category: 'park', area: 'World Discovery / World Nature', itemType: 'attraction',
    status: 'optional',
    notes: 'Entrar na fila antes das 21h — quem já está na fila no fechamento anda. Se cair numa das quatro de 102cm+, Rider Switch para a Gabi.',
    countsTowardCompletion: false,
    reminderMinutesBefore: 0,
  },
  {
    order: 31, start: '21:00', end: '21:20', title: 'Luminous: The Symphony of Us',
    category: 'park', area: 'Encerramento', itemType: 'show',
    status: 'optional', showDurationMin: 18, lastShowtimeOfDay: true,
    location: 'World Showcase Lagoon',
    notes: 'Alternativa à fila final — não dá para fazer os dois. Posição 30 min antes.',
    timeIsEstimated: false, recommendedArrivalMinBefore: 30, reminderMinutesBefore: 40,
  },
  {
    order: 32, start: '21:20', end: '22:15', title: 'Saída do EPCOT e retorno ao hotel',
    category: 'transit', area: 'Deslocamento', city: 'Lake Buena Vista → Kissimmee',
    location: 'EPCOT → Vacation Village at Parkway',
    notes: 'Fluxo de saída pesado. A vaga foi fotografada de manhã.',
    reminderMinutesBefore: 0,
  },
];

export const EPCOT_DIA_09_ITEMS = buildOperationalDay(
  {
    parkKey: 'ec9',
    parkName: 'EPCOT',
    city: 'Lake Buena Vista',
    date: '2026-09-09',
  },
  ROWS
);
