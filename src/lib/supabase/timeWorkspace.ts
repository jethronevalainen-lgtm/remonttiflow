import { supabase } from '@/lib/supabase/client';
import type { UserRole } from '@/auth/permissions';

export type TimeEntryStatus = 'Odottaa' | 'Hyväksytty' | 'Hylätty';
export type CorrectionStatus = 'Avoin' | 'Hyväksytty' | 'Hylätty';

export interface TimeWorkspaceCapabilities {
  readAll: boolean;
  readProjects: boolean;
  approve: boolean;
  requestCorrection: boolean;
  resolveCorrections: boolean;
  createForOthers: boolean;
  manageRules: boolean;
  lockPeriods: boolean;
  exportPayroll: boolean;
}

export interface TimeWorkspaceEntry {
  id: string;
  userId: string;
  employeeId: string;
  employeeName: string;
  date: string;
  projectId: string;
  projectName: string;
  workOrderId: string;
  workOrderTitle: string;
  hours: number;
  overtime: number;
  breakMinutes: number;
  breakSource: string;
  startTime: string;
  endTime: string;
  description: string;
  status: TimeEntryStatus;
  source: string;
  rejectionReason: string;
  lockedAt: string;
  payrollPeriodId: string;
  approvedAt: string;
  createdAt: string;
}

export interface TimeWorkspaceSession {
  id: string;
  userId: string;
  employeeId: string;
  employeeName: string;
  workOrderId: string;
  workOrderTitle: string;
  projectId: string;
  projectName: string;
  startedAt: string;
  note: string;
  checkInId: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  distanceFromSiteM: number | null;
  withinGeofence: boolean | null;
}

export interface TimeWorkspaceWorkOrder {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  location: string;
  status: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
  plannedStartTime: string;
  plannedEndTime: string;
  assignedToCurrentUser: boolean;
}

export interface TimeWorkspacePerson {
  userId: string;
  employeeId: string;
  name: string;
  role: string;
  department: string;
  status: string;
}

export interface TimeWorkspaceProject {
  id: string;
  name: string;
  location: string;
  status: string;
  projectNumber: string;
}

export interface TimeCorrectionRequest {
  id: string;
  timeEntryId: string;
  targetUserId: string;
  targetName: string;
  requestedBy: string;
  reason: string;
  status: CorrectionStatus;
  resolutionNote: string;
  createdAt: string;
  resolvedAt: string;
  entryDate: string;
  projectName: string;
}

export interface TimePayrollPeriod {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  lockedAt: string;
  exportedAt: string;
}

export interface TimeWorkspaceAnomaly {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  userId: string;
  timeEntryId: string;
  sessionId: string;
  createdAt: string;
}

export interface TimeWorkspaceDashboard {
  role: UserRole;
  capabilities: TimeWorkspaceCapabilities;
  entries: TimeWorkspaceEntry[];
  activeSessions: TimeWorkspaceSession[];
  workOrders: TimeWorkspaceWorkOrder[];
  people: TimeWorkspacePerson[];
  projects: TimeWorkspaceProject[];
  correctionRequests: TimeCorrectionRequest[];
  payrollPeriods: TimePayrollPeriod[];
  timeRules: Record<string, unknown>;
  anomalies: TimeWorkspaceAnomaly[];
}

