import { supabase } from '@/lib/supabase/client';

export type BillingStatus = 'recorded' | 'approved' | 'billable' | 'queued' | 'invoiced' | 'credited' | 'rejected';

export interface OperationsProject {
  id: string;
  name: string;
  projectNumber: string | null;
  location: string | null;
  customerId: string | null;
  defaultBillingRateCents: number | null;
  constructionReportingEnabled: boolean;
  sharedConstructionSite: boolean;
}

export interface OperationsEquipment {
  id: string;
  name: string;
  type: string;
  assetNumber: string | null;
  currentProjectId: string | null;
}

export interface SubcontractorWorker {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxNumber: string | null;
  employmentCategory: string;
  validFrom: string | null;
  validUntil: string | null;
  status: string;
}

export interface SubcontractorAssignment {
  id: string;
  projectId: string;
  contractNumber: string | null;
  contractValueCents: number | null;
  billingBasis: string;
  isConstructionService: boolean;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
}

export interface Subcontractor {
  id: string;
  companyName: string;
  businessId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  liabilityDocumentsValidUntil: string | null;
  insuranceValidUntil: string | null;
  notes: string | null;
  workers: SubcontractorWorker[];
  assignments: SubcontractorAssignment[];
}

export interface BillingItem {
  id: string;
  customerId: string | null;
  projectId: string;
  workOrderId: string | null;
  sourceType: string;
  sourceId: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number | null;
  vatRate: number;
  totalExVatCents: number | null;
  status: BillingStatus;
  invoiceReference: string | null;
  createdAt: string;
}

export interface VehiclePosition {
  id: string;
  equipmentId: string;
  projectId: string | null;
  driverUserId: string | null;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  speedKmh: number | null;
  headingDegrees: number | null;
  source: string;
  externalDeviceId: string | null;
  sourceReference: string | null;
  recordedAt: string;
}

export interface BusinessOperationsData {
  projects: OperationsProject[];
  equipment: OperationsEquipment[];
  subcontractors: Subcontractor[];
  billingItems: BillingItem[];
  vehiclePositions: VehiclePosition[];
  summary: {
    activeSubcontractors: number;
    billableCents: number;
    queuedCents: number;
    invoicedCents: number;
    trackedVehicles: number;
  };
}

export interface ConstructionWorkerRow {
  projectId: string;
  projectName: string;
  siteLocation: string | null;
  userId?: string;
  workerName: string;
  taxNumber: string | null;
  employmentCategory: string;
  employerName?: string;
  employerBusinessId?: string | null;
  firstWorkDate?: string;
  lastWorkDate?: string;
  validFrom?: string | null;
  validUntil?: string | null;
  sharedConstructionSite: boolean;
}

export interface ConstructionContractRow {
  projectId: string;
  projectName: string;
  siteLocation: string | null;
  subcontractorName: string;
  businessId: string | null;
  contractNumber: string | null;
  contractValueCents: number | null;
  billingBasis: string;
  isConstructionService: boolean;
  startsAt: string | null;
  endsAt: string | null;
  reportingThresholdExceeded: boolean;
}

