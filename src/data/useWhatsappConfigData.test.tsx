// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useWhatsappConfigData, DEFAULT_WHATSAPP_CONFIG, type WhatsappConfigClient } from './useWhatsappConfigData';

afterEach(() => {
  cleanup();
});

function mockClient(row: unknown | null, upsertError: { message: string } | null = null) {
  const upsert = vi.fn();
  const client: WhatsappConfigClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: row, error: null }),
        }),
      }),
      upsert: (values: unknown, opts: { onConflict: string }) => {
        upsert(values, opts);
        return {
          select: () => ({
            single: () =>
              Promise.resolve(
                upsertError
                  ? { data: null, error: upsertError }
                  : { data: { id: 'cfg-1', ...(values as object) }, error: null },
              ),
          }),
        };
      },
    }),
  };
  return { client, upsert };
}

describe('useWhatsappConfigData (#20)', () => {
  it('carrega a config do tenant e normaliza horários HH:MM:SS → HH:MM', async () => {
    const { client } = mockClient({
      id: 'cfg-1',
      tenant_id: 't-1',
      phone_number_id: '123',
      enabled: true,
      digest_time: '07:30:00',
      evening_digest_time: '21:00:00',
      timezone: 'America/Sao_Paulo',
      reminders_enabled: true,
      reminder_lead_minutes: 45,
      quiet_hours_start: '22:00:00',
      quiet_hours_end: '07:00:00',
      monthly_message_quota: null,
      message_retention_days: 90,
    });
    const { result } = renderHook(() => useWhatsappConfigData({ client, tenantId: 't-1', recordFailure: vi.fn() }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config?.digest_time).toBe('07:30');
    expect(result.current.config?.reminder_lead_minutes).toBe(45);
  });

  it('tenant sem config devolve null (a UI mostra os defaults)', async () => {
    const { client } = mockClient(null);
    const { result } = renderHook(() => useWhatsappConfigData({ client, tenantId: 't-1', recordFailure: vi.fn() }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toBeNull();
  });

  it('save faz upsert por tenant_id e atualiza o estado', async () => {
    const { client, upsert } = mockClient(null);
    const { result } = renderHook(() => useWhatsappConfigData({ client, tenantId: 't-1', recordFailure: vi.fn() }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const res = await result.current.save({ ...DEFAULT_WHATSAPP_CONFIG, phone_number_id: '999' });
    expect(res.error).toBeNull();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: 't-1', phone_number_id: '999' }), { onConflict: 'tenant_id' });
    await waitFor(() => expect(result.current.config?.phone_number_id).toBe('999'));
  });

  it('falha no upsert devolve a mensagem e registra a falha para retry', async () => {
    const { client } = mockClient(null, { message: 'duplicate key' });
    const recordFailure = vi.fn();
    const { result } = renderHook(() => useWhatsappConfigData({ client, tenantId: 't-1', recordFailure }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const res = await result.current.save(DEFAULT_WHATSAPP_CONFIG);
    expect(res.error).toBe('duplicate key');
    expect(recordFailure).toHaveBeenCalledWith(expect.objectContaining({ entity: 'Bot do WhatsApp' }));
  });
});
