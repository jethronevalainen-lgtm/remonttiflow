import { supabase } from '@/lib/supabase/client';

export interface EmployeeSupervisorAssignment {
  employeeId: string;
  supervisorUserId: string;
}

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

export async function listEmployeeSupervisorAssignments(
  organizationId: string,
): Promise<EmployeeSupervisorAssignment[]> {
  const { data, error } = await supabase
    .from('supervisor_team_members')
    .select('employee_id, supervisor_user_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (error) throw new Error(`Esihenkilösuhteiden haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    employeeId: text(row, 'employee_id'),
    supervisorUserId: text(row, 'supervisor_user_id'),
  })).filter((item) => item.employeeId && item.supervisorUserId);
}

export async function setEmployeeSupervisor(values: {
  organizationId: string;
  employeeId: string;
  supervisorUserId?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('set_employee_supervisor', {
    p_organization_id: values.organizationId,
    p_employee_id: values.employeeId,
    p_supervisor_user_id: values.supervisorUserId || null,
  });
  if (error) throw new Error(`Esihenkilön tallennus epäonnistui: ${error.message}`);
}
