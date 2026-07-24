import { supabase } from './client';
import type {
  Announcement,
  CrmLead,
  CrmLeadStage,
  Customer,
  CustomerStatus,
  CustomerType,
  DiaryEntry,
  DrivingLogEntry,
  Employee,
  EmployeeStatus,
  Equipment,
  EquipmentStatus,
  Message,
  Project,
  ProjectStatus,
  SafetyItem,
  SafetyItemSeverity,
  SafetyItemType,
  TimeEntry,
  TimeEntryStatus,
  WasteEntry,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
} from '@/types';

type Row = Record<string, unknown>;
type TableName =
  | 'projects'
  | 'work_orders'
  | 'time_entries'
  | 'employees'
  | 'equipment'
  | 'customers'
  | 'crm_leads'
  | 'diary_entries'
  | 'safety_items'
  | 'waste_entries'
  | 'driving_log_entries'
  | 'announcements'
  | 'messages';

export interface DomainData {
  projects: Project[];
  workOrders: WorkOrder[];
  timeEntries: TimeEntry[];
  employees: Employee[];
  equipment: Equipment[];
  customers: Customer[];
  crmLeads: CrmLead[];
  diaryEntries: DiaryEntry[];
  safetyItems: SafetyItem[];
  wasteEntries: WasteEntry[];
  drivingLog: DrivingLogEntry[];
  announcements: Announcement[];
  messages: Message[];
}

export const EMPTY_DOMAIN_DATA: DomainData = {
  projects: [],
  workOrders: [],
  timeEntries: [],
  employees: [],
  equipment: [],
  customers: [],
  crmLeads: [],
  diaryEntries: [],
  safetyItems: [],
  wasteEntries: [],
  drivingLog: [],
  announcements: [],
  messages: [],
};

function text(row: Row, key: string, fallback = ''): string {
  const value = row[key];
  return typeof value === 'string' ? value : fallback;
}

function optionalText(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(row: Row, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function booleanValue(row: Row, key: string, fallback = false): boolean {
  return typeof row[key] === 'boolean' ? row[key] : fallback;
}

function enumValue<T extends string>(row: Row, key: string, allowed: readonly T[], fallback: T): T {
  const value = row[key];
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function toIsoDate(value: string): string {
  const trimmed = value.trim();
  const finnish = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (finnish) {
    const [, day, month, year] = finnish;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return trimmed;
}

function toFinnishDate(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return iso ? `${Number(iso[3])}.${Number(iso[2])}.${iso[1]}` : value;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Tuntematon tietokantavirhe';
}

function ensureRow(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tietueen.');
  }
  return value as Row;
}

async function selectOrganizationRows(table: TableName, organizationId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId);

  if (error) {
    throw new Error(`${table}-tietojen haku epäonnistui: ${error.message}`);
  }
  return Array.isArray(data) ? data.map(ensureRow) : [];
}

async function insertRow(table: TableName, payload: Row): Promise<Row> {
  const { data, error } = await supabase.from(table).insert(payload).select('*').single();
  if (error) throw new Error(`Tallennus epäonnistui: ${error.message}`);
  return ensureRow(data);
}

async function updateRow(
  table: TableName,
  organizationId: string,
  id: string,
  payload: Row,
): Promise<Row> {
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select('*')
    .single();
  if (error) throw new Error(`Päivitys epäonnistui: ${error.message}`);
  return ensureRow(data);
}

async function deleteRow(table: TableName, organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) throw new Error(`Poistaminen epäonnistui: ${error.message}`);
}

const PROJECT_STATUSES = ['Aktiivinen', 'Suunniteltu', 'Valmis', 'Myöhässä'] as const;
const WORK_ORDER_PRIORITIES = ['Korkea', 'Normaali', 'Matala'] as const;
const WORK_ORDER_STATUSES = ['Avoin', 'Käynnissä', 'Odottaa', 'Valmis', 'Peruttu'] as const;
const TIME_ENTRY_STATUSES = ['Hyväksytty', 'Odottaa', 'Hylätty'] as const;
const EMPLOYEE_STATUSES = ['Aktiivinen', 'Lomalla', 'Sairas', 'Koulutuksessa', 'Eroonnut'] as const;
const EQUIPMENT_STATUSES = ['Käytössä', 'Vapaa', 'Huollossa', 'Vuokralla'] as const;
const CUSTOMER_TYPES = ['Yritys', 'Yksityinen', 'Taloyhtiö'] as const;
const CUSTOMER_STATUSES = ['Aktiivinen', 'Epäaktiivinen'] as const;
const CRM_STAGES = ['Uusi', 'Tarjous tehty', 'Neuvottelu', 'Sopimus'] as const;
const SAFETY_TYPES = ['incident', 'risk', 'inspection', 'training'] as const;
const SAFETY_SEVERITIES = ['Lievä', 'Keskitasoinen', 'Vakava'] as const;

export function mapProject(row: Row): Project {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    customer: text(row, 'customer'),
    status: enumValue<ProjectStatus>(row, 'status', PROJECT_STATUSES, 'Suunniteltu'),
    startDate: text(row, 'start_date'),
    endDate: text(row, 'end_date'),
    progress: numberValue(row, 'progress'),
    budget: numberValue(row, 'budget'),
    spent: numberValue(row, 'spent'),
    description: optionalText(row, 'description'),
    location: optionalText(row, 'location'),
  };
}

