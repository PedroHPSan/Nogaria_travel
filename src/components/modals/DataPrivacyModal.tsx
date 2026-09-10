import React, { useState } from 'react';
import { BaseModal } from './BaseModal';
import { LegalModal } from './LegalModal';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { Trash2, FileText } from 'lucide-react';

interface DataPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * "Privacidade e dados" (Conta): acesso aos textos legais e ao direito de
 * exclusão — apagar a organização inteira via RPC delete_tenant, que cascateia
 * por todas as tabelas (mensagens do WhatsApp e logs de IA inclusive).
 */
export const DataPrivacyModal: React.FC<DataPrivacyModalProps> = ({ isOpen, onClose }) => {
  const { activeTenant, activeRole, profile, signOut } = useAuth();
  const [legalOpen, setLegalOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = activeRole === 'admin';
  const canDelete = isAdmin && activeTenant && confirmName.trim() === activeTenant.name;

  const handleDelete = async () => {
    if (!activeTenant || !canDelete) return;
    setDeleting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('delete_tenant', { p_tenant_id: activeTenant.id });
    setDeleting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    // A organização não existe mais; o AuthGate vai recarregar as memberships no próximo login.
    await signOut();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Privacidade e dados" subtitle={profile?.email}>
      <div className="space-y-5 text-xs">
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-ink-100">Documentos</h3>
          <button
            type="button"
            onClick={() => setLegalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-ink-900 border border-ink-800 text-info-300 font-semibold hover:border-info-500 transition"
          >
            <FileText className="w-4 h-4" />
            Política de Privacidade e Termos de Uso
          </button>
          <p className="text-ink-400">
            Aceite registrado em {profile?.terms_accepted_at ? new Date(profile.terms_accepted_at).toLocaleString('pt-BR') : '—'}
            {profile?.terms_version ? ` (versão ${profile.terms_version})` : ''}.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-bold text-ink-100">Seus dados</h3>
          <p className="text-ink-400">
            Participantes, viagens e registros podem ser editados ou apagados nas próprias telas. Mensagens do assistente no WhatsApp expiram automaticamente após o fim da viagem (prazo configurável em Bot do WhatsApp).
          </p>
        </section>

        <section className="space-y-3 p-4 rounded-xl border border-danger-500/30 bg-danger-500/5">
          <h3 className="text-sm font-bold text-danger-300 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Excluir a organização "{activeTenant?.name}"
          </h3>
          <p className="text-ink-400">
            Apaga permanentemente todas as viagens, participantes, finanças, documentos, mensagens do WhatsApp e registros de uso da IA desta organização. Sua conta de login continua existindo.
          </p>
          {isAdmin ? (
            <>
              <input
                type="text"
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder={`Digite "${activeTenant?.name}" para confirmar`}
                className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-danger-500"
              />
              {error && (
                <div className="px-3 py-2 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-400">{error}</div>
              )}
              <button
                type="button"
                disabled={!canDelete || deleting}
                onClick={handleDelete}
                className="w-full px-4 py-2.5 rounded-xl bg-danger-600 hover:bg-danger-500 disabled:opacity-40 text-white font-bold transition"
              >
                {deleting ? 'Excluindo…' : 'Excluir tudo permanentemente'}
              </button>
            </>
          ) : (
            <p className="text-ink-500">Apenas administradores podem excluir a organização.</p>
          )}
        </section>
      </div>

      <LegalModal isOpen={legalOpen} onClose={() => setLegalOpen(false)} />
    </BaseModal>
  );
};
