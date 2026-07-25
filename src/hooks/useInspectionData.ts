import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import {
  loadInspectionDetail,
  loadInspectionWorkspace,
  type InspectionWorkspace,
} from '@/lib/supabase/inspectionEntities';

const EMPTY_WORKSPACE: InspectionWorkspace = {
  templates: [],
  buildings: [],
  stairwells: [],
  units: [],
  inspections: [],
  findings: [],
  people: [],
  reports: [],
};

export function useInspectionWorkspace() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = ['inspection-workspace', organizationId ?? 'none'] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => loadInspectionWorkspace(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 15_000,
    retry: 1,
  });

  return {
    ...(query.data ?? EMPTY_WORKSPACE),
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}

export function useInspectionDetail(inspectionId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['inspection-detail', inspectionId ?? 'none'] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => loadInspectionDetail(inspectionId as string),
    enabled: Boolean(inspectionId),
    staleTime: 5_000,
    retry: 1,
  });

  return {
    detail: query.data ?? null,
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
