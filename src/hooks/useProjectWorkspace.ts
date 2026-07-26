import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import {
  listChangeOrders,
  listProjectActivity,
  listProjectDocuments,
  loadProjectWorkspaceSummary,
} from '@/lib/supabase/projectWorkspace';

export function useProjectWorkspace(projectId: string | undefined) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const enabled = Boolean(organizationId && projectId);
  const queryKey = ['project-workspace', organizationId ?? 'none', projectId ?? 'none'] as const;

  const query = useQuery({
    queryKey,
    enabled,
    staleTime: 20_000,
    retry: 1,
    queryFn: async () => {
      const [summary, activity, documents, changeOrders] = await Promise.all([
        loadProjectWorkspaceSummary(organizationId as string, projectId as string),
        listProjectActivity(organizationId as string, projectId as string),
        listProjectDocuments(organizationId as string, projectId as string),
        listChangeOrders(organizationId as string, projectId as string),
      ]);
      return { summary, activity, documents, changeOrders };
    },
  });

  return {
    summary: query.data?.summary,
    activity: query.data?.activity ?? [],
    documents: query.data?.documents ?? [],
    changeOrders: query.data?.changeOrders ?? [],
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
