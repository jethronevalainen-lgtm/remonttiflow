/**
 * Organization context: which organizations the signed-in user belongs
 * to, which one is currently active, and the user's role in it.
 *
 * Data comes from src/lib/supabase/orgContext.ts (RLS-scoped helpers).
 * The active organization choice is persisted to localStorage so a
 * returning user lands back in the organization they last used.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/contexts/AuthContext';
import {
  getMyOrganizations,
  type MyOrganization,
} from '@/lib/supabase/orgContext';
import type { OrganizationRole } from '@/lib/supabase/types';

/** localStorage key for the persisted active-organization id. */
export const CURRENT_ORG_STORAGE_KEY = 'vakantti-v1-currentOrg';

export interface OrganizationContextValue {
  /** Every organization the current user is a member of. */
  organizations: MyOrganization[];
  /** The active organization, or null when none is available/selected. */
  currentOrg: MyOrganization | null;
  /** The user's membership role in currentOrg, or null without one. */
  currentRole: OrganizationRole | null;
  /** Switches the active organization (must be one of `organizations`). */
  setCurrentOrg: (orgId: string) => void;
  /** True while auth is resolving or organizations are being fetched. */
  loading: boolean;
  /** Finnish error message from the last failed load, or null. */
  error: string | null;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

function readStoredOrgId(): string | null {
  try {
    return window.localStorage.getItem(CURRENT_ORG_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredOrgId(orgId: string): void {
  try {
    window.localStorage.setItem(CURRENT_ORG_STORAGE_KEY, orgId);
  } catch {
    // Storage unavailable (private mode etc.) — selection still works in memory.
  }
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();

  const [organizations, setOrganizations] = useState<MyOrganization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<MyOrganization | null>(null);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No session → signed out (or never signed in): reset everything.
    if (!session) {
      setOrganizations([]);
      setCurrentOrgState(null);
      setOrgsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setOrgsLoading(true);
      setError(null);
      try {
        const orgs = await getMyOrganizations();
        if (cancelled) return;
        setOrganizations(orgs);

        // Restore the persisted choice when the user is still a member,
        // otherwise fall back to the first organization.
        const storedId = readStoredOrgId();
        const restored = storedId
          ? orgs.find((org) => org.id === storedId)
          : undefined;
        const next = restored ?? orgs[0] ?? null;
        setCurrentOrgState(next);
        if (next) {
          writeStoredOrgId(next.id);
        }
      } catch (err) {
        if (cancelled) return;
        setOrganizations([]);
        setCurrentOrgState(null);
        setError(
          err instanceof Error
            ? err.message
            : 'Organisaatioiden lataaminen epäonnistui.',
        );
      } finally {
        if (!cancelled) {
          setOrgsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const setCurrentOrg = useCallback(
    (orgId: string) => {
      const next = organizations.find((org) => org.id === orgId);
      if (!next) return; // Not a member of that organization — ignore.
      setCurrentOrgState(next);
      writeStoredOrgId(next.id);
    },
    [organizations],
  );

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organizations,
      currentOrg,
      currentRole: currentOrg?.role ?? null,
      setCurrentOrg,
      loading: authLoading || orgsLoading,
      error,
    }),
    [organizations, currentOrg, setCurrentOrg, authLoading, orgsLoading, error],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return ctx;
}
