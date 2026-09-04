import { describe, expect, it } from 'vitest';
import { formatDailyDigest, formatDatePtBr, type DigestItineraryItem } from '../formatter.ts';
import { buildSystemPrompt, localDateIso, youngestWithHeight, type ParticipantRow, type TripContext } from '../tripContext.ts';
import { createToolExecutor } from '../tripTools.ts';
import { DEFAULT_GEMINI_MODEL, buildModelTurnParts, resolveGeminiModel, sanitizeHistory } from '../gemini.ts';

const baseItem: DigestItineraryItem = {
  date: '2026-08-25',
  time_start: '09:00',
  time_end: null,
  title: 'Space Mountain',
  category: 'park',
  city: 'Orlando',
  park: 'Magic Kingdom',
  min_height_cm: 112,
  notes: null,
};

describe('formatDailyDigest', () => {
  it('lista atividades com horário, parque e emoji de categoria', () => {
    const text = formatDailyDigest({
      tripTitle: 'NOGÁRIA USA 2026',
      dateIso: '2026-08-25',
      items: [baseItem],
      tasksDueSoon: [],
      nextFlight: null,
      child: null,
    });

    expect(text).toContain('*Bom dia, Família!*');
    expect(text).toContain('🎡 *09:00* • Space Mountain (Magic Kingdom)');
  });

  it('alerta quando a criança não atinge a altura mínima', () => {
    const text = formatDailyDigest({
      tripTitle: 'Viagem',
      dateIso: '2026-08-25',
      items: [baseItem],
      tasksDueSoon: [],
      nextFlight: null,
      child: { nickname: 'Gabi', height_cm: 100 },
    });

    expect(text).toContain('A altura mínima é 112cm');
    expect(text).toContain('Rider Switch');
  });

  it('não alerta quando a criança atinge a altura mínima', () => {
    const text = formatDailyDigest({
      tripTitle: 'Viagem',
      dateIso: '2026-08-25',
      items: [baseItem],
      tasksDueSoon: [],
      nextFlight: null,
      child: { nickname: 'Débora', height_cm: 150 },
    });

    expect(text).not.toContain('Rider Switch');
  });

  it('informa dia livre quando não há atividades', () => {
    const text = formatDailyDigest({
      tripTitle: 'Viagem',
      dateIso: '2026-08-25',
      items: [],
      tasksDueSoon: [],
      nextFlight: null,
      child: null,
    });

    expect(text).toContain('dia livre');
  });

  it('inclui lembretes de voo e tarefas quando presentes', () => {
    const text = formatDailyDigest({
      tripTitle: 'Viagem',
      dateIso: '2026-08-25',
      items: [],
      tasksDueSoon: [{ title: 'Comprar dólar', due_date: '2026-08-26', priority: 'high' }],
      nextFlight: {
        airline: 'LATAM',
        flight_number: 'LA8180',
        origin_airport: 'GRU',
        destination_airport: 'MCO',
        departure_time: '2026-08-26T10:30:00Z',
        booking_code: 'ABC123',
      },
      child: null,
    });

    expect(text).toContain('Atenção ao nosso voo!');
    expect(text).toContain('LA8180');
    expect(text).toContain('*ABC123*');
    expect(text).toContain('Só um lembrete rápido:');
    expect(text).toContain('Comprar dólar');
  });
});

describe('formatDatePtBr', () => {
  it('formata data ISO em pt-BR sem deslocamento de fuso', () => {
    expect(formatDatePtBr('2026-08-25')).toBe('terça-feira, 25/08');
  });
});

describe('localDateIso', () => {
  it('respeita o fuso horário informado', () => {
    // 01:30 UTC ainda é dia anterior em America/Sao_Paulo (UTC-3).
    const now = new Date('2026-08-25T01:30:00Z');
    expect(localDateIso(now, 'America/Sao_Paulo')).toBe('2026-08-24');
    expect(localDateIso(now, 'UTC')).toBe('2026-08-25');
  });
});

describe('youngestWithHeight', () => {
  const participants: ParticipantRow[] = [
    { id: '1', full_name: 'Pedro', nickname: null, is_minor: false, height_cm: 180, whatsapp_phone: null },
    { id: '2', full_name: 'Débora', nickname: 'Dé', is_minor: true, height_cm: 150, whatsapp_phone: null },
    { id: '3', full_name: 'Gabriela', nickname: 'Gabi', is_minor: true, height_cm: 100, whatsapp_phone: null },
  ];

  it('retorna o menor participante mirim com altura cadastrada', () => {
    expect(youngestWithHeight(participants)?.id).toBe('3');
  });

  it('retorna null quando não há mirins com altura', () => {
    expect(youngestWithHeight([participants[0]])).toBeNull();
  });
});

