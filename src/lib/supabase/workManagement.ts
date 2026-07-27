import { supabase } from '@/lib/supabase/client';
import type {
  WorkAssignmentScope,
  WorkOrderPriority,
  WorkOrderStatus,
} from '@/types';
import type { OrganizationRole } from '@/lib/supabase/types';

export type WorkOrderOccupancyStatus = 'unknown' | 'occupied' | 'vacant' | 'partly_occupied';

export interface OrganizationPerson {
  userId: string;
  name: string;
  email: string;
  role: OrganizationRole;
  avatarUrl?: string;
}

export interface ProjectMembership {
  projectId: string;
  userId: string;
}

export interface ManagedWorkOrder {
  id: string;
  projectId?: string;
  project: string;
  location: string;
  title: string;
  dueDate: string;
  plannedStartDate: string;
  plannedEndDate: string;
  plannedStartTime: string;
  plannedEndTime: string;
  plannedWeekdays: number[];
  calendarSyncEnabled: boolean;
  occupancyStatus: WorkOrderOccupancyStatus;
  workReference: string;
  startConstraints: string;
  accessNotes: string;
  residentNotificationRequired: boolean;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  description: string;
  type: string;
  assignmentScope: WorkAssignmentScope;
  assigneeUserIds: string[];
  assigneeNames: string[];
  workerNote: string;
  startedAt?: string;
  completedAt?: string;
}

export interface RoleWorkspaceData {
  people: OrganizationPerson[];
  projectMemberships: ProjectMembership[];
  workOrders: ManagedWorkOrder[];
}

