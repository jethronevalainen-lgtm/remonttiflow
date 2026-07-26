import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  loadRoleWorkspace,
  type RoleWorkspaceData,
} from '@/lib/supabase/workManagement';

const EMPTY_WORKSPACE: RoleWorkspaceData = {
  people: [],
  projectMemberships: [],
  workOrders: [],
};

export function useRoleWorkspace() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const { effectiveRole, effectiveUserId } = useViewAs();
  const organizationId = currentOrg?.id;
  const canManage = effectiveRole === 'admin' || effectiveRole === 'supervisor';
  const queryKey = [
    'role-workspace',
    organizationId ?? 'none',
    effectiveUserId ?? 'anonymous',
    effectiveRole ?? 'none',
  ] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => loadRoleWorkspace(
      organizationId as string,
      canManage,
      effectiveUserId as string,
    ),
    enabled: Boolean(organizationId && effectiveUserId && effectiveRole),
    staleTime: 15_000,
    retry: 1,
  });

  return {
    ...(query.data ?? EMPTY_WORKSPACE),
    canManage,
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  };
}
