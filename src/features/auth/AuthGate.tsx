import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthScreen } from './AuthScreen';
import { OnboardingScreen } from './OnboardingScreen';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, session, tenantMemberships, userDataLoading, loadError, retryLoadUserData } = useAuth();

  if (loading || (session && userDataLoading)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="glass-card w-full max-w-md p-8 rounded-2xl border border-slate-800 space-y-4 text-center">
          <h1 className="text-lg font-bold text-white">Não foi possível carregar seus dados</h1>
          <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-left">
            {loadError}
          </div>
          <button
            onClick={() => retryLoadUserData()}
            className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (tenantMemberships.length === 0) {
    return <OnboardingScreen />;
  }

  return <>{children}</>;
};
