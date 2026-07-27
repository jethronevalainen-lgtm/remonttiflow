import { type DomainData } from './domainData';
import { loadExtendedDomainData } from './extendedDomainData';
import { supabase } from './client';
import type {
  SafetyItem,
  SafetyItemSeverity,
  SafetyItemType,
  TimeEntry,
  TimeEntryBreakSource,
  TimeEntryStatus,
} from '@/types';

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
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function optionalNumber(item: Row, key: string): number | undefined {
  return item[key] == null ? undefined : numberValue(item, key);
}

function enumValue<T extends string>(
  item: Row,
  key: string,
  values: readonly T[],
  fallback: T,
): T {
  const value = item[key];
  return typeof value === 'string' && values.includes(value as T) ? value as T : fallback;
}

function toFinnishDate(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return iso ? `${Number(iso[3])}.${Number(iso[2])}.${iso[1]}` : value;
}

async function selectRows(table: string, organizationId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId);
  if (error) throw new Error(`${table}-tietojen haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(row);
}

function mapTimeEntry(item: Row): TimeEntry {
  return {
    id: text(item, 'id'),
    date: toFinnishDate(text(item, 'date')),
    userId: optionalText(item, 'user_id'),
    employeeId: optionalText(item, 'employee_id'),
    employee: text(item, 'employee'),
    projectId: optionalText(item, 'project_id'),
    project: text(item, 'project'),
    workOrderId: optionalText(item, 'work_order_id'),
    hours: numberValue(item, 'hours'),
    overtime: numberValue(item, 'overtime'),
    breakMinutes: numberValue(item, 'break_minutes'),
    breakSource: enumValue<TimeEntryBreakSource>(
      item,
      'break_source',
      ['none', 'manual', 'automatic'],
      numberValue(item, 'break_minutes') > 0 ? 'manual' : 'none',
    ),
    startTime: optionalText(item, 'start_time'),
    endTime: optionalText(item, 'end_time'),
    breakStartTime: optionalText(item, 'break_start_time'),
    breakEndTime: optionalText(item, 'break_end_time'),
    source: optionalText(item, 'source'),
    description: text(item, 'description'),
    status: enumValue<TimeEntryStatus>(item, 'status', ['Hyväksytty', 'Odottaa', 'Hylätty'], 'Odottaa'),
    approvedBy: optionalText(item, 'approved_by'),
    approvedAt: optionalText(item, 'approved_at'),
    rejectionReason: optionalText(item, 'rejection_reason'),
    lockedAt: optionalText(item, 'locked_at'),
    payrollPeriodId: optionalText(item, 'payroll_period_id'),
  };
}

function mapSafetyItem(item: Row): SafetyItem {
  return {
    id: text(item, 'id'),
    type: enumValue<SafetyItemType>(item, 'type', ['incident', 'risk', 'inspection', 'training'], 'risk'),
    title: text(item, 'title'),
    description: optionalText(item, 'description'),
    date: text(item, 'date'),
    projectId: optionalText(item, 'project_id'),
    project: optionalText(item, 'project'),
    severity: item.severity == null
      ? undefined
      : enumValue<SafetyItemSeverity>(item, 'severity', ['Lievä', 'Keskitasoinen', 'Vakava'], 'Keskitasoinen'),
    status: text(item, 'status') || 'Avoin',
    assignee: optionalText(item, 'assignee'),
    assigneeUserId: optionalText(item, 'assignee_user_id'),
    dueDate: optionalText(item, 'due_date'),
    location: optionalText(item, 'location'),
    rootCause: optionalText(item, 'root_cause'),
    correctiveAction: optionalText(item, 'corrective_action'),
    preventiveAction: optionalText(item, 'preventive_action'),
    resolvedAt: optionalText(item, 'resolved_at'),
    verifiedAt: optionalText(item, 'verified_at'),
    verifiedBy: optionalText(item, 'verified_by'),
    latitude: optionalNumber(item, 'latitude'),
    longitude: optionalNumber(item, 'longitude'),
  };
}

export async function loadNormalizedDomainData(organizationId: string): Promise<DomainData> {
  const [base, timeEntries, safetyItems] = await Promise.all([
    loadExtendedDomainData(organizationId),
    selectRows('time_entries', organizationId),
    selectRows('safety_items', organizationId),
  ]);
  return {
    ...base,
    timeEntries: timeEntries.map(mapTimeEntry),
    safetyItems: safetyItems.map(mapSafetyItem),
  };
}
