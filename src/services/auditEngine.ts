import type {
  Trip,
  Participant,
  Flight,
  Accommodation,
  TransportReservation,
  ItineraryItem,
  GiftCard,
  PurchaseItem,
  AuditFinding,
  Expense
} from '../types/database.types';
import { isBelowMinAge, isBelowMinHeight } from './eligibility';

export interface AuditInput {
  trip: Trip;
  participants: Participant[];
  flights: Flight[];
  accommodations: Accommodation[];
  transports: TransportReservation[];
  itinerary: ItineraryItem[];
  giftCards: GiftCard[];
  purchases: PurchaseItem[];
  expenses: Expense[];
}

/** Mínimo entre devolução do carro e decolagem (voo internacional com despacho). */
const MIN_CAR_DROPOFF_TO_FLIGHT_HOURS = 3;
/** Validade mínima do passaporte exigida por muitos destinos, contada a partir da volta. */
const PASSPORT_VALIDITY_MONTHS_AFTER_TRIP = 6;
/** Duração assumida para um item de roteiro sem `time_end` na checagem de sobreposição. */
const DEFAULT_ITEM_DURATION_MIN = 30;

const ACTIVE_FLIGHT_STATUSES: Flight['status'][] = ['booked', 'confirmed', 'changed'];

const displayName = (p: Participant) => p.nickname || p.full_name;

/** `YYYY-MM-DD` de um ISO datetime (ou já-data). Sem fuso: compara dias civis. */
const dateOnly = (iso: string) => iso.slice(0, 10);

const formatBr = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-');
  return y && m && d ? `${d}/${m}/${y}` : isoDate;
};

/** Soma dias a uma data `YYYY-MM-DD` sem depender do fuso do navegador. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d + days);
  return new Date(t).toISOString().slice(0, 10);
}

function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = Date.UTC(y, m - 1 + months, d);
  return new Date(t).toISOString().slice(0, 10);
}

/** Minutos desde a meia-noite de um `HH:MM`; `null` para valor ausente/malformado. */
function toMinutes(time?: string): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ---------------------------------------------------------------------------
// Regras. Cada uma é uma função pura (input → findings) para poder ser testada
// isoladamente e para o `runFullTripAudit` ser só a composição.
// ---------------------------------------------------------------------------

function auditCarDropoff(data: AuditInput): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const rentalCars = data.transports.filter(t => t.type === 'rental_car' && t.status === 'reserved');

  rentalCars.forEach(car => {
    const dropoffDate = new Date(car.dropoff_time);
    const dropoffLabel = dropoffDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    findings.push({
      id: `audit-car-followup-${car.id}`,
      code: 'CAR_DROPOFF_FOLLOWUP_REQUIRED',
      severity: 'critical',
      category: 'logistics',
      title: `Devolução do carro alugado exige transporte complementar (${dropoffLabel})`,
      description: `O veículo será devolvido na locadora em ${dropoffLabel}. É necessário transporte (Uber/transfer) para a próxima hospedagem ou aeroporto.`,
      affected_entities: [car.provider_company || 'Veículo alugado', ...data.participants.map(displayName)],
      recommendation: `Agendar Uber ou transfer para logo após ${dropoffLabel}.`,
      resolved: false
    });

    data.flights
      .filter(f => ACTIVE_FLIGHT_STATUSES.includes(f.status))
      .forEach(flight => {
        const departureDate = new Date(flight.departure_time);
        if (departureDate <= dropoffDate) return;
        const diffHours = (departureDate.getTime() - dropoffDate.getTime()) / (1000 * 60 * 60);
        if (diffHours >= MIN_CAR_DROPOFF_TO_FLIGHT_HOURS) return;
        findings.push({
          id: `audit-flight-${flight.id}`,
          code: 'INSUFFICIENT_TRANSFER_TIME',
          severity: 'critical',
          category: 'logistics',
          title: `Tempo curto entre devolução do carro e voo ${flight.flight_number}`,
          description: `Apenas ${diffHours.toFixed(1)} horas entre a devolução do carro e a partida do voo. Recomenda-se no mínimo ${MIN_CAR_DROPOFF_TO_FLIGHT_HOURS}h para voos com despacho de bagagem.`,
          affected_entities: [flight.flight_number],
          recommendation: 'Antecipar a devolução do veículo ou remarcar o horário do voo.',
          resolved: false
        });
      });
  });

  return findings;
}

