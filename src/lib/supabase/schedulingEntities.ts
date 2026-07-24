import { supabase } from './client';
import type { ProjectPhase, Shift } from '@/hooks/useSchedulingData';

type TableName = 'project_phases' | 'shifts';
type Payload = Record<string, unknown>;

async function insert(table: TableName, payload: Payload) {
  const { error } = await supabase.from(table).insert(payload);
  if (error) throw new Error(`Tallennus epäonnistui: ${error.message}`);
}

async function update(
  table: TableName,
  organizationId: string,
  id: string,
  payload: Payload,
) {
  const { error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) throw new Error(`Päivitys epäonnistui: ${error.message}`);
}

async function remove(table: TableName, organizationId: string, id: string) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) throw new Error(`Poistaminen epäonnistui: ${error.message}`);
}

function phasePayload(phase: Omit<ProjectPhase, 'id'> | Partial<ProjectPhase>): Payload {
  const payload: Payload = {};
  if (phase.projectId !== undefined) payload.project_id = phase.projectId || null;
  if (phase.projectName !== undefined) payload.project_name = phase.projectName || null;
  if (phase.name !== undefined) payload.name = phase.name;
  if (phase.startDate !== undefined) payload.start_date = phase.startDate;
  if (phase.endDate !== undefined) payload.end_date = phase.endDate;
  if (phase.status !== undefined) payload.status = phase.status;
  if (phase.progress !== undefined) payload.progress = phase.progress;
  if (phase.notes !== undefined) payload.notes = phase.notes || null;
  return payload;
}

export async function createProjectPhase(
  organizationId: string,
  createdBy: string | undefined,
  phase: Omit<ProjectPhase, 'id'>,
) {
  await insert('project_phases', {
    organization_id: organizationId,
    ...(createdBy ? { created_by: createdBy } : {}),
    ...phasePayload(phase),
  });
}

export async function updateProjectPhase(
  organizationId: string,
  id: string,
  phase: Partial<ProjectPhase>,
) {
  await update('project_phases', organizationId, id, phasePayload(phase));
}

export const deleteProjectPhase = (organizationId: string, id: string) =>
  remove('project_phases', organizationId, id);

function shiftPayload(shift: Omit<Shift, 'id'> | Partial<Shift>): Payload {
  const payload: Payload = {};
  if (shift.employeeId !== undefined) payload.employee_id = shift.employeeId || null;
  if (shift.employeeName !== undefined) payload.employee_name = shift.employeeName || null;
  if (shift.projectId !== undefined) payload.project_id = shift.projectId || null;
  if (shift.project !== undefined) payload.project = shift.project || null;
  if (shift.date !== undefined) payload.date = shift.date;
  if (shift.startTime !== undefined) payload.start_time = shift.startTime || null;
  if (shift.endTime !== undefined) payload.end_time = shift.endTime || null;
  if (shift.shiftType !== undefined) payload.shift_type = shift.shiftType || null;
  if (shift.notes !== undefined) payload.notes = shift.notes || null;
  return payload;
}

export async function createShift(
  organizationId: string,
  createdBy: string | undefined,
  shift: Omit<Shift, 'id'>,
) {
  await insert('shifts', {
    organization_id: organizationId,
    ...(createdBy ? { created_by: createdBy } : {}),
    ...shiftPayload(shift),
  });
}

export async function updateShift(
  organizationId: string,
  id: string,
  shift: Partial<Shift>,
) {
  await update('shifts', organizationId, id, shiftPayload(shift));
}

export const deleteShift = (organizationId: string, id: string) =>
  remove('shifts', organizationId, id);
