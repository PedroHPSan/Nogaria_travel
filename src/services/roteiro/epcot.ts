import { buildParkDay, type RoteiroRow } from './shared';

const ROWS: RoteiroRow[] = [
  [1, 'Guardians of the Galaxy: Cosmic Rewind', 'World Discovery', 'attraction', 'S', { lightningLane: 'individual', description: 'Estratégia própria conforme o sistema de acesso disponível na viagem.' }],
  [2, 'Test Track', 'World Discovery', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 3 }],
  [3, 'Mission: SPACE – Orange Mission', 'World Discovery', 'attraction', 'A', { lightningLane: 'genie_plus', lightningLaneRank: 6, description: 'Mesma atração-base da versão Green; registradas separadamente só para métrica de cobertura.' }],
  [4, 'Mission: SPACE – Green Mission', 'World Discovery', 'attraction', 'B'],
  [5, 'Advanced Training Lab', 'World Discovery', 'experience', 'C'],
  [6, "Soarin' Across America", 'World Nature', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 4, description: 'Versão de verão 2026 válida até 08/09 — confirmar no calendário oficial na data.' }],
  [7, 'Living with the Land', 'World Nature', 'attraction', 'A'],
  [8, 'Awesome Planet', 'World Nature', 'show', 'B'],
  [9, 'The Seas with Nemo & Friends', 'World Nature', 'attraction', 'A'],
  [10, 'SeaBase Aquarium', 'World Nature', 'experience', 'B'],
  [11, 'Turtle Talk with Crush', 'World Nature', 'attraction', 'A'],
  [12, 'Journey of Water, Inspired by Moana', 'World Nature', 'experience', 'B'],
  [13, 'Spaceship Earth', 'World Celebration', 'attraction', 'A', { lightningLane: 'genie_plus', lightningLaneRank: 5 }],
  [14, 'Project Tomorrow', 'World Celebration', 'experience', 'C'],
  [15, 'Journey Into Imagination with Figment', 'World Celebration', 'attraction', 'B'],
  [16, 'ImageWorks – The "What If" Labs', 'World Celebration', 'experience', 'C'],
  [17, 'Disney & Pixar Short Film Festival', 'World Celebration', 'attraction', 'B'],
  [18, 'Gran Fiesta Tour Starring The Three Caballeros', 'México', 'attraction', 'A'],
  [19, 'Exploração do Pavilhão do México', 'México', 'experience', 'C'],
  [20, 'Frozen Ever After', 'Noruega', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 2 }],
  [21, 'Akershus Royal Banquet Hall', 'Noruega', 'experience', undefined, { timeStartOverride: '15:15', timeIsEstimated: false, description: 'Reserva confirmada às 15h15.' }],
  [22, 'Reflections of China', 'China', 'show', 'B'],
  [23, 'Exploração da Alemanha', 'Alemanha', 'experience', 'C'],
  [24, 'Exploração da Itália', 'Itália', 'experience', 'C'],
  [25, 'The American Adventure', 'Estados Unidos', 'show', 'A'],
  [26, 'Voices of Liberty', 'Estados Unidos', 'show'],
  [27, 'Exploração do Japão', 'Japão', 'experience', 'C'],
  [28, 'Exploração do Marrocos', 'Marrocos', 'experience', 'C'],
  [29, "Remy's Ratatouille Adventure", 'França', 'attraction', 'S', { lightningLane: 'genie_plus', lightningLaneRank: 1 }],
  [30, 'Beauty and the Beast Sing-Along', 'França', 'show', 'B'],
  [31, 'Exploração do Reino Unido', 'Reino Unido', 'experience', 'C'],
  [32, 'Canada Far and Wide in Circle-Vision 360', 'Canadá', 'show', 'B'],
  [33, 'Luminous: The Symphony of Us', 'Encerramento', 'show', undefined, { lastShowtimeOfDay: true, description: 'Conforme programação oficial da data.' }],
];

export const EPCOT_ITEMS = buildParkDay(
  {
    parkKey: 'ec',
    parkName: 'EPCOT',
    city: 'Lake Buena Vista',
    date: '2026-09-08',
    openTime: '09:00',
    closeTime: '21:00',
  },
  ROWS
);
