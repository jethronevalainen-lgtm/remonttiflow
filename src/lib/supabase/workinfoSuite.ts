import { supabase } from './client';

export type OperationalEntryType = 'material' | 'equipment' | 'daily_note';
export type OperationalEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type BillingStatus = 'recorded' | 'approved' | 'billable' | 'queued' | 'invoiced' | 'credited' | 'rejected';

export interface WorkinfoSummary {
  activeWorkers: number;
  todayHours: number;
  monthHours: number;
  pendingHours: number;
  billableCents: number;
  unqueuedCents: number;
}

export interface ActivePresence {
  id: string;
  userId: string;
  employeeName: string;
  projectId?: string;
  projectName: string;
  workOrderId?: string;
  workOrderTitle?: string;
  description?: string;
  checkedInAt: string;
  accuracyM: number;
  distanceFromSiteM?: number;
  withinGeofence?: boolean;
  durationMinutes: number;
}

export interface OperationalException {
  id: string;
  employeeName: string;
  projectName: string;
  checkedInAt: string;
  severity: 'info' | 'warning' | 'critical';
  reasons: string[];
}

export interface WorkDescription {
  id: string;
  date: string;
  employeeName: string;
  projectName: string;
  projectId?: string;
  workOrderId?: string;
  workOrderTitle?: string;
  description?: string;
  hours: number;
  status: string;
  createdAt: string;
  qualityFlags: string[];
}

export interface WorkinfoDashboardData {
  summary: WorkinfoSummary;
  activePresence: ActivePresence[];
  exceptions: OperationalException[];
  latestDescriptions: WorkDescription[];
}

export interface OperationalEntry {
  id: string;
  organizationId: string;
  userId: string;
  projectId?: string;
  workOrderId?: string;
  equipmentId?: string;
  entryType: OperationalEntryType;
  title: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unitCostCents?: number;
  occurredAt: string;
  status: OperationalEntryStatus;
  rejectionReason?: string;
  createdAt: string;
}

export interface SubcontractorWorker {
  id: string;
  subcontractorId: string;
  name: string;
  email?: string;
  phone?: string;
  taxNumber?: string;
  employmentCategory: string;
  validFrom?: string;
  validUntil?: string;
  status: string;
}

export interface SubcontractorAssignment {
  id: string;
  subcontractorId: string;
  projectId: string;
  contractNumber?: string;
  contractValueCents?: number;
  billingBasis: string;
  isConstructionService: boolean;
  startsAt?: string;
  endsAt?: string;
  status: string;
}

export interface Subcontractor {
  id: string;
  organizationId: string;
  companyName: string;
  businessId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: string;
  liabilityDocumentsValidUntil?: string;
  insuranceValidUntil?: string;
  notes?: string;
  workers: SubcontractorWorker[];
  assignments: SubcontractorAssignment[];
}

export interface BillingItem {
  id: string;
  organizationId: string;
  customerId?: string;
  projectId: string;
  workOrderId?: string;
  sourceType: string;
  sourceId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents?: number;
  vatRate: number;
  totalExVatCents?: number;
  status: BillingStatus;
  invoiceReference?: string;
  createdAt: string;
}

export interface VehiclePosition {
  id: string;
  organizationId: string;
  equipmentId: string;
  projectId?: string;
  driverUserId?: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  speedKmh?: number;
  headingDegrees?: number;
  source: string;
  sourceReference?: string;
  recordedAt: string;
}

