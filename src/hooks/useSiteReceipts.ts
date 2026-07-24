import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { loadSiteReceipts } from '@/lib/supabase/siteReceiptEntities';

export function useSiteReceipts() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = ['site-receipts', organizationId ?? 'none'] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => loadSiteReceipts(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 20_000,
    retry: 1,
  });

  return {
    receipts: query.data ?? [],
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
