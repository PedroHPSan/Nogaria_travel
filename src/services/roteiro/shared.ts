import type { ItineraryItem } from '../../types/database.types';

export const ROTEIRO_TRIP_ID = '9a8b7c6d-5e4f-4321-8765-4321fedcba09';

export const ROTEIRO_ALL_PARTICIPANT_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
];

export type RoteiroItemType = 'attraction' | 'show' | 'experience' | 'character';
export type RoteiroPriority = 'S' | 'A' | 'B' | 'C';
export type RoteiroLightningLane = 'none' | 'genie_plus' | 'individual' | 'express';
export type RoteiroOperationalStatus = 'operating' | 'scheduled_closure' | 'temporarily_closed' | 'refurbishment';

export interface RoteiroRowExtra {
  lightningLane?: RoteiroLightningLane;
  lightningLaneRank?: number;
  earlyClosureRisk?: boolean;
  lastShowtimeOfDay?: boolean;
  operationalStatus?: RoteiroOperationalStatus;
  countsTowardCompletion?: boolean;
  description?: string;
  timeStartOverride?: string;
  timeIsEstimated?: boolean;
  minHeightCm?: number;
  childSwitch?: boolean;
  showDurationMin?: number;
}

export type RoteiroRow = [
  order: number,
  name: string,
  area: string,
  type: RoteiroItemType,
  priority?: RoteiroPriority,
  extra?: RoteiroRowExtra
];

