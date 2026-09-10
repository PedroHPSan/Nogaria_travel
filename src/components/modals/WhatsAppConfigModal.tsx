import React, { useEffect, useState } from 'react';
import { BaseModal } from './BaseModal';
import { useAuth } from '../../context/AuthContext';
import { useTrip } from '../../context/TripContext';
import { supabase } from '../../services/supabaseClient';
import { useWhatsappConfigData, DEFAULT_WHATSAPP_CONFIG, type WhatsappConfigClient, type WhatsappConfigInput } from '../../data/useWhatsappConfigData';
import { MessageCircle } from 'lucide-react';

interface WhatsAppConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMEZONES = ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/New_York', 'America/Los_Angeles', 'Europe/Lisbon', 'Europe/Paris'];

const inputClass = 'w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500';

/**
 * Configuração do bot do WhatsApp por tenant (issue #20): substitui o INSERT
 * manual em whatsapp_configs. Só admin edita; os demais veem o estado.
 */
export const WhatsAppConfigModal: React.FC<WhatsAppConfigModalProps> = ({ isOpen, onClose }) => {
  const { activeTenantId, activeRole } = useAuth();
  const { participants, activeTrip } = useTrip();
  const isAdmin = activeRole === 'admin';

  const { config, loading, save } = useWhatsappConfigData({
    // supabase-js satisfaz o shape mínimo; o cast existe porque o client real é genérico demais para o tipo estrutural.
    client: supabase as unknown as WhatsappConfigClient,
    tenantId: isOpen ? activeTenantId : null,
    recordFailure: () => {},
  });

  const [form, setForm] = useState<WhatsappConfigInput>(DEFAULT_WHATSAPP_CONFIG);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (config) {
      const { id: _id, tenant_id: _tenant, ...rest } = config;
      setForm(rest);
    } else {
      setForm(DEFAULT_WHATSAPP_CONFIG);
    }
    setMessage(null);
  }, [config, isOpen]);

  const set = <K extends keyof WhatsappConfigInput>(key: K, value: WhatsappConfigInput[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const withPhone = participants.filter(p => p.trip_id === activeTrip.id && p.whatsapp_phone).length;
  const total = participants.filter(p => p.trip_id === activeTrip.id).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!form.phone_number_id.trim()) {
      setMessage({ kind: 'error', text: 'Informe o Phone Number ID do número business (painel Meta for Developers → WhatsApp → API Setup).' });
      return;
    }
    setSaving(true);
    const { error } = await save({ ...form, phone_number_id: form.phone_number_id.trim() });
    setSaving(false);
    setMessage(error ? { kind: 'error', text: error } : { kind: 'ok', text: 'Configuração salva.' });
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Bot do WhatsApp" subtitle="Digest diário, avisos por horário e franquia">
      {loading ? (
        <p className="text-xs text-ink-400">Carregando…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-ink-900/60 border border-ink-800 flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-success-400 shrink-0" />
            <div className="text-ink-300">
              <strong className="text-ink-100">{withPhone} de {total}</strong> participantes da viagem ativa têm WhatsApp cadastrado.
              {withPhone < total && ' Cadastre o telefone em Grupo → editar participante para que recebam o roteiro e os avisos.'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-ink-300 font-semibold mb-1">Phone Number ID (Meta Cloud API)</label>
              <input type="text" value={form.phone_number_id} onChange={e => set('phone_number_id', e.target.value)} disabled={!isAdmin} className={inputClass} placeholder="Ex: 123456789012345" />
            </div>

            <label className="flex items-center gap-2 text-ink-200">
              <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} disabled={!isAdmin} className="w-4 h-4 accent-success-500" />
              Bot ativo
            </label>
            <label className="flex items-center gap-2 text-ink-200">
              <input type="checkbox" checked={form.reminders_enabled} onChange={e => set('reminders_enabled', e.target.checked)} disabled={!isAdmin} className="w-4 h-4 accent-success-500" />
              Avisos de atividade por horário
            </label>

            <div>
              <label className="block text-ink-300 font-semibold mb-1">Fuso horário</label>
              <select value={form.timezone} onChange={e => set('timezone', e.target.value)} disabled={!isAdmin} className={inputClass}>
                {[form.timezone, ...TIMEZONES.filter(t => t !== form.timezone)].map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink-300 font-semibold mb-1">Antecedência padrão dos avisos (min)</label>
              <input type="number" min={5} max={720} value={form.reminder_lead_minutes} onChange={e => set('reminder_lead_minutes', Number(e.target.value))} disabled={!isAdmin} className={inputClass} />
            </div>

            <div>
              <label className="block text-ink-300 font-semibold mb-1">Digest da manhã (roteiro de hoje)</label>
              <input type="time" value={form.digest_time} onChange={e => set('digest_time', e.target.value)} disabled={!isAdmin} className={inputClass} />
            </div>
            <div>
              <label className="block text-ink-300 font-semibold mb-1">Digest da noite (prévia de amanhã)</label>
              <input type="time" value={form.evening_digest_time} onChange={e => set('evening_digest_time', e.target.value)} disabled={!isAdmin} className={inputClass} />
            </div>

            <div>
              <label className="block text-ink-300 font-semibold mb-1">Silêncio — início</label>
              <input type="time" value={form.quiet_hours_start} onChange={e => set('quiet_hours_start', e.target.value)} disabled={!isAdmin} className={inputClass} />
            </div>
            <div>
              <label className="block text-ink-300 font-semibold mb-1">Silêncio — fim</label>
              <input type="time" value={form.quiet_hours_end} onChange={e => set('quiet_hours_end', e.target.value)} disabled={!isAdmin} className={inputClass} />
            </div>

            <div>
              <label className="block text-ink-300 font-semibold mb-1">Franquia mensal (mensagens)</label>
              <input
                type="number"
                min={0}
                value={form.monthly_message_quota ?? ''}
                onChange={e => set('monthly_message_quota', e.target.value === '' ? null : Number(e.target.value))}
                disabled={!isAdmin}
                className={inputClass}
                placeholder="vazio = franquia do plano"
              />
            </div>
            <div>
              <label className="block text-ink-300 font-semibold mb-1">Retenção das mensagens (dias após a viagem)</label>
              <input type="number" min={7} max={730} value={form.message_retention_days} onChange={e => set('message_retention_days', Number(e.target.value))} disabled={!isAdmin} className={inputClass} />
            </div>
          </div>

          {message && (
            <div className={`px-3 py-2 rounded-xl border ${message.kind === 'ok' ? 'bg-success-500/10 border-success-500/30 text-success-400' : 'bg-danger-500/10 border-danger-500/30 text-danger-400'}`}>
              {message.text}
            </div>
          )}

          {isAdmin ? (
            <button type="submit" disabled={saving} className="w-full px-4 py-2.5 rounded-xl bg-success-600 hover:bg-success-500 disabled:opacity-50 text-white font-bold transition">
              {saving ? 'Salvando…' : 'Salvar configuração'}
            </button>
          ) : (
            <p className="text-ink-500">Apenas administradores alteram a configuração do bot.</p>
          )}

          <p className="text-[11px] text-ink-500">
            Token, verify token e app secret da Meta ficam nas secrets do Supabase (não passam pelo app). O webhook da Meta deve apontar para <code>/functions/v1/whatsapp-webhook</code>.
          </p>
        </form>
      )}
    </BaseModal>
  );
};
