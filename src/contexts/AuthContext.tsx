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
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

import {
  administratorSupabase,
  deactivateImpersonationSession,
  getActiveSupabaseClient,
  isImpersonationClientActive,
  subscribeActiveSupabaseClient,
} from '@/lib/supabase/client';
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
const LEGACY_VIEW_AS_STORAGE_KEY = 'vakantti-v1-view-as';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearLegacyPreviewState(): void {
  try {
    window.sessionStorage.removeItem(LEGACY_VIEW_AS_STORAGE_KEY);
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

async function fetchProfile(
  client: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
  const query = () => client.from('profiles').select('*').eq('id', userId).maybeSingle();
  let { data, error } = await query();
  if (error) {
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    ({ data, error } = await query());
  }
  return error ? null : data as ProfileRow | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    let unsubscribeAuth: (() => void) | null = null;

    const hydrateSession = async (
      client: SupabaseClient,
      nextSession: Session | null,
      expectedRevision: number,
    ) => {
      if (
        cancelled
        || expectedRevision !== revision
        || client !== getActiveSupabaseClient()
      ) return;

      setSession(nextSession);
      setProfile(null);
      if (!nextSession?.user) {
        setLoading(false);
        return;
      }

      const nextProfile = await fetchProfile(client, nextSession.user.id);
      if (
        cancelled
        || expectedRevision !== revision
        || client !== getActiveSupabaseClient()
      ) return;
      setProfile(nextProfile);
      setLoading(false);
    };

    const bindClient = async (client: SupabaseClient) => {
      revision += 1;
      const expectedRevision = revision;
      unsubscribeAuth?.();
      unsubscribeAuth = null;
      setLoading(true);
      setSession(null);
      setProfile(null);

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (client !== getActiveSupabaseClient()) return;
        if (!nextSession && isImpersonationClientActive()) {
          void deactivateImpersonationSession();
          return;
        }
        void hydrateSession(client, nextSession, expectedRevision);
      });
      unsubscribeAuth = () => subscription.unsubscribe();

      const {
        data: { session: initialSession },
      } = await client.auth.getSession();
      await hydrateSession(client, initialSession, expectedRevision);
    };

    void bindClient(getActiveSupabaseClient());
    const unsubscribeClient = subscribeActiveSupabaseClient((client) => {
      void bindClient(client);
    });

    return () => {
      cancelled = true;
      revision += 1;
      unsubscribeClient();
      unsubscribeAuth?.();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      try {
        clearLegacyPreviewState();
        if (isImpersonationClientActive()) await deactivateImpersonationSession();
        const { error } = await administratorSupabase.auth.signInWithPassword({ email, password });
        if (error) return { error: mapSignInError(error.message) };
        return { error: null };
      } catch {
        return { error: SIGN_IN_GENERIC_ERROR };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    clearLegacyPreviewState();
    if (isImpersonationClientActive()) await deactivateImpersonationSession();
    await administratorSupabase.auth.signOut();
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
