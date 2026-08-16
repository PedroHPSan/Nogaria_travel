import { useCallback, useEffect, useState } from 'react';
import type { AiProviderConfig, AiUsageLog } from '../types/database.types';
import type { WriteFailure } from './useWriteFailures';
import type { SupabaseLike } from './useTripsData';
import { newId } from '../services/ids';
import { aiConfigFromRow, aiConfigToInsert, aiUsageLogFromRow, type AiProviderConfigRow, type AiUsageLogRow } from './mappers/aiConfigMapper';

export interface AiDataDeps {
  client: SupabaseLike;
  tenantId: string | null;
  recordFailure: (f: Omit<WriteFailure, 'id'>) => void;
  fallbackConfigs?: AiProviderConfig[];
  fallbackLogs?: AiUsageLog[];
}

export function useAiData({ client, tenantId, recordFailure, fallbackConfigs = [], fallbackLogs = [] }: AiDataDeps) {
  const [aiConfigs, setAiConfigs] = useState<AiProviderConfig[]>([]);
  const [aiLogs, setAiLogs] = useState<AiUsageLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tenantId) {
      setAiConfigs([]);
      setAiLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      client.from('ai_provider_configs').select('*').eq('tenant_id', tenantId),
      client.from('ai_usage_logs').select('*').eq('tenant_id', tenantId),
    ]).then(([configsRes, logsRes]) => {
      if (cancelado) return;

      if (!configsRes.error && configsRes.data && configsRes.data.length > 0) {
        setAiConfigs((configsRes.data as AiProviderConfigRow[]).map(aiConfigFromRow));
      } else if (fallbackConfigs.length > 0) {
        setAiConfigs(fallbackConfigs);
      } else {
        setAiConfigs([]);
      }

      if (!logsRes.error && logsRes.data && logsRes.data.length > 0) {
        setAiLogs((logsRes.data as AiUsageLogRow[]).map(aiUsageLogFromRow));
      } else if (fallbackLogs.length > 0) {
        setAiLogs(fallbackLogs);
      } else {
        setAiLogs([]);
      }

      setLoading(false);
    });

    return () => {
      cancelado = true;
    };
  }, [client, tenantId]);

  const updateAiConfig = useCallback(
    (id: string, patch: Partial<AiProviderConfig>) => {
      if (!tenantId) return;
      let anterior: AiProviderConfig | undefined;

      const escrever = () => {
        setAiConfigs(prev => {
          anterior = prev.find(x => x.id === id);
          if (!anterior) return prev;
          return prev.map(x => (x.id === id ? { ...x, ...patch } : x));
        });

        if (!anterior) return;
        const atualizado = { ...anterior, ...patch };

        client
          .from('ai_provider_configs')
          .update(aiConfigToInsert(atualizado, tenantId))
          .eq('id', id)
          .then(({ error }) => {
            if (!error || !anterior) return;
            setAiConfigs(prev => prev.map(x => (x.id === id ? anterior! : x)));
            recordFailure({
              entity: 'Configuração de IA',
              operation: 'atualizar',
              label: anterior.provider,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, tenantId, recordFailure],
  );

  const addAiConfig = useCallback(
    (data: Omit<AiProviderConfig, 'id'>) => {
      if (!tenantId) return;
      const cfg: AiProviderConfig = { ...data, id: newId() };

      const escrever = () => {
        setAiConfigs(prev => [...prev, cfg]);
        client
          .from('ai_provider_configs')
          .insert(aiConfigToInsert(cfg, tenantId))
          .then(({ error }) => {
            if (!error) return;
            setAiConfigs(prev => prev.filter(x => x.id !== cfg.id));
            recordFailure({
              entity: 'Configuração de IA',
              operation: 'criar',
              label: cfg.provider,
              retry: escrever,
            });
          });
      };

      escrever();
    },
    [client, tenantId, recordFailure],
  );

  const addAiLog = useCallback(
    (data: Omit<AiUsageLog, 'id' | 'timestamp'>) => {
      const log: AiUsageLog = {
        ...data,
        id: newId(),
        timestamp: new Date().toISOString(),
      };

      setAiLogs(prev => [log, ...prev]);

      if (tenantId) {
        client
          .from('ai_usage_logs')
          .insert({
            id: log.id,
            tenant_id: tenantId,
            timestamp: log.timestamp,
            user_name: log.user_name,
            function_name: log.function_name,
            provider: log.provider,
            model: log.model,
            tokens_input: log.tokens_input,
            tokens_output: log.tokens_output,
            estimated_cost_usd: log.estimated_cost_usd,
          })
          .then(({ error }) => {
            if (error) {
              console.error(`[useAiData] Erro ao salvar log de IA: ${error.message}`);
            }
          });
      }
    },
    [client, tenantId],
  );

  return {
    aiConfigs,
    aiLogs,
    loading,
    updateAiConfig,
    addAiConfig,
    addAiLog,
  };
}
