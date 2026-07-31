import type { ItineraryItem, Participant } from '../types/database.types';

export interface CoverageCount {
  done: number;
  total: number;
}

export type CoverageItemType = 'attraction' | 'show' | 'experience' | 'character';

export interface DayCoverage {
  byType: Record<CoverageItemType, CoverageCount>;
  byParticipant: Record<string, CoverageCount>;
  overall: CoverageCount;
  percent: number;
}

const ITEM_TYPES: CoverageItemType[] = ['attraction', 'show', 'experience', 'character'];

function emptyCount(): CoverageCount {
  return { done: 0, total: 0 };
}

function isParticipantEligible(item: ItineraryItem, participant: Participant): boolean {
  if (item.min_height_cm && participant.height_cm && participant.height_cm < item.min_height_cm) {
    return false;
  }
  if (item.min_age_years && participant.age < item.min_age_years) {
    return false;
  }
  return true;
}

export function computeCoverage(items: ItineraryItem[], participants: Participant[]): DayCoverage {
  const byType = ITEM_TYPES.reduce((acc, type) => {
    acc[type] = emptyCount();
    return acc;
  }, {} as Record<CoverageItemType, CoverageCount>);

  const byParticipant: Record<string, CoverageCount> = {};

  const countedItems = items.filter(item => item.counts_toward_completion !== false);

  countedItems.forEach(item => {
    const type = item.item_type;
    if (!type) return;

    byType[type].total += 1;
    let anyEligibleDone = false;

    item.participant_ids.forEach(participantId => {
      const participant = participants.find(p => p.id === participantId);
      if (!participant || !isParticipantEligible(item, participant)) return;

      if (!byParticipant[participantId]) byParticipant[participantId] = emptyCount();
      byParticipant[participantId].total += 1;

      if (item.participant_status?.[participantId] === 'done') {
        byParticipant[participantId].done += 1;
        anyEligibleDone = true;
      }
    });

    if (anyEligibleDone) byType[type].done += 1;
  });

  const overall = ITEM_TYPES.reduce(
    (acc, type) => ({ done: acc.done + byType[type].done, total: acc.total + byType[type].total }),
    emptyCount()
  );

  const percent = overall.total === 0 ? 0 : Math.round((overall.done / overall.total) * 100);

  return { byType, byParticipant, overall, percent };
}
