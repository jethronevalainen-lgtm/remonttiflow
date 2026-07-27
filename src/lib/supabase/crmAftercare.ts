import { supabase } from '@/lib/supabase/client';

export type CustomerCaseType = 'Reklamaatio' | 'Takuu' | 'Laatupoikkeama' | 'Huolto';
export type CustomerCasePriority = 'Matala' | 'Normaali' | 'Korkea' | 'Kriittinen';
export type CustomerCaseStatus =
  | 'Uusi'
  | 'Selvityksessä'
  | 'Korjaus sovittu'
  | 'Korjauksessa'
  | 'Odottaa asiakkaan hyväksyntää'
  | 'Suljettu'
  | 'Hylätty';
export type CustomerCaseDecision = 'Odottaa' | 'Hyväksytty' | 'Hylätty';

export interface CustomerCase {
  id: string;
  organizationId: string;
  caseNumber: string;
  customerId: string;
  siteId?: string;
  projectId?: string;
  workRequestId?: string;
  workOrderId?: string;
  caseType: CustomerCaseType;
  title: string;
  description: string;
  reportedByName?: string;
  reportedByEmail?: string;
  reportedByPhone?: string;
  reportedAt: string;
  priority: CustomerCasePriority;
  status: CustomerCaseStatus;
  dueAt?: string;
  assignedUserId?: string;
  warrantyCovered?: boolean | null;
  rootCause?: string;
  resolution?: string;
  estimatedCostCents: number;
  actualCostCents: number;
  customerVisible: boolean;
  customerDecision?: CustomerCaseDecision | null;
  customerDecisionNote?: string;
  customerDecidedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProjectCase {
  id: string;
  caseNumber: string;
  caseType: CustomerCaseType;
  title: string;
  description: string;
  priority: CustomerCasePriority;
  status: CustomerCaseStatus;
  reportedAt: string;
  dueAt?: string;
  warrantyCovered?: boolean;
  resolution?: string;
  customerDecision?: CustomerCaseDecision;
  customerDecisionNote?: string;
  customerDecidedAt?: string;
  closedAt?: string;
}

export interface CrmChangeOrderSignal {
  id: string;
  projectId: string;
  title: string;
  status: string;
  amountCents: number;
  customerVisible: boolean;
  customerDecision?: string;
  submittedToCustomerAt?: string;
}

export interface CrmPortalUserSignal {
  customerId: string;
  userId: string;
  accessScope: string;
}

type Row = Record<string, unknown>;

type CustomerCaseInput = {
  customerId: string;
  siteId?: string;
  projectId?: string;
  workOrderId?: string;
  caseType: CustomerCaseType;
  title: string;
  description: string;
  reportedByName?: string;
  reportedByEmail?: string;
  reportedByPhone?: string;
  reportedAt?: string;
  priority: CustomerCasePriority;
  status: CustomerCaseStatus;
  dueAt?: string;
  assignedUserId?: string;
  warrantyCovered?: boolean | null;
  rootCause?: string;
  resolution?: string;
  estimatedCostCents?: number;
  actualCostCents?: number;
  customerVisible?: boolean;
  customerDecision?: CustomerCaseDecision | null;
  closedAt?: string;
};

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
  const parsed = Number(row[key]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalBoolean(row: Row, key: string): boolean | undefined {
  return typeof row[key] === 'boolean' ? row[key] as boolean : undefined;
}

function mapCase(row: Row): CustomerCase {
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    caseNumber: text(row, 'case_number'),
    customerId: text(row, 'customer_id'),
    siteId: optionalText(row, 'site_id'),
    projectId: optionalText(row, 'project_id'),
    workRequestId: optionalText(row, 'work_request_id'),
    workOrderId: optionalText(row, 'work_order_id'),
    caseType: text(row, 'case_type') as CustomerCaseType,
    title: text(row, 'title'),
    description: text(row, 'description'),
    reportedByName: optionalText(row, 'reported_by_name'),
    reportedByEmail: optionalText(row, 'reported_by_email'),
    reportedByPhone: optionalText(row, 'reported_by_phone'),
    reportedAt: text(row, 'reported_at'),
    priority: text(row, 'priority') as CustomerCasePriority,
    status: text(row, 'status') as CustomerCaseStatus,
    dueAt: optionalText(row, 'due_at'),
    assignedUserId: optionalText(row, 'assigned_user_id'),
    warrantyCovered: optionalBoolean(row, 'warranty_covered'),
    rootCause: optionalText(row, 'root_cause'),
    resolution: optionalText(row, 'resolution'),
    estimatedCostCents: numberValue(row, 'estimated_cost_cents'),
    actualCostCents: numberValue(row, 'actual_cost_cents'),
    customerVisible: row.customer_visible === true,
    customerDecision: optionalText(row, 'customer_decision') as CustomerCaseDecision | undefined,
    customerDecisionNote: optionalText(row, 'customer_decision_note'),
    customerDecidedAt: optionalText(row, 'customer_decided_at'),
    closedAt: optionalText(row, 'closed_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

function mapProjectCase(row: Row): CustomerProjectCase {
  return {
    id: text(row, 'id'),
    caseNumber: text(row, 'case_number'),
    caseType: text(row, 'case_type') as CustomerCaseType,
    title: text(row, 'title'),
    description: text(row, 'description'),
    priority: text(row, 'priority') as CustomerCasePriority,
    status: text(row, 'status') as CustomerCaseStatus,
    reportedAt: text(row, 'reported_at'),
    dueAt: optionalText(row, 'due_at'),
    warrantyCovered: optionalBoolean(row, 'warranty_covered'),
    resolution: optionalText(row, 'resolution'),
    customerDecision: optionalText(row, 'customer_decision') as CustomerCaseDecision | undefined,
    customerDecisionNote: optionalText(row, 'customer_decision_note'),
    customerDecidedAt: optionalText(row, 'customer_decided_at'),
    closedAt: optionalText(row, 'closed_at'),
  };
}

function casePayload(input: Partial<CustomerCaseInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.customerId !== undefined) payload.customer_id = input.customerId;
  if (input.siteId !== undefined) payload.site_id = input.siteId || null;
  if (input.projectId !== undefined) payload.project_id = input.projectId || null;
  if (input.workOrderId !== undefined) payload.work_order_id = input.workOrderId || null;
  if (input.caseType !== undefined) payload.case_type = input.caseType;
  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.description !== undefined) payload.description = input.description.trim();
  if (input.reportedByName !== undefined) payload.reported_by_name = input.reportedByName.trim() || null;
  if (input.reportedByEmail !== undefined) payload.reported_by_email = input.reportedByEmail.trim() || null;
  if (input.reportedByPhone !== undefined) payload.reported_by_phone = input.reportedByPhone.trim() || null;
  if (input.reportedAt !== undefined) payload.reported_at = input.reportedAt || null;
  if (input.priority !== undefined) payload.priority = input.priority;
  if (input.status !== undefined) payload.status = input.status;
  if (input.dueAt !== undefined) payload.due_at = input.dueAt || null;
  if (input.assignedUserId !== undefined) payload.assigned_user_id = input.assignedUserId || null;
  if (input.warrantyCovered !== undefined) payload.warranty_covered = input.warrantyCovered;
  if (input.rootCause !== undefined) payload.root_cause = input.rootCause.trim() || null;
  if (input.resolution !== undefined) payload.resolution = input.resolution.trim() || null;
  if (input.estimatedCostCents !== undefined) payload.estimated_cost_cents = input.estimatedCostCents;
  if (input.actualCostCents !== undefined) payload.actual_cost_cents = input.actualCostCents;
  if (input.customerVisible !== undefined) payload.customer_visible = input.customerVisible;
  if (input.customerDecision !== undefined) payload.customer_decision = input.customerDecision || null;
  if (input.closedAt !== undefined) payload.closed_at = input.closedAt || null;
  return payload;
}

export async function loadCrmAftercare(organizationId: string): Promise<{
  cases: CustomerCase[];
  changeOrders: CrmChangeOrderSignal[];
  portalUsers: CrmPortalUserSignal[];
}> {
  const [caseResult, changeResult, portalResult] = await Promise.all([
    supabase
      .from('customer_cases')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),
    supabase
      .from('change_orders')
      .select('id, project_id, title, status, amount_cents, customer_visible, customer_decision, submitted_to_customer_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),
    supabase
      .from('customer_users')
      .select('customer_id, user_id, access_scope')
      .eq('organization_id', organizationId),
  ]);

  if (caseResult.error) throw new Error(`Reklamaatioiden haku epäonnistui: ${caseResult.error.message}`);
  if (changeResult.error) throw new Error(`Lisätöiden haku epäonnistui: ${changeResult.error.message}`);
  if (portalResult.error) throw new Error(`Asiakasportaalin käyttäjien haku epäonnistui: ${portalResult.error.message}`);

  return {
    cases: rows(caseResult.data).map(mapCase).filter((item) => item.id),
    changeOrders: rows(changeResult.data).map((row) => ({
      id: text(row, 'id'),
      projectId: text(row, 'project_id'),
      title: text(row, 'title'),
      status: text(row, 'status'),
      amountCents: numberValue(row, 'amount_cents'),
      customerVisible: row.customer_visible === true,
      customerDecision: optionalText(row, 'customer_decision'),
      submittedToCustomerAt: optionalText(row, 'submitted_to_customer_at'),
    })).filter((item) => item.id),
    portalUsers: rows(portalResult.data).map((row) => ({
      customerId: text(row, 'customer_id'),
      userId: text(row, 'user_id'),
      accessScope: text(row, 'access_scope'),
    })).filter((item) => item.customerId && item.userId),
  };
}

export async function createCustomerCase(
  organizationId: string,
  userId: string | undefined,
  input: CustomerCaseInput,
): Promise<void> {
  const { error } = await supabase.from('customer_cases').insert({
    organization_id: organizationId,
    created_by: userId || null,
    ...casePayload(input),
  });
  if (error) throw new Error(`Reklamaation tallennus epäonnistui: ${error.message}`);
}

export async function updateCustomerCase(
  organizationId: string,
  id: string,
  input: Partial<CustomerCaseInput>,
): Promise<void> {
  const { error } = await supabase
    .from('customer_cases')
    .update(casePayload(input))
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Reklamaation päivitys epäonnistui: ${error.message}`);
}

export async function deleteCustomerCase(organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('customer_cases')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Reklamaation poistaminen epäonnistui: ${error.message}`);
}

export async function submitCustomerCaseForAcceptance(
  organizationId: string,
  id: string,
  resolution: string,
): Promise<void> {
  const normalized = resolution.trim();
  if (!normalized) throw new Error('Kirjaa ratkaisu ennen asiakkaan hyväksynnän pyytämistä.');
  const { error } = await supabase
    .from('customer_cases')
    .update({
      resolution: normalized,
      status: 'Odottaa asiakkaan hyväksyntää',
      customer_visible: true,
      customer_decision: 'Odottaa',
      customer_decision_note: null,
      customer_decided_by: null,
      customer_decided_at: null,
      closed_at: null,
    })
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Hyväksyntäpyynnön lähetys epäonnistui: ${error.message}`);
}

export async function loadCustomerProjectCases(projectId: string): Promise<CustomerProjectCase[]> {
  const { data, error } = await supabase.rpc('customer_project_cases_v2', {
    p_project_id: projectId,
  });
  if (error) throw new Error(`Reklamaatioiden haku epäonnistui: ${error.message}`);
  return rows(data).map(mapProjectCase).filter((item) => item.id);
}

export async function decideCustomerCaseResolution(input: {
  caseId: string;
  decision: Extract<CustomerCaseDecision, 'Hyväksytty' | 'Hylätty'>;
  note?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('decide_customer_case_resolution_v2', {
    p_case_id: input.caseId,
    p_decision: input.decision,
    p_note: input.note?.trim() || null,
  });
  if (error) throw new Error(`Reklamaation päätöksen tallennus epäonnistui: ${error.message}`);
}