export function mapWorkOrder(row: Row): WorkOrder {
  return {
    id: text(row, 'id'),
    title: text(row, 'title'),
    project: text(row, 'project'),
    assignee: text(row, 'assignee'),
    dueDate: text(row, 'due_date'),
    priority: enumValue<WorkOrderPriority>(row, 'priority', WORK_ORDER_PRIORITIES, 'Normaali'),
    status: enumValue<WorkOrderStatus>(row, 'status', WORK_ORDER_STATUSES, 'Avoin'),
    description: optionalText(row, 'description'),
    type: optionalText(row, 'type'),
  };
}

export function mapTimeEntry(row: Row): TimeEntry {
  return {
    id: text(row, 'id'),
    date: toFinnishDate(text(row, 'date')),
    employee: text(row, 'employee'),
    project: text(row, 'project'),
    hours: numberValue(row, 'hours'),
    overtime: numberValue(row, 'overtime'),
    description: text(row, 'description'),
    status: enumValue<TimeEntryStatus>(row, 'status', TIME_ENTRY_STATUSES, 'Odottaa'),
  };
}

export function mapEmployee(row: Row): Employee {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    role: text(row, 'role'),
    department: text(row, 'department'),
    phone: text(row, 'phone'),
    email: text(row, 'email'),
    startDate: text(row, 'start_date'),
    status: enumValue<EmployeeStatus>(row, 'status', EMPLOYEE_STATUSES, 'Aktiivinen'),
    projects: 0,
    hours: 0,
    training: 0,
    certifications: [],
  };
}

export function mapEquipment(row: Row): Equipment {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    type: text(row, 'type'),
    serial: text(row, 'serial'),
    location: text(row, 'location'),
    status: enumValue<EquipmentStatus>(row, 'status', EQUIPMENT_STATUSES, 'Vapaa'),
    lastMaintenance: text(row, 'last_maintenance'),
  };
}

export function mapCustomer(row: Row): Customer {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    type: enumValue<CustomerType>(row, 'type', CUSTOMER_TYPES, 'Yritys'),
    contactPerson: text(row, 'contact_person'),
    phone: text(row, 'phone'),
    email: text(row, 'email'),
    address: text(row, 'address'),
    projectCount: numberValue(row, 'project_count'),
    lastContact: text(row, 'last_contact'),
    status: enumValue<CustomerStatus>(row, 'status', CUSTOMER_STATUSES, 'Aktiivinen'),
  };
}

export function mapCrmLead(row: Row): CrmLead {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    company: text(row, 'company'),
    value: numberValue(row, 'value'),
    stage: enumValue<CrmLeadStage>(row, 'stage', CRM_STAGES, 'Uusi'),
    assignee: text(row, 'assignee'),
    date: text(row, 'expected_date') || text(row, 'created_at').slice(0, 10),
  };
}

export function mapDiaryEntry(row: Row): DiaryEntry {
  return {
    id: text(row, 'id'),
    date: text(row, 'date'),
    project: text(row, 'project'),
    author: text(row, 'author'),
    weather: text(row, 'weather'),
    temperature: text(row, 'temperature', String(numberValue(row, 'temperature'))),
    workers: numberValue(row, 'workers'),
    workDescription: text(row, 'work_phases'),
    issues: optionalText(row, 'issues'),
  };
}

export function mapSafetyItem(row: Row): SafetyItem {
  const severity = row.severity;
  return {
    id: text(row, 'id'),
    type: enumValue<SafetyItemType>(row, 'type', SAFETY_TYPES, 'risk'),
    title: text(row, 'title'),
    date: text(row, 'date'),
    severity:
      typeof severity === 'string' && SAFETY_SEVERITIES.includes(severity as SafetyItemSeverity)
        ? (severity as SafetyItemSeverity)
        : undefined,
    status: text(row, 'status', 'Avoin'),
  };
}

export function mapWasteEntry(row: Row): WasteEntry {
  return {
    id: text(row, 'id'),
    date: text(row, 'date'),
    project: text(row, 'project'),
    wasteType: text(row, 'waste_type'),
    amount: numberValue(row, 'amount'),
    method: text(row, 'unit') || text(row, 'notes'),
    cost: numberValue(row, 'cost'),
  };
}

