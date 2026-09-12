import { buildOperationalDay, type OperationalRow } from './shared';

/**
 * Disney's Hollywood Studios — 12/09/2026, dia operacional **sem Early Entry e
 * sem Lightning Lane**.
 *
 * O dia 10/09 era originalmente Hollywood Studios (`hollywoodStudios.ts`), mas
 * virou compras (`supabase/seeds/compras_2026-09-10.sql`) e os 19 itens do
 * catálogo foram cancelados no banco. 12/09 é a única data restante antes do
 * check-in no Universal em 14/09 — não há segunda chance neste roteiro.
 *
 * Três premissas moldam a ordem dos blocos, as mesmas de `epcotDia09.ts` e
 * `animalKingdomDia11.ts`:
 *
 * 1. **Sem Early Entry.** De 07 a 14/09 a família está no Celebration Suites
 *    (Kissimmee, hotel fora da rede Disney) — o rope drop é na abertura
 *    regular das 9h, não nos 8h30 de Early Entry que um hotel Disney daria.
 * 2. **Sem Lightning Lane** — decisão explícita: o roteiro é reordenado por
 *    fila, não por passe pago. Rise of the Resistance e Slinky Dog Dash
 *    entram logo na abertura justamente para não pagar essa conta em fila
 *    à tarde.
 * 3. **A tarde inteira é indoor por desenho.** A previsão do NWS para 12/09
 *    (emitida 11/09) dá trovoada provável das 14h às 19h, com pico de 57% às
 *    16h — bem acima da manhã (≤7% até 13h). Os blocos 14 a 19 (Runaway
 *    Railway, Star Tours, Indiana Jones, Frozen Sing-Along, Little Mermaid,
 *    Disney Junior) e o jantar são todos cobertos ou climatizados, na ordem
 *    certa para atravessar a janela de chuva sem perder tempo de fila.
 *
 * Atrações fechadas em 12/09 e que por isso não aparecem: Muppet*Vision 3D,
 * PizzeRizzo e Mama Melrose's (fecharam em 2025 para dar lugar a Monstropolis,
 * que só abre em 2027) e Star Wars Launch Bay / Lightning McQueen's Racing
 * Academy (deram lugar ao Roy E. Disney Animation Building — Magic of Disney
 * Animation reabre em 14/09/2026, dois dias depois deste roteiro, e por isso
 * também não entra). Rock 'n' Roller Coaster Starring The Muppets reabriu em
 * 26/05/2026 com a mesma barra de altura do Aerosmith (122cm) e por isso
 * ainda barra a Gabi.
 *
 * Gabi tem 112cm: passa em todas as atrações do dia (barra mais alta do
 * catálogo é 102cm) **menos** Rock 'n' Roller Coaster Starring The Muppets
 * (122cm) — é a única atração do dia com Rider Switch.
 *
 * `reminderMinutesBefore: 0` desliga o aviso do item, pelo mesmo motivo dos
 * dias anteriores: um dia de 30 blocos sem isso viraria 30 mensagens por
 * participante. Só 9 momentos de decisão avisam.
 */