export interface ConstructionWorkerRow {
  projectId: string;
  projectName: string;
  siteLocation?: string;
  userId?: string;
  workerName: string;
  taxNumber?: string;
  employmentCategory: string;
  employerName: string;
  employerBusinessId?: string;
  firstWorkDate?: string;
  lastWorkDate?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface ConstructionContractRow {
  projectId: string;
  projectName: string;
  siteLocation?: string;
  subcontractorName: string;
  businessId?: string;
  contractNumber?: string;
  contractValueCents?: number;
  billingBasis: string;
  isConstructionService: boolean;
  startsAt?: string;
  endsAt?: string;
  reportingThresholdExceeded: boolean;
}

export interface ConstructionReportingData {
  targetMonth: string;
  workerRows: ConstructionWorkerRow[];
  subcontractorWorkerRows: ConstructionWorkerRow[];
  contractRows: ConstructionContractRow[];
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapOperationalEntry(row: Record<string, unknown>): OperationalEntry {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    projectId: row.project_id ? String(row.project_id) : undefined,
    workOrderId: row.work_order_id ? String(row.work_order_id) : undefined,
    equipmentId: row.equipment_id ? String(row.equipment_id) : undefined,
    entryType: row.entry_type as OperationalEntryType,
    title: String(row.title),
    description: row.description ? String(row.description) : undefined,
    quantity: row.quantity == null ? undefined : numberValue(row.quantity),
    unit: row.unit ? String(row.unit) : undefined,
    unitCostCents: row.unit_cost_cents == null ? undefined : numberValue(row.unit_cost_cents),
    occurredAt: String(row.occurred_at),
    status: row.status as OperationalEntryStatus,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    createdAt: String(row.created_at),
  };
}

function mapBillingItem(row: Record<string, unknown>): BillingItem {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    customerId: row.customer_id ? String(row.customer_id) : undefined,
    projectId: String(row.project_id),
    workOrderId: row.work_order_id ? String(row.work_order_id) : undefined,
    sourceType: String(row.source_type),
    sourceId: row.source_id ? String(row.source_id) : undefined,
    description: String(row.description),
    quantity: numberValue(row.quantity),
    unit: String(row.unit),
    unitPriceCents: row.unit_price_cents == null ? undefined : numberValue(row.unit_price_cents),
    vatRate: numberValue(row.vat_rate),
    totalExVatCents: row.total_ex_vat_cents == null ? undefined : numberValue(row.total_ex_vat_cents),
    status: row.status as BillingStatus,
    invoiceReference: row.invoice_reference ? String(row.invoice_reference) : undefined,
    createdAt: String(row.created_at),
  };
}

export async function getWorkinfoDashboard(organizationId: string): Promise<WorkinfoDashboardData> {
  const { data, error } = await supabase.rpc('list_workinfo_operational_dashboard', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Operatiivisen tilannekuvan haku epäonnistui: ${error.message}`);
  const payload = (data ?? {}) as Partial<WorkinfoDashboardData>;
  return {
    summary: {
      activeWorkers: numberValue(payload.summary?.activeWorkers),
      todayHours: numberValue(payload.summary?.todayHours),
      monthHours: numberValue(payload.summary?.monthHours),
      pendingHours: numberValue(payload.summary?.pendingHours),
      billableCents: numberValue(payload.summary?.billableCents),
      unqueuedCents: numberValue(payload.summary?.unqueuedCents),
    },
    activePresence: Array.isArray(payload.activePresence) ? payload.activePresence : [],
    exceptions: Array.isArray(payload.exceptions) ? payload.exceptions : [],
    latestDescriptions: Array.isArray(payload.latestDescriptions) ? payload.latestDescriptions : [],
  };
}

export async function listOperationalEntries(organizationId: string): Promise<OperationalEntry[]> {
  const { data, error } = await supabase
    .from('operational_entries')
    .select('*')
    .eq('organization_id', organizationId)
    .order('occurred_at', { ascending: false })
    .limit(250);
  if (error) throw new Error(`Kirjausten haku epäonnistui: ${error.message}`);
  return (data ?? []).map((row) => mapOperationalEntry(row as Record<string, unknown>));
}

export async function createOperationalEntry(input: {
  organizationId: string;
  userId: string;
  projectId?: string;
  workOrderId?: string;
  equipmentId?: string;
  entryType: OperationalEntryType;
  title: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unitCostCents?: number;
  occurredAt?: string;
}): Promise<void> {
  const { error } = await supabase.from('operational_entries').insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    project_id: input.projectId ?? null,
    work_order_id: input.workOrderId ?? null,
    equipment_id: input.equipmentId ?? null,
    entry_type: input.entryType,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    quantity: input.quantity ?? null,
    unit: input.unit?.trim() || null,
    unit_cost_cents: input.unitCostCents ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    status: 'submitted',
  });
  if (error) throw new Error(`Kirjauksen tallennus epäonnistui: ${error.message}`);
}

export async function reviewOperationalEntry(
  organizationId: string,
  id: string,
  status: 'approved' | 'rejected',
  reviewerId: string,
  rejectionReason?: string,
): Promise<void> {
  const { error } = await supabase
    .from('operational_entries')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: status === 'rejected' ? rejectionReason?.trim() || null : null,
    })
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Kirjauksen käsittely epäonnistui: ${error.message}`);
}

