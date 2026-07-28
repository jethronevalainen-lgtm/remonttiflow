import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';

export type AppNotificationSeverity = 'info' | 'warning' | 'danger';

export type AppNotificationType =
  | 'shift_start_reminder'
  | 'missing_check_in_reminder'
  | 'late_check_in'
  | 'work_order_due_soon'
  | 'work_order_overdue'
  | 'work_order_completion_requested'
  | 'work_order_completion_approved'
  | 'work_order_completion_rejected'
  | 'project_message_new'
  | string;

export interface AppNotification {
  id: string;
  organizationId: string;
  recipientUserId: string;
  notificationType: AppNotificationType;
  severity: AppNotificationSeverity;
  title: string;
  body: string;
  path: string;
  sourceTable?: string;
  sourceId?: string;
  metadata: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettings {
  notificationCenterEnabled: boolean;
  lateCheckInAlertsEnabled: boolean;
  lateCheckInGraceMinutes: number;
  shiftStartRemindersEnabled: boolean;
  shiftStartReminderMinutes: number;
  workOrderDueRemindersEnabled: boolean;
  workOrderDueReminderDays: number;
  workOrderOverdueRemindersEnabled: boolean;
  timezone: string;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  notificationCenterEnabled: true,
  lateCheckInAlertsEnabled: true,
  lateCheckInGraceMinutes: 15,
  shiftStartRemindersEnabled: true,
  shiftStartReminderMinutes: 30,
  workOrderDueRemindersEnabled: true,
  workOrderDueReminderDays: 7,
  workOrderOverdueRemindersEnabled: true,
  timezone: 'Europe/Helsinki',
};

type Row = Record<string, unknown>;

function object(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function optionalText(row: Row, key: string): string | undefined {
  return text(row, key) || undefined;
}

function bool(row: Row, key: string, fallback: boolean): boolean {
  return typeof row[key] === 'boolean' ? row[key] as boolean : fallback;
}

function numberValue(row: Row, key: string, fallback: number): number {
  const parsed = Number(row[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function severity(value: unknown): AppNotificationSeverity {
  return value === 'danger' || value === 'warning' ? value : 'info';
}

export function mapAppNotification(value: unknown): AppNotification {
  const row = object(value);
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    recipientUserId: text(row, 'recipient_user_id'),
    notificationType: text(row, 'notification_type'),
    severity: severity(row.severity),
    title: text(row, 'title'),
    body: text(row, 'body'),
    path: text(row, 'path') || '/dashboard',
    sourceTable: optionalText(row, 'source_table'),
    sourceId: optionalText(row, 'source_id'),
    metadata: object(row.metadata),
    readAt: optionalText(row, 'read_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export async function listAppNotifications(
  organizationId: string,
  limit = 50,
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('app_notifications')
    .select('*')
    .eq('organization_id', organizationId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Ilmoitusten haku epäonnistui: ${error.message}`);
  return rows(data).map(mapAppNotification).filter((item) => item.id);
}

export async function loadNotificationSettings(
  organizationId: string,
): Promise<NotificationSettings> {
  const { data, error } = await supabase.rpc('get_notification_settings', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Ilmoitusasetusten haku epäonnistui: ${error.message}`);

  const row = rows(data)[0] ?? object(data);
  return {
    notificationCenterEnabled: bool(row, 'notification_center_enabled', DEFAULT_SETTINGS.notificationCenterEnabled),
    lateCheckInAlertsEnabled: bool(row, 'late_check_in_alerts_enabled', DEFAULT_SETTINGS.lateCheckInAlertsEnabled),
    lateCheckInGraceMinutes: numberValue(row, 'late_check_in_grace_minutes', DEFAULT_SETTINGS.lateCheckInGraceMinutes),
    shiftStartRemindersEnabled: bool(row, 'shift_start_reminders_enabled', DEFAULT_SETTINGS.shiftStartRemindersEnabled),
    shiftStartReminderMinutes: numberValue(row, 'shift_start_reminder_minutes', DEFAULT_SETTINGS.shiftStartReminderMinutes),
    workOrderDueRemindersEnabled: bool(row, 'work_order_due_reminders_enabled', DEFAULT_SETTINGS.workOrderDueRemindersEnabled),
    workOrderDueReminderDays: numberValue(row, 'work_order_due_reminder_days', DEFAULT_SETTINGS.workOrderDueReminderDays),
    workOrderOverdueRemindersEnabled: bool(row, 'work_order_overdue_reminders_enabled', DEFAULT_SETTINGS.workOrderOverdueRemindersEnabled),
    timezone: text(row, 'timezone') || DEFAULT_SETTINGS.timezone,
  };
}

export async function saveNotificationSettings(
  organizationId: string,
  settings: NotificationSettings,
): Promise<void> {
  const { error } = await supabase.rpc('update_notification_settings', {
    p_organization_id: organizationId,
    p_notification_center_enabled: settings.notificationCenterEnabled,
    p_late_check_in_alerts_enabled: settings.lateCheckInAlertsEnabled,
    p_late_check_in_grace_minutes: settings.lateCheckInGraceMinutes,
    p_shift_start_reminders_enabled: settings.shiftStartRemindersEnabled,
    p_shift_start_reminder_minutes: settings.shiftStartReminderMinutes,
    p_work_order_due_reminders_enabled: settings.workOrderDueRemindersEnabled,
    p_work_order_due_reminder_days: settings.workOrderDueReminderDays,
    p_work_order_overdue_reminders_enabled: settings.workOrderOverdueRemindersEnabled,
  });
  if (error) throw new Error(`Ilmoitusasetusten tallennus epäonnistui: ${error.message}`);
}

export async function markAppNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_app_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) throw new Error(`Ilmoituksen lukeminen epäonnistui: ${error.message}`);
}

export async function markAllAppNotificationsRead(organizationId: string): Promise<number> {
  const { data, error } = await supabase.rpc('mark_all_app_notifications_read', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Ilmoitusten merkitseminen luetuksi epäonnistui: ${error.message}`);
  const count = Number(data);
  return Number.isFinite(count) ? count : 0;
}

export function subscribeAppNotifications(
  organizationId: string,
  recipientUserId: string,
  onChange: () => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`app-notifications-${organizationId}-${recipientUserId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_notifications',
        filter: `recipient_user_id=eq.${recipientUserId}`,
      },
      onChange,
    );

  void channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}
