import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthScreen } from './AuthScreen';
import { OnboardingScreen } from './OnboardingScreen';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, session, tenantMemberships } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (tenantMemberships.length === 0) {
    return <OnboardingScreen />;
  }

  return <>{children}</>;
};
