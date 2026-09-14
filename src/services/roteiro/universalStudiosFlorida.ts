import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, "Illumination's Villain-Con Minion Blast", 'Minion Land', 'attraction', 'A', { minHeightCm: 102 }],
  [2, 'Despicable Me Minion Mayhem', 'Minion Land', 'attraction', 'A', { minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 4 }],
  [3, 'Illumination Theater e encontros', 'Minion Land', 'experience', 'B'],
  [4, 'Revenge of the Mummy', 'New York', 'attraction', 'S', { minHeightCm: 122, lightningLane: 'express', lightningLaneRank: 2 }],
  [5, 'TRANSFORMERS: The Ride-3D', 'Production Central', 'attraction', 'S', { minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 3, description: 'Simulador sobre trilho com telas 3D de 18m. Faltava no catálogo — Hollywood Rip Ride Rockit, que ficava ao lado, fechou em definitivo em agosto de 2025 para dar lugar ao Fast & Furious: Hollywood Drift (2027) e por isso não entra.' }],
  [6, 'The Blues Brothers Show', 'New York', 'show', 'B', { showDurationMin: 15 }],
  [7, 'Race Through New York Starring Jimmy Fallon', 'New York', 'attraction', 'B', { minHeightCm: 102 }],
  [8, 'Fast & Furious – Supercharged', 'San Francisco', 'attraction', 'C', { minHeightCm: 102 }],
  [9, 'Beat Builders', 'San Francisco', 'show', undefined, { showDurationMin: 15, description: 'Se programado no dia.' }],
  [10, 'Harry Potter and the Escape from Gringotts', 'Diagon Alley', 'attraction', 'S', { minHeightCm: 107, lightningLane: 'express', lightningLaneRank: 1 }],
  [11, 'Ollivanders Wand Experience', 'Diagon Alley', 'experience', 'A'],
  [12, 'Knockturn Alley', 'Diagon Alley', 'experience', 'A'],
  [13, 'The Tales of Beedle the Bard', 'Diagon Alley', 'show', undefined, { showDurationMin: 15 }],
  [14, 'Celestina Warbeck and the Banshees', 'Diagon Alley', 'show', undefined, { showDurationMin: 15 }],
  [15, "Hogwarts Express – King's Cross Station", 'Diagon Alley', 'attraction', 'A', { description: 'Exige ingresso Park-to-Park.' }],
  [16, 'MEN IN BLACK Alien Attack', 'World Expo', 'attraction', 'A', { minHeightCm: 107, lightningLane: 'express', lightningLaneRank: 5 }],
  [17, 'The Simpsons Ride', 'Springfield', 'attraction', 'A', { minHeightCm: 102, lightningLane: 'express', lightningLaneRank: 7 }],
  [18, "Kang & Kodos' Twirl 'n' Hurl", 'Springfield', 'attraction', 'B', { minHeightCm: 91 }],
  [19, 'Exploração de Springfield', 'Springfield', 'experience', 'B'],
  [20, 'Trolls Trollercoaster', 'DreamWorks Land', 'attraction', 'B', { minHeightCm: 91 }],
  [21, "Po's Kung Fu Training Camp", 'DreamWorks Land', 'experience', 'C'],
  [22, "Shrek's Swamp for Little Ogres", 'DreamWorks Land', 'experience', 'C'],
  [23, 'DreamWorks Imagination Celebration', 'DreamWorks Land', 'show', 'B'],
  [24, 'Character Zone', 'DreamWorks Land', 'character', undefined],
  [25, 'E.T. Adventure', 'Hollywood', 'attraction', 'A', { minHeightCm: 86, lightningLane: 'express', lightningLaneRank: 6 }],
  [26, "Universal Orlando's Horror Make-Up Show", 'Hollywood', 'show', 'A', { showDurationMin: 25 }],
  [27, '"Animal Actors" ou eventual substituta operacional', 'Hollywood', 'show', undefined, { showDurationMin: 20, description: 'Confirmar substituta no calendário oficial mais próximo da data.' }],
  [28, 'The Bourne Stuntacular', 'Hollywood', 'show', 'S', { showDurationMin: 25 }],
  [29, 'CineSational: A Symphonic Spectacular', 'Encerramento', 'show', undefined, { lastShowtimeOfDay: true, showDurationMin: 10, description: 'Se programado no dia.' }],
];

export const UNIVERSAL_STUDIOS_FLORIDA_ITEMS = buildParkDay(
  {
    parkKey: 'usf',
    parkName: 'Universal Studios Florida',
    city: 'Orlando',
    date: '2026-09-13',
    openTime: '10:00',
    closeTime: '19:00',
  },
  ROWS
);
