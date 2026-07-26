/**
 * Supabase-backed authentication context.
 *
 * Organization membership and effective role resolution live outside this
 * context. Role constants are re-exported from the central permission model so
 * legacy imports continue to work while the application has one source of truth.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import type { ProfileRow } from '@/lib/supabase/types';

export type { Session, User };
export {
  ROLE_COLORS,
  ROLE_HOME,
  ROLE_LABELS,
  ROLE_ROUTES,
  hasPermission,
  homeForRole,
} from '@/auth/permissions';
export type { Permission, UserRole } from '@/auth/permissions';

const SIGN_IN_GENERIC_ERROR = 'Kirjautuminen epäonnistui. Yritä uudelleen myöhemmin.';
const SIGN_IN_INVALID_CREDENTIALS_ERROR = 'Virheellinen sähköposti tai salasana';
const VIEW_AS_STORAGE_KEY = 'vakantti-v1-view-as';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearPreviewState(): void {
  try {
    window.sessionStorage.removeItem(VIEW_AS_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in strict privacy modes.
  }
}

function mapSignInError(message: string | undefined): string {
  if (message && /invalid login credentials/i.test(message)) {
    return SIGN_IN_INVALID_CREDENTIALS_ERROR;
  }
  return SIGN_IN_GENERIC_ERROR;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const query = () => supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    let { data, error } = await query();
    if (error) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      ({ data, error } = await query());
    }
    return error ? null : data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveInitialSession = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(initialSession);
      if (initialSession?.user) {
        const initialProfile = await fetchProfile(initialSession.user.id);
        if (cancelled) return;
        setProfile(initialProfile);
      }
      setLoading(false);
    };

    void resolveInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        void fetchProfile(nextSession.user.id).then((nextProfile) => {
          if (!cancelled) setProfile(nextProfile);
        });
      } else {
        setProfile(null);
        clearPreviewState();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      try {
        clearPreviewState();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: mapSignInError(error.message) };
        return { error: null };
      } catch {
        return { error: SIGN_IN_GENERIC_ERROR };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    clearPreviewState();
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