function auditAccommodations(data: AuditInput): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const active = data.accommodations.filter(a => a.status === 'confirmed');

  if (active.length === 0) {
    findings.push({
      id: 'audit-hotel-01',
      code: 'NO_ACTIVE_ACCOMMODATION',
      severity: 'critical',
      category: 'logistics',
      title: 'Viagem sem hospedagens confirmadas',
      description: 'Nenhuma hospedagem com status confirmado para o período da viagem.',
      affected_entities: ['Todos os participantes'],
      recommendation: 'Confirmar as reservas de hospedagem ou marcar as reservas existentes como confirmadas.',
      resolved: false
    });
  }

  const replaced = data.accommodations.filter(a => a.status === 'replaced');
  if (replaced.length > 0) {
    findings.push({
      id: 'audit-hotel-02',
      code: 'REPLACED_HOTEL_ARCHIVED',
      severity: 'info',
      category: 'logistics',
      title: 'Histórico de troca de hospedagem arquivado',
      description: `${replaced.length} hospedagem(ns) substituída(s) preservada(s) com o motivo vinculado a Decisões.`,
      affected_entities: replaced.map(h => h.name),
      recommendation: 'Nenhuma ação necessária. Histórico preservado para auditoria.',
      resolved: true
    });
  }

  return findings;
}

/**
 * Voo × check-in, genérico: a janela em que a família está no destino é
 * [chegada do primeiro voo, partida do último voo] — ou as datas da viagem,
 * quando não há voo cadastrado. Toda noite dessa janela precisa de uma
 * hospedagem confirmada cobrindo; noites descobertas viram um finding só
 * (listando as datas), e diárias pagas antes da chegada viram aviso.
 */
function auditAccommodationCoverage(data: AuditInput): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const active = data.accommodations.filter(a => a.status === 'confirmed' && a.check_in && a.check_out);
  if (active.length === 0) return findings; // NO_ACTIVE_ACCOMMODATION já cobre.

  const flights = data.flights
    .filter(f => ACTIVE_FLIGHT_STATUSES.includes(f.status) && f.arrival_time && f.departure_time)
    .sort((a, b) => a.arrival_time.localeCompare(b.arrival_time));

  const arrival = flights[0] ? dateOnly(flights[0].arrival_time) : data.trip.start_date;
  const lastDeparture = flights.length
    ? dateOnly(flights.reduce((max, f) => (f.departure_time > max.departure_time ? f : max)).departure_time)
    : data.trip.end_date;
  if (!arrival || !lastDeparture || arrival > lastDeparture) return findings;

  const covered = (night: string) => active.some(a => a.check_in <= night && night < a.check_out);

  const uncovered: string[] = [];
  for (let night = arrival; night < lastDeparture; night = addDays(night, 1)) {
    if (!covered(night)) uncovered.push(night);
  }

  if (uncovered.length > 0) {
    const shown = uncovered.slice(0, 5).map(formatBr).join(', ');
    findings.push({
      id: 'audit-hotel-gap',
      code: 'ACCOMMODATION_GAP',
      severity: 'critical',
      category: 'logistics',
      title: `${uncovered.length} noite(s) sem hospedagem confirmada`,
      description: `Entre a chegada (${formatBr(arrival)}) e a partida (${formatBr(lastDeparture)}) há noite(s) sem hospedagem cobrindo: ${shown}${uncovered.length > 5 ? '…' : ''}.`,
      affected_entities: ['Todos os participantes'],
      recommendation: 'Reservar hospedagem para as datas descobertas ou ajustar check-in/check-out das reservas existentes.',
      resolved: false
    });
  }

  active
    .filter(a => a.check_in < arrival)
    .forEach(a => {
      findings.push({
        id: `audit-hotel-early-${a.id}`,
        code: 'ACCOMMODATION_BEFORE_ARRIVAL',
        severity: 'warning',
        category: 'logistics',
        title: `Check-in em ${a.name} antes da chegada`,
        description: `Check-in em ${formatBr(a.check_in)}, mas a chegada ao destino é ${formatBr(arrival)}. Diária(s) pagas sem uso, a menos que seja intencional.`,
        affected_entities: [a.name],
        recommendation: 'Confirmar se a reserva antecipada é proposital ou ajustar a data de check-in.',
        resolved: false
      });
    });

  return findings;
}

