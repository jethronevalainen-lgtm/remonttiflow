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
const VIEW_AS_STORAGE_KEY = 'vakantti-v1-view-as';
export const VIEW_AS_CHANGE_EVENT = 'vakantti:view-as-change';

interface ViewAsChangeDetail {
  organizationId: string;
  role: OrganizationRole | null;
}

export interface OrganizationContextValue {
  organizations: MyOrganization[];
  currentOrg: MyOrganization | null;
  /** Signed-in membership role. Never changes during preview. */
  actualRole: OrganizationRole | null;
  /** Role existing pages should render. May be overridden by admin preview. */
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

function readPreviewRole(organizationId: string, actualRole: OrganizationRole | null): OrganizationRole | null {
  if (actualRole !== 'admin') return null;
  try {
    const raw = window.sessionStorage.getItem(VIEW_AS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      organizationId?: unknown;
      target?: { role?: unknown };
    };
    const role = parsed.target?.role;
    if (
      parsed.organizationId !== organizationId
      || (role !== 'admin' && role !== 'supervisor' && role !== 'worker' && role !== 'customer')
    ) return null;
    return role;
  } catch {
    return null;
  }
}

function chooseOrganization(organizations: MyOrganization[], preferredId: string | null) {
  return (
    (preferredId ? organizations.find((organization) => organization.id === preferredId) : undefined)
    ?? organizations[0]
    ?? null
  );
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState<MyOrganization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<MyOrganization | null>(null);
  const [previewRole, setPreviewRole] = useState<OrganizationRole | null>(null);
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
    if (!session) {
      setOrganizations([]);
      setCurrentOrgState(null);
      setPreviewRole(null);
      setOrgsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setOrgsLoading(true);
      setError(null);
      try {
        const orgs = await getMyOrganizations();
        if (!cancelled) applyOrganizations(orgs, readStoredOrgId());
      } catch (caught) {
        if (!cancelled) {
          setOrganizations([]);
          setCurrentOrgState(null);
          setPreviewRole(null);
          setError(caught instanceof Error ? caught.message : 'Organisaatioiden lataaminen epäonnistui.');
        }
      } finally {
        if (!cancelled) setOrgsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [applyOrganizations, session]);

  useEffect(() => {
    if (!currentOrg) {
      setPreviewRole(null);
      return;
    }
    setPreviewRole(readPreviewRole(currentOrg.id, actualRole));
  }, [actualRole, currentOrg]);

  useEffect(() => {
    const handlePreviewChange = (event: Event) => {
      const detail = (event as CustomEvent<ViewAsChangeDetail>).detail;
      if (
        !currentOrg
        || !detail
        || detail.organizationId !== currentOrg.id
        || actualRole !== 'admin'
      ) return;
      setPreviewRole(detail.role);
    };

    window.addEventListener(VIEW_AS_CHANGE_EVENT, handlePreviewChange);
    return () => window.removeEventListener(VIEW_AS_CHANGE_EVENT, handlePreviewChange);
  }, [actualRole, currentOrg]);

  const refreshOrganizations = useCallback(async () => {
    if (!session) return;
    setOrgsLoading(true);
    setError(null);
    try {
      const orgs = await getMyOrganizations();
      applyOrganizations(orgs, currentOrg?.id ?? readStoredOrgId());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Organisaatioiden lataaminen epäonnistui.');
      throw caught;
    } finally {
      setOrgsLoading(false);
    }
  }, [applyOrganizations, currentOrg?.id, session]);

  const setCurrentOrg = useCallback((orgId: string) => {
    const next = organizations.find((organization) => organization.id === orgId);
    if (!next) return;
    setPreviewRole(null);
    setCurrentOrgState(next);
    writeStoredOrgId(next.id);
  }, [organizations]);

  const value = useMemo<OrganizationContextValue>(() => ({
    organizations,
    currentOrg,
    actualRole,
    currentRole: previewRole ?? actualRole,
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
    previewRole,
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
