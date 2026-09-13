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

export interface DigestWeather {
  tempMaxC: number;
  tempMinC: number;
  precipitationProbabilityMax: number;
  description: string;
}

export interface DigestParkStatus {
  park: string;
  opening: string | null;
  closing: string | null;
  closed: boolean;
  attractions: { title: string; status: 'OPERATING' | 'DOWN' | 'CLOSED' | 'REFURBISHMENT' }[];
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

/** Linha curta de clima pro topo do digest — chuva só aparece se a chance for relevante (>=30%), pra não virar ruído em dia de sol. */
export function formatWeatherLine(weather: DigestWeather): string {
  const rain = weather.precipitationProbabilityMax >= 30 ? ` • ☔ ${weather.precipitationProbabilityMax}% de chance de chuva` : '';
  return `🌡️ ${weather.tempMinC}°C–${weather.tempMaxC}°C, ${weather.description}${rain}`;
}

/**
 * Linha de horário/status do parque predominante do dia, pro topo do digest.
 * Fonte da comunidade (themeparks.wiki) — nunca afirma sem qualificar; omitida
 * (retorna null) quando não há nada a dizer, para não virar ruído.
 */
export function formatParkStatusLine(status: DigestParkStatus): string | null {
  if (status.closed) return `🎢 ${status.park} consta *fechado* hoje (fonte da comunidade — confirme no app oficial).`;
  if (!status.opening && status.attractions.length === 0) return null;

  const hours = status.opening && status.closing ? ` ${status.opening}–${status.closing}` : '';
  const flagged = status.attractions.filter(a => a.status !== 'OPERATING');
  const flaggedText =
    flagged.length > 0
      ? ` ⚠️ ${flagged
          .slice(0, 3)
          .map(a => `${a.title} (${a.status === 'REFURBISHMENT' ? 'manutenção' : a.status === 'CLOSED' ? 'fechada' : 'fora do ar'})`)
          .join(', ')}`
      : '';
  return `🎢 ${status.park} hoje:${hours}.${flaggedText}`;
}

function formatItemLine(item: DigestItineraryItem, child: DigestChild | null): string {
  const timeRange = item.time_end ? `${item.time_start}–${item.time_end}` : item.time_start;
  let line = `🔹 ${categoryEmoji(item.category)} *${timeRange}* • ${item.title}`;
  if (item.park) line += ` (${item.park})`;

  const childAlert =
    child && item.min_height_cm && child.height_cm && child.height_cm < item.min_height_cm;
  if (childAlert) {
    line += `\n   👀 _Psst! A altura mínima é ${item.min_height_cm}cm. ${child!.nickname} tem ${child!.height_cm}cm, então vamos usar o Rider Switch aqui, ok?_`;
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
  /** Fuso do tenant (whatsapp_configs.timezone) — usado para converter o horário do voo, que chega em UTC do banco. */
  timezone: string;
  /** 'today' (digest da manhã) ou 'tomorrow' (prévia da noite) — só muda o texto de abertura; dateIso já vem no dia certo. */
  mode?: 'today' | 'tomorrow';
  /** Previsão do dia (Open-Meteo); ausente/null não aparece — clima é melhor-esforço, nunca bloqueia o digest. */
  weather?: DigestWeather | null;
  /** Horário/status do parque predominante do dia (themeparks.wiki); ausente/null não aparece — mesma filosofia do clima. */
  parkStatus?: DigestParkStatus | null;
}): string {
  const { tripTitle, dateIso, items, tasksDueSoon, nextFlight, child, timezone, mode = 'today', weather, parkStatus } = input;
  const isTomorrow = mode === 'tomorrow';

  const lines: string[] = [];
  lines.push(
    isTomorrow
      ? `🌙 *Boa noite, Família!* Um gostinho do que vem por aí amanhã:`
      : `☀️ *Bom dia, Família!* Hoje é dia de aventura!`,
  );
  lines.push(`📅 *${formatDatePtBr(dateIso)}* — ${tripTitle}`);
  if (weather) lines.push(formatWeatherLine(weather));
  if (parkStatus) {
    const line = formatParkStatusLine(parkStatus);
    if (line) lines.push(line);
  }
  lines.push('');

  if (items.length === 0) {
    lines.push(
      isTomorrow
        ? 'Amanhã não temos programação oficial. Dia livre! 🏖️🍹'
        : 'Hoje não temos programação oficial. Aproveitem o dia livre! 🏖️🍹',
    );
  } else {
    lines.push(isTomorrow ? '🎢 *Programação de amanhã:*' : '🎢 *Nossa programação de hoje:*');
    for (const item of items) {
      lines.push(formatItemLine(item, child));
      if (item.notes) lines.push(`   💡 _${item.notes}_`);
    }
  }

  if (nextFlight) {
    lines.push('');
    lines.push('🚨 *Atenção ao nosso voo!* ✈️');
    const dep = new Date(nextFlight.departure_time).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });
    lines.push(
      `Vamos voar com a ${nextFlight.airline} (${nextFlight.flight_number}) saindo de ${nextFlight.origin_airport} às ${dep}. Nosso localizador é *${nextFlight.booking_code}*!`,
    );
  }

  if (tasksDueSoon.length > 0) {
    lines.push('');
    lines.push('✅ *Só um lembrete rápido:*');
    for (const task of tasksDueSoon) {
      const due = task.due_date ? `(até ${formatDatePtBr(task.due_date).split(',')[1].trim()})` : '';
      lines.push(`👉 ${task.title} ${due}`);
    }
  }

  return lines.join('\n');
}

