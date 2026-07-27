import { supabase } from './client';
import { loadDomainData, type DomainData } from './domainData';
import type {
  CrmLead,
  CrmLeadStage,
  Customer,
  CustomerStatus,
  CustomerType,
  Employee,
  EmployeeStatus,
  Equipment,
  EquipmentStatus,
} from '@/types';

type Row = Record<string, unknown>;

function ensureRow(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tietueen.');
  }
  return value as Row;
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function optionalText(row: Row, key: string): string | undefined {
  return text(row, key) || undefined;
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function optionalNumber(row: Row, key: string): number | undefined {
  return row[key] == null ? undefined : numberValue(row, key);
}

function enumValue<T extends string>(row: Row, key: string, values: readonly T[], fallback: T): T {
  const value = row[key];
  return typeof value === 'string' && values.includes(value as T) ? value as T : fallback;
}

async function selectRows(table: string, organizationId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId);
  if (error) throw new Error(`${table}-tietojen haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(ensureRow);
}

function mapEmployee(row: Row): Employee {
  return {
    id: text(row, 'id'),
    userId: optionalText(row, 'user_id'),
    name: text(row, 'name'),
    role: text(row, 'role'),
    department: text(row, 'department'),
    phone: text(row, 'phone'),
    email: text(row, 'email'),
    startDate: text(row, 'start_date'),
    status: enumValue<EmployeeStatus>(
      row,
      'status',
      ['Aktiivinen', 'Lomalla', 'Sairas', 'Koulutuksessa', 'Eroonnut'],
      'Aktiivinen',
    ),
    hourlyCostCents: optionalNumber(row, 'hourly_cost_cents'),
    employmentType: optionalText(row, 'employment_type'),
    emergencyContactName: optionalText(row, 'emergency_contact_name'),
    emergencyContactPhone: optionalText(row, 'emergency_contact_phone'),
    archivedAt: optionalText(row, 'archived_at'),
    projects: 0,
    hours: 0,
    training: 0,
    certifications: [],
  };
}

function mapEquipment(row: Row): Equipment {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    type: text(row, 'type'),
    serial: text(row, 'serial'),
    location: text(row, 'location'),
    status: enumValue<EquipmentStatus>(
      row,
      'status',
      ['Käytössä', 'Vapaa', 'Huollossa', 'Vuokralla'],
      'Vapaa',
    ),
    lastMaintenance: text(row, 'last_maintenance'),
    assetNumber: optionalText(row, 'asset_number'),
    model: optionalText(row, 'model'),
    year: optionalNumber(row, 'manufacture_year'),
    acquisitionCostCents: optionalNumber(row, 'acquisition_cost_cents'),
    hourlyCostCents: optionalNumber(row, 'hourly_cost_cents'),
    nextMaintenance: optionalText(row, 'next_maintenance'),
    currentProjectId: optionalText(row, 'current_project_id'),
    responsibleUserId: optionalText(row, 'responsible_user_id'),
    archivedAt: optionalText(row, 'archived_at'),
  };
}

function mapCustomer(row: Row): Customer {
  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    type: enumValue<CustomerType>(row, 'type', ['Yritys', 'Yksityinen', 'Taloyhtiö'], 'Yritys'),
    contactPerson: text(row, 'contact_person'),
    phone: text(row, 'phone'),
    email: text(row, 'email'),
    address: text(row, 'address'),
    businessId: optionalText(row, 'business_id'),
    notes: optionalText(row, 'notes'),
    archivedAt: optionalText(row, 'archived_at'),
    projectCount: numberValue(row, 'project_count'),
    lastContact: text(row, 'last_contact'),
    status: enumValue<CustomerStatus>(row, 'status', ['Aktiivinen', 'Epäaktiivinen'], 'Aktiivinen'),
  };
}

const CRM_STAGES: readonly CrmLeadStage[] = [
  'Uusi',
  'Kartoitus sovittu',
  'Kartoitettu',
  'Tarjous laskennassa',
  'Tarjous lähetetty',
  'Neuvottelu',
  'Voitettu',
  'Hävitty',
  'Jäissä',
];

function mapCrmLead(row: Row): CrmLead {
  const storedStage = text(row, 'stage');
  const normalizedStage = storedStage === 'Tarjous tehty'
    ? 'Tarjous lähetetty'
    : storedStage === 'Sopimus'
      ? 'Voitettu'
      : storedStage;

  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    company: text(row, 'company'),
    customerId: optionalText(row, 'customer_id'),
    siteId: optionalText(row, 'site_id'),
    value: numberValue(row, 'value'),
    estimatedCost: optionalNumber(row, 'estimated_cost'),
    stage: CRM_STAGES.includes(normalizedStage as CrmLeadStage)
      ? normalizedStage as CrmLeadStage
      : 'Uusi',
    assignee: text(row, 'assignee'),
    assigneeUserId: optionalText(row, 'assignee_user_id'),
    probability: optionalNumber(row, 'probability'),
    source: optionalText(row, 'source'),
    description: optionalText(row, 'description'),
    nextAction: optionalText(row, 'next_action'),
    nextActionDueAt: optionalText(row, 'next_action_due_at'),
    expectedDecisionDate: optionalText(row, 'expected_decision_date'),
    quotedAt: optionalText(row, 'quoted_at'),
    wonAt: optionalText(row, 'won_at'),
    lostAt: optionalText(row, 'lost_at'),
    frozenUntil: optionalText(row, 'frozen_until'),
    lostReason: optionalText(row, 'lost_reason'),
    convertedProjectId: optionalText(row, 'converted_project_id'),
    lastActivityAt: optionalText(row, 'last_activity_at'),
    date: text(row, 'expected_date') || text(row, 'created_at').slice(0, 10),
  };
}

export async function loadExtendedDomainData(organizationId: string): Promise<DomainData> {
  const [base, employees, equipment, customers, crmLeads] = await Promise.all([
    loadDomainData(organizationId),
    selectRows('employees', organizationId),
    selectRows('equipment', organizationId),
    selectRows('customers', organizationId),
    selectRows('crm_leads', organizationId),
  ]);

  return {
    ...base,
    employees: employees.map(mapEmployee),
    equipment: equipment.map(mapEquipment),
    customers: customers.map(mapCustomer),
    crmLeads: crmLeads.map(mapCrmLead),
  };
}
