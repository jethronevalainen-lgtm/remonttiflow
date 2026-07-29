import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { supabase } from '@/lib/supabase/client';

export type PhaseStatus = 'Suunniteltu' | 'Käynnissä' | 'Valmis' | 'Myöhässä';
export type ShiftSourceType = 'manual' | 'work_order';

export interface ProjectPhase {
  id: string;
  projectId?: string;
  projectName: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PhaseStatus;
  /** Stored DB value; UI should prefer derivePhaseProgress(). */
  progress: number;
  notes: string;
  workPlanId?: string;
  workOrderCount: number;
  completedWorkOrderCount: number;
  activeWorkOrderCount: number;
  scheduledWorkOrderCount: number;
  unassignedWorkOrderCount: number;
  blockedWorkOrderCount: number;
}

export interface Shift {
  id: string;
  userId?: string;
  employeeId?: string;
  employeeName: string;
  projectId?: string;
  project: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  notes: string;
  workOrderId?: string;
  sourceType: ShiftSourceType;
}

type Row = Record<string, unknown>;

function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tietueen.');
  }
  return value as Row;
}

function text(item: Row, key: string): string {
  return typeof item[key] === 'string' ? item[key] as string : '';
}

function optionalText(item: Row, key: string): string | undefined {
  const value = text(item, key);
  return value || undefined;
}

