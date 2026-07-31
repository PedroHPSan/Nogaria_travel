import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, "Illumination's Villain-Con Minion Blast", 'Minion Land', 'attraction', 'A'],
  [2, 'Despicable Me Minion Mayhem', 'Minion Land', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 4 }],
  [3, 'Illumination Theater e encontros', 'Minion Land', 'experience', 'B'],
  [4, 'Revenge of the Mummy', 'New York', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 2 }],
  [5, 'The Blues Brothers Show', 'New York', 'show', 'B', { showDurationMin: 15 }],
  [6, 'Race Through New York Starring Jimmy Fallon', 'New York', 'attraction', 'B'],
  [7, 'Fast & Furious – Supercharged', 'San Francisco', 'attraction', 'C'],
  [8, 'Beat Builders', 'San Francisco', 'show', undefined, { showDurationMin: 15, description: 'Se programado no dia.' }],
  [9, 'Harry Potter and the Escape from Gringotts', 'Diagon Alley', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 1 }],
  [10, 'Ollivanders Wand Experience', 'Diagon Alley', 'experience', 'A'],
  [11, 'Knockturn Alley', 'Diagon Alley', 'experience', 'A'],
  [12, 'The Tales of Beedle the Bard', 'Diagon Alley', 'show', undefined, { showDurationMin: 15 }],
  [13, 'Celestina Warbeck and the Banshees', 'Diagon Alley', 'show', undefined, { showDurationMin: 15 }],
  [14, "Hogwarts Express – King's Cross Station", 'Diagon Alley', 'attraction', 'A', { description: 'Exige ingresso Park-to-Park.' }],
  [15, 'MEN IN BLACK Alien Attack', 'World Expo', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 5 }],
  [16, 'The Simpsons Ride', 'Springfield', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 3 }],
  [17, "Kang & Kodos' Twirl 'n' Hurl", 'Springfield', 'attraction', 'B'],
  [18, 'Exploração de Springfield', 'Springfield', 'experience', 'B'],
  [19, 'Trolls Trollercoaster', 'DreamWorks Land', 'attraction', 'B'],
  [20, "Po's Kung Fu Training Camp", 'DreamWorks Land', 'experience', 'C'],
  [21, "Shrek's Swamp for Little Ogres", 'DreamWorks Land', 'experience', 'C'],
  [22, 'DreamWorks Imagination Celebration', 'DreamWorks Land', 'show', 'B'],
  [23, 'Character Zone', 'DreamWorks Land', 'character', undefined],
  [24, 'E.T. Adventure', 'Hollywood', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 6 }],
  [25, "Universal Orlando's Horror Make-Up Show", 'Hollywood', 'show', 'A', { showDurationMin: 25 }],
  [26, '"Animal Actors" ou eventual substituta operacional', 'Hollywood', 'show', undefined, { showDurationMin: 20, description: 'Confirmar substituta no calendário oficial mais próximo da data.' }],
  [27, 'The Bourne Stuntacular', 'Hollywood', 'show', 'S', { showDurationMin: 25 }],
  [28, 'CineSational: A Symphonic Spectacular', 'Encerramento', 'show', undefined, { lastShowtimeOfDay: true, showDurationMin: 10, description: 'Se programado no dia.' }],
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
