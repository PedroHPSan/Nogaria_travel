// Alerta proativo de condições (chuva, parque fechado, atração em manutenção)
// cruzadas com o roteiro do dia. Módulo puro (sem I/O) — a decisão de
// dedupe/cooldown é injetada como `alreadyAlertedToday`, calculada pela
// function via consulta a whatsapp_messages (mesmo padrão de
// quotaNoticeSentToday em whatsapp-webhook/index.ts). Pendurado no
// daily-digest (já roda de hora em hora com tenant/timezone/clima
// resolvidos) — não justifica um cron dedicado.

import { isWithinQuietHours } from './reminderScheduler.ts';

export type ConditionAlertReason = 'rain' | 'park_closed' | 'attraction_closed';

export interface ConditionAlert {
  reason: ConditionAlertReason;
  message: string;
}

export interface ConditionsAlertInput {
  /** Itens do dia; só o `park` importa aqui (proxy de "atividade ao ar livre"). */
  items: { park: string | null }[];
  weather: { precipitationProbabilityMax: number } | null;
  parkStatus: { park: string; closed: boolean; attractions: { title: string; status: string }[] } | null;
  localMinutes: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  /** true = já saiu um alerta de condições pra esta viagem dentro do cooldown — sempre no máximo um por rodada. */
  alreadyAlertedToday: boolean;
}

const RAIN_THRESHOLD_PCT = 70;
const MIN_OUTDOOR_ITEMS = 3;
const MAX_FLAGGED_ATTRACTIONS = 3;

/**
 * Decide quais alertas cabem nesta execução. Silêncio (quiet hours) e
 * cooldown (`alreadyAlertedToday`) suprimem TUDO — nunca parcialmente, porque
 * a agregação em uma mensagem só depende de decidir tudo de uma vez.
 */
export function selectConditionAlerts(input: ConditionsAlertInput): ConditionAlert[] {
  if (input.alreadyAlertedToday) return [];
  if (isWithinQuietHours(input.localMinutes, input.quietHoursStart, input.quietHoursEnd)) return [];

  const alerts: ConditionAlert[] = [];
  const outdoorCount = input.items.filter(i => i.park).length;

  // Chuva alta só importa se há de fato atividade ao ar livre no dia — um
  // dia inteiro de shopping/indoor não deve gerar alerta (falso positivo mais
  // irritante possível).
  if (input.weather && input.weather.precipitationProbabilityMax >= RAIN_THRESHOLD_PCT && outdoorCount >= MIN_OUTDOOR_ITEMS) {
    alerts.push({
      reason: 'rain',
      message: `☔ ${input.weather.precipitationProbabilityMax}% de chance de chuva hoje, com ${outdoorCount} atividades ao ar livre no roteiro.`,
    });
  }

  if (input.parkStatus?.closed && outdoorCount > 0) {
    alerts.push({ reason: 'park_closed', message: `🎢 ${input.parkStatus.park} consta *fechado* hoje (fonte da comunidade).` });
  }

  const flagged = (input.parkStatus?.attractions ?? []).filter(a => a.status !== 'OPERATING').slice(0, MAX_FLAGGED_ATTRACTIONS);
  if (flagged.length > 0) {
    alerts.push({
      reason: 'attraction_closed',
      message: `⚠️ No roteiro de hoje: ${flagged.map(a => a.title).join(', ')} consta(m) fechada(s) ou em manutenção.`,
    });
  }

  return alerts;
}

/** Sempre UMA mensagem, concatenando os alertas — nunca uma por condição. */
export function formatConditionsAlertMessage(alerts: ConditionAlert[]): string {
  return [
    '🔎 *Antes de sair de hoje:*',
    ...alerts.map(a => a.message),
    '',
    'Quer que eu empurre o dia em 1h ou troque com outro dia? É só pedir.',
  ].join('\n');
}
