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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="glass-card w-full max-w-md p-8 rounded-2xl border border-slate-800 text-center space-y-4">
          <Mail className="w-10 h-10 text-blue-400 mx-auto" />
          <h1 className="text-lg font-bold text-white">Confirme seu email</h1>
          <p className="text-sm text-slate-400">
            Enviamos um link de confirmação para <strong className="text-slate-200">{email}</strong>. Clique nele para ativar sua conta.
          </p>
          <button
            onClick={() => setAwaitingConfirmation(false)}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 rounded-2xl border border-slate-800 space-y-6">
        <div className="flex items-center gap-3 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
            <Plane className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-extrabold text-white">Plataforma de Viagens</h1>
        </div>

        <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1">
          <button
            type="button"
            onClick={() => { setMode('login'); resetMessages(); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); resetMessages(); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${mode === 'signup' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
          >
            Criar Conta
          </button>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}
          {infoMessage && (
            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
              {infoMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition"
          >
            {mode === 'login' ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>

        <div className="flex items-center gap-3 text-[10px] text-slate-500 uppercase font-bold">
          <div className="flex-1 h-px bg-slate-800" />
          ou
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={isSubmitting}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Enviar link mágico
          </button>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            Continuar com Google
          </button>
        </div>
      </div>
    </div>
  );
};
