import { describe, it, expect } from 'vitest';
import { runFullTripAudit, computePreparationScore, type AuditInput } from './auditEngine';
import type { Accommodation, Flight, ItineraryItem, Participant, Trip } from '../types/database.types';

// Fixtures deliberadamente de OUTRA família/viagem: a issue #31 exige que o
// motor gere findings coerentes para um segundo tenant, não só para o do autor.
const trip: Trip = {
  id: 'trip-x',
  tenant_id: 'tenant-x',
  title: 'Lisboa em família',
  destination_main: 'Lisboa',
  start_date: '2027-03-10',
  end_date: '2027-03-17',
  currency_base: 'USD',
  status: 'planning',
  created_at: '2027-01-01T00:00:00Z',
  updated_at: '2027-01-01T00:00:00Z',
};

const adult = (id: string, name: string, extra: Partial<Participant> = {}): Participant => ({
  id,
  trip_id: trip.id,
  full_name: name,
  birth_date: '1985-06-01',
  age: 41,
  is_minor: false,
  relationship: 'Adulto',
  budget_limit_usd: 0,
  ...extra,
});

const child = (id: string, name: string, extra: Partial<Participant> = {}): Participant => ({
  id,
  trip_id: trip.id,
  full_name: name,
  birth_date: '2021-02-01',
  age: 6,
  is_minor: true,
  relationship: 'Filho',
  budget_limit_usd: 0,
  height_cm: 110,
  responsible_participant_id: 'a1',
  ...extra,
});

const hotel = (id: string, checkIn: string, checkOut: string, extra: Partial<Accommodation> = {}): Accommodation => ({
  id,
  trip_id: trip.id,
  name: `Hotel ${id}`,
  address: '',
  city: 'Lisboa',
  check_in: checkIn,
  check_out: checkOut,
  booking_code: 'X',
  total_cost_usd: 0,
  currency: 'USD',
  guest_ids: [],
  status: 'confirmed',
  ...extra,
} as Accommodation);

const flight = (id: string, departure: string, arrival: string): Flight => ({
  id,
  trip_id: trip.id,
  airline: 'TAP',
  flight_number: `TP${id}`,
  origin_airport: 'GRU',
  destination_airport: 'LIS',
  departure_time: departure,
  arrival_time: arrival,
  booking_code: 'ABC',
  class_type: 'economy',
  passenger_ids: [],
  currency: 'USD',
  status: 'confirmed',
} as Flight);

const item = (id: string, extra: Partial<ItineraryItem>): ItineraryItem => ({
  id,
  trip_id: trip.id,
  date: '2027-03-12',
  time_start: '10:00',
  city: 'Lisboa',
  title: `Item ${id}`,
  category: 'attraction',
  participant_ids: [],
  status: 'planned',
  child_friendly: true,
  ...extra,
} as ItineraryItem);

const base = (over: Partial<AuditInput> = {}): AuditInput => ({
  trip,
  participants: [adult('a1', 'Marta'), child('c1', 'Nuno')],
  flights: [flight('1', '2027-03-09T22:00:00Z', '2027-03-10T11:00:00Z'), flight('2', '2027-03-17T14:00:00Z', '2027-03-17T22:00:00Z')],
  accommodations: [hotel('h1', '2027-03-10', '2027-03-17')],
  transports: [],
  itinerary: [],
  giftCards: [],
  purchases: [],
  expenses: [],
  ...over,
});

const codes = (input: AuditInput) => runFullTripAudit(input).map(f => f.code);