function auditChildRestrictions(data: AuditInput): AuditFinding[] {
  const findings: AuditFinding[] = [];

  data.participants.forEach(participant => {
    const name = displayName(participant);

    if (participant.is_minor && !participant.responsible_participant_id) {
      findings.push({
        id: `audit-minor-guardian-${participant.id}`,
        code: 'MINOR_WITHOUT_GUARDIAN',
        severity: 'warning',
        category: 'child_safety',
        title: `${name} é menor de idade sem responsável vinculado`,
        description: `${participant.full_name} tem ${participant.age} anos e não tem um responsável legal indicado no cadastro.`,
        affected_entities: [participant.full_name],
        recommendation: 'Editar o participante e selecionar o responsável legal (necessário para consentimento e para embarque de menores).',
        resolved: false
      });
    }

    data.itinerary
      .filter(item => item.participant_ids.length === 0 || item.participant_ids.includes(participant.id))
      .forEach(item => {
        if (isBelowMinHeight(item, participant)) {
          findings.push({
            id: `audit-child-height-${item.id}-${participant.id}`,
            code: 'CHILD_HEIGHT_RESTRICTION',
            severity: 'warning',
            category: 'child_safety',
            title: `Atração '${item.title}' exige altura mínima de ${item.min_height_cm}cm`,
            description: `${participant.full_name} tem ${participant.height_cm}cm. Não poderá ir nesta atração.`,
            affected_entities: [participant.full_name, item.title],
            recommendation: `Planejar troca de acompanhantes (Rider Switch / Child Swap) ou atividade alternativa para ${name}.`,
            resolved: false
          });
        }

        if (isBelowMinAge(item, participant)) {
          findings.push({
            id: `audit-child-age-${item.id}-${participant.id}`,
            code: 'MINOR_AGE_RESTRICTION',
            severity: 'warning',
            category: 'child_safety',
            title: `Restrição de idade em '${item.title}'`,
            description: `${participant.full_name} tem ${participant.age} anos e a atividade exige idade mínima de ${item.min_age_years} anos.`,
            affected_entities: [participant.full_name, item.title],
            recommendation: `Remover ${name} da lista de participantes desta atividade.`,
            resolved: false
          });
        }
      });
  });

  return findings;
}

/**
 * Sobreposição de agenda por participante, no mesmo dia. Só compara itens com
 * horário confirmado (`time_is_estimated !== true`): num dia de parque os
 * horários são estimativas espaçadas pela engine e se sobrepõem por desenho.
 */
function auditScheduleOverlaps(data: AuditInput): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const timed = data.itinerary
    .filter(i => i.status !== 'cancelled' && i.time_is_estimated !== true && toMinutes(i.time_start) !== null)
    .map(i => {
      const start = toMinutes(i.time_start)!;
      const end = toMinutes(i.time_end) ?? start + DEFAULT_ITEM_DURATION_MIN;
      return { item: i, start, end: Math.max(end, start + 1) };
    });

  const reported = new Set<string>();

  for (let a = 0; a < timed.length; a++) {
    for (let b = a + 1; b < timed.length; b++) {
      const x = timed[a];
      const y = timed[b];
      if (x.item.date !== y.item.date) continue;
      if (x.start >= y.end || y.start >= x.end) continue;

      const shared = data.participants.filter(
        p =>
          (x.item.participant_ids.length === 0 || x.item.participant_ids.includes(p.id)) &&
          (y.item.participant_ids.length === 0 || y.item.participant_ids.includes(p.id))
      );
      if (shared.length === 0) continue;

      const key = [x.item.id, y.item.id].sort().join('-');
      if (reported.has(key)) continue;
      reported.add(key);

      findings.push({
        id: `audit-overlap-${key}`,
        code: 'SCHEDULE_OVERLAP',
        severity: 'warning',
        category: 'logistics',
        title: `Conflito de horário em ${formatBr(x.item.date)}: '${x.item.title}' × '${y.item.title}'`,
        description: `${x.item.title} (${x.item.time_start}${x.item.time_end ? `–${x.item.time_end}` : ''}) e ${y.item.title} (${y.item.time_start}${y.item.time_end ? `–${y.item.time_end}` : ''}) se sobrepõem para ${shared.map(displayName).join(', ')}.`,
        affected_entities: [x.item.title, y.item.title, ...shared.map(displayName)],
        recommendation: 'Reagendar um dos itens ou dividir os participantes entre eles.',
        resolved: false
      });
    }
  }

  return findings;
}

