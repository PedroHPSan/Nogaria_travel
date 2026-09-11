import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, 'Avatar Flight of Passage', 'Pandora', 'attraction', 'S', { minHeightCm: 112, description: 'Estratégia própria conforme o acesso disponível.' }],
  [2, "Na'vi River Journey", 'Pandora', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 1 }],
  [3, "Exploração de Pandora e Valley of Mo'ara", 'Pandora', 'experience', 'B'],
  [4, 'Kilimanjaro Safaris', 'Africa', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 2 }],
  [5, 'Gorilla Falls Exploration Trail', 'Africa', 'experience', 'A'],
  [6, 'Festival of the Lion King', 'Africa', 'show', 'S', { showDurationMin: 40 }],
  [7, 'Wildlife Express Train', "Rafiki's Planet Watch", 'experience', 'B', { description: 'Narração do Robert Irwin. Trajeto de ida; o retorno faz parte da mesma experiência.' }],
  [8, "Bluey's Wild World", "Rafiki's Planet Watch", 'experience', 'B', { description: 'Substituiu Affection Section e The Animation Experience em Conservation Station (26/05/2026). Fecha 15h45.' }],
  [9, 'Expedition Everest – Legend of the Forbidden Mountain', 'Asia', 'attraction', 'S', { minHeightCm: 112, lightningLane: 'genie_plus', lightningLaneRank: 3 }],
  [10, 'Maharajah Jungle Trek', 'Asia', 'experience', 'A'],
  [11, 'Kali River Rapids', 'Asia', 'attraction', 'A', { minHeightCm: 97, lightningLane: 'genie_plus', lightningLaneRank: 4 }],
  [12, 'Feathered Friends in Flight!', 'Asia', 'show', 'A'],
  [13, 'Zootopia: Better Zoogether!', 'Discovery Island', 'show', 'A'],
  [14, 'Discovery Island Trails', 'Discovery Island', 'experience', 'B'],
  [15, 'Tree of Life e caminhos dos animais', 'Discovery Island', 'experience', 'B'],
  [16, 'Adventures with Kevin', 'Discovery Island', 'character', undefined, { description: 'Somente se o encontro estiver ocorrendo no dia.' }],
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