export interface ConstructionReportingData {
  targetMonth: string;
  workerRows: ConstructionWorkerRow[];
  subcontractorWorkerRows: ConstructionWorkerRow[];
  contractRows: ConstructionContractRow[];
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadBusinessOperations(organizationId: string): Promise<BusinessOperationsData> {
  const { data, error } = await supabase.rpc('business_operations_data', { p_organization_id: organizationId });
  if (error) throw new Error(`Toiminnanohjauksen tietojen lataus epäonnistui: ${error.message}`);
  const root = object(data);
  const summary = object(root.summary);
  return {
    projects: array<OperationsProject>(root.projects),
    equipment: array<OperationsEquipment>(root.equipment),
    subcontractors: array<Subcontractor>(root.subcontractors),
    billingItems: array<BillingItem>(root.billingItems),
    vehiclePositions: array<VehiclePosition>(root.vehiclePositions),
    summary: {
      activeSubcontractors: numberValue(summary.activeSubcontractors),
      billableCents: numberValue(summary.billableCents),
      queuedCents: numberValue(summary.queuedCents),
      invoicedCents: numberValue(summary.invoicedCents),
      trackedVehicles: numberValue(summary.trackedVehicles),
    },
  };
}

async function rpcVoid(name: string, args: Record<string, unknown>, fallback: string): Promise<void> {
  const { error } = await supabase.rpc(name, args);
  if (error) throw new Error(`${fallback}: ${error.message}`);
}

export async function saveSubcontractor(organizationId: string, payload: Record<string, unknown>): Promise<void> {
  await rpcVoid('save_subcontractor', { p_organization_id: organizationId, p_payload: payload }, 'Alihankkijan tallennus epäonnistui');
}

export async function saveSubcontractorWorker(organizationId: string, payload: Record<string, unknown>): Promise<void> {
  await rpcVoid('save_subcontractor_worker', { p_organization_id: organizationId, p_payload: payload }, 'Työntekijän tallennus epäonnistui');
}

export async function saveSubcontractorAssignment(organizationId: string, payload: Record<string, unknown>): Promise<void> {
  await rpcVoid('save_subcontractor_assignment', { p_organization_id: organizationId, p_payload: payload }, 'Projektikytkennän tallennus epäonnistui');
}

export async function syncBillingItems(organizationId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sync_billing_items', { p_organization_id: organizationId });
  if (error) throw new Error(`Laskutusrivien muodostaminen epäonnistui: ${error.message}`);
  return numberValue(data);
}

export async function setBillingItemPrice(organizationId: string, itemId: string, unitPriceCents: number): Promise<void> {
  await rpcVoid('set_billing_item_price', {
    p_organization_id: organizationId,
    p_item_id: itemId,
    p_unit_price_cents: unitPriceCents,
  }, 'Laskutushinnan tallennus epäonnistui');
}

export async function transitionBillingItem(
  organizationId: string,
  itemId: string,
  status: BillingStatus,
  invoiceReference?: string,
): Promise<void> {
  await rpcVoid('transition_billing_item', {
    p_organization_id: organizationId,
    p_item_id: itemId,
    p_status: status,
    p_invoice_reference: invoiceReference || null,
  }, 'Laskutusrivin tilan muuttaminen epäonnistui');
}

export async function saveVehiclePosition(organizationId: string, payload: Record<string, unknown>): Promise<void> {
  await rpcVoid('save_vehicle_position', { p_organization_id: organizationId, p_payload: payload }, 'Ajoneuvosijainnin tallennus epäonnistui');
}

export async function loadConstructionReporting(
  organizationId: string,
  targetMonth: string,
  projectId?: string,
): Promise<ConstructionReportingData> {
  const { data, error } = await supabase.rpc('construction_reporting_data', {
    p_organization_id: organizationId,
    p_target_month: `${targetMonth}-01`,
    p_project_id: projectId || null,
  });
  if (error) throw new Error(`Rakentamisraportin muodostaminen epäonnistui: ${error.message}`);
  const root = object(data);
  return {
    targetMonth: String(root.targetMonth ?? `${targetMonth}-01`),
    workerRows: array<ConstructionWorkerRow>(root.workerRows),
    subcontractorWorkerRows: array<ConstructionWorkerRow>(root.subcontractorWorkerRows),
    contractRows: array<ConstructionContractRow>(root.contractRows),
  };
}

export async function recordConstructionExport(
  organizationId: string,
  reportType: 'worker_data' | 'contract_data',
  targetMonth: string,
  projectId: string | undefined,
  rowCount: number,
): Promise<void> {
  await rpcVoid('record_construction_export', {
    p_organization_id: organizationId,
    p_report_type: reportType,
    p_target_month: `${targetMonth}-01`,
    p_project_id: projectId || null,
    p_row_count: rowCount,
  }, 'Raportin audit-tallennus epäonnistui');
}