export async function listSubcontractors(organizationId: string): Promise<Subcontractor[]> {
  const [companies, workers, assignments] = await Promise.all([
    supabase.from('subcontractors').select('*').eq('organization_id', organizationId).is('archived_at', null).order('company_name'),
    supabase.from('subcontractor_workers').select('*').eq('organization_id', organizationId).order('name'),
    supabase.from('subcontractor_project_assignments').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
  ]);
  const firstError = companies.error ?? workers.error ?? assignments.error;
  if (firstError) throw new Error(`Alihankkijoiden haku epäonnistui: ${firstError.message}`);
  return (companies.data ?? []).map((row) => {
    const company = row as Record<string, unknown>;
    return {
      id: String(company.id),
      organizationId: String(company.organization_id),
      companyName: String(company.company_name),
      businessId: company.business_id ? String(company.business_id) : undefined,
      contactName: company.contact_name ? String(company.contact_name) : undefined,
      contactEmail: company.contact_email ? String(company.contact_email) : undefined,
      contactPhone: company.contact_phone ? String(company.contact_phone) : undefined,
      status: String(company.status),
      liabilityDocumentsValidUntil: company.liability_documents_valid_until ? String(company.liability_documents_valid_until) : undefined,
      insuranceValidUntil: company.insurance_valid_until ? String(company.insurance_valid_until) : undefined,
      notes: company.notes ? String(company.notes) : undefined,
      workers: (workers.data ?? []).filter((item) => item.subcontractor_id === company.id).map((item) => ({
        id: String(item.id),
        subcontractorId: String(item.subcontractor_id),
        name: String(item.name),
        email: item.email ? String(item.email) : undefined,
        phone: item.phone ? String(item.phone) : undefined,
        taxNumber: item.tax_number ? String(item.tax_number) : undefined,
        employmentCategory: String(item.employment_category),
        validFrom: item.valid_from ? String(item.valid_from) : undefined,
        validUntil: item.valid_until ? String(item.valid_until) : undefined,
        status: String(item.status),
      })),
      assignments: (assignments.data ?? []).filter((item) => item.subcontractor_id === company.id).map((item) => ({
        id: String(item.id),
        subcontractorId: String(item.subcontractor_id),
        projectId: String(item.project_id),
        contractNumber: item.contract_number ? String(item.contract_number) : undefined,
        contractValueCents: item.contract_value_cents == null ? undefined : numberValue(item.contract_value_cents),
        billingBasis: String(item.billing_basis),
        isConstructionService: Boolean(item.is_construction_service),
        startsAt: item.starts_at ? String(item.starts_at) : undefined,
        endsAt: item.ends_at ? String(item.ends_at) : undefined,
        status: String(item.status),
      })),
    };
  });
}

