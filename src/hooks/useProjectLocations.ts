import { useQuery } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import {
  loadProjectLocationCatalog,
  type ProjectLocationCatalog,
} from '@/lib/supabase/projectLocations';

const EMPTY_CATALOG: ProjectLocationCatalog = {
  buildings: [],
  stairwells: [],
  units: [],
};

export function useProjectLocations() {
  const { currentOrg } = useOrganization();
  const organizationId = currentOrg?.id;
  const query = useQuery({
    queryKey: ['project-location-catalog', organizationId ?? 'none'],
    queryFn: () => loadProjectLocationCatalog(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    retry: 1,
  });

  return {
    ...(query.data ?? EMPTY_CATALOG),
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