describe('buildSystemPrompt', () => {
  it('inclui dados da viagem e regras de negócio', () => {
    const ctx: TripContext = {
      tenantId: 't1',
      trip: {
        id: 'trip1',
        title: 'NOGÁRIA USA 2026',
        destination_main: 'Orlando',
        start_date: '2026-08-20',
        end_date: '2026-09-01',
        currency_base: 'USD',
      },
      participants: [
        { id: '3', full_name: 'Gabriela', nickname: 'Gabi', is_minor: true, height_cm: 100, whatsapp_phone: null },
      ],
      todayItems: [],
      tasksDueSoon: [],
      nextFlight: null,
    };

    const prompt = buildSystemPrompt(ctx, '2026-08-25');
    expect(prompt).toContain('NOGÁRIA USA 2026');
    expect(prompt).toContain('Gabi (100cm)');
    expect(prompt).toContain('Rider Switch');
    expect(prompt).toContain('Nunca invente horários');
  });
});

describe('createToolExecutor — validação de argumentos', () => {
  // As validações rodam antes de qualquer acesso ao banco, então um stub vazio basta.
  const executor = createToolExecutor({
    supabase: {} as never,
    tripId: 'trip1',
    todayIso: '2026-08-25',
    participants: [],
  });

  it('rejeita data fora do formato AAAA-MM-DD', async () => {
    await expect(executor('get_itinerary', { date: '25/08/2026' })).rejects.toThrow('AAAA-MM-DD');
  });

  it('rejeita mark_itinerary_item_done sem título', async () => {
    await expect(executor('mark_itinerary_item_done', {})).rejects.toThrow('title');
  });

  it('rejeita status de tarefa inválido', async () => {
    await expect(executor('get_tasks', { status: 'deleted' })).rejects.toThrow('status');
  });

  it('rejeita ferramenta desconhecida', async () => {
    await expect(executor('drop_database', {})).rejects.toThrow('desconhecida');
  });

  it('rejeita participante inexistente na escrita', async () => {
    await expect(
      executor('mark_itinerary_item_done', { title: 'Space Mountain', participant: 'Fulano' }),
    ).rejects.toThrow('não encontrado');
  });
});

describe('resolveGeminiModel', () => {
  it('mantém um modelo Gemini válido', () => {
    expect(resolveGeminiModel('gemini-3.5-flash')).toBe('gemini-3.5-flash');
    expect(resolveGeminiModel('gemini-3-pro')).toBe('gemini-3-pro');
  });

  it('cai no default para nomes vazios, de outro provedor ou de gerações descontinuadas', () => {
    expect(resolveGeminiModel(undefined)).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('')).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('gpt-4o')).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('claude-sonnet-5')).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('gemini-1.5-flash')).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('gemini-2.5-pro')).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel('gemini-flash-latest')).toBe(DEFAULT_GEMINI_MODEL);
  });
});

describe('sanitizeHistory', () => {
  it('remove mensagens vazias e garante que a conversa comece pelo usuário', () => {
    const history = sanitizeHistory([
      { role: 'model', text: 'Oi! Como posso ajudar?' },
      { role: 'user', text: '   ' },
      { role: 'user', text: 'Qual o roteiro de hoje?' },
      { role: 'model', text: '' },
      { role: 'model', text: 'Hoje é Magic Kingdom 🎢' },
    ]);
    expect(history).toEqual([
      { role: 'user', text: 'Qual o roteiro de hoje?' },
      { role: 'model', text: 'Hoje é Magic Kingdom 🎢' },
    ]);
  });

  it('retorna vazio quando só há turnos do modelo', () => {
    expect(sanitizeHistory([{ role: 'model', text: 'Bom dia!' }])).toEqual([]);
  });
});

describe('buildModelTurnParts', () => {
  it('ecoa functionCall com thoughtSignature e descarta partes vazias', () => {
    const parts = buildModelTurnParts([
      { text: '' },
      { functionCall: { name: 'get_itinerary', args: { date: '2026-09-04' } }, thoughtSignature: 'sig-1' },
      { thoughtSignature: 'sig-orfa' },
      { text: 'Deixa eu conferir...' },
    ]);
    expect(parts).toEqual([
      { functionCall: { name: 'get_itinerary', args: { date: '2026-09-04' } }, thoughtSignature: 'sig-1' },
      { text: 'Deixa eu conferir...' },
    ]);
  });

  it('não adiciona thoughtSignature quando o modelo não a envia', () => {
    const parts = buildModelTurnParts([{ functionCall: { name: 'get_tasks', args: {} } }]);
    expect(parts).toEqual([{ functionCall: { name: 'get_tasks', args: {} } }]);
  });
});
