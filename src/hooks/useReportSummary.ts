import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import {
  listSavedReports,
  loadOrganizationReportSummary,
} from '@/lib/supabase/reporting';

export function useReportSummary(input: {
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = [
    'report-summary',
    organizationId ?? 'none',
    input.projectId ?? 'all',
    input.dateFrom ?? '',
    input.dateTo ?? '',
  ] as const;

  const query = useQuery({
    queryKey,
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const [summary, savedReports] = await Promise.all([
        loadOrganizationReportSummary({
          organizationId: organizationId as string,
          projectId: input.projectId,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        }),
        listSavedReports(organizationId as string),
      ]);
      return { summary, savedReports };
    },
  });

  return {
    summary: query.data?.summary,
    savedReports: query.data?.savedReports ?? [],
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