interface Row {
  [key: string]: unknown;
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function timeText(row: Row, key: string): string {
  return text(row, key).slice(0, 5);
}

function optionalText(row: Row, key: string): string | undefined {
  const value = text(row, key);
  return value || undefined;
}

function booleanValue(row: Row, key: string, fallback = false): boolean {
  return typeof row[key] === 'boolean' ? row[key] as boolean : fallback;
}

function numberArray(row: Row, key: string, fallback: number[]): number[] {
  const value = row[key];
  if (!Array.isArray(value)) return fallback;
  const result = value
    .map((item) => typeof item === 'number' ? item : Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7);
  return result.length > 0 ? [...new Set(result)].sort((a, b) => a - b) : fallback;
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

function priority(value: unknown): WorkOrderPriority {
  return value === 'Korkea' || value === 'Matala' ? value : 'Normaali';
}

function status(value: unknown): WorkOrderStatus {
  return ['Avoin', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu'].includes(String(value))
    ? value as WorkOrderStatus
    : 'Avoin';
}

function scope(value: unknown): WorkAssignmentScope {
  return value === 'project_team' ? 'project_team' : 'people';
}

function occupancy(value: unknown): WorkOrderOccupancyStatus {
  return ['occupied', 'vacant', 'partly_occupied'].includes(String(value))
    ? value as WorkOrderOccupancyStatus
    : 'unknown';
}

async function requireData<T>(
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  label: string,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label} epäonnistui: ${error.message}`);
  return data as T;
}

export async function loadRoleWorkspace(
  organizationId: string,
  canManage: boolean,
  currentUserId: string,
): Promise<RoleWorkspaceData> {
  const [workOrderData, membershipData, assigneeData] = await Promise.all([
    requireData(
      supabase
        .from('work_orders')
        .select('*')
        .eq('organization_id', organizationId)
        .order('planned_start_date', { ascending: true, nullsFirst: false })
        .order('due_date', { ascending: true, nullsFirst: false }),
      'Työmääräysten haku',
    ),
    requireData(
      supabase
        .from('project_members')
        .select('project_id, user_id')
        .eq('organization_id', organizationId),
      'Projektitiimien haku',
    ),
    requireData(
      supabase
        .from('work_order_assignees')
        .select('work_order_id, user_id')
        .eq('organization_id', organizationId),
      'Työmääräysvastuiden haku',
    ),
  ]);

  const membershipRows = asRows(membershipData);
  const assigneeRows = asRows(assigneeData);
  const visibleUserIds = new Set<string>([currentUserId]);
  membershipRows.forEach((item) => visibleUserIds.add(text(item, 'user_id')));
  assigneeRows.forEach((item) => visibleUserIds.add(text(item, 'user_id')));

  let directoryRows: Row[] = [];
  if (canManage) {
    directoryRows = asRows(await requireData(
      supabase.rpc('list_operational_directory', {
        p_organization_id: organizationId,
      }),
      'Rajattujen projektihenkilöiden haku',
    ));
    directoryRows.forEach((item) => visibleUserIds.add(text(item, 'user_id')));
  }

  const ids = [...visibleUserIds].filter(Boolean);
  const profileRows = canManage
    ? directoryRows.map((item) => ({
        id: text(item, 'user_id'),
        full_name: text(item, 'display_name'),
        avatar_url: text(item, 'avatar_url'),
        email: '',
      }))
    : ids.length > 0
      ? asRows(await requireData(
          supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', ids),
          'Käyttäjäprofiilien haku',
        ))
      : [];

  const profiles = new Map(profileRows.map((item) => [text(item, 'id'), item]));

  const people = canManage
    ? directoryRows.map((item): OrganizationPerson => ({
        userId: text(item, 'user_id'),
        name: text(item, 'display_name') || 'Nimetön käyttäjä',
        email: '',
        role: role(item.role),
        avatarUrl: optionalText(item, 'avatar_url'),
      })).sort((a, b) => a.name.localeCompare(b.name, 'fi'))
    : [];

  const assigneesByOrder = new Map<string, string[]>();
  assigneeRows.forEach((item) => {
    const orderId = text(item, 'work_order_id');
    const userId = text(item, 'user_id');
    if (!orderId || !userId) return;
    assigneesByOrder.set(orderId, [...(assigneesByOrder.get(orderId) ?? []), userId]);
  });

  const allWorkOrders = asRows(workOrderData).map((item): ManagedWorkOrder => {
    const id = text(item, 'id');
    const assigneeUserIds = assigneesByOrder.get(id) ?? [];
    const projectId = optionalText(item, 'project_id');
    return {
      id,
      projectId,
      project: text(item, 'project') || (projectId ? 'Nimetön projekti' : 'Yksittäinen työ'),
      location: text(item, 'location'),
      title: text(item, 'title'),
      dueDate: text(item, 'due_date'),
      plannedStartDate: text(item, 'planned_start_date'),
      plannedEndDate: text(item, 'planned_end_date'),
      plannedStartTime: timeText(item, 'planned_start_time') || '07:00',
      plannedEndTime: timeText(item, 'planned_end_time') || '15:30',
      plannedWeekdays: numberArray(item, 'planned_weekdays', [1, 2, 3, 4, 5]),
      calendarSyncEnabled: booleanValue(item, 'calendar_sync_enabled', true),
      occupancyStatus: occupancy(item.occupancy_status),
      workReference: text(item, 'work_reference'),
      startConstraints: text(item, 'start_constraints'),
      accessNotes: text(item, 'access_notes'),
      residentNotificationRequired: booleanValue(item, 'resident_notification_required'),
      priority: priority(item.priority),
      status: status(item.status),
      description: text(item, 'description'),
      type: text(item, 'type'),
      assignmentScope: scope(item.assignment_scope),
      assigneeUserIds,
      assigneeNames: assigneeUserIds.map((userId) => {
        const profile = profiles.get(userId) ?? {};
        return text(profile, 'full_name') || text(profile, 'email') || 'Nimetön käyttäjä';
      }),
      workerNote: text(item, 'worker_note'),
      startedAt: optionalText(item, 'started_at'),
      completedAt: optionalText(item, 'completed_at'),
    };
  });

  const projectMemberships = membershipRows.map((item) => ({
    projectId: text(item, 'project_id'),
    userId: text(item, 'user_id'),
  })).filter((item) => item.projectId && item.userId);

  if (canManage) {
    return {
      people,
      projectMemberships,
      workOrders: allWorkOrders,
    };
  }

  const ownProjectIds = new Set(
    projectMemberships
      .filter((membership) => membership.userId === currentUserId)
      .map((membership) => membership.projectId),
  );
  const workOrders = allWorkOrders.filter((order) => (
    order.assignmentScope === 'project_team'
      ? Boolean(order.projectId && ownProjectIds.has(order.projectId))
      : order.assigneeUserIds.includes(currentUserId)
  ));

  return {
    people: [],
    projectMemberships: projectMemberships.filter((membership) => membership.userId === currentUserId),
    workOrders,
  };
}

export async function replaceProjectMembers(values: {
  organizationId: string;
  projectId: string;
  userIds: string[];
}): Promise<void> {
  const { error } = await supabase.rpc('replace_project_members', {
    p_organization_id: values.organizationId,
    p_project_id: values.projectId,
    p_user_ids: values.userIds,
  });
  if (error) throw new Error(`Projektitiimin tallennus epäonnistui: ${error.message}`);
}

export async function saveManagedWorkOrder(values: {
  organizationId: string;
  workOrderId?: string;
  projectId?: string;
  title: string;
  location?: string;
  dueDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  plannedStartTime?: string;
  plannedEndTime?: string;
  plannedWeekdays: number[];
  calendarSyncEnabled: boolean;
  occupancyStatus: WorkOrderOccupancyStatus;
  workReference?: string;
  startConstraints?: string;
  accessNotes?: string;
  residentNotificationRequired: boolean;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  description?: string;
  type?: string;
  assignmentScope: WorkAssignmentScope;
  assigneeUserIds: string[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_work_order_v2', {
    p_organization_id: values.organizationId,
    p_work_order_id: values.workOrderId ?? null,
    p_project_id: values.projectId || null,
    p_title: values.title,
    p_location: values.location || null,
    p_due_date: values.dueDate || null,
    p_planned_start_date: values.plannedStartDate || null,
    p_planned_end_date: values.plannedEndDate || null,
    p_planned_start_time: values.plannedStartDate ? values.plannedStartTime || '07:00' : null,
    p_planned_end_time: values.plannedStartDate ? values.plannedEndTime || '15:30' : null,
    p_planned_weekdays: values.plannedWeekdays,
    p_calendar_sync_enabled: values.calendarSyncEnabled,
    p_occupancy_status: values.occupancyStatus,
    p_work_reference: values.workReference || null,
    p_start_constraints: values.startConstraints || null,
    p_access_notes: values.accessNotes || null,
    p_resident_notification_required: values.residentNotificationRequired,
    p_priority: values.priority,
    p_status: values.status,
    p_description: values.description || null,
    p_type: values.type || null,
    p_assignment_scope: values.assignmentScope,
    p_assignee_user_ids: values.assigneeUserIds,
  });
  if (error) throw new Error(`Työmääräyksen tallennus epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tietokanta ei palauttanut työmääräyksen tunnistetta.');
  return data;
}

export async function moveManagedWorkOrderSchedule(values: {
  organizationId: string;
  workOrderId: string;
  targetStartDate: string;
}): Promise<void> {
  const { error } = await supabase.rpc('move_work_order_schedule', {
    p_organization_id: values.organizationId,
    p_work_order_id: values.workOrderId,
    p_target_start_date: values.targetStartDate,
  });
  if (error) throw new Error(`Työmääräyksen aikataulun siirto epäonnistui: ${error.message}`);
}

export async function transitionMyWorkOrder(values: {
  workOrderId: string;
  status: Extract<WorkOrderStatus, 'Käynnissä' | 'Odottaa' | 'Valmis'>;
  workerNote?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('transition_my_work_order', {
    p_work_order_id: values.workOrderId,
    p_status: values.status,
    p_worker_note: values.workerNote || null,
  });
  if (error) throw new Error(`Työn tilan päivitys epäonnistui: ${error.message}`);
}
