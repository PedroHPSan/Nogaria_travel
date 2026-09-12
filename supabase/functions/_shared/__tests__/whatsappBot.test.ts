import { describe, expect, it } from 'vitest';
import { formatDailyDigest, formatDatePtBr, type DigestItineraryItem } from '../formatter.ts';
import {
  buildSystemPrompt,
  formatLocalTime,
  localDateIso,
  resolveDigestTriggers,
  youngestWithHeight,
  type ParticipantRow,
  type TripContext,
} from '../tripContext.ts';
import { createToolExecutor, resolveMatch } from '../tripTools.ts';
import { DEFAULT_GEMINI_MODEL, backoffDelayMs, buildModelTurnParts, resolveGeminiModel, sanitizeHistory } from '../gemini.ts';

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
      timezone: 'America/New_York',
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
      timezone: 'America/New_York',
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
      timezone: 'America/New_York',
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
      timezone: 'America/New_York',
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
      timezone: 'America/New_York',
    });

    expect(text).toContain('Atenção ao nosso voo!');
    expect(text).toContain('LA8180');
    expect(text).toContain('*ABC123*');
    expect(text).toContain('Só um lembrete rápido:');
    expect(text).toContain('Comprar dólar');
    // 10:30 UTC = 06:30 em America/New_York (EDT) — não o fuso do remetente.
    expect(text).toContain('06:30');
  });

  it('modo tomorrow troca a saudação e o texto de dia livre, sem mexer no resto', () => {
    const text = formatDailyDigest({
      tripTitle: 'Viagem',
      dateIso: '2026-08-26',
      items: [baseItem],
      tasksDueSoon: [],
      nextFlight: null,
      child: null,
      timezone: 'America/New_York',
      mode: 'tomorrow',
    });

    expect(text).toContain('Boa noite, Família!');
    expect(text).toContain('Programação de amanhã:');
    expect(text).not.toContain('Bom dia, Família!');
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

describe('formatLocalTime', () => {
  it('converte um timestamp UTC do banco para o fuso do destino', () => {
    // AD2705 chegando em FLL: 10:20 UTC é 06:20 em America/New_York (EDT) —
    // servir o valor cru fazia o bot informar 10:20 como se já fosse hora local.
    expect(formatLocalTime('2026-09-06T10:20:00Z', 'America/New_York')).toBe('06/09, 06:20');
  });

  it('respeita fusos diferentes para o mesmo instante', () => {
    expect(formatLocalTime('2026-09-06T10:20:00Z', 'America/Sao_Paulo')).toBe('06/09, 07:20');
  });
});

describe('resolveDigestTriggers', () => {
  const base = { todayIso: '2026-09-06', digestTime: '06:00', eveningDigestTime: '22:00' };

  it('dispara o resumo de hoje às 06h', () => {
    expect(resolveDigestTriggers({ ...base, localHour: '06' })).toEqual([
      { mode: 'today', dateIso: '2026-09-06' },
    ]);
  });

  it('dispara a prévia de amanhã às 22h', () => {
    expect(resolveDigestTriggers({ ...base, localHour: '22' })).toEqual([
      { mode: 'tomorrow', dateIso: '2026-09-07' },
    ]);
  });

  it('não dispara nada fora dos dois horários', () => {
    expect(resolveDigestTriggers({ ...base, localHour: '14' })).toEqual([]);
  });

  it('dispara os dois se as configs caírem na mesma hora, em vez de descartar uma', () => {
    expect(
      resolveDigestTriggers({ todayIso: '2026-09-06', digestTime: '08:00', eveningDigestTime: '08:00', localHour: '08' }),
    ).toEqual([
      { mode: 'today', dateIso: '2026-09-06' },
      { mode: 'tomorrow', dateIso: '2026-09-07' },
    ]);
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

    const prompt = buildSystemPrompt(ctx, '2026-08-25', 'America/New_York');
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
    tenantId: 't1',
    tripId: 'trip1',
    todayIso: '2026-08-25',
    participants: [],
    timeZone: 'America/New_York',
    senderPhone: '5511999990000',
    phoneNumberId: 'pn1',
    metaAccessToken: 'token',
    googleMapsApiKey: null,
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
  it('o default é o modelo mais capaz da linha', () => {
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.8-flash');
  });

  it('mantém um modelo Gemini válido, inclusive a geração anterior', () => {
    expect(resolveGeminiModel('gemini-3.8-flash')).toBe('gemini-3.8-flash');
    // 3.5 continua existindo: quem escolher explicitamente não é sobrescrito.
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

describe('buildSystemPrompt — pré-carregamento do dia', () => {
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
    todayItems: [
      { time_start: '09:00:00', time_end: '11:00:00', title: 'Space Mountain', park: 'Magic Kingdom', min_height_cm: 112 },
    ],
    tasksDueSoon: [{ title: 'Comprar dólar', due_date: '2026-08-26', priority: 'high' }],
    nextFlight: {
      airline: 'LATAM',
      flight_number: 'LA8180',
      origin_airport: 'GRU',
      destination_airport: 'MCO',
      departure_time: '2026-08-26T10:30:00Z',
      booking_code: 'ABC123',
    },
  };

  it('injeta roteiro, tarefas e voo do dia — o que elimina uma rodada de tool', () => {
    const prompt = buildSystemPrompt(ctx, '2026-08-25', 'America/New_York');
    expect(prompt).toContain('09:00-11:00 Space Mountain (Magic Kingdom) [altura mín. 112cm]');
    expect(prompt).toContain('Comprar dólar');
    expect(prompt).toContain('LA8180');
    expect(prompt).toContain('SEM chamar ferramenta');
  });

  it('converte o horário do voo para o fuso do tenant, não expõe o UTC cru', () => {
    // 10:30 UTC = 06:30 em America/New_York (EDT). Servir o valor cru fazia o
    // bot informar "10:30" como se já fosse hora local de Orlando.
    const prompt = buildSystemPrompt(ctx, '2026-08-25', 'America/New_York');
    expect(prompt).not.toContain('2026-08-26T10:30:00Z');
    expect(prompt).toContain('06:30');
  });

  it('mantém o bloco estático como prefixo, antes de qualquer dado variável', () => {
    const a = buildSystemPrompt(ctx, '2026-08-25', 'America/New_York');
    const b = buildSystemPrompt({ ...ctx, todayItems: [], tasksDueSoon: [] }, '2026-08-30', 'America/New_York');
    const marker = '--- CONTEXTO DE HOJE ---';
    // O prefixo idêntico é o que o cache implícito do Gemini reaproveita.
    expect(a.slice(0, a.indexOf(marker))).toBe(b.slice(0, b.indexOf(marker)));
  });

  it('marca dia livre quando não há atividades', () => {
    const prompt = buildSystemPrompt({ ...ctx, todayItems: [] }, '2026-08-25', 'America/New_York');
    expect(prompt).toContain('nenhuma atividade cadastrada (dia livre)');
  });
});

describe('resolveMatch — entity resolution', () => {
  it('age quando o melhor candidato é forte e isolado', () => {
    const result = resolveMatch([
      { id: 'a', title: 'Expedition Everest', score: 0.95 },
      { id: 'b', title: 'Everest Base Camp', score: 0.4 },
    ]);
    expect(result).toEqual({ kind: 'one', row: { id: 'a', title: 'Expedition Everest', score: 0.95 } });
  });

  it('pergunta quando há empate técnico no topo', () => {
    const result = resolveMatch([
      { id: 'a', title: 'Jantar no Be Our Guest', score: 0.8 },
      { id: 'b', title: 'Jantar no Cinderella', score: 0.75 },
    ]);
    expect(result.kind).toBe('ambiguous');
  });

  it('pergunta quando o único candidato é fraco — falso positivo em escrita é pior', () => {
    expect(resolveMatch([{ id: 'a', title: 'Piscina do hotel', score: 0.35 }]).kind).toBe('ambiguous');
  });

  it('reporta ausência quando nada pontuou', () => {
    expect(resolveMatch([])).toEqual({ kind: 'none' });
  });
});

describe('set_activity_reminder — validação', () => {
  const executor = createToolExecutor({
    supabase: {} as never,
    tenantId: 't1',
    tripId: 'trip1',
    todayIso: '2026-08-25',
    participants: [],
    timeZone: 'America/New_York',
    senderPhone: '5511999990000',
    phoneNumberId: 'pn1',
    metaAccessToken: 'token',
    googleMapsApiKey: null,
  });

  it('exige minutes_before inteiro dentro do intervalo', async () => {
    await expect(executor('set_activity_reminder', { title: 'Jantar' })).rejects.toThrow('minutes_before');
    await expect(executor('set_activity_reminder', { title: 'Jantar', minutes_before: -5 })).rejects.toThrow('minutes_before');
    await expect(executor('set_activity_reminder', { title: 'Jantar', minutes_before: 900 })).rejects.toThrow('minutes_before');
    await expect(executor('set_activity_reminder', { title: 'Jantar', minutes_before: '30' })).rejects.toThrow('minutes_before');
  });

  it('exige título', async () => {
    await expect(executor('set_activity_reminder', { minutes_before: 30 })).rejects.toThrow('title');
  });
});

describe('backoffDelayMs', () => {
  it('cresce exponencialmente entre as tentativas', () => {
    expect(backoffDelayMs(1)).toBe(400);
    expect(backoffDelayMs(2)).toBe(800);
  });
});
