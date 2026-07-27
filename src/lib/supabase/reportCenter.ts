import { supabase } from '@/lib/supabase/client';

export type ReportCenterType =
  | 'time_entries'
  | 'work_descriptions'
  | 'site_presence'
  | 'travel_expenses'
  | 'projects'
  | 'equipment';

export type ReportColumnType = 'text' | 'number' | 'money' | 'boolean';

export interface ReportCenterColumn {
  key: string;
  label: string;
  type: ReportColumnType;
}

export type ReportCenterRow = Record<string, unknown>;

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
