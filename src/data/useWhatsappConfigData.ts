import { useCallback, useEffect, useState } from 'react';
import type { WriteFailure } from './useWriteFailures';

/** Linha de public.whatsapp_configs, como o Postgres devolve (colunas que a UI edita). */
export interface WhatsappConfigRow {
  id: string;
  tenant_id: string;
  phone_number_id: string;
  enabled: boolean;
  digest_time: string;
  evening_digest_time: string;
  timezone: string;
  reminders_enabled: boolean;
  reminder_lead_minutes: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  monthly_message_quota: number | null;
  message_retention_days: number;
}

export type WhatsappConfigInput = Omit<WhatsappConfigRow, 'id' | 'tenant_id'>;

export const DEFAULT_WHATSAPP_CONFIG: WhatsappConfigInput = {
  phone_number_id: '',
  enabled: true,
  digest_time: '07:00',
  evening_digest_time: '22:00',
  timezone: 'America/Sao_Paulo',
  reminders_enabled: true,
  reminder_lead_minutes: 60,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  monthly_message_quota: null,
  message_retention_days: 90,
};

/**
 * Cliente mínimo para esta tabela — estrutural, para o teste injetar um fake.
 * `upsert` é o que faltava no SupabaseLike dos outros hooks: a config é uma
 * linha por tenant (unique em phone_number_id), então criar e editar são a
 * mesma operação.
 */
export interface WhatsappConfigClient {
  from: (table: 'whatsapp_configs') => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
    upsert: (values: unknown, opts: { onConflict: string }) => {
      select: (columns: string) => {
        single: () => PromiseLike<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
  };
}

export interface WhatsappConfigDeps {
  client: WhatsappConfigClient;
  tenantId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
}

/** Hora `HH:MM` a partir de `HH:MM:SS` do Postgres. */
const hhmm = (t: unknown) => String(t ?? '').slice(0, 5);

function normalizeRow(raw: unknown): WhatsappConfigRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.tenant_id !== 'string') return null;
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    phone_number_id: String(r.phone_number_id ?? ''),
    enabled: Boolean(r.enabled),
    digest_time: hhmm(r.digest_time) || DEFAULT_WHATSAPP_CONFIG.digest_time,
    evening_digest_time: hhmm(r.evening_digest_time) || DEFAULT_WHATSAPP_CONFIG.evening_digest_time,
    timezone: String(r.timezone ?? DEFAULT_WHATSAPP_CONFIG.timezone),
    reminders_enabled: r.reminders_enabled !== false,
    reminder_lead_minutes: Number(r.reminder_lead_minutes ?? DEFAULT_WHATSAPP_CONFIG.reminder_lead_minutes),
    quiet_hours_start: hhmm(r.quiet_hours_start) || DEFAULT_WHATSAPP_CONFIG.quiet_hours_start,
    quiet_hours_end: hhmm(r.quiet_hours_end) || DEFAULT_WHATSAPP_CONFIG.quiet_hours_end,
    monthly_message_quota: r.monthly_message_quota === null || r.monthly_message_quota === undefined ? null : Number(r.monthly_message_quota),
    message_retention_days: Number(r.message_retention_days ?? DEFAULT_WHATSAPP_CONFIG.message_retention_days),
  };
}

/**
 * Configuração do bot do WhatsApp do tenant ativo (issue #20). Uma linha por
 * tenant; `save` faz upsert. Sem escrita otimista de propósito: é uma tela de
 * configuração com botão "Salvar", e o usuário precisa saber se gravou.
 */
export function useWhatsappConfigData({ client, tenantId, recordFailure }: WhatsappConfigDeps) {
  const [config, setConfig] = useState<WhatsappConfigRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) {
      setConfig(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await client.from('whatsapp_configs').select('*').eq('tenant_id', tenantId).maybeSingle();
    setConfig(error ? null : normalizeRow(data));
    setLoading(false);
  }, [client, tenantId]);

  useEffect(() => {
    let cancelado = false;
    load().then(() => {
      if (cancelado) return;
    });
    return () => {
      cancelado = true;
    };
  }, [load]);

  const save = useCallback(
    async (input: WhatsappConfigInput): Promise<{ error: string | null }> => {
      if (!tenantId) return { error: 'Nenhuma organização ativa.' };
      const payload = { ...input, tenant_id: tenantId, ...(config ? { id: config.id } : {}) };
      const { data, error } = await client
        .from('whatsapp_configs')
        .upsert(payload, { onConflict: 'tenant_id' })
        .select('*')
        .single();
      if (error) {
        recordFailure({ entity: 'Bot do WhatsApp', operation: 'atualizar', label: 'configuração', retry: () => { void save(input); } });
        return { error: error.message };
      }
      setConfig(normalizeRow(data));
      return { error: null };
    },
    [client, tenantId, config, recordFailure],
  );

  return { config, loading, save, reload: load };
}
