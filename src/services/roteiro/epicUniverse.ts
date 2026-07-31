import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, 'Harry Potter and the Battle at the Ministry', 'Ministry of Magic', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 1, description: 'Se a fila estiver muito alta, comparar: entrar já, aguardar queda, usar Express (se aceito) ou retornar antes do fechamento da fila.' }],
  [2, "Mario Kart: Bowser's Challenge", 'Super Nintendo World', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 4 }],
  [3, 'Mine-Cart Madness', 'Super Nintendo World', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 2 }],
  [4, "Yoshi's Adventure", 'Super Nintendo World', 'attraction', 'A'],
  [5, 'Bowser Jr. Shadow Showdown', 'Super Nintendo World', 'experience', 'A', { description: 'Requer Power-Up Band.' }],
  [6, 'Key Challenges', 'Super Nintendo World', 'experience', 'A', { description: 'Requer Power-Up Band.' }],
  [7, 'Exploração interativa de Super Nintendo World', 'Super Nintendo World', 'experience', 'A'],
  [8, 'Monsters Unchained: The Frankenstein Experiment', 'Dark Universe', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 3 }],
  [9, 'Curse of the Werewolf', 'Dark Universe', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 7 }],
  [10, 'Darkmoor Monster Makeup Experience', 'Dark Universe', 'experience', 'B'],
  [11, 'Encontros com monstros', 'Dark Universe', 'character', undefined],
  [12, 'Le Cirque Arcanus', 'Ministry of Magic', 'show', 'S', { showDurationMin: 20 }],
  [13, 'Exploração da Paris bruxa', 'Ministry of Magic', 'experience', 'A'],
  [14, 'Interações com varinhas', 'Ministry of Magic', 'experience', 'B'],
  [15, "Hiccup's Wing Gliders", 'Isle of Berk', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 5 }],
  [16, "Dragon Racer's Rally", 'Isle of Berk', 'attraction', 'A'],
  [17, 'Fyre Drill', 'Isle of Berk', 'attraction', 'A'],
  [18, 'Viking Training Camp', 'Isle of Berk', 'experience', 'B'],
  [19, 'The Untrainable Dragon', 'Isle of Berk', 'show', 'S', { showDurationMin: 20 }],
  [20, 'Encontros com Soluço e Banguela', 'Isle of Berk', 'character', undefined],
  [21, 'Stardust Racers', 'Celestial Park', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 6 }],
  [22, 'Constellation Carousel', 'Celestial Park', 'attraction', 'A'],
  [23, 'Astronomica', 'Celestial Park', 'experience', 'B'],
  [24, 'Exploração dos jardins e fontes', 'Celestial Park', 'experience', 'B'],
  [25, 'The Cosmos Fountain Show', 'Encerramento', 'show', undefined, { showDurationMin: 8 }],
  [26, 'Show ou espetáculo noturno do Epic Universe', 'Encerramento', 'show', undefined, { lastShowtimeOfDay: true, showDurationMin: 15, description: 'Confirmar programação oficial da data.' }],
];

export const EPIC_UNIVERSE_ITEMS = buildParkDay(
  {
    parkKey: 'eu',
    parkName: 'Epic Universe',
    city: 'Orlando',
    date: '2026-09-14',
    openTime: '07:00',
    closeTime: '20:00',
  },
  ROWS
);
