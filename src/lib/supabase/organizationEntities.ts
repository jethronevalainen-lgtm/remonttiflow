import { supabase } from './client';
import type { Employee, Equipment } from '@/types';

type EntityTable = 'employees' | 'equipment';
type Payload = Record<string, unknown>;

async function insert(table: EntityTable, payload: Payload): Promise<void> {
  const { error } = await supabase.from(table).insert(payload);
  if (error) throw new Error(`Tallennus epäonnistui: ${error.message}`);
}

async function update(
  table: EntityTable,
  organizationId: string,
  id: string,
  payload: Payload,
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) throw new Error(`Päivitys epäonnistui: ${error.message}`);
}

async function remove(table: EntityTable, organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) throw new Error(`Poistaminen epäonnistui: ${error.message}`);
}

function employeePayload(employee: Omit<Employee, 'id'> | Partial<Employee>): Payload {
  const payload: Payload = {};
  if (employee.userId !== undefined) payload.user_id = employee.userId || null;
  if (employee.name !== undefined) payload.name = employee.name;
  if (employee.role !== undefined) payload.role = employee.role;
  if (employee.department !== undefined) payload.department = employee.department;
  if (employee.phone !== undefined) payload.phone = employee.phone || null;
  if (employee.email !== undefined) payload.email = employee.email || null;
  if (employee.startDate !== undefined) payload.start_date = employee.startDate || null;
  if (employee.status !== undefined) payload.status = employee.status;
  if (employee.hourlyCostCents !== undefined) payload.hourly_cost_cents = employee.hourlyCostCents ?? 0;
  if (employee.employmentType !== undefined) payload.employment_type = employee.employmentType || null;
  if (employee.emergencyContactName !== undefined) {
    payload.emergency_contact_name = employee.emergencyContactName || null;
  }
  if (employee.emergencyContactPhone !== undefined) {
    payload.emergency_contact_phone = employee.emergencyContactPhone || null;
  }
  if (employee.archivedAt !== undefined) payload.archived_at = employee.archivedAt || null;
  return payload;
}

function equipmentPayload(equipment: Omit<Equipment, 'id'> | Partial<Equipment>): Payload {
  const payload: Payload = {};
  if (equipment.name !== undefined) payload.name = equipment.name;
  if (equipment.type !== undefined) payload.type = equipment.type;
  if (equipment.serial !== undefined) payload.serial = equipment.serial || null;
  if (equipment.location !== undefined) payload.location = equipment.location || null;
  if (equipment.status !== undefined) payload.status = equipment.status;
  if (equipment.lastMaintenance !== undefined) {
    payload.last_maintenance = equipment.lastMaintenance || null;
  }
  if (equipment.assetNumber !== undefined) payload.asset_number = equipment.assetNumber || null;
  if (equipment.model !== undefined) payload.model = equipment.model || null;
  if (equipment.year !== undefined) payload.manufacture_year = equipment.year ?? null;
  if (equipment.acquisitionCostCents !== undefined) {
    payload.acquisition_cost_cents = equipment.acquisitionCostCents ?? 0;
  }
  if (equipment.hourlyCostCents !== undefined) payload.hourly_cost_cents = equipment.hourlyCostCents ?? 0;
  if (equipment.nextMaintenance !== undefined) {
    payload.next_maintenance = equipment.nextMaintenance || null;
  }
  if (equipment.currentProjectId !== undefined) {
    payload.current_project_id = equipment.currentProjectId || null;
  }
  if (equipment.responsibleUserId !== undefined) {
    payload.responsible_user_id = equipment.responsibleUserId || null;
  }
  if (equipment.archivedAt !== undefined) payload.archived_at = equipment.archivedAt || null;
  return payload;
}

export async function createEmployeeRecord(
  organizationId: string,
  createdBy: string | undefined,
  employee: Omit<Employee, 'id'>,
): Promise<void> {
  await insert('employees', {
    organization_id: organizationId,
    ...(createdBy ? { created_by: createdBy } : {}),
    ...employeePayload(employee),
  });
}

export async function updateEmployeeRecord(
  organizationId: string,
  id: string,
  updates: Partial<Employee>,
): Promise<void> {
  await update('employees', organizationId, id, employeePayload(updates));
}

export async function deleteEmployeeRecord(organizationId: string, id: string): Promise<void> {
  await remove('employees', organizationId, id);
}

export async function createEquipmentRecord(
  organizationId: string,
  createdBy: string | undefined,
  equipment: Omit<Equipment, 'id'>,
): Promise<void> {
  await insert('equipment', {
    organization_id: organizationId,
    ...(createdBy ? { created_by: createdBy } : {}),
    ...equipmentPayload(equipment),
  });
}

export async function updateEquipmentRecord(
  organizationId: string,
  id: string,
  updates: Partial<Equipment>,
): Promise<void> {
  await update('equipment', organizationId, id, equipmentPayload(updates));
}

export async function deleteEquipmentRecord(organizationId: string, id: string): Promise<void> {
  await remove('equipment', organizationId, id);
}
