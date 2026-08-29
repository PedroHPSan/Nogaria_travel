import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';

// Avatares ilustrados gerados por seed via DiceBear (MIT, roda 100% client-side
// como SVG — sem upload de foto, sem custo de storage, sem dependência de rede).
// `avatar_preset_id` no participante guarda o JSON de AvatarFilters abaixo
// (seed + filtros de gênero/cor de pele/roupa), não mais um id de galeria fixa.

export type AvatarGender = 'neutral' | 'male' | 'female';

export interface AvatarFilters {
  seed: string;
  gender?: AvatarGender;
  skinColor?: string; // hex sem '#'
  clothing?: string;
  clothesColor?: string; // hex sem '#'
  emotion?: string; // id de AVATAR_EMOTIONS
  accessory?: string; // id de ACCESSORY_OPTIONS
}

// Estilos de cabelo/barba divididos por apresentação — recorte pragmático do
// enum do avataaars pra permitir o filtro "Homem"/"Mulher" pedido, não uma
// afirmação de que cabelo tem gênero.
const MALE_TOP = [
  'shavedSides', 'shaggy', 'shaggyMullet', 'shortCurly',
  'shortFlat', 'shortRound', 'shortWaved', 'sides', 'theCaesar', 'theCaesarAndSidePart'
];
const FEMALE_TOP = [
  'bob', 'bun', 'curly', 'curvy', 'dreads', 'frida', 'fro', 'froBand',
  'longButNotTooLong', 'miaWallace', 'straight01', 'straight02', 'straightAndStrand', 'bigHair'
];

export const SKIN_TONES = ['614335', 'ae5d29', 'd08b5b', 'edb98a', 'ffdbb4', 'fd9841', 'f8d25c'];

export const CLOTHES_COLORS = [
  '262e33', '65c9ff', '5199e4', '25557c', 'e6e6e6', '929598',
  '3c4f5c', 'b1e2ff', 'a7ffc4', 'ffafb9', 'ffffb1', 'ff488e', 'ff5c5c', 'ffffff'
];

export const CLOTHING_OPTIONS: { id: string; label: string }[] = [
  { id: 'hoodie', label: 'Moletom' },
  { id: 'shirtCrewNeck', label: 'Camiseta' },
  { id: 'shirtVNeck', label: 'Camiseta V' },
  { id: 'shirtScoopNeck', label: 'Camiseta Gola U' },
  { id: 'graphicShirt', label: 'Camiseta Estampada' },
  { id: 'collarAndSweater', label: 'Suéter' },
  { id: 'blazerAndShirt', label: 'Blazer' },
  { id: 'blazerAndSweater', label: 'Blazer + Suéter' },
  { id: 'overall', label: 'Jardineira' }
];

// Combinações de olhos/sobrancelha/boca do avataaars que juntas leem como uma
// emoção reconhecível — os 3 traços variam juntos, então ficam num preset só.
export const AVATAR_EMOTIONS: {
  id: string;
  label: string;
  eyes: string;
  eyebrows: string;
  mouth: string;
}[] = [
  { id: 'happy', label: 'Feliz', eyes: 'happy', eyebrows: 'raisedExcitedNatural', mouth: 'smile' },
  { id: 'excited', label: 'Empolgado', eyes: 'surprised', eyebrows: 'raisedExcitedNatural', mouth: 'screamOpen' },
  { id: 'serious', label: 'Sério', eyes: 'default', eyebrows: 'defaultNatural', mouth: 'serious' },
  { id: 'angry', label: 'Bravo', eyes: 'squint', eyebrows: 'angryNatural', mouth: 'grimace' },
  { id: 'sad', label: 'Triste', eyes: 'cry', eyebrows: 'sadConcernedNatural', mouth: 'sad' },
  { id: 'wink', label: 'Piscando', eyes: 'wink', eyebrows: 'defaultNatural', mouth: 'twinkle' },
  { id: 'loving', label: 'Apaixonado', eyes: 'hearts', eyebrows: 'raisedExcitedNatural', mouth: 'smile' },
  { id: 'dizzy', label: 'Zonzo', eyes: 'xDizzy', eyebrows: 'upDownNatural', mouth: 'disbelief' }
];

export const ACCESSORY_OPTIONS: { id: string; label: string }[] = [
  { id: 'round', label: 'Óculos Redondo' },
  { id: 'wayfarers', label: 'Óculos Aviador' },
  { id: 'sunglasses', label: 'Óculos de Sol' },
  { id: 'prescription01', label: 'Óculos de Grau' },
  { id: 'prescription02', label: 'Óculos de Grau 2' },
  { id: 'kurt', label: 'Óculos Kurt' },
  { id: 'eyepatch', label: 'Tapa-olho' }
];

export function randomAvatarSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function encodeAvatarFilters(filters: AvatarFilters): string {
  return JSON.stringify(filters);
}

export function decodeAvatarFilters(raw: string): AvatarFilters {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.seed === 'string') {
      return parsed as AvatarFilters;
    }
  } catch {
    // Seed antiga (string simples, de antes dos filtros) — trata como seed pura.
  }
  return { seed: raw };
}

export function diceBearAvatarUri(rawPresetId: string): string {
  const filters = decodeAvatarFilters(rawPresetId);
  const options: Record<string, unknown> = { seed: filters.seed, size: 128 };

  if (filters.gender === 'male') options.top = MALE_TOP;
  else if (filters.gender === 'female') options.top = FEMALE_TOP;

  if (filters.skinColor) options.skinColor = [filters.skinColor];
  if (filters.clothing) options.clothing = [filters.clothing];
  if (filters.clothesColor) options.clothesColor = [filters.clothesColor];

  if (filters.emotion) {
    const emotion = AVATAR_EMOTIONS.find(e => e.id === filters.emotion);
    if (emotion) {
      options.eyes = [emotion.eyes];
      options.eyebrows = [emotion.eyebrows];
      options.mouth = [emotion.mouth];
    }
  }

  if (filters.accessory) {
    options.accessories = [filters.accessory];
    options.accessoriesProbability = 100;
  }

  return createAvatar(avataaars, options).toDataUri();
}
