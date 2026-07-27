import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { loadCustomerRelations } from '@/lib/supabase/customerRelations';

export function useCustomerRelations() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = ['customer-relations', organizationId ?? 'none'] as const;
  const query = useQuery({
    queryKey,
    enabled: Boolean(organizationId),
    staleTime: 20_000,
    retry: 1,
    queryFn: () => loadCustomerRelations(organizationId as string),
  });

  return {
    contacts: query.data?.contacts ?? [],
    sites: query.data?.sites ?? [],
    activities: query.data?.activities ?? [],
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
