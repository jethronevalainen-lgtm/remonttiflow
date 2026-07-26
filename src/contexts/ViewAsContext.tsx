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

const VIEW_AS_STORAGE_KEY = 'vakantti-v1-view-as';

export interface ViewAsTarget {
  userId: string;
  displayName: string;
  email: string | null;
  role: OrganizationRole;
}

interface StoredViewAsState {
  organizationId: string;
  target: ViewAsTarget;
}

interface ViewAsContextValue {
  /** Signed-in administrator's real role. Never affected by preview mode. */
  actualRole: OrganizationRole | null;
  /** Role used by navigation and ordinary route guards while previewing. */
  effectiveRole: OrganizationRole | null;
  /** Signed-in user's id, or the selected member id while previewing. */
  effectiveUserId: string | null;
  /** Signed-in user's name, or the selected member name while previewing. */
  effectiveDisplayName: string;
  previewTarget: ViewAsTarget | null;
  isPreviewing: boolean;
  startPreview: (target: ViewAsTarget) => void;
  stopPreview: () => void;
}

const ViewAsContext = createContext<ViewAsContextValue | null>(null);

function readStoredPreview(organizationId: string): ViewAsTarget | null {
  try {
    const raw = window.sessionStorage.getItem(VIEW_AS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredViewAsState>;
    const target = parsed.target;
    if (
      parsed.organizationId !== organizationId
      || !target
      || typeof target.userId !== 'string'
      || typeof target.displayName !== 'string'
      || (target.role !== 'admin' && target.role !== 'supervisor' && target.role !== 'worker')
    ) {
      return null;
    }
    return {
      userId: target.userId,
      displayName: target.displayName,
      email: typeof target.email === 'string' ? target.email : null,
      role: target.role,
    };
  } catch {
    return null;
  }
}

function clearStoredPreview(): void {
  try {
    window.sessionStorage.removeItem(VIEW_AS_STORAGE_KEY);
  } catch {
    // Session storage may be unavailable in strict privacy modes.
  }
}

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const organizationId = currentOrg?.id ?? null;
  const [previewTarget, setPreviewTarget] = useState<ViewAsTarget | null>(null);

  useEffect(() => {
    if (currentRole !== 'admin' || !organizationId) {
      setPreviewTarget(null);
      clearStoredPreview();
      return;
    }
    setPreviewTarget(readStoredPreview(organizationId));
  }, [currentRole, organizationId]);

  const startPreview = useCallback((target: ViewAsTarget) => {
    if (currentRole !== 'admin' || !organizationId) return;
    setPreviewTarget(target);
    try {
      const stored: StoredViewAsState = {
        organizationId,
        target,
      };
      window.sessionStorage.setItem(VIEW_AS_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Preview still works in memory when storage is unavailable.
    }
  }, [currentRole, organizationId]);

  const stopPreview = useCallback(() => {
    setPreviewTarget(null);
    clearStoredPreview();
  }, []);

  const value = useMemo<ViewAsContextValue>(() => {
    const signedInDisplayName = profile?.full_name ?? user?.email ?? '';
    return {
      actualRole: currentRole,
      effectiveRole: previewTarget?.role ?? currentRole,
      effectiveUserId: previewTarget?.userId ?? user?.id ?? null,
      effectiveDisplayName: previewTarget?.displayName || previewTarget?.email || signedInDisplayName,
      previewTarget,
      isPreviewing: Boolean(previewTarget),
      startPreview,
      stopPreview,
    };
  }, [currentRole, previewTarget, profile?.full_name, startPreview, stopPreview, user?.email, user?.id]);

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
}

export function useViewAs(): ViewAsContextValue {
  const context = useContext(ViewAsContext);
  if (!context) throw new Error('useViewAs must be used within ViewAsProvider');
  return context;
}
