import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, 'Slinky Dog Dash', 'Toy Story Land', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 1 }],
  [2, 'Toy Story Mania!', 'Toy Story Land', 'attraction', 'A', { lightningLane: 'genie_plus', lightningLaneRank: 4 }],
  [3, 'Alien Swirling Saucers', 'Toy Story Land', 'attraction', 'B', { lightningLane: 'genie_plus', lightningLaneRank: 6 }],
  [4, 'Star Wars: Rise of the Resistance', "Galaxy's Edge", 'attraction', 'S', { description: 'Estratégia própria conforme o produto de fila disponível.' }],
  [5, 'Millennium Falcon: Smugglers Run', "Galaxy's Edge", 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 5 }],
  [6, "Exploração de Galaxy's Edge e Datapad", "Galaxy's Edge", 'experience', 'B'],
  [7, 'Star Tours – The Adventures Continue', 'Grand Avenue e Echo Lake', 'attraction', 'A'],
  [8, 'Indiana Jones Epic Stunt Spectacular!', 'Grand Avenue e Echo Lake', 'show', undefined, { showDurationMin: 30 }],
  [9, 'For the First Time in Forever: A Frozen Sing-Along Celebration', 'Grand Avenue e Echo Lake', 'show', undefined, { showDurationMin: 25 }],
  [10, 'Vacation Fun – An Original Animated Short with Mickey & Minnie', 'Grand Avenue e Echo Lake', 'experience', 'C'],
  [11, 'Disney Junior Play and Dance!', 'Grand Avenue e Echo Lake', 'show', 'C', { showDurationMin: 20, description: 'Especialmente indicado para a Gabriela.' }],
  [12, "Mickey & Minnie's Runaway Railway", 'Hollywood Boulevard', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 2 }],
  [13, 'The Twilight Zone Tower of Terror', 'Sunset Boulevard', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 3 }],
  [14, "Rock 'n' Roller Coaster Starring The Muppets", 'Sunset Boulevard', 'attraction', 'S'],
  [15, 'Beauty and the Beast – Live on Stage', 'Sunset Boulevard', 'show', undefined, { showDurationMin: 25 }],
  [16, 'The Little Mermaid – A Musical Adventure', 'Sunset Boulevard', 'show', undefined, { showDurationMin: 15 }],
  [17, 'Disney Villains: Unfairly Ever After', 'Sunset Boulevard', 'show', undefined, { showDurationMin: 12 }],
  [18, 'Wonderful World of Animation', 'Encerramento', 'show', undefined, { showDurationMin: 12, description: 'Se estiver programado no dia.' }],
  [19, 'Fantasmic!', 'Encerramento', 'show', undefined, { lastShowtimeOfDay: true, showDurationMin: 26, description: 'Show final obrigatório.' }],
];

export const HOLLYWOOD_STUDIOS_ITEMS = buildParkDay(
  {
    parkKey: 'hs',
    parkName: "Disney's Hollywood Studios",
    city: 'Lake Buena Vista',
    date: '2026-09-10',
    openTime: '07:15',
    closeTime: '21:30',
  },
  ROWS
);
