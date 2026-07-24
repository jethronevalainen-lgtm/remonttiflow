import { supabase } from '@/lib/supabase/client';
import type {
  WorkAssignmentScope,
  WorkOrderPriority,
  WorkOrderStatus,
} from '@/types';
import type { OrganizationRole } from '@/lib/supabase/types';

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
  projectId: string;
  project: string;
  title: string;
  dueDate: string;
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

function optionalText(row: Row, key: string): string | undefined {
  const value = text(row, key);
  return value || undefined;
}

function role(value: unknown): OrganizationRole {
  return value === 'admin' || value === 'supervisor' ? value : 'worker';
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

  let membershipRoles: Row[] = [];
  if (canManage) {
    const rows = await requireData(
      supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId),
      'Organisaation käyttäjien haku',
    );
    membershipRoles = asRows(rows);
    membershipRoles.forEach((item) => visibleUserIds.add(text(item, 'user_id')));
  }

  const ids = [...visibleUserIds].filter(Boolean);
  const profileRows = ids.length > 0
    ? asRows(await requireData(
      supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', ids),
      'Käyttäjäprofiilien haku',
    ))
    : [];

  const profiles = new Map(profileRows.map((item) => [text(item, 'id'), item]));
  const roleByUser = new Map(membershipRoles.map((item) => [
    text(item, 'user_id'),
    role(item.role),
  ]));

  const people = canManage
    ? membershipRoles.map((membership): OrganizationPerson => {
      const userId = text(membership, 'user_id');
      const profile = profiles.get(userId) ?? {};
      return {
        userId,
        name: text(profile, 'full_name') || text(profile, 'email') || 'Nimetön käyttäjä',
        email: text(profile, 'email'),
        role: roleByUser.get(userId) ?? 'worker',
        avatarUrl: optionalText(profile, 'avatar_url'),
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'fi'))
    : [];

  const assigneesByOrder = new Map<string, string[]>();
  assigneeRows.forEach((item) => {
    const orderId = text(item, 'work_order_id');
    const userId = text(item, 'user_id');
    if (!orderId || !userId) return;
    assigneesByOrder.set(orderId, [...(assigneesByOrder.get(orderId) ?? []), userId]);
  });

  const workOrders = asRows(workOrderData).map((item): ManagedWorkOrder => {
    const id = text(item, 'id');
    const assigneeUserIds = assigneesByOrder.get(id) ?? [];
    return {
      id,
      projectId: text(item, 'project_id'),
      project: text(item, 'project'),
      title: text(item, 'title'),
      dueDate: text(item, 'due_date'),
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

  return {
    people,
    projectMemberships: membershipRows.map((item) => ({
      projectId: text(item, 'project_id'),
      userId: text(item, 'user_id'),
    })).filter((item) => item.projectId && item.userId),
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
  projectId: string;
  title: string;
  dueDate?: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  description?: string;
  type?: string;
  assignmentScope: WorkAssignmentScope;
  assigneeUserIds: string[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_work_order', {
    p_organization_id: values.organizationId,
    p_work_order_id: values.workOrderId ?? null,
    p_project_id: values.projectId,
    p_title: values.title,
    p_due_date: values.dueDate || null,
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
