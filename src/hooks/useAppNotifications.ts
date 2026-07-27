import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  listAppNotifications,
  markAllAppNotificationsRead,
  markAppNotificationRead,
  subscribeAppNotifications,
} from '@/lib/supabase/appNotifications';

export function useAppNotifications() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const userId = user?.id;
  const queryKey = useMemo(
    () => ['app-notifications', organizationId ?? 'none', userId ?? 'anonymous'] as const,
    [organizationId, userId],
  );

  const query = useQuery({
    queryKey,
    queryFn: () => listAppNotifications(organizationId as string),
    enabled: Boolean(organizationId && userId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!organizationId || !userId) return undefined;
    return subscribeAppNotifications(organizationId, userId, () => {
      void queryClient.invalidateQueries({ queryKey });
    });
  }, [organizationId, queryClient, queryKey, userId]);

  const notifications = useMemo(() => query.data ?? [], [query.data]);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  return {
    notifications,
    unreadCount,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
    markRead: async (notificationId: string) => {
      await markAppNotificationRead(notificationId);
      await queryClient.invalidateQueries({ queryKey });
    },
    markAllRead: async () => {
      if (!organizationId) return 0;
      const count = await markAllAppNotificationsRead(organizationId);
      await queryClient.invalidateQueries({ queryKey });
      return count;
    },
  };
}
