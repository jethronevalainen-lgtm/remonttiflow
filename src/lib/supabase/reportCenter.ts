import { supabase } from '@/lib/supabase/client';

export type ReportCenterType =
  | 'time_entries'
  | 'work_descriptions'
  | 'site_presence'
  | 'travel_expenses'
  | 'projects'
  | 'equipment';

export type ReportColumnType = 'text' | 'number' | 'money' | 'boolean';
export type ReportMetricFormat = 'number' | 'hours' | 'money' | 'percent';
export type ReportInsightSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface ReportCenterColumn {
  key: string;
  label: string;
  type: ReportColumnType;
}

export type ReportCenterRow = Record<string, unknown>;

export interface ReportCenterContext {
  organizationName: string;
  periodLabel: string;
  projectLabel: string;
  peopleLabel: string;
  statusLabel: string;
}

export interface ReportCenterInsight {
  id: string;
  severity: ReportInsightSeverity;
  title: string;
  description: string;
  value?: number | string;
  format?: ReportMetricFormat;
}

export interface ReportCenterBreakdownRow {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface ReportCenterBreakdown {
  id: string;
  title: string;
  description: string;
  format: ReportMetricFormat;
  secondaryFormat?: ReportMetricFormat;
  valueLabel?: string;
  secondaryValueLabel?: string;
  rows: ReportCenterBreakdownRow[];
}

export interface ReportCenterDataset {
  reportType: ReportCenterType;
  title: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  organizationId: string;
  projectId: string | null;
  columns: ReportCenterColumn[];
  rows: ReportCenterRow[];
  summary: Record<string, number | string | boolean | null>;
  context?: ReportCenterContext;
  insights?: ReportCenterInsight[];
  breakdowns?: ReportCenterBreakdown[];
}

export interface ReportCenterFilters {
  organizationId: string;
  reportType: ReportCenterType;
  projectId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  statuses?: string[] | null;
  userIds?: string[] | null;
}

export interface ReportFilterProject {
  id: string;
  name: string;
  projectNumber: string | null;
  status: string;
}

export interface ReportFilterUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export interface ReportFilterCatalog {
  projects: ReportFilterProject[];
  users: ReportFilterUser[];
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function rows(value: unknown): ReportCenterRow[] {
  return Array.isArray(value)
    ? value.filter((item): item is ReportCenterRow => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function mapDataset(value: unknown, requestedType: ReportCenterType): ReportCenterDataset {
  const root = object(value);
  const columnRows = Array.isArray(root.columns) ? root.columns : [];
  return {
    reportType: (text(root.reportType) || requestedType) as ReportCenterType,
    title: text(root.title) || 'Raportti',
    dateFrom: text(root.dateFrom),
    dateTo: text(root.dateTo),
    generatedAt: text(root.generatedAt) || new Date().toISOString(),
    organizationId: text(root.organizationId),
    projectId: nullableText(root.projectId),
    columns: columnRows.map((item): ReportCenterColumn => {
      const column = object(item);
      const typeValue = text(column.type);
      const type: ReportColumnType = ['number', 'money', 'boolean'].includes(typeValue)
        ? typeValue as ReportColumnType
        : 'text';
      return { key: text(column.key), label: text(column.label), type };
    }).filter((item) => item.key),
    rows: rows(root.rows),
    summary: object(root.summary) as Record<string, number | string | boolean | null>,
  };
}

export async function loadReportCenterData(filters: ReportCenterFilters): Promise<ReportCenterDataset> {
  const { data, error } = await supabase.rpc('report_center_data', {
    p_organization_id: filters.organizationId,
    p_report_type: filters.reportType,
    p_project_id: filters.projectId || null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_statuses: filters.statuses?.length ? filters.statuses : null,
    p_user_ids: filters.userIds?.length ? filters.userIds : null,
  });
  if (error) throw new Error(`Raportin muodostaminen epäonnistui: ${error.message}`);
  return mapDataset(data, filters.reportType);
}

export async function loadReportFilterCatalog(organizationId: string): Promise<ReportFilterCatalog> {
  const { data, error } = await supabase.rpc('report_center_filter_catalog', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Raporttisuodattimien lataus epäonnistui: ${error.message}`);
  const root = object(data);
  return {
    projects: rows(root.projects).map((row): ReportFilterProject => ({
      id: text(row.id),
      name: text(row.name),
      projectNumber: nullableText(row.projectNumber),
      status: text(row.status),
    })).filter((item) => item.id),
    users: rows(root.users).map((row): ReportFilterUser => ({
      id: text(row.id),
      name: text(row.name),
      email: nullableText(row.email),
      role: text(row.role),
    })).filter((item) => item.id),
  };
}
