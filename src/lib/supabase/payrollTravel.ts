import { supabase } from './client';

export interface PayrollTravelPreviewLine {
  employeeId?: string;
  employeeUserId?: string;
  employeeName: string;
  travelExpenseId: string;
  expenseDate: string;
  expenseType: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  amountCents: number;
  approvedBy?: string;
  approvedAt?: string;
  blockers: string[];
  warnings: string[];
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

function optionalText(row: Row, key: string): string | undefined {
  return text(row, key) || undefined;
}

function numberValue(row: Row, key: string): number {
  const parsed = Number(row[key] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringArray(row: Row, key: string): string[] {
  return Array.isArray(row[key])
    ? (row[key] as unknown[]).filter((item): item is string => typeof item === 'string')
    : [];
}

export async function listPayrollTravelPreview(
  organizationId: string,
  periodStart: string,
  periodEnd: string,
): Promise<PayrollTravelPreviewLine[]> {
  const { data, error } = await supabase.rpc('list_payroll_travel_preview', {
    p_organization_id: organizationId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (error) throw new Error(`Palkkakauden matkakulujen haku epäonnistui: ${error.message}`);

  return rows(data).map((row) => ({
    employeeId: optionalText(row, 'employee_id'),
    employeeUserId: optionalText(row, 'employee_user_id'),
    employeeName: text(row, 'employee_name'),
    travelExpenseId: text(row, 'travel_expense_id'),
    expenseDate: text(row, 'expense_date'),
    expenseType: text(row, 'expense_type'),
    description: optionalText(row, 'description'),
    projectId: optionalText(row, 'project_id'),
    projectName: optionalText(row, 'project_name'),
    amountCents: numberValue(row, 'amount_cents'),
    approvedBy: optionalText(row, 'approved_by'),
    approvedAt: optionalText(row, 'approved_at'),
    blockers: stringArray(row, 'blockers'),
    warnings: stringArray(row, 'warnings'),
  }));
}
