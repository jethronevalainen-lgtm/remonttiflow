import { useQuery } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useRoleWorkspace } from '@/hooks/useRoleWorkspace';
import { supabase } from '@/lib/supabase/client';
import type { OrganizationPerson } from '@/lib/supabase/workManagement';
import type { OrganizationRole } from '@/lib/supabase/types';

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(item: Row, key: string) {
  return typeof item[key] === 'string' ? item[key] as string : '';
}

function role(value: unknown): OrganizationRole {
  if (
    value === 'admin'
    || value === 'supervisor'
    || value === 'project_coordinator'
    || value === 'worker'
    || value === 'customer'
  ) return value;
  return 'worker';
}

async function loadWorkerDirectory(
  organizationId: string,
  currentUserId: string,
  relevantUserIds: string[],
): Promise<OrganizationPerson[]> {
  const { data: membershipData, error: membershipError } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', organizationId);
  if (membershipError) throw new Error(`Viestihakemiston lataus epäonnistui: ${membershipError.message}`);

  const relevant = new Set(relevantUserIds);
  relevant.add(currentUserId);
  const visibleMemberships = rows(membershipData).filter((membership) => {
    const membershipRole = role(membership.role);
    return membershipRole === 'admin'
      || membershipRole === 'supervisor'
      || relevant.has(text(membership, 'user_id'));
  });
  const ids = visibleMemberships.map((item) => text(item, 'user_id')).filter(Boolean);
  if (!ids.length) return [];

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .in('id', ids);
  if (profileError) throw new Error(`Viestihakemiston profiilien lataus epäonnistui: ${profileError.message}`);
  const profileMap = new Map(rows(profileData).map((item) => [text(item, 'id'), item]));

  return visibleMemberships
    .map((membership): OrganizationPerson => {
      const userId = text(membership, 'user_id');
      const profile = profileMap.get(userId) ?? {};
      return {
        userId,
        name: text(profile, 'full_name') || text(profile, 'email') || 'Nimetön käyttäjä',
        email: text(profile, 'email'),
        avatarUrl: text(profile, 'avatar_url') || undefined,
        role: role(membership.role),
      };
    })
    .filter((person) => person.userId !== currentUserId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fi'));
}

export function useCommunicationDirectory() {
  const { currentOrg, actualRole } = useOrganization();
  const { effectiveUserId } = useViewAs();
  const {
    people: operationalPeople,
    projectMemberships,
    workOrders,
    canManage,
    loading: workspaceLoading,
    error: workspaceError,
  } = useRoleWorkspace();
  const relevantUserIds = [
    ...projectMemberships.map((item) => item.userId),
    ...workOrders.flatMap((item) => item.assigneeUserIds),
  ];

  const query = useQuery({
    queryKey: [
      'communication-directory',
      currentOrg?.id ?? 'none',
      effectiveUserId ?? 'none',
      actualRole ?? 'none',
      [...new Set(relevantUserIds)].sort().join(','),
    ],
    queryFn: () => loadWorkerDirectory(
      currentOrg?.id as string,
      effectiveUserId as string,
      relevantUserIds,
    ),
    enabled: Boolean(!canManage && currentOrg?.id && effectiveUserId && actualRole),
    staleTime: 30_000,
  });

  if (canManage) {
    return {
      people: operationalPeople
        .filter((person) => person.userId !== effectiveUserId)
        .sort((a, b) => a.name.localeCompare(b.name, 'fi')),
      loading: workspaceLoading,
      error: workspaceError,
    };
  }

  return {
    people: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