function numberValue(item: Row, key: string): number {
  const value = item[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function sourceType(value: unknown): ShiftSourceType {
  return value === 'work_order' ? 'work_order' : 'manual';
}

interface WorkOrderPhaseStats {
  total: number;
  completed: number;
  active: number;
  scheduled: number;
  unassigned: number;
  blocked: number;
}

interface PhaseWorkOrder {
  id: string;
  projectPhaseId: string;
  projectId?: string;
  status: string;
  assignmentScope: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  predecessorWorkOrderId?: string;
}

const EMPTY_PHASE_STATS: WorkOrderPhaseStats = {
  total: 0,
  completed: 0,
  active: 0,
  scheduled: 0,
  unassigned: 0,
  blocked: 0,
};

async function loadWorkOrderPhaseStats(
  organizationId: string,
): Promise<Map<string, WorkOrderPhaseStats>> {
  const [ordersResponse, assigneesResponse, membersResponse] = await Promise.all([
    supabase
      .from('work_orders')
      .select('id, project_phase_id, project_id, status, assignment_scope, planned_start_date, planned_end_date, predecessor_work_order_id')
      .eq('organization_id', organizationId)
      .not('project_phase_id', 'is', null),
    supabase
      .from('work_order_assignees')
      .select('work_order_id')
      .eq('organization_id', organizationId),
    supabase
      .from('project_members')
      .select('project_id')
      .eq('organization_id', organizationId),
  ]);

  if (ordersResponse.error) {
    throw new Error(`Työmääräysten vaihetilastojen haku epäonnistui: ${ordersResponse.error.message}`);
  }
  if (assigneesResponse.error) {
    throw new Error(`Työmääräysten tekijätietojen haku epäonnistui: ${assigneesResponse.error.message}`);
  }
  if (membersResponse.error) {
    throw new Error(`Projektitiimien haku epäonnistui: ${membersResponse.error.message}`);
  }

  const assigneeOrderIds = new Set(
    (Array.isArray(assigneesResponse.data) ? assigneesResponse.data : [])
      .map(row)
      .map((item) => text(item, 'work_order_id'))
      .filter(Boolean),
  );
  const projectIdsWithMembers = new Set(
    (Array.isArray(membersResponse.data) ? membersResponse.data : [])
      .map(row)
      .map((item) => text(item, 'project_id'))
      .filter(Boolean),
  );
  const orders: PhaseWorkOrder[] = (Array.isArray(ordersResponse.data) ? ordersResponse.data : [])
    .map(row)
    .map((item) => ({
      id: text(item, 'id'),
      projectPhaseId: text(item, 'project_phase_id'),
      projectId: optionalText(item, 'project_id'),
      status: text(item, 'status'),
      assignmentScope: text(item, 'assignment_scope'),
      plannedStartDate: optionalText(item, 'planned_start_date'),
      plannedEndDate: optionalText(item, 'planned_end_date'),
      predecessorWorkOrderId: optionalText(item, 'predecessor_work_order_id'),
    }));
  const statusByOrderId = new Map(orders.map((item) => [item.id, item.status]));
  const stats = new Map<string, WorkOrderPhaseStats>();

  for (const item of orders) {
    if (!item.projectPhaseId) continue;
    const current = { ...(stats.get(item.projectPhaseId) ?? EMPTY_PHASE_STATS) };
    const completed = item.status === 'Valmis' || item.status === 'Peruttu';
    current.total += 1;
    if (completed) current.completed += 1;
    if (item.status === 'Käynnissä') current.active += 1;
    if (item.plannedStartDate && item.plannedEndDate) current.scheduled += 1;

    const hasAssignment = item.assignmentScope === 'project_team'
      ? Boolean(item.projectId && projectIdsWithMembers.has(item.projectId))
      : assigneeOrderIds.has(item.id);
    if (!hasAssignment) current.unassigned += 1;

    const predecessorStatus = item.predecessorWorkOrderId
      ? statusByOrderId.get(item.predecessorWorkOrderId)
      : undefined;
    if (!completed && item.predecessorWorkOrderId && !['Valmis', 'Peruttu'].includes(predecessorStatus ?? '')) {
      current.blocked += 1;
    }
    stats.set(item.projectPhaseId, current);
  }
  return stats;
}

async function loadScheduling(organizationId: string) {
  const [phasesResponse, shiftsResponse, phaseStats] = await Promise.all([
    supabase
      .from('project_phases')
      .select('*')
      .eq('organization_id', organizationId)
      .order('start_date', { ascending: true }),
    supabase
      .from('shifts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('date', { ascending: true }),
    loadWorkOrderPhaseStats(organizationId),
  ]);

  if (phasesResponse.error) {
    throw new Error(`Projektivaiheiden haku epäonnistui: ${phasesResponse.error.message}`);
  }
  if (shiftsResponse.error) {
    throw new Error(`Resurssivarausten haku epäonnistui: ${shiftsResponse.error.message}`);
  }

  const phases = (Array.isArray(phasesResponse.data) ? phasesResponse.data : [])
    .map(row)
    .map((item): ProjectPhase => {
      const rawStatus = text(item, 'status');
      const status: PhaseStatus = ['Käynnissä', 'Valmis', 'Myöhässä'].includes(rawStatus)
        ? rawStatus as PhaseStatus
        : 'Suunniteltu';
      const phaseId = text(item, 'id');
      const counts = phaseStats.get(phaseId) ?? EMPTY_PHASE_STATS;
      return {
        id: phaseId,
        projectId: optionalText(item, 'project_id'),
        projectName: text(item, 'project_name'),
        name: text(item, 'name'),
        startDate: text(item, 'start_date'),
        endDate: text(item, 'end_date'),
        status,
        progress: numberValue(item, 'progress'),
        notes: text(item, 'notes'),
        workPlanId: optionalText(item, 'work_plan_id'),
        workOrderCount: counts.total,
        completedWorkOrderCount: counts.completed,
        activeWorkOrderCount: counts.active,
        scheduledWorkOrderCount: counts.scheduled,
        unassignedWorkOrderCount: counts.unassigned,
        blockedWorkOrderCount: counts.blocked,
      };
    });

  const shifts = (Array.isArray(shiftsResponse.data) ? shiftsResponse.data : [])
    .map(row)
    .map((item): Shift => ({
      id: text(item, 'id'),
      userId: optionalText(item, 'user_id'),
      employeeId: optionalText(item, 'employee_id'),
      employeeName: text(item, 'employee_name'),
      projectId: optionalText(item, 'project_id'),
      project: text(item, 'project'),
      title: text(item, 'title'),
      date: text(item, 'date'),
      startTime: text(item, 'start_time').slice(0, 5),
      endTime: text(item, 'end_time').slice(0, 5),
      shiftType: text(item, 'shift_type'),
      notes: text(item, 'notes'),
      workOrderId: optionalText(item, 'work_order_id'),
      sourceType: sourceType(item.source_type),
    }));

  return { phases, shifts };
}

export function useSchedulingData() {
  const { currentOrg } = useOrganization();
  const { effectiveRole, effectiveUserId, effectiveDisplayName } = useViewAs();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = [
    'scheduling-data',
    organizationId ?? 'none',
    effectiveRole ?? 'none',
    effectiveUserId ?? 'anonymous',
  ] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => loadScheduling(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 10_000,
    retry: 1,
  });

  const isWorkerView = effectiveRole === 'worker';
  const normalizedName = effectiveDisplayName.trim().toLocaleLowerCase('fi');
  const shifts = (query.data?.shifts ?? []).filter((shift) => {
    if (!isWorkerView) return true;
    if (effectiveUserId && shift.userId === effectiveUserId) return true;
    return Boolean(normalizedName && shift.employeeName.trim().toLocaleLowerCase('fi') === normalizedName);
  });

  return {
    phases: isWorkerView ? [] : query.data?.phases ?? [],
    shifts,
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
