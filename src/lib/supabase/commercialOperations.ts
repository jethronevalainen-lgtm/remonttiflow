import { supabase } from './client';

export type BillingStatus = 'recorded' | 'approved' | 'billable' | 'queued' | 'invoiced' | 'credited' | 'rejected';

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
  workDays?: number;
  workHours?: number;
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
  thresholdCents: number;
  workerRows: ConstructionWorkerRow[];
  subcontractorWorkerRows: ConstructionWorkerRow[];
  contractRows: ConstructionContractRow[];
}

type DbRow = Record<string, unknown>;

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalString(value: unknown): string | undefined {
  return value == null || value === '' ? undefined : String(value);
}

function mapBillingItem(row: DbRow): BillingItem {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    customerId: optionalString(row.customer_id),
    projectId: String(row.project_id),
    workOrderId: optionalString(row.work_order_id),
    sourceType: String(row.source_type),
    sourceId: optionalString(row.source_id),
    description: String(row.description),
    quantity: numberValue(row.quantity),
    unit: String(row.unit),
    unitPriceCents: row.unit_price_cents == null ? undefined : numberValue(row.unit_price_cents),
    vatRate: numberValue(row.vat_rate),
    totalExVatCents: row.total_ex_vat_cents == null ? undefined : numberValue(row.total_ex_vat_cents),
    status: row.status as BillingStatus,
    invoiceReference: optionalString(row.invoice_reference),
    createdAt: String(row.created_at),
  };
}

function rpcRecord(data: unknown): DbRow {
  if (Array.isArray(data)) return (data[0] ?? {}) as DbRow;
  return (data ?? {}) as DbRow;
}

export async function listSubcontractors(organizationId: string): Promise<Subcontractor[]> {
  const [companies, workers, assignments] = await Promise.all([
    supabase.from('subcontractors').select('*').eq('organization_id', organizationId).is('archived_at', null).order('company_name'),
    supabase.from('subcontractor_workers').select('*').eq('organization_id', organizationId).order('name'),
    supabase.from('subcontractor_project_assignments').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
  ]);
  const error = companies.error ?? workers.error ?? assignments.error;
  if (error) throw new Error(`Alihankkijoiden haku epäonnistui: ${error.message}`);

  return (companies.data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    companyName: String(row.company_name),
    businessId: optionalString(row.business_id),
    contactName: optionalString(row.contact_name),
    contactEmail: optionalString(row.contact_email),
    contactPhone: optionalString(row.contact_phone),
    status: String(row.status),
    liabilityDocumentsValidUntil: optionalString(row.liability_documents_valid_until),
    insuranceValidUntil: optionalString(row.insurance_valid_until),
    notes: optionalString(row.notes),
    workers: (workers.data ?? []).filter((item) => item.subcontractor_id === row.id).map((item) => ({
      id: String(item.id),
      subcontractorId: String(item.subcontractor_id),
      name: String(item.name),
      email: optionalString(item.email),
      phone: optionalString(item.phone),
      taxNumber: optionalString(item.tax_number),
      employmentCategory: String(item.employment_category),
      validFrom: optionalString(item.valid_from),
      validUntil: optionalString(item.valid_until),
      status: String(item.status),
    })),
    assignments: (assignments.data ?? []).filter((item) => item.subcontractor_id === row.id).map((item) => ({
      id: String(item.id),
      subcontractorId: String(item.subcontractor_id),
      projectId: String(item.project_id),
      contractNumber: optionalString(item.contract_number),
      contractValueCents: item.contract_value_cents == null ? undefined : numberValue(item.contract_value_cents),
      billingBasis: String(item.billing_basis),
      isConstructionService: Boolean(item.is_construction_service),
      startsAt: optionalString(item.starts_at),
      endsAt: optionalString(item.ends_at),
      status: String(item.status),
    })),
  }));
}

export async function createSubcontractor(input: {
  organizationId: string;
  companyName: string;
  businessId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  liabilityDocumentsValidUntil?: string;
  insuranceValidUntil?: string;
  notes?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_subcontractor', {
    p_organization_id: input.organizationId,
    p_company_name: input.companyName,
    p_business_id: input.businessId || null,
    p_contact_name: input.contactName || null,
    p_contact_email: input.contactEmail || null,
    p_contact_phone: input.contactPhone || null,
    p_liability_documents_valid_until: input.liabilityDocumentsValidUntil || null,
    p_insurance_valid_until: input.insuranceValidUntil || null,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(`Alihankkijan tallennus epäonnistui: ${error.message}`);
  return String(data);
}

export async function createSubcontractorWorker(input: {
  organizationId: string;
  subcontractorId: string;
  name: string;
  email?: string;
  phone?: string;
  taxNumber?: string;
  employmentCategory?: string;
  validFrom?: string;
  validUntil?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_subcontractor_worker', {
    p_organization_id: input.organizationId,
    p_subcontractor_id: input.subcontractorId,
    p_name: input.name,
    p_email: input.email || null,
    p_phone: input.phone || null,
    p_tax_number: input.taxNumber || null,
    p_employment_category: input.employmentCategory || 'subcontractor_employee',
    p_valid_from: input.validFrom || null,
    p_valid_until: input.validUntil || null,
  });
  if (error) throw new Error(`Alihankkijan työntekijän tallennus epäonnistui: ${error.message}`);
  return String(data);
}

