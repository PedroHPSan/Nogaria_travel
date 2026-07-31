import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, "Hagrid's Magical Creatures Motorbike Adventure", 'Hogsmeade', 'attraction', 'S', { description: 'Estratégia própria — pode não aceitar Express na mesma modalidade das demais atrações.' }],
  [2, 'Harry Potter and the Forbidden Journey', 'Hogsmeade', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 2 }],
  [3, 'Flight of the Hippogriff', 'Hogsmeade', 'attraction', 'A'],
  [4, 'Ollivanders', 'Hogsmeade', 'experience', 'A'],
  [5, 'Frog Choir', 'Hogsmeade', 'show'],
  [6, 'Triwizard Spirit Rally', 'Hogsmeade', 'show'],
  [7, 'Hogwarts Express – Hogsmeade Station', 'Hogsmeade', 'attraction', 'A', { description: 'Exige ingresso Park-to-Park.' }],
  [8, 'Jurassic World VelociCoaster', 'Jurassic Park', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 1 }],
  [9, 'Pteranodon Flyers', 'Jurassic Park', 'attraction', 'B', { description: 'Restrições específicas para adultos sem criança acompanhante.' }],
  [10, 'Camp Jurassic', 'Jurassic Park', 'experience', 'B'],
  [11, 'Jurassic Park Discovery Center', 'Jurassic Park', 'experience', 'B'],
  [12, 'Raptor Encounter', 'Jurassic Park', 'character', 'A'],
  [13, 'Jurassic Park River Adventure', 'Jurassic Park', 'attraction', undefined, { operationalStatus: 'scheduled_closure', countsTowardCompletion: false, description: 'Fechamento programado de 5 de janeiro a 19 de novembro de 2026 — não conta no percentual de conclusão.' }],
  [14, 'Skull Island: Reign of Kong', 'Skull Island', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 7 }],
  [15, "Dudley Do-Right's Ripsaw Falls", 'Toon Lagoon', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 5 }],
  [16, "Popeye & Bluto's Bilge-Rat Barges", 'Toon Lagoon', 'attraction', 'A', { lightningLane: 'express', lightningLaneRank: 6 }],
  [17, 'Me Ship, the Olive', 'Toon Lagoon', 'experience', 'C'],
  [18, 'The Incredible Hulk Coaster', 'Marvel Super Hero Island', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 4 }],
  [19, 'The Amazing Adventures of Spider-Man', 'Marvel Super Hero Island', 'attraction', 'S', { lightningLane: 'express', lightningLaneRank: 3 }],
  [20, "Doctor Doom's Fearfall", 'Marvel Super Hero Island', 'attraction', 'A'],
  [21, 'Storm Force Accelatron', 'Marvel Super Hero Island', 'attraction', 'B'],
  [22, 'Encontro dos heróis Marvel', 'Marvel Super Hero Island', 'character', undefined],
  [23, 'The High in the Sky Seuss Trolley Train Ride!', 'Seuss Landing', 'attraction', 'A'],
  [24, 'The Cat in the Hat', 'Seuss Landing', 'attraction', 'A'],
  [25, 'One Fish, Two Fish, Red Fish, Blue Fish', 'Seuss Landing', 'attraction', 'B'],
  [26, 'Caro-Seuss-el', 'Seuss Landing', 'attraction', 'B'],
  [27, 'If I Ran the Zoo', 'Seuss Landing', 'experience', 'C'],
  [28, "Oh, the Stories You'll Hear", 'Seuss Landing', 'show', undefined, { description: 'Se programado no dia.' }],
  [29, 'Exploração temática da área', 'Lost Continent', 'experience', 'C'],
  [30, 'The Mystic Fountain', 'Lost Continent', 'experience', 'C'],
];

export const ISLANDS_OF_ADVENTURE_ITEMS = buildParkDay(
  {
    parkKey: 'ioa',
    parkName: "Universal's Islands of Adventure",
    city: 'Orlando',
    date: '2026-09-15',
    openTime: '07:00',
    closeTime: '19:00',
  },
  ROWS
);
