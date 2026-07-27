import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { loadOffersData } from '@/lib/supabase/offers';

export function useOffersData() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = ['offers-data', organizationId ?? 'none'] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => loadOffersData(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 15_000,
    retry: 1,
  });

  return {
    offers: query.data?.offers ?? [],
    versions: query.data?.versions ?? [],
    sections: query.data?.sections ?? [],
    lines: query.data?.lines ?? [],
    catalog: query.data?.catalog ?? [],
    events: query.data?.events ?? [],
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
