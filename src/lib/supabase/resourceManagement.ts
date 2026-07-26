import { supabase } from './client';

type Row = Record<string, unknown>;

function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tietueen.');
  }
  return value as Row;
}

function text(item: Row, key: string): string {
  return typeof item[key] === 'string' ? item[key] as string : '';
}

function optionalText(item: Row, key: string): string | undefined {
  return text(item, key) || undefined;
}

function numberValue(item: Row, key: string): number {
  const value = item[key];
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface EmployeeCertification {
  id: string;
  employeeId: string;
  certificationType: string;
  certificationNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
  issuer?: string;
  attachmentPath?: string;
  notes?: string;
  createdAt: string;
}

export interface EmployeeAbsence {
  id: string;
  employeeId: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  status: string;
  notes?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface EquipmentReservation {
  id: string;
  equipmentId: string;
  projectId?: string;
  reservedForUserId?: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface EquipmentMaintenance {
  id: string;
  equipmentId: string;
  maintenanceType: string;
  status: string;
  scheduledAt?: string;
  completedAt?: string;
  costCents: number;
  provider?: string;
  description?: string;
  attachmentPath?: string;
  createdAt: string;
}

async function listRows(table: string, organizationId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`${table}-tietojen haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(row);
}

export async function loadResourceManagement(organizationId: string) {
  const [certifications, absences, reservations, maintenance] = await Promise.all([
    listRows('employee_certifications', organizationId),
    listRows('employee_absences', organizationId),
    listRows('equipment_reservations', organizationId),
    listRows('equipment_maintenance', organizationId),
  ]);

  return {
    certifications: certifications.map((item): EmployeeCertification => ({
      id: text(item, 'id'),
      employeeId: text(item, 'employee_id'),
      certificationType: text(item, 'certification_type'),
      certificationNumber: optionalText(item, 'certification_number'),
      issuedAt: optionalText(item, 'issued_at'),
      expiresAt: optionalText(item, 'expires_at'),
      issuer: optionalText(item, 'issuer'),
      attachmentPath: optionalText(item, 'attachment_path'),
      notes: optionalText(item, 'notes'),
      createdAt: text(item, 'created_at'),
    })),
    absences: absences.map((item): EmployeeAbsence => ({
      id: text(item, 'id'),
      employeeId: text(item, 'employee_id'),
      absenceType: text(item, 'absence_type'),
      startDate: text(item, 'start_date'),
      endDate: text(item, 'end_date'),
      status: text(item, 'status'),
      notes: optionalText(item, 'notes'),
      approvedBy: optionalText(item, 'approved_by'),
      createdAt: text(item, 'created_at'),
    })),
    reservations: reservations.map((item): EquipmentReservation => ({
      id: text(item, 'id'),
      equipmentId: text(item, 'equipment_id'),
      projectId: optionalText(item, 'project_id'),
      reservedForUserId: optionalText(item, 'reserved_for_user_id'),
      startsAt: text(item, 'starts_at'),
      endsAt: text(item, 'ends_at'),
      status: text(item, 'status'),
      notes: optionalText(item, 'notes'),
      createdAt: text(item, 'created_at'),
    })),
    maintenance: maintenance.map((item): EquipmentMaintenance => ({
      id: text(item, 'id'),
      equipmentId: text(item, 'equipment_id'),
      maintenanceType: text(item, 'maintenance_type'),
      status: text(item, 'status'),
      scheduledAt: optionalText(item, 'scheduled_at'),
      completedAt: optionalText(item, 'completed_at'),
      costCents: numberValue(item, 'cost_cents'),
      provider: optionalText(item, 'provider'),
      description: optionalText(item, 'description'),
      attachmentPath: optionalText(item, 'attachment_path'),
      createdAt: text(item, 'created_at'),
    })),
  };
}

export async function createEmployeeCertification(input: {
  organizationId: string;
  employeeId: string;
  userId?: string;
  certificationType: string;
  certificationNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
  issuer?: string;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('employee_certifications').insert({
    organization_id: input.organizationId,
    employee_id: input.employeeId,
    created_by: input.userId,
    certification_type: input.certificationType.trim(),
    certification_number: input.certificationNumber?.trim() || null,
    issued_at: input.issuedAt || null,
    expires_at: input.expiresAt || null,
    issuer: input.issuer?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error(`Pätevyyden tallennus epäonnistui: ${error.message}`);
}

export async function deleteEmployeeCertification(
  organizationId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('employee_certifications')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Pätevyyden poistaminen epäonnistui: ${error.message}`);
}

export async function createEmployeeAbsence(input: {
  organizationId: string;
  employeeId: string;
  userId?: string;
  approvedBy?: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  status?: string;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('employee_absences').insert({
    organization_id: input.organizationId,
    employee_id: input.employeeId,
    created_by: input.userId,
    approved_by: input.approvedBy || null,
    absence_type: input.absenceType.trim(),
    start_date: input.startDate,
    end_date: input.endDate,
    status: input.status ?? 'Hyväksytty',
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error(`Poissaolon tallennus epäonnistui: ${error.message}`);
}

export async function deleteEmployeeAbsence(
  organizationId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('employee_absences')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Poissaolon poistaminen epäonnistui: ${error.message}`);
}

export async function createEquipmentReservation(input: {
  organizationId: string;
  equipmentId: string;
  projectId?: string;
  reservedForUserId?: string;
  userId?: string;
  startsAt: string;
  endsAt: string;
  status?: string;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('equipment_reservations').insert({
    organization_id: input.organizationId,
    equipment_id: input.equipmentId,
    project_id: input.projectId || null,
    reserved_for_user_id: input.reservedForUserId || null,
    created_by: input.userId,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    status: input.status ?? 'Varattu',
    notes: input.notes?.trim() || null,
  });
  if (error?.code === '23P01') {
    throw new Error('Kalusto on jo varattu valitulla ajalla.');
  }
  if (error) throw new Error(`Kalustovarauksen tallennus epäonnistui: ${error.message}`);
}

export async function deleteEquipmentReservation(
  organizationId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('equipment_reservations')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Kalustovarauksen poistaminen epäonnistui: ${error.message}`);
}

export async function createEquipmentMaintenance(input: {
  organizationId: string;
  equipmentId: string;
  userId?: string;
  maintenanceType: string;
  status?: string;
  scheduledAt?: string;
  completedAt?: string;
  costCents?: number;
  provider?: string;
  description?: string;
}): Promise<void> {
  const { error } = await supabase.from('equipment_maintenance').insert({
    organization_id: input.organizationId,
    equipment_id: input.equipmentId,
    created_by: input.userId,
    maintenance_type: input.maintenanceType.trim(),
    status: input.status ?? 'Suunniteltu',
    scheduled_at: input.scheduledAt || null,
    completed_at: input.completedAt || null,
    cost_cents: input.costCents ?? 0,
    provider: input.provider?.trim() || null,
    description: input.description?.trim() || null,
  });
  if (error) throw new Error(`Huollon tallennus epäonnistui: ${error.message}`);
}

export async function deleteEquipmentMaintenance(
  organizationId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('equipment_maintenance')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Huollon poistaminen epäonnistui: ${error.message}`);
}
