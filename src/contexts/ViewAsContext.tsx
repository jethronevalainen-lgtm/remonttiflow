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
import type { CustomerPreviewScope } from '@/lib/customerPortalAccess';
import { queryClient } from '@/lib/queryClient';
import { isImpersonationClientActive } from '@/lib/supabase/client';
import {
  startAdministratorImpersonation,
  stopAdministratorImpersonation,
  type ActiveImpersonation,
} from '@/lib/supabase/impersonation';
import type { OrganizationRole } from '@/lib/supabase/types';

export interface ViewAsTarget {
  userId: string;
  displayName: string;
  email: string | null;
  role: OrganizationRole;
  customerPreview?: CustomerPreviewScope;
}

interface ViewAsContextValue {
  actualRole: OrganizationRole | null;
  effectiveRole: OrganizationRole | null;
  effectiveUserId: string | null;
  effectiveDisplayName: string;
  previewTarget: ViewAsTarget | null;
  customerPreview: CustomerPreviewScope | null;
  /** Legacy compatibility flag. Real impersonation is never preview-only. */
  isPreviewing: boolean;
  isImpersonating: boolean;
  switching: boolean;
  startPreview: (target: ViewAsTarget) => Promise<void>;
  stopPreview: () => Promise<void>;
}

const ViewAsContext = createContext<ViewAsContextValue | null>(null);

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const { currentOrg, actualRole: organizationRole } = useOrganization();
  const [impersonation, setImpersonation] = useState<ActiveImpersonation | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!impersonation || authLoading) return;

    // The memory-only impersonation client publishes before AuthContext has
    // finished hydrating its target session. During that short handoff `user`
    // can be null. Clearing the metadata at that point would strand the browser
    // in the target user's real session without the return-to-admin control.
    if (isImpersonationClientActive()) return;

    if (!user || user.id !== impersonation.target.userId) {
      setImpersonation(null);
      queryClient.clear();
    }
  }, [authLoading, impersonation, user]);

  const startPreview = useCallback(async (target: ViewAsTarget) => {
    const organizationId = currentOrg?.id;
    if (organizationRole !== 'admin' || !organizationId) {
      throw new Error('Vain organisaation ylläpitäjä voi toimia toisena käyttäjänä.');
    }
    if (impersonation || isImpersonationClientActive()) {
      throw new Error('Lopeta nykyinen käyttäjänä toimiminen ennen uuden käyttäjän valintaa.');
    }

    setSwitching(true);
    queryClient.clear();
    try {
      const next = await startAdministratorImpersonation({
        organizationId,
        targetUserId: target.userId,
      });
      setImpersonation(next);
      queryClient.clear();
    } finally {
      setSwitching(false);
    }
  }, [currentOrg?.id, impersonation, organizationRole]);

  const stopPreview = useCallback(async () => {
    if (!impersonation) return;
    setSwitching(true);
    queryClient.clear();
    try {
      await stopAdministratorImpersonation(impersonation);
    } finally {
      setImpersonation(null);
      queryClient.clear();
      setSwitching(false);
    }
  }, [impersonation]);

  const value = useMemo<ViewAsContextValue>(() => {
    const signedInDisplayName = profile?.full_name ?? user?.email ?? '';
    const target = impersonation?.target ?? null;
    return {
      actualRole: target?.role ?? organizationRole,
      effectiveRole: target?.role ?? organizationRole,
      effectiveUserId: target?.userId ?? user?.id ?? null,
      effectiveDisplayName: target?.displayName || target?.email || signedInDisplayName,
      previewTarget: target
        ? {
            userId: target.userId,
            displayName: target.displayName,
            email: target.email,
            role: target.role,
          }
        : null,
      customerPreview: null,
      isPreviewing: false,
      isImpersonating: Boolean(target),
      switching,
      startPreview,
      stopPreview,
    };
  }, [impersonation?.target, organizationRole, profile?.full_name, startPreview, stopPreview, switching, user?.email, user?.id]);

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
}

export function useViewAs(): ViewAsContextValue {
  const context = useContext(ViewAsContext);
  if (!context) throw new Error('useViewAs must be used within ViewAsProvider');
  return context;
}
