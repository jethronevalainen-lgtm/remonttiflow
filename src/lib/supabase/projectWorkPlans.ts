import { supabase } from '@/lib/supabase/client';
import {
  phaseKey,
  resolveWorkItemAssignees,
  selectedWorkAssignments,
  type ProjectWorkAssignmentDraft,
  type ProjectWorkPhaseDraft,
  type ProjectWorkTargetDraft,
} from '@/lib/projectWorkPlanBuilder';

export interface ProjectWorkPlanSummary {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: 'Suunniteltu' | 'Käynnissä' | 'Valmis' | 'Arkistoitu';
  progress: number;
  createdAt: string;
}

export interface ProjectWorkPlanConflict {
  kind: 'existing_shift' | 'internal_overlap';
  userId: string;
  employeeName: string;
  date: string;
  targetTitle: string;
  phaseTitle: string;
  conflictingTitle: string;
}

interface Row {
  [key: string]: unknown;
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function numberValue(row: Row, key: string): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function status(value: unknown): ProjectWorkPlanSummary['status'] {
  return ['Suunniteltu', 'Käynnissä', 'Valmis', 'Arkistoitu'].includes(String(value))
    ? value as ProjectWorkPlanSummary['status']
    : 'Suunniteltu';
}

export async function loadProjectWorkPlans(values: {
  organizationId: string;
  projectId: string;
}): Promise<ProjectWorkPlanSummary[]> {
  const { data, error } = await supabase
    .from('project_work_plans')
    .select('id, project_id, name, description, status, progress, created_at')
    .eq('organization_id', values.organizationId)
    .eq('project_id', values.projectId)
    .neq('status', 'Arkistoitu')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Työkokonaisuuksien haku epäonnistui: ${error.message}`);
  const rows: Row[] = Array.isArray(data)
    ? data.map((item) => item as unknown as Row)
    : [];
  return rows.map((row) => ({
    id: text(row, 'id'),
    projectId: text(row, 'project_id'),
    name: text(row, 'name'),
    description: text(row, 'description'),
    status: status(row.status),
    progress: numberValue(row, 'progress'),
    createdAt: text(row, 'created_at'),
  }));
}

function serializedItems(values: {
  targets: ProjectWorkTargetDraft[];
  phases: ProjectWorkPhaseDraft[];
  assignments: ProjectWorkAssignmentDraft[];
}) {
  const targetMap = new Map(values.targets.map((target) => [target.id, target]));
  const phaseMap = new Map(values.phases.map((phase) => [phase.id, phase]));
  const phaseOrder = new Map(values.phases.map((phase, index) => [phase.id, index + 1]));

  return selectedWorkAssignments(values.assignments)
    .map((item) => {
      const target = targetMap.get(item.targetId);
      const phase = phaseMap.get(item.phaseId);
      if (!target || !phase) return null;
      return {
        target_key: target.key,
        phase_key: phaseKey(phase, (phaseOrder.get(phase.id) ?? 1) - 1),
        target_title: target.title.trim(),
        phase_title: phase.title.trim(),
        start_date: item.startDate,
        end_date: item.endDate,
        sequence_no: phaseOrder.get(phase.id) ?? 1,
        assignee_user_ids: resolveWorkItemAssignees(item, target, phase),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.target_key.localeCompare(b.target_key, 'fi', { numeric: true }) || a.sequence_no - b.sequence_no);
}

export async function previewProjectWorkPlanConflicts(values: {
  organizationId: string;
  targets: ProjectWorkTargetDraft[];
  phases: ProjectWorkPhaseDraft[];
  assignments: ProjectWorkAssignmentDraft[];
}): Promise<ProjectWorkPlanConflict[]> {
  const { data, error } = await supabase.rpc('preview_project_work_plan_conflicts_v2', {
    p_organization_id: values.organizationId,
    p_items: serializedItems(values),
    p_defaults: {
      planned_start_time: '07:00',
      planned_end_time: '15:30',
      planned_weekdays: [1, 2, 3, 4, 5],
    },
  });

  if (error) throw new Error(`Resurssiristiriitojen tarkistus epäonnistui: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const row = item as Row;
    const kind = text(row, 'kind');
    return {
      kind: kind === 'internal_overlap' ? 'internal_overlap' : 'existing_shift',
      userId: text(row, 'user_id'),
      employeeName: text(row, 'employee_name') || 'Nimetön henkilö',
      date: text(row, 'date'),
      targetTitle: text(row, 'target_title'),
      phaseTitle: text(row, 'phase_title'),
      conflictingTitle: text(row, 'conflicting_title'),
    };
  });
}

export async function createProjectWorkPlan(values: {
  organizationId: string;
  projectId: string;
  name: string;
  description?: string;
  targets: ProjectWorkTargetDraft[];
  phases: ProjectWorkPhaseDraft[];
  assignments: ProjectWorkAssignmentDraft[];
  occupancyStatus?: 'unknown' | 'occupied' | 'vacant' | 'partly_occupied';
  residentNotificationRequired?: boolean;
}): Promise<{ planId: string; targetCount: number; phaseCount: number; workOrderCount: number }> {
  const items = serializedItems(values);
  const { data, error } = await supabase.rpc('create_project_work_plan_v2', {
    p_organization_id: values.organizationId,
    p_project_id: values.projectId,
    p_name: values.name.trim(),
    p_description: values.description?.trim() || null,
    p_targets: values.targets.map((target, index) => ({
      key: target.key,
      title: target.title.trim(),
      location: target.location.trim() || target.title.trim(),
      description: target.description.trim() || null,
      earliest_start_date: target.startDate,
      target_end_date: target.endDate,
      sequence_no: index + 1,
      default_assignee_user_ids: target.assigneeUserIds,
    })),
    p_phase_templates: values.phases.map((phase, index) => ({
      key: phaseKey(phase, index),
      title: phase.title.trim(),
      type: phase.type.trim() || null,
      description: phase.description.trim() || null,
      duration_workdays: Math.max(1, Math.floor(Number(phase.durationWorkdays) || 1)),
      priority: phase.priority,
      sequence_no: index + 1,
      planned_start_time: phase.startTime || '07:00',
      planned_end_time: phase.endTime || '15:30',
      planned_weekdays: phase.weekdays?.length ? phase.weekdays : [1, 2, 3, 4, 5],
      default_assignee_user_ids: phase.assigneeUserIds,
    })),
    p_items: items,
    p_defaults: {
      planned_start_time: '07:00',
      planned_end_time: '15:30',
      planned_weekdays: [1, 2, 3, 4, 5],
      calendar_sync_enabled: true,
      occupancy_status: values.occupancyStatus ?? 'unknown',
      resident_notification_required: values.residentNotificationRequired ?? false,
    },
  });

  if (error) throw new Error(`Työkokonaisuuden luonti epäonnistui: ${error.message}`);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Tietokanta ei palauttanut työkokonaisuuden tietoja.');
  }

  const row = data as Row;
  const planId = text(row, 'plan_id');
  if (!planId) throw new Error('Tietokanta ei palauttanut työkokonaisuuden tunnistetta.');

  return {
    planId,
    targetCount: numberValue(row, 'target_count'),
    phaseCount: numberValue(row, 'phase_count'),
    workOrderCount: numberValue(row, 'work_order_count'),
  };
}
