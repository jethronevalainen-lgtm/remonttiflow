import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';

export type LiveOperationExceptionCode =
  | 'missing_description'
  | 'open_over_12h'
  | 'previous_day'
  | 'weak_accuracy'
  | 'outside_geofence'
  | 'no_active_work_order'
  | 'not_project_member';

export type WorkDescriptionQualityCode =
  | 'missing_description'
  | 'too_short'
  | 'duplicate_description'
  | 'no_work_order'
  | 'completed_text_open_order';

export interface ManagementLiveMetrics {
  activePeople: number;
  activeSites: number;
  todayHours: number;
  pendingHours: number;
  activeExceptions: number;
  descriptionExceptions: number;
}

export interface ActiveSiteCheckIn {
  id: string;
  userId: string;
  projectId: string | null;
  projectName: string;
  projectLocation: string | null;
  employeeName: string;
  avatarUrl: string | null;
  description: string | null;
  checkedInAt: string;
  durationMinutes: number;
  accuracyM: number;
  distanceFromSiteM: number | null;
  geofenceRadiusM: number | null;
  withinGeofence: boolean | null;
  workOrderId: string | null;
  workOrderTitle: string | null;
  exceptionCodes: LiveOperationExceptionCode[];
}

export interface ActiveSiteCount {
  key: string;
  projectId: string | null;
  projectName: string;
  peopleCount: number;
  firstCheckedInAt: string;
  exceptionCount: number;
}

export interface RecentWorkDescription {
  id: string;
  userId: string | null;
  employeeId: string | null;
  projectId: string | null;
  workOrderId: string | null;
  employeeName: string;
  projectName: string;
  date: string;
  hours: number;
  overtime: number;
  description: string | null;
  status: string;
  createdAt: string;
  workOrderTitle: string | null;
  qualityCodes: WorkDescriptionQualityCode[];
}

export interface ManagementLiveOperationsSnapshot {
  generatedAt: string;
  metrics: ManagementLiveMetrics;
  activeCheckIns: ActiveSiteCheckIn[];
  siteCounts: ActiveSiteCount[];
  recentDescriptions: RecentWorkDescription[];
}

const EMPTY_SNAPSHOT: ManagementLiveOperationsSnapshot = {
  generatedAt: new Date(0).toISOString(),
  metrics: {
    activePeople: 0,
    activeSites: 0,
    todayHours: 0,
    pendingHours: 0,
    activeExceptions: 0,
    descriptionExceptions: 0,
  },
  activeCheckIns: [],
  siteCounts: [],
  recentDescriptions: [],
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function stringList<T extends string>(value: unknown): T[] {
  return asArray(value).filter((item): item is T => typeof item === 'string');
}

function mapSnapshot(value: unknown): ManagementLiveOperationsSnapshot {
  const root = asObject(value);
  const metrics = asObject(root.metrics);
  return {
    generatedAt: asString(root.generatedAt) || new Date().toISOString(),
    metrics: {
      activePeople: asNumber(metrics.activePeople),
      activeSites: asNumber(metrics.activeSites),
      todayHours: asNumber(metrics.todayHours),
      pendingHours: asNumber(metrics.pendingHours),
      activeExceptions: asNumber(metrics.activeExceptions),
      descriptionExceptions: asNumber(metrics.descriptionExceptions),
    },
    activeCheckIns: asArray(root.activeCheckIns).map((item): ActiveSiteCheckIn => {
      const row = asObject(item);
      return {
        id: asString(row.id),
        userId: asString(row.userId),
        projectId: asNullableString(row.projectId),
        projectName: asString(row.projectName),
        projectLocation: asNullableString(row.projectLocation),
        employeeName: asString(row.employeeName),
        avatarUrl: asNullableString(row.avatarUrl),
        description: asNullableString(row.description),
        checkedInAt: asString(row.checkedInAt),
        durationMinutes: asNumber(row.durationMinutes),
        accuracyM: asNumber(row.accuracyM),
        distanceFromSiteM: asNullableNumber(row.distanceFromSiteM),
        geofenceRadiusM: asNullableNumber(row.geofenceRadiusM),
        withinGeofence: asNullableBoolean(row.withinGeofence),
        workOrderId: asNullableString(row.workOrderId),
        workOrderTitle: asNullableString(row.workOrderTitle),
        exceptionCodes: stringList<LiveOperationExceptionCode>(row.exceptionCodes),
      };
    }).filter((item) => item.id),
    siteCounts: asArray(root.siteCounts).map((item): ActiveSiteCount => {
      const row = asObject(item);
      return {
        key: asString(row.key),
        projectId: asNullableString(row.projectId),
        projectName: asString(row.projectName),
        peopleCount: asNumber(row.peopleCount),
        firstCheckedInAt: asString(row.firstCheckedInAt),
        exceptionCount: asNumber(row.exceptionCount),
      };
    }).filter((item) => item.key),
    recentDescriptions: asArray(root.recentDescriptions).map((item): RecentWorkDescription => {
      const row = asObject(item);
      return {
        id: asString(row.id),
        userId: asNullableString(row.userId),
        employeeId: asNullableString(row.employeeId),
        projectId: asNullableString(row.projectId),
        workOrderId: asNullableString(row.workOrderId),
        employeeName: asString(row.employeeName),
        projectName: asString(row.projectName),
        date: asString(row.date),
        hours: asNumber(row.hours),
        overtime: asNumber(row.overtime),
        description: asNullableString(row.description),
        status: asString(row.status),
        createdAt: asString(row.createdAt),
        workOrderTitle: asNullableString(row.workOrderTitle),
        qualityCodes: stringList<WorkDescriptionQualityCode>(row.qualityCodes),
      };
    }).filter((item) => item.id),
  };
}

export async function loadManagementLiveOperations(
  organizationId: string,
): Promise<ManagementLiveOperationsSnapshot> {
  if (!organizationId) return EMPTY_SNAPSHOT;
  const { data, error } = await supabase.rpc('management_live_operations', {
    p_organization_id: organizationId,
  });
  if (error) {
    throw new Error(`Työmaiden reaaliaikaisen tilannekuvan lataus epäonnistui: ${error.message}`);
  }
  return mapSnapshot(data);
}

export function subscribeManagementLiveOperations(
  organizationId: string,
  onChange: () => void,
): () => void {
  const channels: RealtimeChannel[] = [
    supabase.channel(`management-live-check-ins-${organizationId}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'work_site_check_ins', filter: `organization_id=eq.${organizationId}` },
      onChange,
    ),
    supabase.channel(`management-live-time-entries-${organizationId}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'time_entries', filter: `organization_id=eq.${organizationId}` },
      onChange,
    ),
  ];

  channels.forEach((channel) => { void channel.subscribe(); });
  return () => {
    channels.forEach((channel) => { void supabase.removeChannel(channel); });
  };
}
