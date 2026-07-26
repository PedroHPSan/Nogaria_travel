import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import type { Profile, Tenant, UserRole } from '../types/database.types';

// Must match TripContext.tsx's STORAGE_KEY. Not imported directly to avoid a
// circular dependency (TripContext.tsx already imports useAuth from this file).
const TRIP_STORAGE_KEY = 'ANTIGRAVITY_TRAVEL_PLATFORM_V1';

export interface TenantMembership {
  tenant: Tenant;
  role: UserRole;
}

interface AuthContextType {
  loading: boolean;
  userDataLoading: boolean;
  loadError: string | null;
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
  signOut: () => Promise<{ error: string | null }>;
  createTenant: (name: string) => Promise<{ error: string | null }>;
  retryLoadUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// PostgREST rejects a request with these exact messages (error code PGRST303/
// PGRST301 family) when the JWT's iat/exp/nbf claims fall outside its own
// clock ±30s tolerance. Supabase has had real incidents of clock skew between
// its Auth service (which stamps `iat`) and PostgREST (which validates it) —
// we hit "JWT issued at future" right after email confirmation on 2026-07-26.
// The condition is transient: PostgREST's clock keeps advancing, so a freshly
// rejected token becomes valid seconds later. Retry instead of hard-failing.
// See .superpowers/sdd/jwt-future-investigation-report.md for the evidence.
const JWT_CLOCK_SKEW_ERROR = /JWT (issued at future|expired|not yet valid)/i;

// Total ~22s of automatic waiting, enough to outlast skew of up to ~50s
// beyond PostgREST's built-in 30s tolerance. Beyond that, the user still
// gets the manual "Tentar novamente" screen.
const JWT_RETRY_DELAYS_MS = [2000, 6000, 14000];

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function fetchProfile(userId: string): Promise<{ data: Profile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, created_at')
    .eq('id', userId)
    .returns<Profile[]>();
  if (error) return { data: null, error: error.message };
  return { data: data?.[0] ?? null, error: null };
}

interface MembershipRow {
  role: UserRole;
  tenants: Tenant | null;
}

async function fetchTenantMemberships(userId: string): Promise<{ data: TenantMembership[]; error: string | null }> {
  const { data, error } = await supabase
    .from('memberships')
    .select('role, tenants(id, name, slug, plan, created_at)')
    .eq('user_id', userId)
    .returns<MembershipRow[]>();
  if (error) return { data: [], error: error.message };
  const memberships = (data ?? [])
    .filter((row): row is MembershipRow & { tenants: Tenant } => row.tenants !== null)
    .map(row => ({ tenant: row.tenants, role: row.role }));
  return { data: memberships, error: null };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenantMemberships, setTenantMemberships] = useState<TenantMembership[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  const loadUserData = useCallback(async (userId: string) => {
    setUserDataLoading(true);
    setLoadError(null);
    try {
      let profileResult: Awaited<ReturnType<typeof fetchProfile>>;
      let membershipsResult: Awaited<ReturnType<typeof fetchTenantMemberships>>;
      let combinedError: string | null;
      for (let attempt = 0; ; attempt++) {
        [profileResult, membershipsResult] = await Promise.all([
          fetchProfile(userId),
          fetchTenantMemberships(userId)
        ]);
        combinedError = profileResult.error ?? membershipsResult.error;
        if (
          combinedError &&
          JWT_CLOCK_SKEW_ERROR.test(combinedError) &&
          attempt < JWT_RETRY_DELAYS_MS.length
        ) {
          // Transient Supabase-side clock skew (see JWT_CLOCK_SKEW_ERROR
          // above): wait for PostgREST's clock to catch up and try again.
          await delay(JWT_RETRY_DELAYS_MS[attempt]);
          continue;
        }
        break;
      }
      if (combinedError) setLoadError(combinedError);
      setProfile(profileResult.data);
      setTenantMemberships(membershipsResult.data);
      setActiveTenantId(prev =>
        prev && membershipsResult.data.some(m => m.tenant.id === prev)
          ? prev
          : (membershipsResult.data[0]?.tenant.id ?? null)
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erro ao carregar dados do usuário.');
    } finally {
      setUserDataLoading(false);
    }
  }, []);

  // Tracks the user id we last loaded profile/tenant data for, so background
  // auth events for the SAME user (e.g. the hourly token auto-refresh, or a
  // SIGNED_IN/TOKEN_REFRESHED rebroadcast from another tab) don't trigger a
  // blocking reload of already-loaded data. Reset to null on sign-out so a
  // subsequent sign-in — even as the same user — is always treated as fresh.
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Rely solely on onAuthStateChange: it fires an INITIAL_SESSION event to
    // every new subscriber on mount (carrying the same session getSession()
    // would resolve), so a separate getSession() call would just duplicate
    // loadUserData for the same user on every mount.
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      if (newSession) {
        const isBackgroundRefreshForSameUser = previousUserIdRef.current === newSession.user.id;
        previousUserIdRef.current = newSession.user.id;
        if (!isBackgroundRefreshForSameUser) {
          await loadUserData(newSession.user.id);
        }
        // else: same user's session was silently refreshed (or rebroadcast
        // from another tab) — setSession above already kept the token fresh;
        // profile/tenant data hasn't changed, so skip the blocking reload.
      } else {
        previousUserIdRef.current = null;
        setProfile(null);
        setTenantMemberships([]);
        setActiveTenantId(null);
        setLoadError(null);
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const retryLoadUserData = async () => {
    if (session) await loadUserData(session.user.id);
  };

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
    const { error } = await supabase.auth.signOut();
    if (error) console.error('signOut failed:', error.message);

    // Clear TripContext's localStorage so the next person to sign in on this
    // browser doesn't inherit the previous account's trip/financial data.
    Object.keys(localStorage)
      .filter(key => key.startsWith(TRIP_STORAGE_KEY))
      .forEach(key => localStorage.removeItem(key));

    return { error: error ? error.message : null };
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
        userDataLoading,
        loadError,
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
        createTenant,
        retryLoadUserData
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