export interface ParkDayConfig {
  parkKey: string;
  parkName: string;
  city: string;
  date: string;
  openTime: string;
  closeTime: string;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const rounded = Math.round(minutes / 5) * 5;
  const hours = Math.floor(rounded / 60) % 24;
  const mins = rounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

const DEFAULT_SHOW_DURATION_MIN = 20;

export function buildParkDay(config: ParkDayConfig, rows: RoteiroRow[]): ItineraryItem[] {
  const openMinutes = timeToMinutes(config.openTime);
  const closeMinutes = timeToMinutes(config.closeTime);
  const spacing = (closeMinutes - openMinutes) / rows.length;

  return rows.map(([order, name, area, type, priority, extra = {}]) => {
    const operationalStatus = extra.operationalStatus ?? 'operating';
    const timeStart = extra.timeStartOverride ?? minutesToTime(openMinutes + spacing * (order - 0.5));
    const timeIsEstimated = extra.timeIsEstimated ?? extra.timeStartOverride === undefined;
    const showBlockStart = type === 'show' ? timeStart : undefined;
    const showBlockEnd =
      type === 'show'
        ? minutesToTime(timeToMinutes(timeStart) + (extra.showDurationMin ?? DEFAULT_SHOW_DURATION_MIN))
        : undefined;

    const item: ItineraryItem = {
      id: `${config.parkKey}-${String(order).padStart(3, '0')}`,
      trip_id: ROTEIRO_TRIP_ID,
      date: config.date,
      time_start: timeStart,
      city: config.city,
      title: name,
      category: 'park',
      description: extra.description,
      location: config.parkName,
      participant_ids: ROTEIRO_ALL_PARTICIPANT_IDS,
      status: 'planned',
      child_friendly: true,
      park: config.parkName,
      area,
      base_order: order,
      item_type: type,
      priority_tier: priority,
      lightning_lane: extra.lightningLane ?? 'none',
      lightning_lane_priority_rank: extra.lightningLaneRank,
      single_rider: false,
      child_switch: extra.childSwitch ?? false,
      min_height_cm: extra.minHeightCm,
      early_closure_risk: extra.earlyClosureRisk ?? false,
      operational_status: operationalStatus,
      counts_toward_completion: extra.countsTowardCompletion ?? (operationalStatus === 'operating'),
      participant_status: {},
      time_is_estimated: timeIsEstimated,
      last_showtime_of_day: extra.lastShowtimeOfDay ?? false,
      show_block_start: showBlockStart,
      show_block_end: showBlockEnd,
    };

    return item;
  });
}

/**
 * Linha de um **dia operacional**: ao contrário de `buildParkDay`, que distribui
 * as atrações uniformemente entre abertura e fechamento, aqui cada bloco tem
 * horário decidido à mão (fila de rope drop, âncora de reserva, travessia a pé).
 */
export interface OperationalRow {
  order: number;
  /** Início local, HH:MM. */
  start: string;
  /** Fim local, HH:MM. Vira `time_end`. */
  end?: string;
  title: string;
  category: ItineraryItem['category'];
  area: string;
  itemType?: RoteiroItemType;
  priority?: RoteiroPriority;
  status?: ItineraryItem['status'];
  description?: string;
  /** Vai junto no aviso de WhatsApp (`💡 _<notes>_`) — manter curto e acionável. */
  notes?: string;
  planB?: string;
  minHeightCm?: number;
  childSwitch?: boolean;
  /**
   * Antecedência do aviso, em minutos. `0` desliga — é assim que um dia de 30
   * blocos vira ~9 avisos em vez de 30 mensagens por pessoa.
   */
  reminderMinutesBefore?: number;
  recommendedArrivalMinBefore?: number;
  recommendedWindow?: string;
  /** Default `true`; `false` marca horário travado (reserva, abertura, show). */
  timeIsEstimated?: boolean;
  countsTowardCompletion?: boolean;
  lastShowtimeOfDay?: boolean;
  showDurationMin?: number;
  /** Sobrepõe a cidade do dia (blocos de hotel/deslocamento fora do parque). */
  city?: string;
  location?: string;
}

export interface OperationalDayConfig {
  parkKey: string;
  parkName: string;
  city: string;
  date: string;
}

/**
 * Monta um dia com horários explícitos. `lightning_lane` sai `'none'` em todos
 * os itens por construção: um dia operacional só existe porque não há fila
 * paga para reordenar o roteiro.
 */
export function buildOperationalDay(
  config: OperationalDayConfig,
  rows: OperationalRow[]
): ItineraryItem[] {
  return rows.map(row => {
    const isShow = row.itemType === 'show';
    const showBlockEnd = isShow
      ? minutesToTime(timeToMinutes(row.start) + (row.showDurationMin ?? DEFAULT_SHOW_DURATION_MIN))
      : undefined;

    const item: ItineraryItem = {
      id: `${config.parkKey}-${String(row.order).padStart(3, '0')}`,
      trip_id: ROTEIRO_TRIP_ID,
      date: config.date,
      time_start: row.start,
      time_end: row.end,
      city: row.city ?? config.city,
      title: row.title,
      category: row.category,
      description: row.description,
      location: row.location ?? config.parkName,
      participant_ids: ROTEIRO_ALL_PARTICIPANT_IDS,
      status: row.status ?? 'planned',
      min_height_cm: row.minHeightCm,
      child_friendly: true,
      notes: row.notes,
      park: config.parkName,
      area: row.area,
      base_order: row.order,
      item_type: row.itemType,
      priority_tier: row.priority,
      lightning_lane: 'none',
      single_rider: false,
      child_switch: row.childSwitch ?? false,
      recommended_window: row.recommendedWindow,
      early_closure_risk: false,
      operational_status: 'operating',
      // Sem `item_type` o bloco é logística (deslocamento, pausa): não entra na
      // métrica de cobertura do dia.
      counts_toward_completion: row.countsTowardCompletion ?? row.itemType !== undefined,
      participant_status: {},
      plan_b: row.planB,
      time_is_estimated: row.timeIsEstimated ?? true,
      show_block_start: isShow ? row.start : undefined,
      show_block_end: showBlockEnd,
      recommended_arrival_min_before: row.recommendedArrivalMinBefore,
      last_showtime_of_day: row.lastShowtimeOfDay ?? false,
      reminder_minutes_before: row.reminderMinutesBefore,
    };

    return item;
  });
}
