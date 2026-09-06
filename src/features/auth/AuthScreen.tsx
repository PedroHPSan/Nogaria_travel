import React, { useState } from 'react';
import { Plane, Mail, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type Mode = 'login' | 'signup';

export const AuthScreen: React.FC = () => {
  const { signInWithPassword, signUpWithPassword, signInWithMagicLink, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const resetMessages = () => {
    setError(null);
    setInfoMessage(null);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsSubmitting(true);

    if (mode === 'login') {
      const { error: signInError } = await signInWithPassword(email, password);
      if (signInError) setError(signInError);
    } else {
      const { error: signUpError, needsEmailConfirmation } = await signUpWithPassword(email, password);
      if (signUpError) {
        setError(signUpError);
      } else if (needsEmailConfirmation) {
        setAwaitingConfirmation(true);
      }
    }

    setIsSubmitting(false);
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setError('Informe seu email para receber o link mágico.');
      return;
    }
    resetMessages();
    setIsSubmitting(true);
    const { error: otpError } = await signInWithMagicLink(email);
    setIsSubmitting(false);
    if (otpError) {
      setError(otpError);
    } else {
      setInfoMessage('Link enviado! Confira seu email para entrar.');
    }
  };

  const handleGoogle = async () => {
    resetMessages();
    const { error: googleError } = await signInWithGoogle();
    if (googleError) setError(googleError);
  };

  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen bg-ink-950 text-ink-100 flex items-center justify-center p-4">
        <div className="glass-card w-full max-w-md p-8 rounded-2xl border border-ink-800 text-center space-y-4">
          <Mail className="w-10 h-10 text-info-400 mx-auto" />
          <h1 className="text-lg font-bold text-ink-100">Confirme seu email</h1>
          <p className="text-sm text-ink-400">
            Enviamos um link de confirmação para <strong className="text-ink-200">{email}</strong>. Clique nele para ativar sua conta.
          </p>
          <button
            onClick={() => setAwaitingConfirmation(false)}
            className="text-xs text-info-400 hover:text-info-300 font-semibold"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 rounded-2xl border border-ink-800 space-y-6">
        <div className="flex items-center gap-3 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-info-600 via-indigo-600 to-accent-600 flex items-center justify-center shadow-lg shadow-info-500/20 text-white">
            <Plane className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-extrabold text-ink-100">Plataforma de Viagens</h1>
        </div>

        <div className="flex rounded-xl bg-ink-900 border border-ink-800 p-1">
          <button
            type="button"
            onClick={() => { setMode('login'); resetMessages(); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${mode === 'login' ? 'bg-info-600 text-white' : 'text-ink-400'}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); resetMessages(); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${mode === 'signup' ? 'bg-info-600 text-white' : 'text-ink-400'}`}
          >
            Criar Conta
          </button>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-ink-300 font-semibold mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          <div>
            <label className="block text-ink-300 font-semibold mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 focus:outline-none focus:border-info-500"
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-400 text-xs">
              {error}
            </div>
          )}
          {infoMessage && (
            <div className="px-3 py-2 rounded-xl bg-success-500/10 border border-success-500/30 text-success-400 text-xs">
              {infoMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-2.5 rounded-xl bg-info-600 hover:bg-info-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-info-600/30 transition"
          >
            {mode === 'login' ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>

        <div className="flex items-center gap-3 text-[10px] text-ink-500 uppercase font-bold">
          <div className="flex-1 h-px bg-ink-800" />
          ou
          <div className="flex-1 h-px bg-ink-800" />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={isSubmitting}
            className="w-full px-4 py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 disabled:opacity-50 text-ink-200 font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-info-400" />
            Enviar link mágico
          </button>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full px-4 py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-200 font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <Lock className="w-3.5 h-3.5 text-success-400" />
            Continuar com Google
          </button>
        </div>
      </div>
    </div>
  );
};