export interface BrowserLocationSample {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

type JsonRecord = Record<string, unknown>;

const EMPTY_CAPABILITIES: TimeWorkspaceCapabilities = {
  readAll: false,
  readProjects: false,
  approve: false,
  requestCorrection: false,
  resolveCorrections: false,
  createForOthers: false,
  manageRules: false,
  lockPeriods: false,
  exportPayroll: false,
};

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(row: JsonRecord, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function numeric(row: JsonRecord, key: string): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function nullableNumeric(row: JsonRecord, key: string): number | null {
  if (row[key] === null || row[key] === undefined || row[key] === '') return null;
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : null;
}

function boolean(row: JsonRecord, key: string): boolean {
  return row[key] === true;
}

function nullableBoolean(row: JsonRecord, key: string): boolean | null {
  return typeof row[key] === 'boolean' ? row[key] as boolean : null;
}

function parseDashboard(value: unknown): TimeWorkspaceDashboard {
  const root = record(value);
  const capabilities = record(root.capabilities);
  const rawRole = text(root, 'role');
  const role: UserRole = ['admin', 'supervisor', 'project_coordinator', 'worker', 'customer'].includes(rawRole)
    ? rawRole as UserRole
    : 'worker';

  return {
    role,
    capabilities: {
      ...EMPTY_CAPABILITIES,
      readAll: boolean(capabilities, 'readAll'),
      readProjects: boolean(capabilities, 'readProjects'),
      approve: boolean(capabilities, 'approve'),
      requestCorrection: boolean(capabilities, 'requestCorrection'),
      resolveCorrections: boolean(capabilities, 'resolveCorrections'),
      createForOthers: boolean(capabilities, 'createForOthers'),
      manageRules: boolean(capabilities, 'manageRules'),
      lockPeriods: boolean(capabilities, 'lockPeriods'),
      exportPayroll: boolean(capabilities, 'exportPayroll'),
    },
    entries: list(root.entries).map((row) => ({
      id: text(row, 'id'),
      userId: text(row, 'userId'),
      employeeId: text(row, 'employeeId'),
      employeeName: text(row, 'employeeName'),
      date: text(row, 'date'),
      projectId: text(row, 'projectId'),
      projectName: text(row, 'projectName'),
      workOrderId: text(row, 'workOrderId'),
      workOrderTitle: text(row, 'workOrderTitle'),
      hours: numeric(row, 'hours'),
      overtime: numeric(row, 'overtime'),
      breakMinutes: numeric(row, 'breakMinutes'),
      breakSource: text(row, 'breakSource'),
      startTime: text(row, 'startTime'),
      endTime: text(row, 'endTime'),
      description: text(row, 'description'),
      status: (text(row, 'status') || 'Odottaa') as TimeEntryStatus,
      source: text(row, 'source'),
      rejectionReason: text(row, 'rejectionReason'),
      lockedAt: text(row, 'lockedAt'),
      payrollPeriodId: text(row, 'payrollPeriodId'),
      approvedAt: text(row, 'approvedAt'),
      createdAt: text(row, 'createdAt'),
    })).filter((item) => item.id),
    activeSessions: list(root.activeSessions).map((row) => ({
      id: text(row, 'id'),
      userId: text(row, 'userId'),
      employeeId: text(row, 'employeeId'),
      employeeName: text(row, 'employeeName'),
      workOrderId: text(row, 'workOrderId'),
      workOrderTitle: text(row, 'workOrderTitle'),
      projectId: text(row, 'projectId'),
      projectName: text(row, 'projectName'),
      startedAt: text(row, 'startedAt'),
      note: text(row, 'note'),
      checkInId: text(row, 'checkInId'),
      latitude: nullableNumeric(row, 'latitude'),
      longitude: nullableNumeric(row, 'longitude'),
      accuracyM: nullableNumeric(row, 'accuracyM'),
      distanceFromSiteM: nullableNumeric(row, 'distanceFromSiteM'),
      withinGeofence: nullableBoolean(row, 'withinGeofence'),
    })).filter((item) => item.id),
    workOrders: list(root.workOrders).map((row) => ({
      id: text(row, 'id'),
      title: text(row, 'title'),
      projectId: text(row, 'projectId'),
      projectName: text(row, 'projectName'),
      location: text(row, 'location'),
      status: text(row, 'status'),
      priority: text(row, 'priority'),
      plannedStartDate: text(row, 'plannedStartDate'),
      plannedEndDate: text(row, 'plannedEndDate'),
      plannedStartTime: text(row, 'plannedStartTime'),
      plannedEndTime: text(row, 'plannedEndTime'),
      assignedToCurrentUser: boolean(row, 'assignedToCurrentUser'),
    })).filter((item) => item.id),
    people: list(root.people).map((row) => ({
      userId: text(row, 'userId'),
      employeeId: text(row, 'employeeId'),
      name: text(row, 'name'),
      role: text(row, 'role'),
      department: text(row, 'department'),
      status: text(row, 'status'),
    })).filter((item) => item.userId),
    projects: list(root.projects).map((row) => ({
      id: text(row, 'id'),
      name: text(row, 'name'),
      location: text(row, 'location'),
      status: text(row, 'status'),
      projectNumber: text(row, 'projectNumber'),
    })).filter((item) => item.id),
    correctionRequests: list(root.correctionRequests).map((row) => ({
      id: text(row, 'id'),
      timeEntryId: text(row, 'timeEntryId'),
      targetUserId: text(row, 'targetUserId'),
      targetName: text(row, 'targetName'),
      requestedBy: text(row, 'requestedBy'),
      reason: text(row, 'reason'),
      status: (text(row, 'status') || 'Avoin') as CorrectionStatus,
      resolutionNote: text(row, 'resolutionNote'),
      createdAt: text(row, 'createdAt'),
      resolvedAt: text(row, 'resolvedAt'),
      entryDate: text(row, 'entryDate'),
      projectName: text(row, 'projectName'),
    })).filter((item) => item.id),
    payrollPeriods: list(root.payrollPeriods).map((row) => ({
      id: text(row, 'id'),
      periodStart: text(row, 'periodStart'),
      periodEnd: text(row, 'periodEnd'),
      status: text(row, 'status'),
      lockedAt: text(row, 'lockedAt'),
      exportedAt: text(row, 'exportedAt'),
    })).filter((item) => item.id),
    timeRules: record(root.timeRules),
    anomalies: list(root.anomalies).map((row) => ({
      id: text(row, 'id'),
      kind: text(row, 'kind'),
      severity: (text(row, 'severity') || 'info') as TimeWorkspaceAnomaly['severity'],
      title: text(row, 'title'),
      description: text(row, 'description'),
      userId: text(row, 'userId'),
      timeEntryId: text(row, 'timeEntryId'),
      sessionId: text(row, 'sessionId'),
      createdAt: text(row, 'createdAt'),
    })).filter((item) => item.id),
  };
}

export async function loadTimeWorkspace(
  organizationId: string,
  from: string,
  to: string,
): Promise<TimeWorkspaceDashboard> {
  const { data, error } = await supabase.rpc('time_workspace_dashboard_v2', {
    p_organization_id: organizationId,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(`Työaikatietojen haku epäonnistui: ${error.message}`);
  return parseDashboard(data);
}

export async function startTimeWorkspaceSession(input: {
  organizationId: string;
  workOrderId: string;
  note?: string;
  location?: BrowserLocationSample | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('start_time_workspace_session_v2', {
    p_organization_id: input.organizationId,
    p_work_order_id: input.workOrderId,
    p_note: input.note || null,
    p_latitude: input.location?.latitude ?? null,
    p_longitude: input.location?.longitude ?? null,
    p_accuracy_m: input.location?.accuracyM ?? null,
  });
  if (error) throw new Error(`Työn aloittaminen epäonnistui: ${error.message}`);
  return typeof data === 'string' ? data : '';
}

export async function stopTimeWorkspaceSession(organizationId: string, note?: string): Promise<string> {
  const { data, error } = await supabase.rpc('stop_time_workspace_session_v2', {
    p_organization_id: organizationId,
    p_note: note || null,
  });
  if (error) throw new Error(`Työpäivän päättäminen epäonnistui: ${error.message}`);
  return typeof data === 'string' ? data : '';
}

export async function createManualTimeEntry(input: {
  organizationId: string;
  targetUserId?: string;
  projectId?: string;
  workOrderId?: string;
  date: string;
  startTime: string;
  endTime: string;
  breakSource: 'automatic' | 'manual' | 'none';
  breakMinutes?: number;
  breakStartTime?: string;
  breakEndTime?: string;
  description?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_manual_time_entry_v2', {
    p_organization_id: input.organizationId,
    p_target_user_id: input.targetUserId || null,
    p_project_id: input.projectId || null,
    p_work_order_id: input.workOrderId || null,
    p_date: input.date,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_break_source: input.breakSource,
    p_break_minutes: input.breakMinutes ?? 0,
    p_break_start_time: input.breakStartTime || null,
    p_break_end_time: input.breakEndTime || null,
    p_description: input.description || null,
  });
  if (error) throw new Error(`Työajan tallennus epäonnistui: ${error.message}`);
  return typeof data === 'string' ? data : '';
}

export async function reviewTimeDay(input: {
  organizationId: string;
  targetUserId: string;
  date: string;
  decision: 'approve' | 'request_correction';
  reason?: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc('review_time_day_v2', {
    p_organization_id: input.organizationId,
    p_target_user_id: input.targetUserId,
    p_date: input.date,
    p_decision: input.decision,
    p_reason: input.reason || null,
  });
  if (error) throw new Error(`Työpäivän käsittely epäonnistui: ${error.message}`);
  return Number(data) || 0;
}

export async function requestTimeEntryCorrection(
  organizationId: string,
  timeEntryId: string,
  reason: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('request_time_entry_correction_v2', {
    p_organization_id: organizationId,
    p_time_entry_id: timeEntryId,
    p_reason: reason,
  });
  if (error) throw new Error(`Korjauspyynnön lähetys epäonnistui: ${error.message}`);
  return typeof data === 'string' ? data : '';
}

export async function resolveTimeEntryCorrection(input: {
  organizationId: string;
  requestId: string;
  decision: 'accept' | 'reject';
  resolutionNote?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('resolve_time_entry_correction_v2', {
    p_organization_id: input.organizationId,
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_resolution_note: input.resolutionNote || null,
  });
  if (error) throw new Error(`Korjauspyynnön käsittely epäonnistui: ${error.message}`);
}

export function captureBrowserLocation(): Promise<BrowserLocationSample | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyM: Math.max(0, position.coords.accuracy),
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}

export function subscribeTimeWorkspace(
  organizationId: string,
  onChange: () => void,
): () => void {
  let debounce: number | undefined;
  const notify = () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(onChange, 250);
  };
  const channel = supabase
    .channel(`time-workspace:${organizationId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries', filter: `organization_id=eq.${organizationId}` }, notify)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'work_order_time_sessions', filter: `organization_id=eq.${organizationId}` }, notify)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'work_site_check_ins', filter: `organization_id=eq.${organizationId}` }, notify)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entry_correction_requests', filter: `organization_id=eq.${organizationId}` }, notify)
    .subscribe();

  return () => {
    window.clearTimeout(debounce);
    void supabase.removeChannel(channel);
  };
}
