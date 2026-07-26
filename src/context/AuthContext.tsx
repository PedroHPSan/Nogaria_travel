import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import type { Profile, Tenant, UserRole } from '../types/database.types';

export interface TenantMembership {
  tenant: Tenant;
  role: UserRole;
}

interface AuthContextType {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  tenantMemberships: TenantMembership[];
  activeTenantId: string | null;
  activeTenant: Tenant | null;
  activeRole: UserRole | null;
  setActiveTenantId: (id: string) => void;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  createTenant: (name: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, created_at')
    .eq('id', userId)
    .returns<Profile[]>();
  if (error || !data || data.length === 0) return null;
  return data[0];
}

interface MembershipRow {
  role: UserRole;
  tenants: Tenant | null;
}

async function fetchTenantMemberships(userId: string): Promise<TenantMembership[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('role, tenants(id, name, slug, plan, created_at)')
    .eq('user_id', userId)
    .returns<MembershipRow[]>();
  if (error || !data) return [];
  return data
    .filter((row): row is MembershipRow & { tenants: Tenant } => row.tenants !== null)
    .map(row => ({ tenant: row.tenants, role: row.role }));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenantMemberships, setTenantMemberships] = useState<TenantMembership[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  const loadUserData = useCallback(async (userId: string) => {
    const [profileData, memberships] = await Promise.all([
      fetchProfile(userId),
      fetchTenantMemberships(userId)
    ]);
    setProfile(profileData);
    setTenantMemberships(memberships);
    setActiveTenantId(prev =>
      prev && memberships.some(m => m.tenant.id === prev) ? prev : (memberships[0]?.tenant.id ?? null)
    );
  }, []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      if (data.session) {
        await loadUserData(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      if (newSession) {
        await loadUserData(newSession.user.id);
      } else {
        setProfile(null);
        setTenantMemberships([]);
        setActiveTenantId(null);
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const signUpWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, needsEmailConfirmation: false };
    return { error: null, needsEmailConfirmation: !data.session };
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? 'Email ou senha incorretos.' : null };
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error ? error.message : null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const createTenant = async (name: string) => {
    const { data, error } = await supabase.rpc('create_tenant_with_owner', { p_name: name });
    if (error) return { error: error.message };
    const newTenantId = data as string | null;
    if (!newTenantId) return { error: 'Falha ao criar a família/organização.' };
    if (session) await loadUserData(session.user.id);
    setActiveTenantId(newTenantId);
    return { error: null };
  };

  const activeTenant = tenantMemberships.find(m => m.tenant.id === activeTenantId)?.tenant ?? null;
  const activeRole = tenantMemberships.find(m => m.tenant.id === activeTenantId)?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        profile,
        tenantMemberships,
        activeTenantId,
        activeTenant,
        activeRole,
        setActiveTenantId,
        signUpWithPassword,
        signInWithPassword,
        signInWithMagicLink,
        signInWithGoogle,
        signOut,
        createTenant
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
