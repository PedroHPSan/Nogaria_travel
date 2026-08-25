// Formatação de mensagens WhatsApp para o bot de viagem.
// Módulo puro (sem I/O, sem dependências Deno) para ser testável com vitest.

export interface DigestItineraryItem {
  date: string;
  time_start: string;
  time_end: string | null;
  title: string;
  category: string;
  city: string;
  park: string | null;
  min_height_cm: number | null;
  notes: string | null;
}

export interface DigestTask {
  title: string;
  due_date: string | null;
  priority: string;
}

export interface DigestFlight {
  airline: string;
  flight_number: string;
  origin_airport: string;
  destination_airport: string;
  departure_time: string;
  booking_code: string;
}

export interface DigestChild {
  nickname: string;
  height_cm: number | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  flight: '✈️',
  hotel: '🏨',
  park: '🎡',
  restaurant: '🍽️',
  shopping: '🛍️',
  tour: '🗽',
  rest: '😴',
  transit: '🚗',
  event: '🎫',
};

function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? '📌';
}

export function formatDatePtBr(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });
}

function formatItemLine(item: DigestItineraryItem, child: DigestChild | null): string {
  const timeRange = item.time_end ? `${item.time_start}–${item.time_end}` : item.time_start;
  let line = `${categoryEmoji(item.category)} *${timeRange}* • ${item.title}`;
  if (item.park) line += ` (${item.park})`;

  const childAlert =
    child && item.min_height_cm && child.height_cm && child.height_cm < item.min_height_cm;
  if (childAlert) {
    line += `\n   ⚠️ Altura mínima ${item.min_height_cm}cm — ${child!.nickname} tem ${child!.height_cm}cm (usar Rider Switch)`;
  }
  return line;
}

/**
 * Monta a mensagem da lista diária de atividades + lembretes importantes,
 * em texto formatado para WhatsApp (*negrito*).
 */
export function formatDailyDigest(input: {
  tripTitle: string;
  dateIso: string;
  items: DigestItineraryItem[];
  tasksDueSoon: DigestTask[];
  nextFlight: DigestFlight | null;
  child: DigestChild | null;
}): string {
  const { tripTitle, dateIso, items, tasksDueSoon, nextFlight, child } = input;

  const lines: string[] = [];
  lines.push(`🌎 *${tripTitle} — ROTEIRO DO DIA*`);
  lines.push(`📅 ${formatDatePtBr(dateIso)}`);
  lines.push('');

  if (items.length === 0) {
    lines.push('Nenhuma atividade cadastrada para hoje. Dia livre! 🏖️');
  } else {
    for (const item of items) {
      lines.push(formatItemLine(item, child));
      if (item.notes) lines.push(`   💡 ${item.notes}`);
    }
  }

  if (nextFlight) {
    lines.push('');
    lines.push('🚨 *LEMBRETE DE VOO (próximas 24h)*');
    const dep = new Date(nextFlight.departure_time).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
    lines.push(
      `✈️ ${nextFlight.airline} ${nextFlight.flight_number} • ${nextFlight.origin_airport} → ${nextFlight.destination_airport} • ${dep} • Localizador: *${nextFlight.booking_code}*`,
    );
  }

  if (tasksDueSoon.length > 0) {
    lines.push('');
    lines.push('⏰ *LEMBRETES (tarefas vencendo em 48h)*');
    for (const task of tasksDueSoon) {
      const due = task.due_date ? ` — vence ${formatDatePtBr(task.due_date)}` : '';
      lines.push(`• ${task.title}${due}`);
    }
  }

  return lines.join('\n');
}
