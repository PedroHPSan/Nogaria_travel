import type { ItineraryItem } from '../types/database.types';

/**
 * Normaliza strings de horário para formato HH:MM de comparação segura.
 * Trata "8:30" -> "08:30", "08:40:00" -> "08:40", vazios -> "00:00".
 */
export function normalizeTime(t?: string | null): string {
  if (!t) return '00:00';
  const trimmed = t.trim();
  const parts = trimmed.split(':');
  const hours = (parts[0] || '0').padStart(2, '0');
  const minutes = (parts[1] || '0').padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Compara dois itens de roteiro cronologicamente:
 * 1. Data (YYYY-MM-DD)
 * 2. Horário de início normalizado (HH:MM)
 * 3. Ordem base (base_order / sequência no parque)
 * 4. Horário de término normalizado (HH:MM)
 * 5. Título alfabético
 * 6. ID
 */
export function compareItineraryChronological(a: ItineraryItem, b: ItineraryItem): number {
  const dateA = a.date || '';
  const dateB = b.date || '';
  if (dateA !== dateB) return dateA.localeCompare(dateB);

  const timeA = normalizeTime(a.time_start);
  const timeB = normalizeTime(b.time_start);
  if (timeA !== timeB) return timeA.localeCompare(timeB);

  const orderA = a.base_order ?? 0;
  const orderB = b.base_order ?? 0;
  if (orderA !== orderB) return orderA - orderB;

  const endA = normalizeTime(a.time_end);
  const endB = normalizeTime(b.time_end);
  if (endA !== endB) return endA.localeCompare(endB);

  const titleA = a.title || '';
  const titleB = b.title || '';
  if (titleA !== titleB) return titleA.localeCompare(titleB);

  return (a.id || '').localeCompare(b.id || '');
}

/**
 * Retorna uma nova lista de itens ordenada cronologicamente de forma imutável.
 */
export function sortItineraryChronologically(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort(compareItineraryChronological);
}
