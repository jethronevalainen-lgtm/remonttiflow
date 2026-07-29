import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import {
  listAnnouncementDirectory,
  listManagedAnnouncements,
  listVisibleAnnouncements,
  recordAnnouncementEvent,
  type AnnouncementEvent,
  type AnnouncementPlacement,
} from '@/lib/supabase/announcements';

export function useVisibleAnnouncements(values: {
  placement: AnnouncementPlacement;
  projectId?: string;
  workOrderId?: string;
  enabled?: boolean;
}) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = useMemo(() => [
    'announcements',
    'visible',
    organizationId ?? 'none',
    values.placement,
    values.projectId ?? 'none',
    values.workOrderId ?? 'none',
  ] as const, [organizationId, values.placement, values.projectId, values.workOrderId]);

  const query = useQuery({
    queryKey,
    queryFn: () => listVisibleAnnouncements({
      organizationId: organizationId as string,
      placement: values.placement,
      projectId: values.projectId,
      workOrderId: values.workOrderId,
    }),
    enabled: Boolean((values.enabled ?? true) && organizationId),
    staleTime: 20_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  useEffect(() => {
    const items = query.data ?? [];
    const unseen = items.filter((item) => !item.firstShownAt);
    if (unseen.length === 0) return;
    void Promise.all(unseen.map((item) => recordAnnouncementEvent(item.id, 'shown')))
      .then(() => queryClient.invalidateQueries({ queryKey }))
      .catch(() => undefined);
  }, [query.data, queryClient, queryKey]);

  const record = async (announcementId: string, event: AnnouncementEvent) => {
    await recordAnnouncementEvent(announcementId, event);
    await queryClient.invalidateQueries({ queryKey: ['announcements'] });
    await queryClient.invalidateQueries({ queryKey: ['app-notifications'] });
  };

  return {
    announcements: query.data ?? [],
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
    record,
  };
}

export function useManagedAnnouncements(enabled = true) {
  const { currentOrg } = useOrganization();
  const organizationId = currentOrg?.id;
  const queryKey = ['announcements', 'managed', organizationId ?? 'none'] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => listManagedAnnouncements(organizationId as string),
    enabled: Boolean(enabled && organizationId),
    staleTime: 15_000,
    retry: 1,
  });
  return {
    announcements: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: query.refetch,
  };
}

export function useAnnouncementDirectory(enabled = true) {
  const { currentOrg } = useOrganization();
  const organizationId = currentOrg?.id;
  const query = useQuery({
    queryKey: ['announcements', 'directory', organizationId ?? 'none'],
    queryFn: () => listAnnouncementDirectory(organizationId as string),
    enabled: Boolean(enabled && organizationId),
    staleTime: 60_000,
    retry: 1,
  });
  return {
    people: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
