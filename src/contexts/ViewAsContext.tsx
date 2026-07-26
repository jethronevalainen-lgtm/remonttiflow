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
import { useOrganization } from '@/contexts/OrganizationContext';
import type { OrganizationRole } from '@/lib/supabase/types';

export interface ViewAsTarget {
  userId: string;
  displayName: string;
  email: string | null;
  role: OrganizationRole;
}

interface ViewAsContextValue {
  actualRole: OrganizationRole | null;
  effectiveRole: OrganizationRole | null;
  effectiveUserId: string | null;
  effectiveDisplayName: string;
  previewTarget: ViewAsTarget | null;
  isPreviewing: boolean;
  startPreview: (target: ViewAsTarget) => void;
  stopPreview: () => void;
}

const ViewAsContext = createContext<ViewAsContextValue | null>(null);

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { currentOrg, actualRole } = useOrganization();
  const organizationId = currentOrg?.id ?? null;
  const [previewTarget, setPreviewTarget] = useState<ViewAsTarget | null>(null);

  // Preview is intentionally memory-only. A reload, sign-in or organization
  // switch always returns the administrator to their real role.
  useEffect(() => {
    setPreviewTarget(null);
  }, [actualRole, organizationId, user?.id]);

  const startPreview = useCallback((target: ViewAsTarget) => {
    if (actualRole !== 'admin' || !organizationId) return;
    setPreviewTarget(target);
  }, [actualRole, organizationId]);

  const stopPreview = useCallback(() => {
    setPreviewTarget(null);
  }, []);

  const value = useMemo<ViewAsContextValue>(() => {
    const signedInDisplayName = profile?.full_name ?? user?.email ?? '';
    return {
      actualRole,
      effectiveRole: previewTarget?.role ?? actualRole,
      effectiveUserId: previewTarget?.userId ?? user?.id ?? null,
      effectiveDisplayName: previewTarget?.displayName || previewTarget?.email || signedInDisplayName,
      previewTarget,
      isPreviewing: Boolean(previewTarget),
      startPreview,
      stopPreview,
    };
  }, [actualRole, previewTarget, profile?.full_name, startPreview, stopPreview, user?.email, user?.id]);

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
}

export function useViewAs(): ViewAsContextValue {
  const context = useContext(ViewAsContext);
  if (!context) throw new Error('useViewAs must be used within ViewAsProvider');
  return context;
}