describe('auditEngine — regras genéricas (#31)', () => {
  it('viagem consistente de outro tenant não gera findings falsos', () => {
    expect(codes(base())).toEqual([]);
  });

  it('nunca depende de nome: os textos citam os participantes do input', () => {
    const findings = runFullTripAudit(base({ participants: [adult('a1', 'Marta'), child('c1', 'Nuno', { responsible_participant_id: undefined })] }));
    expect(findings.map(f => f.code)).toContain('MINOR_WITHOUT_GUARDIAN');
    expect(JSON.stringify(findings)).not.toMatch(/Gabi|Pedro|Débora/);
    expect(findings[0].title).toContain('Nuno');
  });

  describe('altura e idade', () => {
    it('restrição de altura usa height_cm vs min_height_cm', () => {
      const input = base({ itinerary: [item('i1', { min_height_cm: 122 })] });
      const found = runFullTripAudit(input).filter(f => f.code === 'CHILD_HEIGHT_RESTRICTION');
      expect(found).toHaveLength(1);
      expect(found[0].affected_entities).toContain('Nuno');
    });

    it('restrição de idade usa a idade derivada vs min_age_years', () => {
      const input = base({ itinerary: [item('i1', { min_age_years: 8 })] });
      expect(codes(input)).toContain('MINOR_AGE_RESTRICTION');
    });

    it('só audita quem participa do item quando participant_ids está preenchido', () => {
      const input = base({ itinerary: [item('i1', { min_height_cm: 122, participant_ids: ['a1'] })] });
      expect(codes(input)).not.toContain('CHILD_HEIGHT_RESTRICTION');
    });
  });

  describe('voo × hospedagem', () => {
    it('noite entre a chegada e o check-in vira ACCOMMODATION_GAP', () => {
      const input = base({ accommodations: [hotel('h1', '2027-03-11', '2027-03-17')] });
      const gap = runFullTripAudit(input).find(f => f.code === 'ACCOMMODATION_GAP');
      expect(gap?.severity).toBe('critical');
      expect(gap?.description).toContain('10/03/2027');
    });

    it('noite entre o check-out e o voo de volta também é gap', () => {
      const input = base({ accommodations: [hotel('h1', '2027-03-10', '2027-03-16')] });
      expect(runFullTripAudit(input).find(f => f.code === 'ACCOMMODATION_GAP')?.description).toContain('16/03/2027');
    });

    it('duas hospedagens encadeadas cobrem a janela inteira', () => {
      const input = base({ accommodations: [hotel('h1', '2027-03-10', '2027-03-13'), hotel('h2', '2027-03-13', '2027-03-17')] });
      expect(codes(input)).not.toContain('ACCOMMODATION_GAP');
    });

    it('check-in antes da chegada do voo é aviso de diária sem uso', () => {
      const input = base({ accommodations: [hotel('h1', '2027-03-08', '2027-03-17')] });
      expect(codes(input)).toContain('ACCOMMODATION_BEFORE_ARRIVAL');
    });

    it('sem voos, usa as datas da viagem como janela', () => {
      const input = base({ flights: [], accommodations: [hotel('h1', '2027-03-12', '2027-03-17')] });
      expect(codes(input)).toContain('ACCOMMODATION_GAP');
    });

    it('voo cancelado não conta', () => {
      const cancelled = { ...flight('9', '2027-03-05T00:00:00Z', '2027-03-05T10:00:00Z'), status: 'cancelled' as const };
      expect(codes(base({ flights: [...base().flights, cancelled] }))).not.toContain('ACCOMMODATION_GAP');
    });
  });

  describe('sobreposição de agenda', () => {
    it('dois itens confirmados no mesmo horário para o mesmo participante geram SCHEDULE_OVERLAP', () => {
      const input = base({
        itinerary: [
          item('i1', { time_start: '10:00', time_end: '11:00', time_is_estimated: false }),
          item('i2', { time_start: '10:30', time_end: '11:30', time_is_estimated: false }),
        ],
      });
      const overlap = runFullTripAudit(input).filter(f => f.code === 'SCHEDULE_OVERLAP');
      expect(overlap).toHaveLength(1);
    });

    it('horários estimados (dia de parque) não geram conflito', () => {
      const input = base({
        itinerary: [
          item('i1', { time_start: '10:00', time_is_estimated: true }),
          item('i2', { time_start: '10:10', time_is_estimated: true }),
        ],
      });
      expect(codes(input)).not.toContain('SCHEDULE_OVERLAP');
    });

    it('participantes disjuntos não conflitam', () => {
      const input = base({
        itinerary: [
          item('i1', { time_start: '10:00', time_end: '11:00', time_is_estimated: false, participant_ids: ['a1'] }),
          item('i2', { time_start: '10:00', time_end: '11:00', time_is_estimated: false, participant_ids: ['c1'] }),
        ],
      });
      expect(codes(input)).not.toContain('SCHEDULE_OVERLAP');
    });

    it('dias diferentes não conflitam', () => {
      const input = base({
        itinerary: [
          item('i1', { date: '2027-03-12', time_start: '10:00', time_is_estimated: false }),
          item('i2', { date: '2027-03-13', time_start: '10:00', time_is_estimated: false }),
        ],
      });
      expect(codes(input)).not.toContain('SCHEDULE_OVERLAP');
    });
  });

  describe('documentos', () => {
    it('passaporte vencendo antes da volta é crítico', () => {
      const input = base({ participants: [adult('a1', 'Marta', { passport_expiry: '2027-03-15' }), child('c1', 'Nuno')] });
      expect(runFullTripAudit(input).find(f => f.code === 'PASSPORT_EXPIRES_BEFORE_RETURN')?.severity).toBe('critical');
    });

    it('passaporte com menos de 6 meses após a volta é aviso', () => {
      const input = base({ participants: [adult('a1', 'Marta', { passport_expiry: '2027-06-01' }), child('c1', 'Nuno')] });
      expect(codes(input)).toContain('PASSPORT_VALIDITY_SHORT');
    });

    it('passaporte válido por mais de 6 meses não gera nada', () => {
      const input = base({ participants: [adult('a1', 'Marta', { passport_expiry: '2030-01-01' }), child('c1', 'Nuno')] });
      expect(codes(input).filter(c => c.startsWith('PASSPORT'))).toEqual([]);
    });
  });

  it('computePreparationScore penaliza 20/10 por crítico/aviso não resolvido', () => {
    const findings = runFullTripAudit(base({
      accommodations: [hotel('h1', '2027-03-11', '2027-03-17')],
      participants: [adult('a1', 'Marta'), child('c1', 'Nuno', { responsible_participant_id: undefined })],
    }));
    expect(computePreparationScore(findings)).toEqual({ score: 70, unresolvedCritical: 1, unresolvedWarning: 1 });
  });
});
