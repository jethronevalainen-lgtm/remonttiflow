import { supabase } from '@/lib/supabase/client';
import type { ManagedWorkOrder } from '@/lib/supabase/workManagement';
import type { WorkOrderPriority, WorkOrderStatus } from '@/types';

export type WorkOrderBillingStatus =
  | 'recorded'
  | 'approved'
  | 'billable'
  | 'queued'
  | 'invoiced'
  | 'credited'
  | 'rejected';

export type WorkOrderAttentionFlag =
  | 'active_long'
  | 'estimate_exceeded'
  | 'missing_assignee'
  | 'missing_schedule'
  | 'overdue'
  | 'pending_review'
  | 'ready_to_bill';

export interface ControlledWorkOrder extends ManagedWorkOrder {
  workNumber: string;
  projectNumber: string;
  projectLocation: string;
  customerId?: string;
  customerName: string;
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: string;
  createdByName: string;
  estimatedMinutes?: number;
  approvedMinutes: number;
  pendingMinutes: number;
  totalMinutes: number;
  timeEntryCount: number;
  quantity?: number;
  quantityUnit: string;
  billable: boolean;
  billingStatus: WorkOrderBillingStatus;
  invoiceReference: string;
  invoicedAt?: string;
  billingItemCount: number;
  billingTotalCents: number;
  activeSessionCount: number;
  activeSessionUserIds: string[];
  activeSessionNames: string[];
  attentionFlags: WorkOrderAttentionFlag[];
  lastActivityAt?: string;
}

export interface WorkOrderSavedView {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  filters: Record<string, unknown>;
  visibleColumns: string[];
  sortKey: string;
  sortDirection: 'asc' | 'desc';
  pageSize: 10 | 25 | 50 | 100;
  isDefault: boolean;
  updatedAt: string;
}

