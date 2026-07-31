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

export function buildParkDay(config: ParkDayConfig, rows: RoteiroRow[]): ItineraryItem[] {
  const openMinutes = timeToMinutes(config.openTime);
  const closeMinutes = timeToMinutes(config.closeTime);
  const spacing = (closeMinutes - openMinutes) / rows.length;

  return rows.map(([order, name, area, type, priority, extra = {}]) => {
    const operationalStatus = extra.operationalStatus ?? 'operating';
    const timeStart = extra.timeStartOverride ?? minutesToTime(openMinutes + spacing * (order - 0.5));
    const timeIsEstimated = extra.timeIsEstimated ?? extra.timeStartOverride === undefined;

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
    };

    return item;
  });
}