function auditDocuments(data: AuditInput): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const tripEnd = data.trip.end_date;
  if (!tripEnd) return findings;
  const recommendedUntil = addMonths(tripEnd, PASSPORT_VALIDITY_MONTHS_AFTER_TRIP);

  data.participants
    .filter(p => p.passport_expiry)
    .forEach(p => {
      const expiry = p.passport_expiry!;
      if (expiry < tripEnd) {
        findings.push({
          id: `audit-passport-expired-${p.id}`,
          code: 'PASSPORT_EXPIRES_BEFORE_RETURN',
          severity: 'critical',
          category: 'documents',
          title: `Passaporte de ${displayName(p)} vence antes da volta`,
          description: `Validade ${formatBr(expiry)}; a viagem termina em ${formatBr(tripEnd)}.`,
          affected_entities: [p.full_name],
          recommendation: 'Renovar o passaporte antes do embarque.',
          resolved: false
        });
      } else if (expiry < recommendedUntil) {
        findings.push({
          id: `audit-passport-short-${p.id}`,
          code: 'PASSPORT_VALIDITY_SHORT',
          severity: 'warning',
          category: 'documents',
          title: `Passaporte de ${displayName(p)} com menos de ${PASSPORT_VALIDITY_MONTHS_AFTER_TRIP} meses após a volta`,
          description: `Validade ${formatBr(expiry)}. Vários destinos exigem ${PASSPORT_VALIDITY_MONTHS_AFTER_TRIP} meses de validade além da data de saída.`,
          affected_entities: [p.full_name],
          recommendation: 'Confirmar a regra de validade do destino; se exigir 6 meses, renovar antes da viagem.',
          resolved: false
        });
      }
    });

  return findings;
}

function auditFinancial(data: AuditInput): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const nominal = data.giftCards.reduce((acc, g) => acc + g.nominal_value, 0);
  const net = data.giftCards.reduce((acc, g) => acc + g.net_cost, 0);
  const savings = nominal - net;

  if (nominal > 0) {
    findings.push({
      id: 'audit-fin-01',
      code: 'GIFT_CARD_NET_SAVINGS',
      severity: 'info',
      category: 'financial',
      title: `Economia líquida de Gift Cards: US$ ${savings.toFixed(2)}`,
      description: `Comprados US$ ${nominal} em Gift Cards com custo real líquido de US$ ${net.toFixed(2)}.`,
      affected_entities: ['Módulo de Gift Cards'],
      recommendation: 'Usar o saldo prioritariamente nas lojas de cada gift card para maximizar o benefício.',
      resolved: true
    });
  }

  data.participants
    .filter(p => p.budget_limit_usd > 0)
    .forEach(participant => {
      const name = displayName(participant);
      const purchasesTotal = data.purchases
        .filter(p => p.target_participant_id === participant.id)
        .reduce((acc, item) => acc + item.target_price_usd * item.quantity, 0);

      if (purchasesTotal > participant.budget_limit_usd) {
        findings.push({
          id: `audit-budget-${participant.id}`,
          code: 'PARTICIPANT_BUDGET_EXCEEDED',
          severity: 'warning',
          category: 'financial',
          title: `Compras de ${name} (US$ ${purchasesTotal}) excedem teto (US$ ${participant.budget_limit_usd})`,
          description: `Compras planejadas por ${name} somam US$ ${purchasesTotal}, superando o orçamento individual.`,
          affected_entities: [name],
          recommendation: 'Utilizar Gift Cards com desconto ou reavaliar itens de menor prioridade.',
          resolved: false
        });
      }
    });

  return findings;
}

/**
 * Auditoria completa da viagem. Todas as regras operam sobre dados
 * (`birth_date`/`age` derivada, `height_cm`, datas de voo e hospedagem,
 * horários do roteiro) — nenhuma cita nome, idade ou data de uma viagem
 * específica, para que um segundo tenant receba findings coerentes.
 */
export function runFullTripAudit(data: AuditInput): AuditFinding[] {
  return [
    ...auditCarDropoff(data),
    ...auditAccommodations(data),
    ...auditAccommodationCoverage(data),
    ...auditChildRestrictions(data),
    ...auditScheduleOverlaps(data),
    ...auditDocuments(data),
    ...auditFinancial(data),
  ];
}

/**
 * Preparation index: 100 minus a penalty per unresolved finding
 * (20pt per critical, 10pt per warning), floored at 0.
 */
export function computePreparationScore(findings: AuditFinding[]): {
  score: number;
  unresolvedCritical: number;
  unresolvedWarning: number;
} {
  const unresolvedCritical = findings.filter(f => f.severity === 'critical' && !f.resolved).length;
  const unresolvedWarning = findings.filter(f => f.severity === 'warning' && !f.resolved).length;
  const score = Math.max(0, 100 - (unresolvedCritical * 20 + unresolvedWarning * 10));

  return { score, unresolvedCritical, unresolvedWarning };
}