export interface WorkOrderAuditEvent {
  id: string;
  userId?: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WorkOrderTimeLine {
  id: string;
  date: string;
  employee: string;
  hours: number;
  overtime: number;
  description: string;
  status: string;
  billingStatus: WorkOrderBillingStatus;
  invoiceReference: string;
  updatedAt?: string;
}

export interface WorkOrderBillingLine {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  totalExVatCents?: number;
  status: WorkOrderBillingStatus;
  invoiceReference: string;
  createdAt: string;
}

export interface WorkOrderInsights {
  auditEvents: WorkOrderAuditEvent[];
  billingLines: WorkOrderBillingLine[];
  timeLines: WorkOrderTimeLine[];
}

export interface WorkOrderControlPatch {
  assigneeUserIds?: string[];
  billable?: boolean;
  billingStatus?: WorkOrderBillingStatus;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  priority?: WorkOrderPriority;
  quantity?: number | null;
  quantityUnit?: string | null;
  scheduleShiftDays?: number;
  status?: WorkOrderStatus;
}

type Row = Record<string, unknown>;

const BILLING_STATUSES: WorkOrderBillingStatus[] = [
  'recorded',
  'approved',
  'billable',
  'queued',
  'invoiced',
  'credited',
  'rejected',
];

const BILLING_RANK: Record<WorkOrderBillingStatus, number> = {
  recorded: 0,
  approved: 1,
  billable: 2,
  queued: 3,
  invoiced: 4,
  credited: 5,
  rejected: -1,
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
  const value = text(row, key);
  return value || undefined;
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

function booleanValue(row: Row, key: string, fallback: boolean): boolean {
  return typeof row[key] === 'boolean' ? row[key] as boolean : fallback;
}

function billingStatus(value: unknown): WorkOrderBillingStatus {
  return typeof value === 'string' && BILLING_STATUSES.includes(value as WorkOrderBillingStatus)
    ? value as WorkOrderBillingStatus
    : 'recorded';
}

function latestIso(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

function dayKey(value: string): number {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getDay() || 7;
}

function inferEstimateMinutes(order: ManagedWorkOrder): number | undefined {
  if (!order.plannedStartDate || !order.plannedEndDate) return undefined;
  const start = new Date(`${order.plannedStartDate}T12:00:00`);
  const end = new Date(`${order.plannedEndDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return undefined;

  const [startHour, startMinute] = order.plannedStartTime.split(':').map(Number);
  const [endHour, endMinute] = order.plannedEndTime.split(':').map(Number);
  const dailyMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (!Number.isFinite(dailyMinutes) || dailyMinutes <= 0) return undefined;

  let workdays = 0;
  const cursor = new Date(start);
  while (cursor <= end && workdays <= 3660) {
    const iso = cursor.toISOString().slice(0, 10);
    if (order.plannedWeekdays.includes(dayKey(iso))) workdays += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return workdays > 0 ? workdays * dailyMinutes : undefined;
}

async function requireRows(
  promise: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
): Promise<Row[]> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label} epäonnistui: ${error.message}`);
  return rows(data);
}

export async function loadWorkOrderControlData(
  organizationId: string,
  baseOrders: ManagedWorkOrder[],
): Promise<ControlledWorkOrder[]> {
  const [metadataRows, projectRows, customerRows, profileRows, timeRows, billingRows, activeRows] = await Promise.all([
    requireRows(
      supabase
        .from('work_orders')
        .select('id, created_at, updated_at, created_by, estimated_minutes, quantity, quantity_unit, billable, billing_status, invoice_reference, invoiced_at')
        .eq('organization_id', organizationId),
      'Työmääräysten ohjaustietojen haku',
    ),
    requireRows(
      supabase
        .from('projects')
        .select('id, customer, customer_id, project_number, location')
        .eq('organization_id', organizationId),
      'Projektitietojen haku',
    ),
    requireRows(
      supabase
        .from('customers')
        .select('id, name')
        .eq('organization_id', organizationId),
      'Asiakastietojen haku',
    ),
    requireRows(
      supabase
        .from('profiles')
        .select('id, full_name, email'),
      'Käyttäjänimien haku',
    ),
    requireRows(
      supabase
        .from('time_entries')
        .select('work_order_id, hours, status, billing_status, invoice_reference, updated_at')
        .eq('organization_id', organizationId)
        .not('work_order_id', 'is', null),
      'Työmääräysten tuntien haku',
    ),
    requireRows(
      supabase
        .from('billing_items')
        .select('work_order_id, status, invoice_reference, total_ex_vat_cents, created_at, updated_at')
        .eq('organization_id', organizationId)
        .not('work_order_id', 'is', null),
      'Työmääräysten laskutustietojen haku',
    ),
    requireRows(
      supabase
        .from('work_order_time_sessions')
        .select('id, work_order_id, user_id, started_at')
        .eq('organization_id', organizationId)
        .is('ended_at', null),
      'Käynnissä olevien työaikojen haku',
    ),
  ]);

  const metadataById = new Map(metadataRows.map((row) => [text(row, 'id'), row]));
  const projectById = new Map(projectRows.map((row) => [text(row, 'id'), row]));
  const customerById = new Map(customerRows.map((row) => [text(row, 'id'), row]));
  const profileById = new Map(profileRows.map((row) => [text(row, 'id'), row]));

  const timeByOrder = new Map<string, Row[]>();
  timeRows.forEach((row) => {
    const orderId = text(row, 'work_order_id');
    if (!orderId) return;
    timeByOrder.set(orderId, [...(timeByOrder.get(orderId) ?? []), row]);
  });

  const billingByOrder = new Map<string, Row[]>();
  billingRows.forEach((row) => {
    const orderId = text(row, 'work_order_id');
    if (!orderId) return;
    billingByOrder.set(orderId, [...(billingByOrder.get(orderId) ?? []), row]);
  });

  const activeByOrder = new Map<string, Row[]>();
  activeRows.forEach((row) => {
    const orderId = text(row, 'work_order_id');
    if (!orderId) return;
    activeByOrder.set(orderId, [...(activeByOrder.get(orderId) ?? []), row]);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return baseOrders.map((order) => {
    const metadata = metadataById.get(order.id) ?? {};
    const project = order.projectId ? projectById.get(order.projectId) ?? {} : {};
    const customerId = optionalText(project, 'customer_id');
    const customer = customerId ? customerById.get(customerId) ?? {} : {};
    const entries = timeByOrder.get(order.id) ?? [];
    const billingItems = billingByOrder.get(order.id) ?? [];
    const activeSessions = activeByOrder.get(order.id) ?? [];
    const createdByUserId = optionalText(metadata, 'created_by');
    const creator = createdByUserId ? profileById.get(createdByUserId) ?? {} : {};

    const approvedMinutes = Math.round(entries
      .filter((entry) => text(entry, 'status') === 'Hyväksytty')
      .reduce((sum, entry) => sum + numberValue(entry, 'hours') * 60, 0));
    const pendingMinutes = Math.round(entries
      .filter((entry) => text(entry, 'status') === 'Odottaa')
      .reduce((sum, entry) => sum + numberValue(entry, 'hours') * 60, 0));
    const totalMinutes = Math.round(entries.reduce((sum, entry) => sum + numberValue(entry, 'hours') * 60, 0));

    const storedEstimate = metadata.estimated_minutes === null || metadata.estimated_minutes === undefined
      ? undefined
      : numberValue(metadata, 'estimated_minutes');
    const estimatedMinutes = storedEstimate ?? inferEstimateMinutes(order);

    const statusCandidates = [
      billingStatus(metadata.billing_status),
      ...entries.map((entry) => billingStatus(entry.billing_status)),
      ...billingItems.map((item) => billingStatus(item.status)),
    ];
    const resolvedBillingStatus = statusCandidates.reduce((current, candidate) => (
      BILLING_RANK[candidate] > BILLING_RANK[current] ? candidate : current
    ), 'recorded' as WorkOrderBillingStatus);

    const activeSessionUserIds = [...new Set(activeSessions.map((session) => text(session, 'user_id')).filter(Boolean))];
    const activeSessionNames = activeSessionUserIds.map((userId) => {
      const profile = profileById.get(userId) ?? {};
      return text(profile, 'full_name') || text(profile, 'email') || 'Nimetön käyttäjä';
    });

    const dueDate = order.dueDate ? new Date(`${order.dueDate}T12:00:00`) : null;
    const overdue = Boolean(
      dueDate
      && !Number.isNaN(dueDate.getTime())
      && dueDate < today
      && !['Valmis', 'Peruttu'].includes(order.status),
    );
    const oldestActiveStartedAt = activeSessions
      .map((session) => optionalText(session, 'started_at'))
      .filter((value): value is string => Boolean(value))
      .sort()[0];
    const activeLong = Boolean(
      oldestActiveStartedAt
      && Date.now() - new Date(oldestActiveStartedAt).getTime() > 12 * 60 * 60 * 1000,
    );

    const attentionFlags: WorkOrderAttentionFlag[] = [];
    if (activeLong) attentionFlags.push('active_long');
    if (estimatedMinutes !== undefined && totalMinutes > estimatedMinutes) attentionFlags.push('estimate_exceeded');
    if (order.assignmentScope === 'people' && order.assigneeUserIds.length === 0) attentionFlags.push('missing_assignee');
    if (!order.plannedStartDate || !order.plannedEndDate) attentionFlags.push('missing_schedule');
    if (overdue) attentionFlags.push('overdue');
    if (order.completionRequestedAt && !order.completionApproved) attentionFlags.push('pending_review');
    if (order.status === 'Valmis' && booleanValue(metadata, 'billable', true) && !['queued', 'invoiced', 'credited', 'rejected'].includes(resolvedBillingStatus)) {
      attentionFlags.push('ready_to_bill');
    }

    const invoiceReference = optionalText(metadata, 'invoice_reference')
      ?? [...entries, ...billingItems]
        .map((item) => optionalText(item, 'invoice_reference'))
        .find(Boolean)
      ?? '';
    const updatedAt = optionalText(metadata, 'updated_at');
    const lastActivityAt = latestIso([
      updatedAt,
      ...entries.map((entry) => optionalText(entry, 'updated_at')),
      ...billingItems.map((item) => optionalText(item, 'updated_at') ?? optionalText(item, 'created_at')),
      ...activeSessions.map((session) => optionalText(session, 'started_at')),
    ]);

    return {
      ...order,
      workNumber: order.workReference || order.id.slice(0, 8).toUpperCase(),
      projectNumber: text(project, 'project_number'),
      projectLocation: text(project, 'location'),
      customerId,
      customerName: text(customer, 'name') || text(project, 'customer') || 'Ei asiakasta',
      createdAt: optionalText(metadata, 'created_at'),
      updatedAt,
      createdByUserId,
      createdByName: text(creator, 'full_name') || text(creator, 'email') || 'Ei tiedossa',
      estimatedMinutes,
      approvedMinutes,
      pendingMinutes,
      totalMinutes,
      timeEntryCount: entries.length,
      quantity: metadata.quantity === null || metadata.quantity === undefined
        ? undefined
        : numberValue(metadata, 'quantity'),
      quantityUnit: text(metadata, 'quantity_unit'),
      billable: booleanValue(metadata, 'billable', true),
      billingStatus: resolvedBillingStatus,
      invoiceReference,
      invoicedAt: optionalText(metadata, 'invoiced_at'),
      billingItemCount: billingItems.length,
      billingTotalCents: Math.round(billingItems.reduce((sum, item) => sum + numberValue(item, 'total_ex_vat_cents'), 0)),
      activeSessionCount: activeSessions.length,
      activeSessionUserIds,
      activeSessionNames,
      attentionFlags,
      lastActivityAt,
    };
  });
}

export async function bulkUpdateWorkOrders(values: {
  organizationId: string;
  workOrderIds: string[];
  patch: WorkOrderControlPatch;
}): Promise<number> {
  const patch: Record<string, unknown> = {};
  if (values.patch.assigneeUserIds !== undefined) patch.assignee_user_ids = values.patch.assigneeUserIds;
  if (values.patch.billable !== undefined) patch.billable = values.patch.billable;
  if (values.patch.billingStatus !== undefined) patch.billing_status = values.patch.billingStatus;
  if (values.patch.dueDate !== undefined) patch.due_date = values.patch.dueDate ?? '';
  if (values.patch.estimatedMinutes !== undefined) patch.estimated_minutes = values.patch.estimatedMinutes ?? '';
  if (values.patch.priority !== undefined) patch.priority = values.patch.priority;
  if (values.patch.quantity !== undefined) patch.quantity = values.patch.quantity ?? '';
  if (values.patch.quantityUnit !== undefined) patch.quantity_unit = values.patch.quantityUnit ?? '';
  if (values.patch.scheduleShiftDays !== undefined) patch.schedule_shift_days = values.patch.scheduleShiftDays;
  if (values.patch.status !== undefined) patch.status = values.patch.status;

  const { data, error } = await supabase.rpc('bulk_update_work_orders', {
    p_organization_id: values.organizationId,
    p_work_order_ids: values.workOrderIds,
    p_patch: patch,
  });
  if (error) throw new Error(`Työmääräysten päivitys epäonnistui: ${error.message}`);
  return typeof data === 'number' ? data : Number(data ?? 0);
}

export async function listWorkOrderSavedViews(organizationId: string): Promise<WorkOrderSavedView[]> {
  const { data, error } = await supabase
    .from('work_order_saved_views')
    .select('*')
    .eq('organization_id', organizationId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`Tallennettujen näkymien haku epäonnistui: ${error.message}`);

  return rows(data).map((row) => ({
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    userId: text(row, 'user_id'),
    name: text(row, 'name'),
    filters: row.filters && typeof row.filters === 'object' && !Array.isArray(row.filters)
      ? row.filters as Record<string, unknown>
      : {},
    visibleColumns: Array.isArray(row.visible_columns)
      ? row.visible_columns.filter((item): item is string => typeof item === 'string')
      : [],
    sortKey: text(row, 'sort_key') || 'dueDate',
    sortDirection: text(row, 'sort_direction') === 'desc' ? 'desc' : 'asc',
    pageSize: [10, 25, 50, 100].includes(numberValue(row, 'page_size'))
      ? numberValue(row, 'page_size') as 10 | 25 | 50 | 100
      : 25,
    isDefault: booleanValue(row, 'is_default', false),
    updatedAt: text(row, 'updated_at'),
  }));
}

export async function saveWorkOrderView(values: {
  id?: string;
  organizationId: string;
  name: string;
  filters: Record<string, unknown>;
  visibleColumns: string[];
  sortKey: string;
  sortDirection: 'asc' | 'desc';
  pageSize: 10 | 25 | 50 | 100;
  isDefault: boolean;
}): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Kirjautunutta käyttäjää ei löytynyt.');

  if (values.isDefault) {
    const { error: clearError } = await supabase
      .from('work_order_saved_views')
      .update({ is_default: false })
      .eq('organization_id', values.organizationId)
      .eq('user_id', authData.user.id)
      .eq('is_default', true);
    if (clearError) throw new Error(`Oletusnäkymän päivitys epäonnistui: ${clearError.message}`);
  }

  const payload = {
    organization_id: values.organizationId,
    user_id: authData.user.id,
    name: values.name.trim(),
    filters: values.filters,
    visible_columns: values.visibleColumns,
    sort_key: values.sortKey,
    sort_direction: values.sortDirection,
    page_size: values.pageSize,
    is_default: values.isDefault,
  };

  const query = values.id
    ? supabase
        .from('work_order_saved_views')
        .update(payload)
        .eq('id', values.id)
        .eq('organization_id', values.organizationId)
    : supabase.from('work_order_saved_views').insert(payload);
  const { error } = await query;
  if (error) throw new Error(`Näkymän tallennus epäonnistui: ${error.message}`);
}

export async function deleteWorkOrderView(organizationId: string, viewId: string): Promise<void> {
  const { error } = await supabase
    .from('work_order_saved_views')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', viewId);
  if (error) throw new Error(`Näkymän poistaminen epäonnistui: ${error.message}`);
}

export async function loadWorkOrderInsights(
  organizationId: string,
  workOrderId: string,
): Promise<WorkOrderInsights> {
  const [timeRows, billingRows, auditRows] = await Promise.all([
    requireRows(
      supabase
        .from('time_entries')
        .select('id, date, employee, hours, overtime, description, status, billing_status, invoice_reference, updated_at')
        .eq('organization_id', organizationId)
        .eq('work_order_id', workOrderId)
        .order('date', { ascending: false }),
      'Työmääräyksen tuntihistorian haku',
    ),
    requireRows(
      supabase
        .from('billing_items')
        .select('id, description, quantity, unit, total_ex_vat_cents, status, invoice_reference, created_at')
        .eq('organization_id', organizationId)
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false }),
      'Työmääräyksen laskutusrivien haku',
    ),
    requireRows(
      supabase
        .from('audit_logs')
        .select('id, user_id, action, metadata, created_at')
        .eq('organization_id', organizationId)
        .eq('table_name', 'work_orders')
        .eq('record_id', workOrderId)
        .order('created_at', { ascending: false })
        .limit(100),
      'Työmääräyksen muutoshistorian haku',
    ),
  ]);

  return {
    timeLines: timeRows.map((row) => ({
      id: text(row, 'id'),
      date: text(row, 'date'),
      employee: text(row, 'employee') || 'Nimetön käyttäjä',
      hours: numberValue(row, 'hours'),
      overtime: numberValue(row, 'overtime'),
      description: text(row, 'description'),
      status: text(row, 'status'),
      billingStatus: billingStatus(row.billing_status),
      invoiceReference: text(row, 'invoice_reference'),
      updatedAt: optionalText(row, 'updated_at'),
    })),
    billingLines: billingRows.map((row) => ({
      id: text(row, 'id'),
      description: text(row, 'description'),
      quantity: numberValue(row, 'quantity'),
      unit: text(row, 'unit'),
      totalExVatCents: row.total_ex_vat_cents === null || row.total_ex_vat_cents === undefined
        ? undefined
        : numberValue(row, 'total_ex_vat_cents'),
      status: billingStatus(row.status),
      invoiceReference: text(row, 'invoice_reference'),
      createdAt: text(row, 'created_at'),
    })),
    auditEvents: auditRows.map((row) => ({
      id: String(row.id ?? ''),
      userId: optionalText(row, 'user_id'),
      action: text(row, 'action'),
      metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {},
      createdAt: text(row, 'created_at'),
    })),
  };
}
