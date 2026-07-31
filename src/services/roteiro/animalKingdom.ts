import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, 'Avatar Flight of Passage', 'Pandora', 'attraction', 'S', { description: 'Estratégia própria conforme o acesso disponível.' }],
  [2, "Na'vi River Journey", 'Pandora', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 1 }],
  [3, "Exploração de Pandora e Valley of Mo'ara", 'Pandora', 'experience', 'B'],
  [4, 'Kilimanjaro Safaris', 'Africa', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 2 }],
  [5, 'Gorilla Falls Exploration Trail', 'Africa', 'experience', 'A'],
  [6, 'Festival of the Lion King', 'Africa', 'show', 'S'],
  [7, 'Wildlife Express Train', "Rafiki's Planet Watch", 'experience', 'B', { description: 'Trajeto de ida; o retorno faz parte da mesma experiência.' }],
  [8, 'Affection Section', "Rafiki's Planet Watch", 'experience', 'B'],
  [9, 'Conservation Station', "Rafiki's Planet Watch", 'experience', 'B'],
  [10, 'Animation Experience at Conservation Station', "Rafiki's Planet Watch", 'experience', 'A'],
  [11, 'Expedition Everest – Legend of the Forbidden Mountain', 'Asia', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 3 }],
  [12, 'Maharajah Jungle Trek', 'Asia', 'experience', 'A'],
  [13, 'Kali River Rapids', 'Asia', 'attraction', 'A', { lightningLane: 'genie_plus', lightningLaneRank: 4 }],
  [14, 'Feathered Friends in Flight!', 'Asia', 'show', 'A'],
  [15, 'Zootopia: Better Zoogether!', 'Discovery Island', 'show', 'A'],
  [16, 'Discovery Island Trails', 'Discovery Island', 'experience', 'B'],
  [17, 'Tree of Life e caminhos dos animais', 'Discovery Island', 'experience', 'B'],
  [18, 'Adventures with Kevin', 'Discovery Island', 'character', undefined, { description: 'Somente se o encontro estiver ocorrendo no dia.' }],
  [19, 'Pandora à noite', 'Pandora', 'experience', 'C', { description: 'Somente se o parque permanecer aberto após escurecer.' }],
];

export const ANIMAL_KINGDOM_ITEMS = buildParkDay(
  {
    parkKey: 'ak',
    parkName: "Disney's Animal Kingdom",
    city: 'Lake Buena Vista',
    date: '2026-09-11',
    openTime: '07:10',
    closeTime: '16:00',
  },
  ROWS
);
