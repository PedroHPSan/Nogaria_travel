import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LegalModal } from '../../components/modals/LegalModal';
import { LEGAL_VERSION } from '../legal/legalTexts';

/**
 * Gate de aceite dos termos e da política (LGPD). Fica entre o login e o app
 * para cobrir todos os caminhos de entrada (senha, magic link, Google), e
 * volta a aparecer quando LEGAL_VERSION muda.
 */
export const ConsentScreen: React.FC = () => {
  const { acceptTerms, signOut, profile } = useAuth();
  const [checked, setChecked] = useState(false);
  const [legalOpen, setLegalOpen] = useState<'privacy' | 'terms' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUpdate = Boolean(profile?.terms_accepted_at);

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    const { error: acceptError } = await acceptTerms();
    setSubmitting(false);
    if (acceptError) setError(acceptError);
  };

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 rounded-2xl border border-ink-800 space-y-6">
        <div className="text-center space-y-2">
          <ShieldCheck className="w-10 h-10 text-info-400 mx-auto" />
          <h1 className="text-lg font-bold text-ink-100">
            {isUpdate ? 'Atualizamos nossos termos' : 'Antes de começar'}
          </h1>
          <p className="text-xs text-ink-400">
            O app trata dados de viagem da sua família, inclusive de crianças. Leia como cuidamos deles e confirme o aceite (versão {LEGAL_VERSION}).
          </p>
        </div>

        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setLegalOpen('privacy')}
            className="flex-1 px-3 py-2 rounded-xl bg-ink-900 border border-ink-800 text-info-300 font-semibold hover:border-info-500 transition"
          >
            Política de Privacidade
          </button>
          <button
            type="button"
            onClick={() => setLegalOpen('terms')}
            className="flex-1 px-3 py-2 rounded-xl bg-ink-900 border border-ink-800 text-info-300 font-semibold hover:border-info-500 transition"
          >
            Termos de Uso
          </button>
        </div>

        <label className="flex items-start gap-3 text-xs text-ink-200 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-info-500"
          />
          <span>
            Li e aceito a Política de Privacidade e os Termos de Uso, inclusive a transferência internacional dos dados descrita na política.
          </span>
        </label>

        {error && (
          <div className="px-3 py-2 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-400 text-xs">{error}</div>
        )}

        <button
          type="button"
          disabled={!checked || submitting}
          onClick={handleAccept}
          className="w-full px-4 py-2.5 rounded-xl bg-info-600 hover:bg-info-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-info-600/30 transition"
        >
          Aceitar e continuar
        </button>

        <button
          type="button"
          onClick={() => signOut()}
          className="w-full text-[11px] text-ink-500 hover:text-ink-300 transition"
        >
          Não aceito — sair
        </button>
      </div>

      <LegalModal isOpen={legalOpen !== null} onClose={() => setLegalOpen(null)} initialDocument={legalOpen ?? 'privacy'} />
    </div>
  );
};