export function mapDrivingLogEntry(row: Row): DrivingLogEntry {
  return {
    id: text(row, 'id'),
    date: text(row, 'date'),
    driver: text(row, 'driver'),
    vehicle: '',
    startAddress: text(row, 'start_address'),
    endAddress: text(row, 'end_address'),
    distance: numberValue(row, 'distance_km'),
    purpose: text(row, 'purpose'),
  };
}

export function mapAnnouncement(row: Row): Announcement {
  return {
    id: text(row, 'id'),
    title: text(row, 'title'),
    content: text(row, 'content'),
    author: text(row, 'author'),
    date: text(row, 'published_at'),
    priority: enumValue(row, 'priority', ['Tärkeä', 'Normaali', 'Info'] as const, 'Normaali'),
  };
}

export function mapMessage(row: Row): Message {
  return {
    id: text(row, 'id'),
    sender: text(row, 'sender'),
    recipient: text(row, 'recipient'),
    content: text(row, 'content'),
    timestamp: text(row, 'sent_at'),
    read: booleanValue(row, 'read'),
  };
}

export async function loadDomainData(organizationId: string): Promise<DomainData> {
  try {
    const [
      projects,
      workOrders,
      timeEntries,
      employees,
      equipment,
      customers,
      crmLeads,
      diaryEntries,
      safetyItems,
      wasteEntries,
      drivingLog,
      announcements,
      messages,
    ] = await Promise.all([
      selectOrganizationRows('projects', organizationId),
      selectOrganizationRows('work_orders', organizationId),
      selectOrganizationRows('time_entries', organizationId),
      selectOrganizationRows('employees', organizationId),
      selectOrganizationRows('equipment', organizationId),
      selectOrganizationRows('customers', organizationId),
      selectOrganizationRows('crm_leads', organizationId),
      selectOrganizationRows('diary_entries', organizationId),
      selectOrganizationRows('safety_items', organizationId),
      selectOrganizationRows('waste_entries', organizationId),
      selectOrganizationRows('driving_log_entries', organizationId),
      selectOrganizationRows('announcements', organizationId),
      selectOrganizationRows('messages', organizationId),
    ]);

    return {
      projects: projects.map(mapProject),
      workOrders: workOrders.map(mapWorkOrder),
      timeEntries: timeEntries.map(mapTimeEntry),
      employees: employees.map(mapEmployee),
      equipment: equipment.map(mapEquipment),
      customers: customers.map(mapCustomer),
      crmLeads: crmLeads.map(mapCrmLead),
      diaryEntries: diaryEntries.map(mapDiaryEntry),
      safetyItems: safetyItems.map(mapSafetyItem),
      wasteEntries: wasteEntries.map(mapWasteEntry),
      drivingLog: drivingLog.map(mapDrivingLogEntry),
      announcements: announcements.map(mapAnnouncement),
      messages: messages.map(mapMessage),
    };
  } catch (error) {
    throw new Error(`Organisaation tietojen lataaminen epäonnistui: ${errorMessage(error)}`);
  }
}

function basePayload(organizationId: string, createdBy: string | undefined): Row {
  return {
    organization_id: organizationId,
    ...(createdBy ? { created_by: createdBy } : {}),
  };
}

export async function createProject(
  organizationId: string,
  createdBy: string | undefined,
  project: Omit<Project, 'id'>,
): Promise<Project> {
  return mapProject(
    await insertRow('projects', {
      ...basePayload(organizationId, createdBy),
      name: project.name,
      customer: project.customer,
      status: project.status,
      start_date: project.startDate || null,
      end_date: project.endDate || null,
      progress: project.progress,
      budget: project.budget,
      spent: project.spent,
      description: project.description ?? null,
      location: project.location ?? null,
    }),
  );
}

export async function patchProject(
  organizationId: string,
  id: string,
  updates: Partial<Project>,
): Promise<Project> {
  const payload: Row = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.customer !== undefined) payload.customer = updates.customer;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate || null;
  if (updates.endDate !== undefined) payload.end_date = updates.endDate || null;
  if (updates.progress !== undefined) payload.progress = updates.progress;
  if (updates.budget !== undefined) payload.budget = updates.budget;
  if (updates.spent !== undefined) payload.spent = updates.spent;
  if (updates.description !== undefined) payload.description = updates.description || null;
  if (updates.location !== undefined) payload.location = updates.location || null;
  return mapProject(await updateRow('projects', organizationId, id, payload));
}

export const removeProject = (organizationId: string, id: string) =>
  deleteRow('projects', organizationId, id);