export async function createSubcontractor(input: {
  organizationId: string;
  userId: string;
  companyName: string;
  businessId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  liabilityDocumentsValidUntil?: string;
  insuranceValidUntil?: string;
  notes?: string;
}): Promise<string> {
  const { data, error } = await supabase.from('subcontractors').insert({
    organization_id: input.organizationId,
    company_name: input.companyName.trim(),
    business_id: input.businessId?.trim() || null,
    contact_name: input.contactName?.trim() || null,
    contact_email: input.contactEmail?.trim() || null,
    contact_phone: input.contactPhone?.trim() || null,
    liability_documents_valid_until: input.liabilityDocumentsValidUntil || null,
    insurance_valid_until: input.insuranceValidUntil || null,
    notes: input.notes?.trim() || null,
    created_by: input.userId,
  }).select('id').single();
  if (error) throw new Error(`Alihankkijan tallennus epäonnistui: ${error.message}`);
  return String(data.id);
}

export async function createSubcontractorWorker(input: {
  organizationId: string;
  subcontractorId: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  taxNumber?: string;
  employmentCategory?: string;
  validFrom?: string;
  validUntil?: string;
}): Promise<void> {
  const { error } = await supabase.from('subcontractor_workers').insert({
    organization_id: input.organizationId,
    subcontractor_id: input.subcontractorId,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    tax_number: input.taxNumber?.trim() || null,
    employment_category: input.employmentCategory || 'subcontractor_employee',
    valid_from: input.validFrom || null,
    valid_until: input.validUntil || null,
    created_by: input.userId,
  });
  if (error) throw new Error(`Alihankkijan työntekijän tallennus epäonnistui: ${error.message}`);
}

export async function createSubcontractorAssignment(input: {
  organizationId: string;
  subcontractorId: string;
  projectId: string;
  userId: string;
  contractNumber?: string;
  contractValueCents?: number;
  billingBasis: string;
  isConstructionService: boolean;
  startsAt?: string;
  endsAt?: string;
}): Promise<void> {
  const { error } = await supabase.from('subcontractor_project_assignments').insert({
    organization_id: input.organizationId,
    subcontractor_id: input.subcontractorId,
    project_id: input.projectId,
    contract_number: input.contractNumber?.trim() || null,
    contract_value_cents: input.contractValueCents ?? null,
    billing_basis: input.billingBasis,
    is_construction_service: input.isConstructionService,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    created_by: input.userId,
  });
  if (error) throw new Error(`Projektikytkennän tallennus epäonnistui: ${error.message}`);
}

export async function syncBillingItems(organizationId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sync_workinfo_billing_items', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Laskutusrivien muodostaminen epäonnistui: ${error.message}`);
  return numberValue(data);
}

export async function listBillingItems(organizationId: string): Promise<BillingItem[]> {
  const { data, error } = await supabase
    .from('billing_items')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(`Laskutusrivien haku epäonnistui: ${error.message}`);
  return (data ?? []).map((row) => mapBillingItem(row as Record<string, unknown>));
}

export async function updateBillingItemPrice(
  organizationId: string,
  itemId: string,
  unitPriceCents: number,
): Promise<void> {
  const { data, error } = await supabase
    .from('billing_items')
    .select('quantity')
    .eq('organization_id', organizationId)
    .eq('id', itemId)
    .single();
  if (error) throw new Error(`Laskutusrivin haku epäonnistui: ${error.message}`);
  const total = Math.round(numberValue(data.quantity) * unitPriceCents);
  const update = await supabase
    .from('billing_items')
    .update({ unit_price_cents: unitPriceCents, total_ex_vat_cents: total, status: 'billable' })
    .eq('organization_id', organizationId)
    .eq('id', itemId);
  if (update.error) throw new Error(`Laskutushinnan tallennus epäonnistui: ${update.error.message}`);
}