export async function createSubcontractorAssignment(input: {
  organizationId: string;
  subcontractorId: string;
  projectId: string;
  contractNumber?: string;
  contractValueCents?: number;
  billingBasis: string;
  isConstructionService: boolean;
  startsAt?: string;
  endsAt?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_subcontractor_assignment', {
    p_organization_id: input.organizationId,
    p_subcontractor_id: input.subcontractorId,
    p_project_id: input.projectId,
    p_contract_number: input.contractNumber || null,
    p_contract_value_cents: input.contractValueCents ?? null,
    p_billing_basis: input.billingBasis,
    p_is_construction_service: input.isConstructionService,
    p_starts_at: input.startsAt || null,
    p_ends_at: input.endsAt || null,
  });
  if (error) throw new Error(`Projektikytkennän tallennus epäonnistui: ${error.message}`);
  return String(data);
}

export async function listBillingItems(organizationId: string): Promise<BillingItem[]> {
  const { data, error } = await supabase.from('billing_items').select('*')
    .eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(`Laskutusrivien haku epäonnistui: ${error.message}`);
  return (data ?? []).map((row) => mapBillingItem(row as DbRow));
}

export async function syncBillingItems(organizationId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sync_billing_items', { p_organization_id: organizationId });
  if (error) throw new Error(`Laskutusrivien muodostaminen epäonnistui: ${error.message}`);
  return numberValue(data);
}

export async function setBillingItemPrice(itemId: string, unitPriceCents: number): Promise<BillingItem> {
  const { data, error } = await supabase.rpc('set_billing_item_price', {
    p_item_id: itemId,
    p_unit_price_cents: unitPriceCents,
  });
  if (error) throw new Error(`Laskutushinnan tallennus epäonnistui: ${error.message}`);
  return mapBillingItem(rpcRecord(data));
}

export async function transitionBillingItem(
  itemId: string,
  status: BillingStatus,
  invoiceReference?: string,
): Promise<BillingItem> {
  const { data, error } = await supabase.rpc('transition_billing_item', {
    p_item_id: itemId,
    p_status: status,
    p_invoice_reference: invoiceReference || null,
  });
  if (error) throw new Error(`Laskutusrivin tilan muutos epäonnistui: ${error.message}`);
  return mapBillingItem(rpcRecord(data));
}

export async function listLatestVehiclePositions(organizationId: string): Promise<VehiclePosition[]> {
  const { data, error } = await supabase.from('vehicle_positions').select('*')
    .eq('organization_id', organizationId).order('recorded_at', { ascending: false }).limit(500);
  if (error) throw new Error(`Ajoneuvosijaintien haku epäonnistui: ${error.message}`);
  const latest = new Map<string, VehiclePosition>();
  for (const row of data ?? []) {
    if (latest.has(row.equipment_id)) continue;
    latest.set(row.equipment_id, {
      id: String(row.id),
      organizationId: String(row.organization_id),
      equipmentId: String(row.equipment_id),
      projectId: optionalString(row.project_id),
      driverUserId: optionalString(row.driver_user_id),
      latitude: numberValue(row.latitude),
      longitude: numberValue(row.longitude),
      accuracyM: row.accuracy_m == null ? undefined : numberValue(row.accuracy_m),
      speedKmh: row.speed_kmh == null ? undefined : numberValue(row.speed_kmh),
      headingDegrees: row.heading_degrees == null ? undefined : numberValue(row.heading_degrees),
      source: String(row.source),
      sourceReference: optionalString(row.source_reference),
      recordedAt: String(row.recorded_at),
    });
  }
  return [...latest.values()];
}

export async function recordVehiclePosition(input: {
  organizationId: string;
  equipmentId: string;
  projectId?: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  source?: 'manual' | 'device' | 'mapon' | 'integration';
  sourceReference?: string;
  speedKmh?: number;
  headingDegrees?: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('record_vehicle_position', {
    p_organization_id: input.organizationId,
    p_equipment_id: input.equipmentId,
    p_project_id: input.projectId || null,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_m: input.accuracyM ?? null,
    p_source: input.source || 'manual',
    p_source_reference: input.sourceReference || null,
    p_speed_kmh: input.speedKmh ?? null,
    p_heading_degrees: input.headingDegrees ?? null,
  });
  if (error) throw new Error(`Ajoneuvosijainnin tallennus epäonnistui: ${error.message}`);
  return String(data);
}

export async function getConstructionReporting(
  organizationId: string,
  targetMonth: string,
  projectId?: string,
): Promise<ConstructionReportingData> {
  const { data, error } = await supabase.rpc('list_construction_reporting', {
    p_organization_id: organizationId,
    p_target_month: `${targetMonth}-01`,
    p_project_id: projectId || null,
  });
  if (error) throw new Error(`Rakentamisraportin muodostaminen epäonnistui: ${error.message}`);
  const payload = (data ?? {}) as Partial<ConstructionReportingData>;
  return {
    targetMonth: String(payload.targetMonth ?? `${targetMonth}-01`),
    thresholdCents: numberValue(payload.thresholdCents),
    workerRows: Array.isArray(payload.workerRows) ? payload.workerRows : [],
    subcontractorWorkerRows: Array.isArray(payload.subcontractorWorkerRows) ? payload.subcontractorWorkerRows : [],
    contractRows: Array.isArray(payload.contractRows) ? payload.contractRows : [],
  };
}

export async function recordConstructionExport(input: {
  organizationId: string;
  reportType: 'worker_data' | 'contract_data';
  targetMonth: string;
  projectId?: string;
  rowCount: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('record_construction_export', {
    p_organization_id: input.organizationId,
    p_report_type: input.reportType,
    p_target_month: `${input.targetMonth}-01`,
    p_project_id: input.projectId || null,
    p_row_count: input.rowCount,
  });
  if (error) throw new Error(`Raporttiviennin auditointi epäonnistui: ${error.message}`);
  return String(data);
}
