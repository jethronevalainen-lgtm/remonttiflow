import { supabase } from './client';

export type PayrollCorrectionStatus = 'Luonnos' | 'Odottaa hyväksyntää' | 'Hyväksytty' | 'Hylätty';
export type PayrollCorrectionDirection = 'Lisäys' | 'Hyvitys';
export type PayrollCorrectionCategory = 'Palkka' | 'Ylityö' | 'Lisä' | 'Matkakulu' | 'Muu';
export type PayrollCorrectionSourceType = 'Tuntikirjaus' | 'Matkakulu' | 'Manuaalinen';

export interface PayrollCorrectionPeriod {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  notes?: string;
  lockedAt?: string;
  baseTotalCents: number;
  correctionTotalCents: number;
  correctedTotalCents: number;
  employeeCount: number;
  correctionVersion: number;
  openRequestCount: number;
}

export interface PayrollCorrectionEmployee {
  employeeId: string;
  employeeUserId?: string;
  employeeName: string;
  baseTotalCents: number;
  correctionTotalCents: number;
  correctedTotalCents: number;
}

export interface PayrollCorrectionRequest {
  id: string;
  payrollPeriodId: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollCorrectionStatus;
  reason: string;
  requestedBy: string;
  requesterName: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  lineCount: number;
  adjustmentTotalCents: number;
  approvedVersionId?: string;
  approvedVersionNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollCorrectionLine {
  id: string;
  correctionRequestId: string;
  employeeId: string;
  employeeUserId?: string;
  employeeName: string;
  direction: PayrollCorrectionDirection;
  category: PayrollCorrectionCategory;
  amountCents: number;
  signedAmountCents: number;
  description: string;
  effectiveDate: string;
  sourceType?: PayrollCorrectionSourceType;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollCorrectionVersion {
  id: string;
  payrollPeriodId: string;
  correctionRequestId: string;
  versionNumber: number;
  previousVersionId?: string;
  baseTotalCents: number;
  priorAdjustmentTotalCents: number;
  adjustmentTotalCents: number;
  cumulativeAdjustmentTotalCents: number;
  correctedTotalCents: number;
  lineCount: number;
  employeeCount: number;
  reason: string;
  approvedBy: string;
  approverName: string;
  approvedAt: string;
  createdAt: string;
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

function statusValue(row: Row): PayrollCorrectionStatus {
  const value = text(row, 'status');
  return value === 'Odottaa hyväksyntää' || value === 'Hyväksytty' || value === 'Hylätty'
    ? value
    : 'Luonnos';
}

export async function listPayrollCorrectionPeriods(organizationId: string): Promise<PayrollCorrectionPeriod[]> {
  const { data, error } = await supabase.rpc('list_payroll_correction_periods', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Korjattavien palkkakausien haku epäonnistui: ${error.message}`);

  return rows(data).map((row) => ({
    id: text(row, 'id'),
    periodStart: text(row, 'period_start'),
    periodEnd: text(row, 'period_end'),
    status: text(row, 'status'),
    notes: optionalText(row, 'notes'),
    lockedAt: optionalText(row, 'locked_at'),
    baseTotalCents: numberValue(row, 'base_total_cents'),
    correctionTotalCents: numberValue(row, 'correction_total_cents'),
    correctedTotalCents: numberValue(row, 'corrected_total_cents'),
    employeeCount: numberValue(row, 'employee_count'),
    correctionVersion: numberValue(row, 'correction_version'),
    openRequestCount: numberValue(row, 'open_request_count'),
  }));
}

export async function listPayrollCorrectionEmployees(
  organizationId: string,
  payrollPeriodId: string,
): Promise<PayrollCorrectionEmployee[]> {
  const { data, error } = await supabase.rpc('list_payroll_correction_employee_context', {
    p_organization_id: organizationId,
    p_payroll_period_id: payrollPeriodId,
  });
  if (error) throw new Error(`Korjauksen työntekijätietojen haku epäonnistui: ${error.message}`);

  return rows(data).map((row) => ({
    employeeId: text(row, 'employee_id'),
    employeeUserId: optionalText(row, 'employee_user_id'),
    employeeName: text(row, 'employee_name'),
    baseTotalCents: numberValue(row, 'base_total_cents'),
    correctionTotalCents: numberValue(row, 'correction_total_cents'),
    correctedTotalCents: numberValue(row, 'corrected_total_cents'),
  }));
}

export async function listPayrollCorrectionRequests(
  organizationId: string,
  payrollPeriodId?: string,
): Promise<PayrollCorrectionRequest[]> {
  const { data, error } = await supabase.rpc('list_payroll_correction_requests', {
    p_organization_id: organizationId,
    p_payroll_period_id: payrollPeriodId ?? null,
  });
  if (error) throw new Error(`Korjauspyyntöjen haku epäonnistui: ${error.message}`);

  return rows(data).map((row) => ({
    id: text(row, 'id'),
    payrollPeriodId: text(row, 'payroll_period_id'),
    periodStart: text(row, 'period_start'),
    periodEnd: text(row, 'period_end'),
    status: statusValue(row),
    reason: text(row, 'reason'),
    requestedBy: text(row, 'requested_by'),
    requesterName: text(row, 'requester_name'),
    submittedAt: optionalText(row, 'submitted_at'),
    reviewedBy: optionalText(row, 'reviewed_by'),
    reviewerName: optionalText(row, 'reviewer_name'),
    reviewedAt: optionalText(row, 'reviewed_at'),
    reviewNote: optionalText(row, 'review_note'),
    lineCount: numberValue(row, 'line_count'),
    adjustmentTotalCents: numberValue(row, 'adjustment_total_cents'),
    approvedVersionId: optionalText(row, 'approved_version_id'),
    approvedVersionNumber: row.approved_version_number == null ? undefined : numberValue(row, 'approved_version_number'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  }));
}

export async function listPayrollCorrectionLines(requestId: string): Promise<PayrollCorrectionLine[]> {
  const { data, error } = await supabase.rpc('list_payroll_correction_lines', {
    p_correction_request_id: requestId,
  });
  if (error) throw new Error(`Korjausrivien haku epäonnistui: ${error.message}`);

  return rows(data).map((row) => ({
    id: text(row, 'id'),
    correctionRequestId: text(row, 'correction_request_id'),
    employeeId: text(row, 'employee_id'),
    employeeUserId: optionalText(row, 'employee_user_id'),
    employeeName: text(row, 'employee_name'),
    direction: text(row, 'direction') === 'Hyvitys' ? 'Hyvitys' : 'Lisäys',
    category: (['Palkka', 'Ylityö', 'Lisä', 'Matkakulu', 'Muu'].includes(text(row, 'category'))
      ? text(row, 'category')
      : 'Muu') as PayrollCorrectionCategory,
    amountCents: numberValue(row, 'amount_cents'),
    signedAmountCents: numberValue(row, 'signed_amount_cents'),
    description: text(row, 'description'),
    effectiveDate: text(row, 'effective_date'),
    sourceType: optionalText(row, 'source_type') as PayrollCorrectionSourceType | undefined,
    sourceId: optionalText(row, 'source_id'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  }));
}

export async function listPayrollCorrectionVersions(
  organizationId: string,
  payrollPeriodId?: string,
): Promise<PayrollCorrectionVersion[]> {
  const { data, error } = await supabase.rpc('list_payroll_correction_versions', {
    p_organization_id: organizationId,
    p_payroll_period_id: payrollPeriodId ?? null,
  });
  if (error) throw new Error(`Korjausversioiden haku epäonnistui: ${error.message}`);

  return rows(data).map((row) => ({
    id: text(row, 'id'),
    payrollPeriodId: text(row, 'payroll_period_id'),
    correctionRequestId: text(row, 'correction_request_id'),
    versionNumber: numberValue(row, 'version_number'),
    previousVersionId: optionalText(row, 'previous_version_id'),
    baseTotalCents: numberValue(row, 'base_total_cents'),
    priorAdjustmentTotalCents: numberValue(row, 'prior_adjustment_total_cents'),
    adjustmentTotalCents: numberValue(row, 'adjustment_total_cents'),
    cumulativeAdjustmentTotalCents: numberValue(row, 'cumulative_adjustment_total_cents'),
    correctedTotalCents: numberValue(row, 'corrected_total_cents'),
    lineCount: numberValue(row, 'line_count'),
    employeeCount: numberValue(row, 'employee_count'),
    reason: text(row, 'reason'),
    approvedBy: text(row, 'approved_by'),
    approverName: text(row, 'approver_name'),
    approvedAt: text(row, 'approved_at'),
    createdAt: text(row, 'created_at'),
  }));
}

export async function createPayrollCorrectionRequest(values: {
  organizationId: string;
  payrollPeriodId: string;
  reason: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_payroll_correction_request', {
    p_organization_id: values.organizationId,
    p_payroll_period_id: values.payrollPeriodId,
    p_reason: values.reason,
  });
  if (error) throw new Error(`Korjauspyynnön luonti epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Korjauspyynnön luonti ei palauttanut tunnistetta.');
  return data;
}

export async function savePayrollCorrectionLine(values: {
  requestId: string;
  lineId?: string;
  employeeId: string;
  direction: PayrollCorrectionDirection;
  category: PayrollCorrectionCategory;
  amountCents: number;
  description: string;
  effectiveDate: string;
  sourceType?: PayrollCorrectionSourceType;
  sourceId?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_payroll_correction_line', {
    p_correction_request_id: values.requestId,
    p_line_id: values.lineId ?? null,
    p_employee_id: values.employeeId,
    p_direction: values.direction,
    p_category: values.category,
    p_amount_cents: values.amountCents,
    p_description: values.description,
    p_effective_date: values.effectiveDate,
    p_source_type: values.sourceType ?? null,
    p_source_id: values.sourceId ?? null,
  });
  if (error) throw new Error(`Korjausrivin tallennus epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Korjausrivin tallennus ei palauttanut tunnistetta.');
  return data;
}

export async function deletePayrollCorrectionLine(lineId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_payroll_correction_line', { p_line_id: lineId });
  if (error) throw new Error(`Korjausrivin poistaminen epäonnistui: ${error.message}`);
}

export async function submitPayrollCorrectionRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('submit_payroll_correction_request', {
    p_correction_request_id: requestId,
  });
  if (error) throw new Error(`Korjauspyynnön lähettäminen epäonnistui: ${error.message}`);
}

export async function reviewPayrollCorrectionRequest(values: {
  requestId: string;
  decision: 'approve' | 'reject';
  reviewNote?: string;
}): Promise<string | undefined> {
  const { data, error } = await supabase.rpc('review_payroll_correction_request', {
    p_correction_request_id: values.requestId,
    p_decision: values.decision,
    p_review_note: values.reviewNote ?? null,
  });
  if (error) throw new Error(`${values.decision === 'approve' ? 'Hyväksyntä' : 'Hylkäys'} epäonnistui: ${error.message}`);
  return typeof data === 'string' ? data : undefined;
}