export async function transitionBillingItem(
  itemId: string,
  status: BillingStatus,
  invoiceReference?: string,
): Promise<BillingItem> {
  const { data, error } = await supabase.rpc('transition_workinfo_billing_item', {
    p_item_id: itemId,
    p_status: status,
    p_invoice_reference: invoiceReference ?? null,
  });
  if (error) throw new Error(`Laskutusrivin tilan muutos epäonnistui: ${error.message}`);
  return mapBillingItem(data as Record<string, unknown>);
}

export async function listLatestVehiclePositions(organizationId: string): Promise<VehiclePosition[]> {
  const { data, error } = await supabase
    .from('vehicle_positions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('recorded_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(`Ajoneuvosijaintien haku epäonnistui: ${error.message}`);
  const latest = new Map<string, VehiclePosition>();
  for (const row of data ?? []) {
    if (latest.has(row.equipment_id)) continue;
    latest.set(row.equipment_id, {
      id: String(row.id),
      organizationId: String(row.organization_id),
      equipmentId: String(row.equipment_id),
      projectId: row.project_id ? String(row.project_id) : undefined,
      driverUserId: row.driver_user_id ? String(row.driver_user_id) : undefined,
      latitude: numberValue(row.latitude),
      longitude: numberValue(row.longitude),
      accuracyM: row.accuracy_m == null ? undefined : numberValue(row.accuracy_m),
      speedKmh: row.speed_kmh == null ? undefined : numberValue(row.speed_kmh),
      headingDegrees: row.heading_degrees == null ? undefined : numberValue(row.heading_degrees),
      source: String(row.source),
      sourceReference: row.source_reference ? String(row.source_reference) : undefined,
      recordedAt: String(row.recorded_at),
    });
  }
  return [...latest.values()];
}

export async function createVehiclePosition(input: {
  organizationId: string;
  equipmentId: string;
  projectId?: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  source?: string;
  sourceReference?: string;
}): Promise<void> {
  const { error } = await supabase.from('vehicle_positions').insert({
    organization_id: input.organizationId,
    equipment_id: input.equipmentId,
    project_id: input.projectId ?? null,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy_m: input.accuracyM ?? null,
    source: input.source ?? 'manual',
    source_reference: input.sourceReference?.trim() || null,
    created_by: input.userId,
  });
  if (error) throw new Error(`Ajoneuvosijainnin tallennus epäonnistui: ${error.message}`);
}

export async function getConstructionReporting(
  organizationId: string,
  targetMonth: string,
  projectId?: string,
): Promise<ConstructionReportingData> {
  const { data, error } = await supabase.rpc('list_workinfo_construction_reporting', {
    p_organization_id: organizationId,
    p_target_month: `${targetMonth}-01`,
    p_project_id: projectId ?? null,
  });
  if (error) throw new Error(`Rakentamisraportin muodostaminen epäonnistui: ${error.message}`);
  const payload = (data ?? {}) as Partial<ConstructionReportingData>;
  return {
    targetMonth: String(payload.targetMonth ?? `${targetMonth}-01`),
    workerRows: Array.isArray(payload.workerRows) ? payload.workerRows : [],
    subcontractorWorkerRows: Array.isArray(payload.subcontractorWorkerRows) ? payload.subcontractorWorkerRows : [],
    contractRows: Array.isArray(payload.contractRows) ? payload.contractRows : [],
  };
}

export async function recordConstructionExport(input: {
  organizationId: string;
  userId: string;
  reportType: 'worker_data' | 'contract_data';
  targetMonth: string;
  projectId?: string;
  rowCount: number;
}): Promise<void> {
  const { error } = await supabase.from('construction_reporting_exports').insert({
    organization_id: input.organizationId,
    report_type: input.reportType,
    target_month: `${input.targetMonth}-01`,
    project_id: input.projectId ?? null,
    row_count: input.rowCount,
    generated_by: input.userId,
  });
  if (error) throw new Error(`Raportin audit-tallennus epäonnistui: ${error.message}`);
}
