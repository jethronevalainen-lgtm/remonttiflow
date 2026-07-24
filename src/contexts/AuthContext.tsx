/**
 * Supabase-backed authentication context.
 *
 * Owns the auth session lifecycle: initial session resolution on mount,
 * the onAuthStateChange subscription, and the profile row fetch from the
 * `profiles` table whenever a session exists. Organization membership and
 * role resolution live in OrganizationContext — this context is role-free
 * except for the shared UserRole type and its Finnish label/color maps
 * (imported by Navbar/Header).
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

export type UserRole = 'admin' | 'supervisor' | 'worker';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Järjestelmänvalvoja',
  supervisor: 'Työnjohtaja',
  worker: 'Työntekijä',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-500',
  supervisor: 'bg-orange-500',
  worker: 'bg-blue-500',
};

export const ROLE_ROUTES: Record<UserRole, string[]> = {
  admin: [
    '/dashboard', '/tyonjohto', '/projektit', '/aikataulutus', '/paivakirjat', '/kuittaukset',
    '/laskenta', '/maaralaskenta', '/jatehuolto', '/tyomaaraykset', '/tyovuorokalenteri',
    '/tuntikirjaukset', '/matkakulut', '/tyoturvallisuus', '/crm', '/asiakkaat',
    '/ai', '/viestinta', '/kalusto', '/henkilosto', '/lomakkeet', '/raportit',
  ],
  supervisor: [
    '/dashboard', '/tyonjohto', '/projektit', '/aikataulutus', '/paivakirjat', '/kuittaukset',
    '/laskenta', '/maaralaskenta', '/jatehuolto', '/tyomaaraykset', '/tyovuorokalenteri',
    '/tuntikirjaukset', '/matkakulut', '/tyoturvallisuus', '/crm', '/asiakkaat',
    '/viestinta', '/kalusto', '/henkilosto', '/lomakkeet', '/raportit',
  ],
  worker: [
    '/dashboard', '/tyomaaraykset', '/kuittaukset', '/tuntikirjaukset', '/matkakulut', '/viestinta',
  ],
};

/** Fallback message for any sign-in failure we do not specifically map. */
const SIGN_IN_GENERIC_ERROR = 'Kirjautuminen epäonnistui. Yritä uudelleen myöhemmin.';
/** Message for wrong email/password (Supabase: "Invalid login credentials"). */
const SIGN_IN_INVALID_CREDENTIALS_ERROR = 'Virheellinen sähköposti tai salasana';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  /** True until the initial session has been resolved on mount. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      // Transient network/RLS races happen (e.g. parallel sign-ins) — retry once.
      await new Promise((resolve) => setTimeout(resolve, 800));
      ({ data, error } = await query());
    }
    // A missing/failed profile must not block the session — degrade to null.
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
        // Fire-and-forget: profile failure degrades to null.
        void fetchProfile(nextSession.user.id).then((nextProfile) => {
          if (!cancelled) setProfile(nextProfile);
        });
      } else {
        setProfile(null);
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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return { error: mapSignInError(error.message) };
        }
        // Session/profile state is updated via the onAuthStateChange listener.
        return { error: null };
      } catch {
        return { error: SIGN_IN_GENERIC_ERROR };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
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
