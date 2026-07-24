import { useQuery } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import {
  fetchOrganizationMembers,
  type OrganizationMemberView,
} from '@/lib/supabase/organizationAdmin';

interface OrganizationAdminData {
  members: OrganizationMemberView[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useOrganizationAdmin(): OrganizationAdminData {
  const { currentOrg, currentRole } = useOrganization();
  const organizationId = currentOrg?.id ?? null;
  const enabled = Boolean(organizationId && currentRole === 'admin');

  const query = useQuery({
    queryKey: ['organization-admin', organizationId],
    queryFn: () => fetchOrganizationMembers(organizationId!),
    enabled,
    staleTime: 30_000,
  });

  return {
    members: query.data ?? [],
    loading: enabled && query.isLoading,
    error:
      query.error instanceof Error
        ? query.error.message
        : query.error
          ? 'Jäsenten lataaminen epäonnistui.'
          : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
