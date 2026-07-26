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
import { getMyOrganizations, type MyOrganization } from '@/lib/supabase/orgContext';
import type { OrganizationRole } from '@/lib/supabase/types';

export const CURRENT_ORG_STORAGE_KEY = 'vakantti-v1-currentOrg';
const ORGANIZATION_LOAD_TIMEOUT_MS = 10_000;
const ORGANIZATION_LOAD_ATTEMPTS = 2;
const ORGANIZATION_RETRY_DELAY_MS = 600;

export interface OrganizationContextValue {
  organizations: MyOrganization[];
  currentOrg: MyOrganization | null;
  actualRole: OrganizationRole | null;
  currentRole: OrganizationRole | null;
  setCurrentOrg: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
  loading: boolean;
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
    // Selection still works in memory when storage is unavailable.
  }
}

function chooseOrganization(organizations: MyOrganization[], preferredId: string | null) {
  return (
    (preferredId ? organizations.find((organization) => organization.id === preferredId) : undefined)
    ?? organizations[0]
    ?? null
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function loadOrganizationsForUser(userId: string): Promise<MyOrganization[]> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= ORGANIZATION_LOAD_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      ORGANIZATION_LOAD_TIMEOUT_MS,
    );

    try {
      const organizations = await getMyOrganizations(userId, controller.signal);
      if (organizations.length === 0) {
        throw new Error('Käyttäjätiliä ei ole liitetty yhteenkään organisaatioon.');
      }
      return organizations;
    } catch (caught) {
      lastError = caught;
      if (attempt < ORGANIZATION_LOAD_ATTEMPTS) {
        await wait(ORGANIZATION_RETRY_DELAY_MS);
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Työtilan lataaminen epäonnistui.');
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? null;
  const [organizations, setOrganizations] = useState<MyOrganization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<MyOrganization | null>(null);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actualRole = currentOrg?.role ?? null;

  const applyOrganizations = useCallback((orgs: MyOrganization[], preferredId: string | null) => {
    setOrganizations(orgs);
    const next = chooseOrganization(orgs, preferredId);
    setCurrentOrgState(next);
    if (next) writeStoredOrgId(next.id);
  }, []);

  useEffect(() => {
    if (!userId) {
      setOrganizations([]);
      setCurrentOrgState(null);
      setOrgsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setOrgsLoading(true);
      setError(null);
      try {
        const orgs = await loadOrganizationsForUser(userId);
        if (!cancelled) applyOrganizations(orgs, readStoredOrgId());
      } catch (caught) {
        if (!cancelled) {
          setOrganizations([]);
          setCurrentOrgState(null);
          setError(caught instanceof Error ? caught.message : 'Organisaatioiden lataaminen epäonnistui.');
        }
      } finally {
        if (!cancelled) setOrgsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [applyOrganizations, userId]);

  const refreshOrganizations = useCallback(async () => {
    if (!userId) return;
    setOrgsLoading(true);
    setError(null);
    try {
      const orgs = await loadOrganizationsForUser(userId);
      applyOrganizations(orgs, currentOrg?.id ?? readStoredOrgId());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Organisaatioiden lataaminen epäonnistui.');
      throw caught;
    } finally {
      setOrgsLoading(false);
    }
  }, [applyOrganizations, currentOrg?.id, userId]);

  const setCurrentOrg = useCallback((orgId: string) => {
    const next = organizations.find((organization) => organization.id === orgId);
    if (!next) return;
    setCurrentOrgState(next);
    writeStoredOrgId(next.id);
  }, [organizations]);

  const value = useMemo<OrganizationContextValue>(() => ({
    organizations,
    currentOrg,
    actualRole,
    currentRole: actualRole,
    setCurrentOrg,
    refreshOrganizations,
    loading: authLoading || orgsLoading,
    error,
  }), [
    actualRole,
    authLoading,
    currentOrg,
    error,
    organizations,
    orgsLoading,
    refreshOrganizations,
    setCurrentOrg,
  ]);

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider');
  return context;
}