const ROWS: OperationalRow[] = [
  // ---------- Hotel → Hollywood Studios ----------
  {
    order: 1, start: '07:00', end: '07:20', title: 'Acordar e preparação',
    category: 'rest', area: 'Hotel', city: 'Kissimmee',
    location: 'Celebration Suites',
    notes: 'Mochila: protetor solar, poncho, garrafas e carregador. Tênis fechado. Medir a Gabi antes de sair — hoje tem atração de 122cm.',
    reminderMinutesBefore: 10,
  },
  {
    order: 2, start: '07:20', end: '07:45', title: 'Café da manhã no apartamento',
    category: 'restaurant', area: 'Hotel', city: 'Kissimmee',
    location: 'Celebration Suites',
    notes: 'Café rápido — sem parada para café dentro do parque hoje.',
    reminderMinutesBefore: 0,
  },
  {
    order: 3, start: '07:45', end: '08:15', title: 'Saída do hotel rumo ao Hollywood Studios',
    category: 'transit', area: 'Deslocamento', city: 'Kissimmee → Lake Buena Vista',
    location: "Celebration Suites → Disney's Hollywood Studios",
    notes: 'Sem Early Entry: chegar cedo na fila é o único jeito de ganhar tempo na abertura.',
    planB: 'Trânsito pesado na I-4: sair até 7h50 no mais tardar para não perder o rope drop.',
    timeIsEstimated: false, reminderMinutesBefore: 15,
  },
  {
    order: 4, start: '08:15', end: '08:40', title: 'Estacionamento e segurança',
    category: 'transit', area: 'Entrada', location: "Disney's Hollywood Studios",
    notes: 'Estacionamento padrão US$ 35/dia. Fotografar a placa da vaga. Ingressos já abertos no My Disney Experience (voucher 4-Park Magic HWQK87515654).',
    reminderMinutesBefore: 0,
  },
  {
    order: 5, start: '08:40', end: '09:00', title: 'Posicionamento na entrada regular (rope drop)',
    category: 'transit', area: 'Entrada', location: "Disney's Hollywood Studios",
    notes: 'Sem Early Entry hoje: estar na frente da catraca antes das 9h vale a manhã inteira. Ir direto para Galaxy\'s Edge.',
    timeIsEstimated: false, reminderMinutesBefore: 0,
  },

  // ---------- Galaxy's Edge e Toy Story Land: 9h–13h05 (manhã seca, PoP ≤7%) ----------
  {
    order: 6, start: '09:00', end: '09:45', title: 'Star Wars: Rise of the Resistance',
    category: 'park', area: "Galaxy's Edge", itemType: 'attraction', priority: 'S',
    minHeightCm: 102, childSwitch: true,
    recommendedWindow: 'Primeiros 30 minutos do dia',
    notes: 'Prioridade absoluta do dia — a fila mais longa e mais sujeita a ficar parada. Ir direto, sem fotos.',
    planB: 'Tem cerca de 1 chance em 5 de estar parada na abertura: se estiver, ir direto ao Slinky Dog Dash e voltar ao Rise às 19h.',
    timeIsEstimated: false, reminderMinutesBefore: 30,
  },
  {
    order: 7, start: '09:50', end: '10:25', title: 'Millennium Falcon: Smugglers Run',
    category: 'park', area: "Galaxy's Edge", itemType: 'attraction', priority: 'S',
    minHeightCm: 97,
    notes: 'Cabine de pilotos — a Gabi senta no colo se não alcançar os controles.',
    reminderMinutesBefore: 0,
  },
  {
    order: 8, start: '10:25', end: '10:45', title: "Travessia Galaxy's Edge → Toy Story Land",
    category: 'transit', area: 'Deslocamento',
    notes: 'Aproveitar para passar pelo Datapad se sobrar tempo.',
    reminderMinutesBefore: 10,
  },
  {
    order: 9, start: '10:45', end: '11:20', title: 'Slinky Dog Dash',
    category: 'park', area: 'Toy Story Land', itemType: 'attraction', priority: 'S',
    minHeightCm: 97,
    notes: 'Segunda fila mais concorrida do parque — ainda de manhã evita a pior espera.',
    reminderMinutesBefore: 0,
  },
  {
    order: 10, start: '11:25', end: '11:50', title: 'Toy Story Mania!',
    category: 'park', area: 'Toy Story Land', itemType: 'attraction', priority: 'A',
    notes: 'Sem restrição de altura: todo mundo joga junto.',
    reminderMinutesBefore: 0,
  },
  {
    order: 11, start: '11:55', end: '12:15', title: 'Alien Swirling Saucers',
    category: 'park', area: 'Toy Story Land', itemType: 'attraction', priority: 'B',
    minHeightCm: 81,
    notes: 'A mais suave de Toy Story Land — boa para a Gabi antes do almoço.',
    reminderMinutesBefore: 0,
  },
  {
    order: 12, start: '12:20', end: '13:05', title: "Almoço — Woody's Lunch Box",
    category: 'restaurant', area: 'Toy Story Land',
    description: 'Quick service temático de lancheira escolar — grilled cheese, totchos, milkshakes.',
    notes: 'Mobile order pelo app antes de sair da fila de Alien Swirling Saucers. ~US$ 60 para os 4.',
    timeIsEstimated: false, recommendedArrivalMinBefore: 10, reminderMinutesBefore: 20,
  },

  // ---------- Hollywood Boulevard e Grand Avenue: 13h–17h (tarde indoor, trovoada provável) ----------
  {
    order: 13, start: '13:10', end: '13:30', title: 'Travessia → Hollywood Boulevard',
    category: 'transit', area: 'Deslocamento',
    reminderMinutesBefore: 0,
  },
  {
    order: 14, start: '13:30', end: '14:00', title: "Mickey & Minnie's Runaway Railway",
    category: 'park', area: 'Hollywood Boulevard', itemType: 'attraction', priority: 'S',
    description: 'Indoor — primeiro bloco da sequência que atravessa a janela de trovoada da tarde.',
    notes: 'Sem altura mínima: toda a família entra junto.',
    reminderMinutesBefore: 0,
  },
  {
    order: 15, start: '14:05', end: '14:40', title: 'Star Tours – The Adventures Continue',
    category: 'park', area: 'Echo Lake', itemType: 'attraction', priority: 'A',
    minHeightCm: 102,
    notes: 'Indoor, simulador — a viagem é sorteada entre dezenas de combinações.',
    reminderMinutesBefore: 0,
  },
  {
    order: 16, start: '14:45', end: '15:20', title: 'Indiana Jones Epic Stunt Spectacular!',
    category: 'park', area: 'Echo Lake', itemType: 'show', priority: 'A',
    location: 'Disney\'s Hollywood Studios',
    description: 'Anfiteatro coberto, mas ao ar livre — 30 minutos de dublês e explosões ao vivo.',
    showDurationMin: 30,
    notes: 'Chegar com folga: sentar na plateia é por ordem de chegada.',
    planB: 'Se for suspenso por raios nas proximidades, trocar por Walt Disney Presents (Main Street exhibits, totalmente indoor).',
    recommendedArrivalMinBefore: 15, reminderMinutesBefore: 30,
  },
  {
    order: 17, start: '15:25', end: '15:55', title: 'For the First Time in Forever: A Frozen Sing-Along Celebration',
    category: 'park', area: 'Echo Lake', itemType: 'show', priority: 'B',
    description: 'Indoor (Hyperion Theater), 25 minutos.',
    showDurationMin: 25,
    reminderMinutesBefore: 0,
  },
  {
    order: 18, start: '16:00', end: '16:25', title: 'The Little Mermaid – A Musical Adventure',
    category: 'park', area: 'Sunset Boulevard', itemType: 'show', priority: 'B',
    description: 'Indoor, boneco-marionete em live-action — aberto desde 27/05/2025.',
    reminderMinutesBefore: 0,
  },
  {
    order: 19, start: '16:30', end: '16:55', title: 'Disney Junior Play and Dance!',
    category: 'park', area: 'Grand Avenue', itemType: 'show', priority: 'C',
    status: 'optional',
    description: 'Indoor, interativo — especialmente indicado para a Gabi.',
    reminderMinutesBefore: 0,
  },
  {
    order: 20, start: '17:00', end: '17:50', title: 'Jantar — Backlot Express',
    category: 'restaurant', area: 'Echo Lake',
    description: 'Quick service climatizado, ao lado dos teatros da tarde — evita atravessar o parque na hora da tempestade.',
    notes: 'Mobile order pelo app. ~US$ 70 para os 4.',
    timeIsEstimated: false, recommendedArrivalMinBefore: 10, reminderMinutesBefore: 30,
  },

  // ---------- Sunset Boulevard e Fantasmic!: 17h50–21h30 ----------
  {
    order: 21, start: '17:55', end: '18:10', title: 'Travessia → Sunset Boulevard',
    category: 'transit', area: 'Deslocamento',
    reminderMinutesBefore: 0,
  },
  {
    order: 22, start: '18:10', end: '18:45', title: 'The Twilight Zone Tower of Terror',
    category: 'park', area: 'Sunset Boulevard', itemType: 'attraction', priority: 'S',
    minHeightCm: 102, childSwitch: true,
    notes: 'Queda livre em sequência aleatória — a Gabi passa na barra, mas pode assustar; combinar antes de entrar.',
    reminderMinutesBefore: 0,
  },
  {
    order: 23, start: '18:50', end: '19:20', title: "Rock 'n' Roller Coaster Starring The Muppets",
    category: 'park', area: 'Sunset Boulevard', itemType: 'attraction', priority: 'S',
    minHeightCm: 122, childSwitch: true,
    notes: 'Reabriu em 26/05/2026 com o Electric Mayhem — mesma barra de altura do Aerosmith (122cm). A Gabi (112cm) fica de fora.',
    planB: "Rider Switch: um adulto vai com a Débora primeiro, o outro espera com a Gabi (que ganha o cartão \"Future Rock Star\" na saída).",
    reminderMinutesBefore: 20,
  },
  {
    order: 24, start: '19:25', end: '19:40', title: 'Disney Villains: Unfairly Ever After',
    category: 'park', area: 'Sunset Boulevard', itemType: 'show', priority: 'C',
    location: 'Sunset Showcase',
    status: 'optional',
    description: 'Indoor, ~12 minutos — encaixe rápido antes do posicionamento do Fantasmic!.',
    showDurationMin: 12,
    reminderMinutesBefore: 0,
  },
  {
    order: 25, start: '19:45', end: '20:30', title: 'Posicionamento no Hollywood Hills Amphitheater',
    category: 'transit', area: 'Sunset Boulevard', location: 'Hollywood Hills Amphitheater',
    notes: 'Sem assento reservado hoje: chegar 45 minutos antes é o mínimo para conseguir lugar sentado.',
    timeIsEstimated: false, reminderMinutesBefore: 30,
  },
  {
    order: 26, start: '20:30', end: '21:00', title: 'Fantasmic!',
    category: 'park', area: 'Sunset Boulevard', itemType: 'show', priority: 'S',
    location: 'Hollywood Hills Amphitheater',
    description: 'Espetáculo noturno com água, fogo e projeções — ~26 minutos. Horário a confirmar no app: em 2026 já oscilou entre 20h30 e 21h.',
    showDurationMin: 26, lastShowtimeOfDay: true,
    notes: 'O trecho dos vilões tem fogo e volume alto — o mais pesado do dia para a Gabi. Dá para sair no meio pelos corredores laterais.',
    reminderMinutesBefore: 0,
  },
  {
    order: 27, start: '21:00', end: '21:25', title: "Compras finais — Mickey's of Hollywood",
    category: 'shopping', area: 'Hollywood Boulevard',
    status: 'optional',
    notes: 'A loja opera um pouco além do horário de fechamento do parque.',
    countsTowardCompletion: false,
    reminderMinutesBefore: 0,
  },
  {
    order: 28, start: '21:25', end: '21:50', title: 'Saída do parque e estacionamento',
    category: 'transit', area: 'Deslocamento',
    notes: 'Fluxo de saída pesado — o parque esvazia às 21h30 para o Disney After Hours (22h–1h, ingresso à parte, não incluído hoje). A vaga foi fotografada de manhã.',
    reminderMinutesBefore: 0,
  },
  {
    order: 29, start: '21:50', end: '22:25', title: 'Retorno ao Celebration Suites',
    category: 'transit', area: 'Deslocamento', city: 'Lake Buena Vista → Kissimmee',
    location: "Disney's Hollywood Studios → Celebration Suites",
    reminderMinutesBefore: 0,
  },
  {
    order: 30, start: '22:25', end: '22:45', title: 'Encerramento e preparação do dia 13',
    category: 'rest', area: 'Hotel', city: 'Kissimmee',
    location: 'Celebration Suites',
    notes: 'Dia 13 (Universal Studios Florida) começa só às 10h10 — dá para dormir até tarde.',
    reminderMinutesBefore: 0,
  },
];

export const HOLLYWOOD_STUDIOS_DIA_12_ITEMS = buildOperationalDay(
  {
    parkKey: 'hs12',
    parkName: "Disney's Hollywood Studios",
    city: 'Lake Buena Vista',
    date: '2026-09-12',
  },
  ROWS
);
