import { supabase } from '@/lib/supabase/client';

export type OperationalEntryType = 'mileage' | 'material' | 'equipment_usage' | 'daily_note';
export type OperationalEntryStatus = 'Odottaa' | 'Hyväksytty' | 'Hylätty';

export interface OperationalProjectOption {
  id: string;
  name: string;
  projectNumber: string | null;
  status: string;
}

export interface OperationalEquipmentOption {
  id: string;
  name: string;
  assetNumber: string | null;
  type: string;
  status: string;
  projectId: string | null;
}

export interface OperationalEntryCatalog {
  projects: OperationalProjectOption[];
  equipment: OperationalEquipmentOption[];
}

export interface OperationalEntry {
  id: string;
  userId: string;
  userName: string;
  projectId: string | null;
  projectName: string | null;
  workOrderId: string | null;
  workOrderTitle: string | null;
  equipmentId: string | null;
  equipmentName: string | null;
  entryType: OperationalEntryType;
  occurredOn: string;
  title: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  distanceKm: number | null;
  durationHours: number | null;
  meterStart: number | null;
  meterEnd: number | null;
  amountCents: number | null;
  startLocation: string | null;
  endLocation: string | null;
  status: OperationalEntryStatus;
  rejectionReason: string | null;
  createdAt: string;
  approvedAt: string | null;
}

export interface CreateOperationalEntryInput {
  organizationId: string;
  entryType: OperationalEntryType;
  occurredOn: string;
  projectId?: string | null;
  workOrderId?: string | null;
  equipmentId?: string | null;
  title?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  distanceKm?: number | null;
  durationHours?: number | null;
  meterStart?: number | null;
  meterEnd?: number | null;
  amountCents?: number | null;
  startLocation?: string | null;
  endLocation?: string | null;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function array(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function loadOperationalEntryCatalog(organizationId: string): Promise<OperationalEntryCatalog> {
  const { data, error } = await supabase.rpc('operational_entry_catalog', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Kirjausten valintatietojen lataus epäonnistui: ${error.message}`);
  const root = object(data);
  return {
    projects: array(root.projects).map((row): OperationalProjectOption => ({
      id: text(row.id),
      name: text(row.name),
      projectNumber: nullableText(row.projectNumber),
      status: text(row.status),
    })).filter((item) => item.id),
    equipment: array(root.equipment).map((row): OperationalEquipmentOption => ({
      id: text(row.id),
      name: text(row.name),
      assetNumber: nullableText(row.assetNumber),
      type: text(row.type),
      status: text(row.status),
      projectId: nullableText(row.projectId),
    })).filter((item) => item.id),
  };
}

export async function createOperationalEntry(input: CreateOperationalEntryInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_operational_entry', {
    p_organization_id: input.organizationId,
    p_entry_type: input.entryType,
    p_occurred_on: input.occurredOn,
    p_project_id: input.projectId || null,
    p_work_order_id: input.workOrderId || null,
    p_equipment_id: input.equipmentId || null,
    p_title: input.title || null,
    p_description: input.description || null,
    p_quantity: input.quantity ?? null,
    p_unit: input.unit || null,
    p_distance_km: input.distanceKm ?? null,
    p_duration_hours: input.durationHours ?? null,
    p_meter_start: input.meterStart ?? null,
    p_meter_end: input.meterEnd ?? null,
    p_amount_cents: input.amountCents ?? null,
    p_start_location: input.startLocation || null,
    p_end_location: input.endLocation || null,
  });
  if (error) throw new Error(`Kirjauksen tallennus epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Palvelin ei palauttanut kirjauksen tunnistetta.');
  return data;
}

export async function loadOperationalEntries(values: {
  organizationId: string;
  entryType?: OperationalEntryType | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  projectId?: string | null;
  status?: OperationalEntryStatus | null;
}): Promise<OperationalEntry[]> {
  const { data, error } = await supabase.rpc('operational_entries_for_user', {
    p_organization_id: values.organizationId,
    p_entry_type: values.entryType || null,
    p_date_from: values.dateFrom || null,
    p_date_to: values.dateTo || null,
    p_project_id: values.projectId || null,
    p_status: values.status || null,
  });
  if (error) throw new Error(`Kirjausten haku epäonnistui: ${error.message}`);
  return array(data).map((row): OperationalEntry => ({
    id: text(row.id),
    userId: text(row.user_id),
    userName: text(row.user_name),
    projectId: nullableText(row.project_id),
    projectName: nullableText(row.project_name),
    workOrderId: nullableText(row.work_order_id),
    workOrderTitle: nullableText(row.work_order_title),
    equipmentId: nullableText(row.equipment_id),
    equipmentName: nullableText(row.equipment_name),
    entryType: text(row.entry_type) as OperationalEntryType,
    occurredOn: text(row.occurred_on),
    title: nullableText(row.title),
    description: nullableText(row.description),
    quantity: nullableNumber(row.quantity),
    unit: nullableText(row.unit),
    distanceKm: nullableNumber(row.distance_km),
    durationHours: nullableNumber(row.duration_hours),
    meterStart: nullableNumber(row.meter_start),
    meterEnd: nullableNumber(row.meter_end),
    amountCents: nullableNumber(row.amount_cents),
    startLocation: nullableText(row.start_location),
    endLocation: nullableText(row.end_location),
    status: text(row.status) as OperationalEntryStatus,
    rejectionReason: nullableText(row.rejection_reason),
    createdAt: text(row.created_at),
    approvedAt: nullableText(row.approved_at),
  })).filter((item) => item.id);
}

export async function decideOperationalEntry(values: {
  organizationId: string;
  entryId: string;
  status: Extract<OperationalEntryStatus, 'Hyväksytty' | 'Hylätty'>;
  rejectionReason?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('decide_operational_entry', {
    p_organization_id: values.organizationId,
    p_entry_id: values.entryId,
    p_status: values.status,
    p_rejection_reason: values.rejectionReason || null,
  });
  if (error) throw new Error(`Kirjauksen päätös epäonnistui: ${error.message}`);
}
