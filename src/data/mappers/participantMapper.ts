import type { Participant } from '../../types/database.types';

/**
 * Linha da tabela public.participants exatamente como o Postgres devolve.
 * Repare no que NÃO existe: não há coluna `age` nem `quota_eligible`.
 */
export interface ParticipantRow {
  id: string;
  trip_id: string;
  full_name: string;
  nickname: string | null;
  birth_date: string;
  is_minor: boolean;
  relationship: string;
  responsible_participant_id: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  visa_status: 'valid' | 'pending' | 'exempt' | 'expired' | null;
  dietary_restrictions: string[] | null;
  height_cm: number | null;
  whatsapp_phone: string | null;
  notes: string | null;
  budget_limit_usd: number;
  avatar_preset_id: string | null;
  avatar_emoji: string | null;
  avatar_color: string | null;
}

/**
 * Idade em anos completos. `today` entra por parâmetro para o cálculo ser
 * determinístico em teste — nada aqui lê o relógio.
 * Datas no formato ISO `YYYY-MM-DD`.
 */
export function deriveAge(birthDate: string, today: string): number {
  if (!birthDate || !today) return 0;

  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  if (!by || !bm || !bd || !ty || !tm || !td) return 0;

  let age = ty - by;
  // Ainda não fez aniversário este ano.
  if (tm < bm || (tm === bm && td < bd)) age -= 1;

  return age > 0 ? age : 0;
}

export function participantFromRow(row: ParticipantRow, today: string): Participant {
  const age = deriveAge(row.birth_date, today);
  return {
    id: row.id,
    trip_id: row.trip_id,
    full_name: row.full_name,
    nickname: row.nickname ?? undefined,
    birth_date: row.birth_date,
    age,
    // Derivado, não lido da coluna: a data de nascimento é a única verdade.
    is_minor: age < 18,
    relationship: row.relationship,
    responsible_participant_id: row.responsible_participant_id ?? undefined,
    passport_number: row.passport_number ?? undefined,
    passport_expiry: row.passport_expiry ?? undefined,
    visa_status: row.visa_status ?? undefined,
    dietary_restrictions: row.dietary_restrictions ?? undefined,
    height_cm: row.height_cm ?? undefined,
    whatsapp_phone: row.whatsapp_phone ?? undefined,
    notes: row.notes ?? undefined,
    budget_limit_usd: row.budget_limit_usd,
    avatar_preset_id: row.avatar_preset_id,
    avatar_emoji: row.avatar_emoji,
    avatar_color: row.avatar_color,
  };
}

export function participantToInsert(p: Participant, today: string): ParticipantRow {
  return {
    id: p.id,
    trip_id: p.trip_id,
    full_name: p.full_name,
    nickname: p.nickname ?? null,
    birth_date: p.birth_date,
    is_minor: deriveAge(p.birth_date, today) < 18,
    relationship: p.relationship,
    responsible_participant_id: p.responsible_participant_id ?? null,
    passport_number: p.passport_number ?? null,
    passport_expiry: p.passport_expiry ?? null,
    visa_status: p.visa_status ?? null,
    dietary_restrictions: p.dietary_restrictions ?? null,
    height_cm: p.height_cm ?? null,
    whatsapp_phone: p.whatsapp_phone ?? null,
    notes: p.notes ?? null,
    budget_limit_usd: p.budget_limit_usd,
    avatar_preset_id: p.avatar_preset_id ?? null,
    avatar_emoji: p.avatar_emoji ?? null,
    avatar_color: p.avatar_color ?? null,
  };
}
