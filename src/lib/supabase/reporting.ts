import { supabase } from './client';

export interface OrganizationReportSummary {
  projectBudget: number;
  projectSpent: number;
  approvedHours: number;
  pendingHours: number;
  openWorkOrders: number;
  openSafety: number;
  seriousSafety: number;
  wasteByUnit: Record<string, number>;
  wasteCost: number;
  travelCost: number;
  changeOrderAmountCents: number;
  changeOrderCostCents: number;
}

type Row = Record<string, unknown>;

function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Raportointipalvelu palautti virheellisen vastauksen.');
  }
  return value as Row;
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

function numberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const parsed = typeof item === 'number' ? item : Number(item);
        return [key, Number.isFinite(parsed) ? parsed : 0] as const;
      }),
  );
}

export async function loadOrganizationReportSummary(input: {
  organizationId: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<OrganizationReportSummary> {
  const { data, error } = await supabase.rpc('get_organization_report_summary', {
    p_organization_id: input.organizationId,
    p_project_id: input.projectId || null,
    p_date_from: input.dateFrom || null,
    p_date_to: input.dateTo || null,
  });
  if (error) throw new Error(`Raportin muodostaminen epäonnistui: ${error.message}`);
  const item = row(data);
  return {
    projectBudget: numberValue(item, 'project_budget'),
    projectSpent: numberValue(item, 'project_spent'),
    approvedHours: numberValue(item, 'approved_hours'),
    pendingHours: numberValue(item, 'pending_hours'),
    openWorkOrders: numberValue(item, 'open_work_orders'),
    openSafety: numberValue(item, 'open_safety'),
    seriousSafety: numberValue(item, 'serious_safety'),
    wasteByUnit: numberRecord(item.waste_by_unit),
    wasteCost: numberValue(item, 'waste_cost'),
    travelCost: numberValue(item, 'travel_cost'),
    changeOrderAmountCents: numberValue(item, 'change_order_amount_cents'),
    changeOrderCostCents: numberValue(item, 'change_order_cost_cents'),
  };
}

export interface SavedReport {
  id: string;
  name: string;
  reportType: string;
  filters: Record<string, unknown>;
  schedule?: string;
  recipients: string[];
  active: boolean;
  createdBy?: string;
  createdAt: string;
}

export async function listSavedReports(organizationId: string): Promise<SavedReport[]> {
  const { data, error } = await supabase
    .from('saved_reports')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Tallennettujen raporttien haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map((value) => {
    const item = row(value);
    return {
      id: String(item.id ?? ''),
      name: String(item.name ?? ''),
      reportType: String(item.report_type ?? ''),
      filters: item.filters && typeof item.filters === 'object' && !Array.isArray(item.filters)
        ? item.filters as Record<string, unknown>
        : {},
      schedule: typeof item.schedule === 'string' && item.schedule ? item.schedule : undefined,
      recipients: Array.isArray(item.recipients)
        ? item.recipients.filter((recipient): recipient is string => typeof recipient === 'string')
        : [],
      active: item.active !== false,
      createdBy: typeof item.created_by === 'string' ? item.created_by : undefined,
      createdAt: String(item.created_at ?? ''),
    };
  });
}

export async function createSavedReport(input: {
  organizationId: string;
  userId: string;
  name: string;
  reportType: string;
  filters: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('saved_reports').insert({
    organization_id: input.organizationId,
    created_by: input.userId,
    name: input.name.trim(),
    report_type: input.reportType,
    filters: input.filters,
  });
  if (error) throw new Error(`Raporttirajauksen tallennus epäonnistui: ${error.message}`);
}

export async function deleteSavedReport(
  organizationId: string,
  reportId: string,
): Promise<void> {
  const { error } = await supabase
    .from('saved_reports')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', reportId);
  if (error) throw new Error(`Tallennetun raportin poistaminen epäonnistui: ${error.message}`);
}
