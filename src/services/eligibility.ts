import type { ItineraryItem, Participant } from '../types/database.types';

/**
 * Regras de elegibilidade de um participante numa atração — a única fonte para
 * auditoria (`auditEngine.ts`), cobertura (`coverageEngine.ts`) e os alertas
 * inline da tela de roteiro. Operam sobre dados (`height_cm`, `birth_date`
 * derivada em `age`), nunca sobre nomes: até a issue #31 a tela de roteiro
 * comparava `nickname === 'Gabi'`, o que zerava os alertas em qualquer outro
 * tenant.
 */
export function isBelowMinHeight(item: ItineraryItem, participant: Participant): boolean {
  return Boolean(item.min_height_cm && participant.height_cm && participant.height_cm < item.min_height_cm);
}

export function isBelowMinAge(item: ItineraryItem, participant: Participant): boolean {
  return Boolean(item.min_age_years && participant.age < item.min_age_years);
}

export function isParticipantEligible(item: ItineraryItem, participant: Participant): boolean {
  return !isBelowMinHeight(item, participant) && !isBelowMinAge(item, participant);
}

/** Participantes do item que não atingem a altura mínima, do mais baixo ao mais alto. */
export function participantsBelowMinHeight(item: ItineraryItem, participants: Participant[]): Participant[] {
  return participants
    .filter(p => isBelowMinHeight(item, p))
    .sort((a, b) => (a.height_cm ?? 0) - (b.height_cm ?? 0));
}

/** Menor de idade mais baixo com altura cadastrada — referência dos textos de alerta. */
export function shortestMinorWithHeight(participants: Participant[]): Participant | null {
  const minors = participants.filter(p => p.is_minor && p.height_cm);
  return minors.sort((a, b) => (a.height_cm ?? 0) - (b.height_cm ?? 0))[0] ?? null;
}
