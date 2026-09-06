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

export function runFullTripAudit(data: {
  trip: Trip;
  participants: Participant[];
  flights: Flight[];
  accommodations: Accommodation[];
  transports: TransportReservation[];
  itinerary: ItineraryItem[];
  giftCards: GiftCard[];
  purchases: PurchaseItem[];
  expenses: Expense[];
}): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // 1. Audit Car Drop-off vs Flight Logistics
  const rentalCars = data.transports.filter(t => t.type === 'rental_car' && t.status === 'reserved');
  rentalCars.forEach(car => {
    const dropoffDate = new Date(car.dropoff_time);
    const dropoffLabel = dropoffDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    findings.push({
      id: `audit-car-followup-${car.id}`,
      code: 'CAR_DROPOFF_FOLLOWUP_REQUIRED',
      severity: 'critical',
      category: 'logistics',
      title: `Devolução do Carro Alugado exige transporte complementar (${dropoffLabel})`,
      description: `O veículo será devolvido na locadora em ${dropoffLabel}. É necessário transporte (Uber/Transfer) para a próxima hospedagem ou aeroporto.`,
      affected_entities: [car.provider_company || 'Veículo alugado', ...data.participants.map(p => p.nickname || p.full_name)],
      recommendation: `Agendar Uber corporativo/pessoal ou transfer hotel para logo após ${dropoffLabel}.`,
      resolved: false
    });

    data.flights.forEach(flight => {
      const departureDate = new Date(flight.departure_time);
      if (departureDate > dropoffDate) {
        const diffHours = (departureDate.getTime() - dropoffDate.getTime()) / (1000 * 60 * 60);
        if (diffHours < 3) {
          findings.push({
            id: `audit-flight-${flight.id}`,
            code: 'INSUFFICIENT_TRANSFER_TIME',
            severity: 'critical',
            category: 'logistics',
            title: `Tempo curto entre devolução do carro e voo ${flight.flight_number}`,
            description: `Apenas ${diffHours.toFixed(1)} horas entre a devolução do carro e a partida do voo. Recomenda-se no mínimo 3.5h para voos internacionais com despacho de bagagem.`,
            affected_entities: [flight.flight_number],
            recommendation: 'Antecipar devolução do veículo ou remarcar horário do voo.',
            resolved: false
          });
        }
      }
    });
  });

  // 2. Audit Unassigned Hotel Nights / Replaced Hotel History
  const activeAccommodations = data.accommodations.filter(a => a.status === 'confirmed');
  if (activeAccommodations.length === 0) {
    findings.push({
      id: 'audit-hotel-01',
      code: 'NO_ACTIVE_ACCOMMODATION',
      severity: 'critical',
      category: 'logistics',
      title: 'Viagem sem hospedagens confirmadas',
      description: 'Nenhum hotel ativo encontrado para o período principal da viagem.',
      affected_entities: ['Todos os participantes'],
      recommendation: 'Confirmar reservas nos hotéis selecionados (Disney All-Star Movies, Four Points, FLL Airport).',
      resolved: false
    });
  }

  const replacedHotels = data.accommodations.filter(a => a.status === 'replaced');
  if (replacedHotels.length > 0) {
    findings.push({
      id: 'audit-hotel-02',
      code: 'REPLACED_HOTEL_ARCHIVED',
      severity: 'info',
      category: 'logistics',
      title: 'Histórico de troca de hospedagem arquivado',
      description: `${replacedHotels.length} hospedagem(ns) substituída(s) preservada(s) com motivo vinculado a Decisões (ex: Celebration Suites / Casa Faena).`,
      affected_entities: replacedHotels.map(h => h.name),
      recommendation: 'Nenhuma ação necessária. Histórico preservado para auditoria.',
      resolved: true
    });
  }

  // 3. Child Safety & Height/Age Restrictions Audit
  data.participants.forEach(participant => {
    const displayName = participant.nickname || participant.full_name;
    data.itinerary.forEach(item => {
      if (item.min_height_cm && participant.height_cm && participant.height_cm < item.min_height_cm) {
        findings.push({
          id: `audit-child-height-${item.id}-${participant.id}`,
          code: 'CHILD_HEIGHT_RESTRICTION',
          severity: 'warning',
          category: 'child_safety',
          title: `Atração '${item.title}' exige altura mínima de ${item.min_height_cm}cm`,
          description: `${participant.full_name} tem ${participant.height_cm}cm. Não poderá ir nesta atração.`,
          affected_entities: [participant.full_name, item.title],
          recommendation: `Planejar troca de acompanhantes (Rider Switch / Child Swap) ou atividade alternativa para ${displayName}.`,
          resolved: false
        });
      }

      if (item.min_age_years && item.min_age_years > participant.age) {
        findings.push({
          id: `audit-child-age-${item.id}-${participant.id}`,
          code: 'MINOR_AGE_RESTRICTION',
          severity: 'warning',
          category: 'child_safety',
          title: `Restrição de idade em '${item.title}'`,
          description: `${participant.full_name} tem ${participant.age} anos e a atividade exige idade mínima de ${item.min_age_years} anos.`,
          affected_entities: [participant.full_name, item.title],
          recommendation: `Remover ${displayName} da lista de participantes desta atividade.`,
          resolved: false
        });
      }
    });
  });

  // 4. Financial Audit: Gift Card Net Savings & Individual Budgets
  const totalGiftCardsNominal = data.giftCards.reduce((acc, g) => acc + g.nominal_value, 0);
  const totalGiftCardsNet = data.giftCards.reduce((acc, g) => acc + g.net_cost, 0);
  const totalGiftSavings = totalGiftCardsNominal - totalGiftCardsNet;

  if (totalGiftCardsNominal > 0) {
    findings.push({
      id: 'audit-fin-01',
      code: 'GIFT_CARD_NET_SAVINGS',
      severity: 'info',
      category: 'financial',
      title: `Economia líquida de Gift Cards: US$ ${totalGiftSavings.toFixed(2)}`,
      description: `Comprados US$ ${totalGiftCardsNominal} em Gift Cards com custo real líquido de US$ ${totalGiftCardsNet.toFixed(2)}.`,
      affected_entities: ['Módulo de Gift Cards'],
      recommendation: 'Utilizar saldo prioritariamente em lojas Disney, Apple e Adidas para maximizar o benefício.',
      resolved: true
    });
  }

  data.participants
    .filter(p => p.budget_limit_usd > 0)
    .forEach(participant => {
      const displayName = participant.nickname || participant.full_name;
      const purchasesTotal = data.purchases
        .filter(p => p.target_participant_id === participant.id)
        .reduce((acc, item) => acc + item.target_price_usd * item.quantity, 0);

      if (purchasesTotal > participant.budget_limit_usd) {
        findings.push({
          id: `audit-budget-${participant.id}`,
          code: 'PARTICIPANT_BUDGET_EXCEEDED',
          severity: 'warning',
          category: 'financial',
          title: `Compras de ${displayName} (US$ ${purchasesTotal}) excedem teto (US$ ${participant.budget_limit_usd})`,
          description: `Compras planejadas por ${displayName} somam US$ ${purchasesTotal}, superando o orçamento individual.`,
          affected_entities: [displayName],
          recommendation: 'Utilizar Gift Cards com desconto ou reavaliar itens de menor prioridade.',
          resolved: false
        });
      }
    });

  return findings;
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
