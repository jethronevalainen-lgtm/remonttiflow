import { supabase } from '@/lib/supabase/client';
import type { ProjectWorkPhaseDraft, ProjectWorkTargetDraft } from '@/lib/projectWorkPlanBuilder';

export interface ProjectWorkPlanSummary {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: 'Suunniteltu' | 'Käynnissä' | 'Valmis' | 'Arkistoitu';
  progress: number;
  createdAt: string;
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
  const rows = Array.isArray(data) ? data.filter((item): item is Row => Boolean(item) && typeof item === 'object') : [];
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

export async function createProjectWorkPlan(values: {
  organizationId: string;
  projectId: string;
  name: string;
  description?: string;
  targets: ProjectWorkTargetDraft[];
  phases: ProjectWorkPhaseDraft[];
  occupancyStatus?: 'unknown' | 'occupied' | 'vacant' | 'partly_occupied';
  residentNotificationRequired?: boolean;
}): Promise<{ planId: string; targetCount: number; phaseCount: number; workOrderCount: number }> {
  const { data, error } = await supabase.rpc('create_project_work_plan', {
    p_organization_id: values.organizationId,
    p_project_id: values.projectId,
    p_name: values.name.trim(),
    p_description: values.description?.trim() || null,
    p_targets: values.targets.map((target) => ({
      key: target.key,
      title: target.title.trim(),
      location: target.location.trim() || target.title.trim(),
    })),
    p_phases: values.phases.map((phase, index) => ({
      title: phase.title.trim(),
      type: phase.type.trim() || null,
      description: phase.description.trim() || null,
      start_date: phase.startDate,
      end_date: phase.endDate,
      priority: phase.priority,
      sequence_no: index + 1,
      assignee_user_ids: phase.assigneeUserIds,
    })),
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
