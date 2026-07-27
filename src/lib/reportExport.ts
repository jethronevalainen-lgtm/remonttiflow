import {
  downloadReportCsv,
  downloadReportXlsx,
  printReport,
} from '@/lib/reportExports';
import type {
  ReportCenterColumn,
  ReportCenterDataset,
  ReportCenterRow,
  ReportColumnType,
} from '@/lib/supabase/reportCenter';

export type ExportCell = string | number | boolean | null | undefined;

function columnType(values: ExportCell[]): ReportColumnType {
  const defined = values.filter((value) => value !== null && value !== undefined && value !== '');
  if (defined.length > 0 && defined.every((value) => typeof value === 'number')) return 'number';
  if (defined.length > 0 && defined.every((value) => typeof value === 'boolean')) return 'boolean';
  return 'text';
}

function dataset(title: string, rows: ExportCell[][]): ReportCenterDataset {
  const headings = rows[0] ?? [];
  const body = rows.slice(1);
  const columns: ReportCenterColumn[] = headings.map((heading, index) => ({
    key: `column_${index}`,
    label: String(heading ?? `Sarake ${index + 1}`),
    type: columnType(body.map((row) => row[index])),
  }));
  const mappedRows: ReportCenterRow[] = body.map((row) => Object.fromEntries(
    columns.map((column, index) => [column.key, row[index] ?? '']),
  ));
  return {
    reportType: 'projects',
    title,
    dateFrom: '',
    dateTo: '',
    generatedAt: new Date().toISOString(),
    organizationId: '',
    projectId: null,
    columns,
    rows: mappedRows,
    summary: {},
  };
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.(csv|xlsx|pdf)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim() || 'VaKantti-raportti';
}

export function downloadCsv(filename: string, rows: ExportCell[][]): void {
  downloadReportCsv(dataset(titleFromFilename(filename), rows));
}

export function downloadXlsx(filename: string, sheetName: string, rows: ExportCell[][]): void {
  downloadReportXlsx(dataset(sheetName || titleFromFilename(filename), rows));
}

export function openPrintReport(title: string, rows: ExportCell[][]): void {
  printReport(dataset(title, rows));
}
