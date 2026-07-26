import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const OnboardingScreen: React.FC = () => {
  const { createTenant } = useAuth();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe um nome.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const { error: createError } = await createTenant(name.trim());
    setIsSubmitting(false);
    if (createError) setError(createError);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 rounded-2xl border border-slate-800 space-y-6">
        <div className="text-center space-y-2">
          <Building2 className="w-10 h-10 text-blue-400 mx-auto" />
          <h1 className="text-lg font-bold text-white">Vamos criar sua família ou organização</h1>
          <p className="text-xs text-slate-400">
            Esse será o espaço onde suas viagens, participantes e finanças ficam organizados.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nome da família / organização</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Família Palheta"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition"
          >
            Continuar
          </button>
        </form>
      </div>
    </div>
  );
};
