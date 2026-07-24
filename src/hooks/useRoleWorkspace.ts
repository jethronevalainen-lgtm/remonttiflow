import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
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
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrganization();
  const organizationId = currentOrg?.id;
  const canManage = currentRole === 'admin' || currentRole === 'supervisor';
  const queryKey = [
    'role-workspace',
    organizationId ?? 'none',
    user?.id ?? 'anonymous',
    currentRole ?? 'none',
  ] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => loadRoleWorkspace(
      organizationId as string,
      canManage,
      user?.id as string,
    ),
    enabled: Boolean(organizationId && user?.id && currentRole),
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