/** "45 min", "1h", "1h30" — antecedência em linguagem natural. */
export function formatLeadTime(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

export interface ReminderItem {
  time_start: string;
  title: string;
  category: string;
  park: string | null;
  city: string | null;
  notes: string | null;
  min_height_cm: number | null;
}

/**
 * Aviso de uma atividade que está prestes a começar. Mensagem curta de
 * propósito: chega no meio do dia da família, então tem que ser lida de relance.
 */
export function formatActivityReminder(input: {
  item: ReminderItem;
  minutesUntil: number;
  child: DigestChild | null;
}): string {
  const { item, minutesUntil, child } = input;
  const lines: string[] = [];

  // Arredondado pra 5 min: o valor exato (57, 58, 56...) é sempre um pouco
  // menor que a antecedência configurada — inerente a detectar a janela num
  // cron periódico, não um erro — mas soa "sempre errado" pra família porque
  // nunca bate com o número redondo que ela configurou.
  const roundedMinutesUntil = Math.max(5, Math.round(minutesUntil / 5) * 5);
  lines.push(`⏰ *Daqui a ${formatLeadTime(roundedMinutesUntil)}!* ${categoryEmoji(item.category)}`);
  lines.push(`*${item.time_start.slice(0, 5)}* • ${item.title}`);

  const place = item.park ?? item.city;
  if (place) lines.push(`📍 ${place}`);

  if (child && item.min_height_cm && child.height_cm && child.height_cm < item.min_height_cm) {
    lines.push(
      `👀 _Altura mínima ${item.min_height_cm}cm — ${child.nickname} tem ${child.height_cm}cm. Bora de Rider Switch!_`,
    );
  }

  if (item.notes) lines.push(`💡 _${item.notes}_`);

  return lines.join('\n');
}

export interface CheckinItem {
  time_start: string;
  title: string;
}

/**
 * Check-in em lote dos itens que já passaram do horário sem confirmação.
 * Sempre em lote (nunca item a item) — ver checkinScheduler.ts pro porquê.
 */
export function formatItineraryCheckin(items: CheckinItem[]): string {
  const lines = ['👋 *Só conferindo o roteiro!* Essas atividades já passaram do horário:'];
  for (const item of items) {
    lines.push(`🔸 *${item.time_start.slice(0, 5)}* • ${item.title}`);
  }
  lines.push('');
  lines.push('Rolou tudo? Me conta o que aconteceu (ex: "sim, tudo certo", "só o primeiro, o resto não deu tempo") que eu já ajusto o roteiro.');
  return lines.join('\n');
}

/**
 * Checkin diário de orçamento — só para quem tem can_manage_budget, enviado
 * junto do digest matinal (mesmo horário, mensagem separada). `estimatedUsd`
 * é a soma de itinerary_items.estimated_cost do dia, já convertida para USD.
 */
export function formatBudgetCheckinMessage(dateIso: string, estimatedUsd: number): string {
  const dateLabel = formatDatePtBr(dateIso);
  const lines = [`💰 *Controle de orçamento — ${dateLabel}*`];
  lines.push(
    estimatedUsd > 0
      ? `Custo estimado do roteiro de hoje: *US$ ${estimatedUsd.toFixed(2)}* (soma dos itens com valor estimado cadastrado).`
      : 'Nenhum item do roteiro de hoje tem custo estimado cadastrado.',
  );
  lines.push('');
  lines.push('Quanto vocês gastaram de fato? Me conta que eu já registro (ex: "gastei 45 dólares no almoço").');
  return lines.join('\n');
}
