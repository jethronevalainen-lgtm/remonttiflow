import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { loadResourceManagement } from '@/lib/supabase/resourceManagement';

export function useResourceManagement() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = ['resource-management', organizationId ?? 'none'] as const;
  const query = useQuery({
    queryKey,
    enabled: Boolean(organizationId),
    staleTime: 20_000,
    retry: 1,
    queryFn: () => loadResourceManagement(organizationId as string),
  });

  return {
    certifications: query.data?.certifications ?? [],
    absences: query.data?.absences ?? [],
    reservations: query.data?.reservations ?? [],
    maintenance: query.data?.maintenance ?? [],
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
