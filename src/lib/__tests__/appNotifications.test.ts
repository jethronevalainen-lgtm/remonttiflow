import { describe, expect, it } from 'vitest';

import { mapAppNotification } from '@/lib/supabase/appNotifications';

describe('app notification mapping', () => {
  it('maps a persistent late check-in notification', () => {
    const result = mapAppNotification({
      id: 'notification-1',
      organization_id: 'org-1',
      recipient_user_id: 'supervisor-1',
      notification_type: 'late_check_in',
      severity: 'danger',
      title: 'Työntekijä ei ole kirjautunut töihin',
      body: 'Työvuoro alkoi klo 07.00.',
      path: '/tyonjohto',
      source_table: 'shifts',
      source_id: 'shift-1',
      metadata: { grace_minutes: 15 },
      read_at: null,
      created_at: '2026-07-27T07:15:00.000Z',
      updated_at: '2026-07-27T07:15:00.000Z',
    });

    expect(result).toMatchObject({
      id: 'notification-1',
      organizationId: 'org-1',
      recipientUserId: 'supervisor-1',
      notificationType: 'late_check_in',
      severity: 'danger',
      path: '/tyonjohto',
      sourceId: 'shift-1',
      readAt: undefined,
      metadata: { grace_minutes: 15 },
    });
  });

  it('falls back safely for malformed optional fields', () => {
    const result = mapAppNotification({ id: 'notification-2', severity: 'unknown' });

    expect(result.severity).toBe('info');
    expect(result.path).toBe('/dashboard');
    expect(result.metadata).toEqual({});
  });
});