export async function createWorkOrder(
  organizationId: string,
  createdBy: string | undefined,
  workOrder: Omit<WorkOrder, 'id'>,
): Promise<WorkOrder> {
  return mapWorkOrder(
    await insertRow('work_orders', {
      ...basePayload(organizationId, createdBy),
      title: workOrder.title,
      project: workOrder.project,
      assignee: workOrder.assignee,
      due_date: workOrder.dueDate ? toIsoDate(workOrder.dueDate) : null,
      priority: workOrder.priority,
      status: workOrder.status,
      description: workOrder.description ?? null,
      type: workOrder.type ?? null,
    }),
  );
}

export async function patchWorkOrder(
  organizationId: string,
  id: string,
  updates: Partial<WorkOrder>,
): Promise<WorkOrder> {
  const payload: Row = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.project !== undefined) payload.project = updates.project;
  if (updates.assignee !== undefined) payload.assignee = updates.assignee;
  if (updates.dueDate !== undefined) payload.due_date = updates.dueDate ? toIsoDate(updates.dueDate) : null;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.description !== undefined) payload.description = updates.description || null;
  if (updates.type !== undefined) payload.type = updates.type || null;
  return mapWorkOrder(await updateRow('work_orders', organizationId, id, payload));
}

export const removeWorkOrder = (organizationId: string, id: string) =>
  deleteRow('work_orders', organizationId, id);

export async function createCustomer(
  organizationId: string,
  createdBy: string | undefined,
  customer: Omit<Customer, 'id'>,
): Promise<Customer> {
  return mapCustomer(
    await insertRow('customers', {
      ...basePayload(organizationId, createdBy),
      name: customer.name,
      type: customer.type,
      contact_person: customer.contactPerson || null,
      phone: customer.phone || null,
      email: customer.email || null,
      address: customer.address || null,
      project_count: customer.projectCount,
      last_contact: customer.lastContact || null,
      status: customer.status,
    }),
  );
}

export async function patchCustomer(
  organizationId: string,
  id: string,
  updates: Partial<Customer>,
): Promise<Customer> {
  const payload: Row = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.type !== undefined) payload.type = updates.type;
  if (updates.contactPerson !== undefined) payload.contact_person = updates.contactPerson || null;
  if (updates.phone !== undefined) payload.phone = updates.phone || null;
  if (updates.email !== undefined) payload.email = updates.email || null;
  if (updates.address !== undefined) payload.address = updates.address || null;
  if (updates.projectCount !== undefined) payload.project_count = updates.projectCount;
  if (updates.lastContact !== undefined) payload.last_contact = updates.lastContact || null;
  if (updates.status !== undefined) payload.status = updates.status;
  return mapCustomer(await updateRow('customers', organizationId, id, payload));
}

export const removeCustomer = (organizationId: string, id: string) =>
  deleteRow('customers', organizationId, id);

export async function createCrmLead(
  organizationId: string,
  createdBy: string | undefined,
  lead: Omit<CrmLead, 'id'>,
): Promise<CrmLead> {
  return mapCrmLead(
    await insertRow('crm_leads', {
      ...basePayload(organizationId, createdBy),
      name: lead.name,
      company: lead.company || null,
      value: lead.value,
      stage: lead.stage,
      assignee: lead.assignee || null,
      expected_date: lead.date ? toIsoDate(lead.date) : null,
    }),
  );
}

export async function patchCrmLead(
  organizationId: string,
  id: string,
  updates: Partial<CrmLead>,
): Promise<CrmLead> {
  const payload: Row = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.company !== undefined) payload.company = updates.company || null;
  if (updates.value !== undefined) payload.value = updates.value;
  if (updates.stage !== undefined) payload.stage = updates.stage;
  if (updates.assignee !== undefined) payload.assignee = updates.assignee || null;
  if (updates.date !== undefined) payload.expected_date = updates.date ? toIsoDate(updates.date) : null;
  return mapCrmLead(await updateRow('crm_leads', organizationId, id, payload));
}

export const removeCrmLead = (organizationId: string, id: string) =>
  deleteRow('crm_leads', organizationId, id);

export async function createTimeEntry(
  organizationId: string,
  createdBy: string | undefined,
  entry: Omit<TimeEntry, 'id'>,
): Promise<TimeEntry> {
  return mapTimeEntry(
    await insertRow('time_entries', {
      ...basePayload(organizationId, createdBy),
      date: toIsoDate(entry.date),
      employee: entry.employee,
      project: entry.project,
      hours: entry.hours,
      overtime: entry.overtime,
      description: entry.description || null,
      status: entry.status,
    }),
  );
}

export async function createSafetyItem(
  organizationId: string,
  createdBy: string | undefined,
  item: Omit<SafetyItem, 'id'>,
): Promise<SafetyItem> {
  return mapSafetyItem(
    await insertRow('safety_items', {
      ...basePayload(organizationId, createdBy),
      type: item.type,
      title: item.title,
      date: item.date ? toIsoDate(item.date) : new Date().toISOString().slice(0, 10),
      severity: item.severity ?? null,
      status: item.status,
    }),
  );
}
