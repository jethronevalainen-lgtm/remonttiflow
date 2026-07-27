import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { loadCrmAftercare } from '@/lib/supabase/crmAftercare';

export function useCrmAftercare() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = ['crm-aftercare', organizationId ?? 'none'] as const;
  const query = useQuery({
    queryKey,
    enabled: Boolean(organizationId),
    staleTime: 20_000,
    retry: 1,
    queryFn: () => loadCrmAftercare(organizationId as string),
  });

  return {
    cases: query.data?.cases ?? [],
    changeOrders: query.data?.changeOrders ?? [],
    portalUsers: query.data?.portalUsers ?? [],
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
