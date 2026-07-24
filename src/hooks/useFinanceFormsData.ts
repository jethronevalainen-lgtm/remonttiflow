import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase/client';

export type EstimateStatus = 'Luonnos' | 'Hyväksytty' | 'Arkistoitu';
export type TakeoffStatus = 'Luonnos' | 'Valmis' | 'Arkistoitu';
export type FormSubmissionStatus = 'Luonnos' | 'Lähetetty' | 'Hyväksytty' | 'Hylätty';
export type FormFieldType = 'text' | 'number' | 'date' | 'checkbox' | 'textarea';

export interface Estimate {
  id: string;
  projectId?: string;
  projectName: string;
  name: string;
  status: EstimateStatus;
  vatRate: number;
  overheadPercent: number;
  riskPercent: number;
  marginPercent: number;
  notes: string;
}

export interface EstimateLine {
  id: string;
  estimateId: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
}

export interface QuantityTakeoff {
  id: string;
  projectId?: string;
  projectName: string;
  name: string;
  status: TakeoffStatus;
  notes: string;
}

export interface QuantityTakeoffLine {
  id: string;
  takeoffId: string;
  workPhase: string;
  description: string;
  quantity: number;
  unit: string;
  wastePercent: number;
  notes: string;
}

export interface FormFieldDefinition {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
}

export interface FormTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: FormFieldDefinition[];
  active: boolean;
}

export interface FormSubmission {
  id: string;
  templateId: string;
  projectId?: string;
  title: string;
  status: FormSubmissionStatus;
  data: Record<string, unknown>;
  submittedAt?: string;
  submittedBy?: string;
}

type Row = Record<string, unknown>;

function toRow(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tietueen.');
  }
  return value as Row;
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? (row[key] as string) : '';
}

function optionalText(row: Row, key: string): string | undefined {
  const value = text(row, key);
  return value || undefined;
}

function numeric(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function booleanValue(row: Row, key: string, fallback = false): boolean {
  return typeof row[key] === 'boolean' ? (row[key] as boolean) : fallback;
}

function objectValue(row: Row, key: string): Record<string, unknown> {
  const value = row[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fieldsValue(row: Row): FormFieldDefinition[] {
  const value = row.fields;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const field = item as Record<string, unknown>;
    const type = typeof field.type === 'string' && ['text', 'number', 'date', 'checkbox', 'textarea'].includes(field.type)
      ? (field.type as FormFieldType)
      : 'text';
    const label = typeof field.label === 'string' ? field.label : '';
    if (!label) return [];
    return [{
      id: typeof field.id === 'string' ? field.id : crypto.randomUUID(),
      label,
      type,
      required: field.required === true,
    }];
  });
}

async function fetchRows(table: string, organizationId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId);
  if (error) throw new Error(`${table}-tietojen haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(toRow);
}

async function loadFinanceForms(organizationId: string) {
  const [estimateRows, estimateLineRows, takeoffRows, takeoffLineRows, templateRows, submissionRows] = await Promise.all([
    fetchRows('estimates', organizationId),
    fetchRows('estimate_lines', organizationId),
    fetchRows('quantity_takeoffs', organizationId),
    fetchRows('quantity_takeoff_lines', organizationId),
    fetchRows('form_templates', organizationId),
    fetchRows('form_submissions', organizationId),
  ]);

  const estimates: Estimate[] = estimateRows.map((row) => ({
    id: text(row, 'id'),
    projectId: optionalText(row, 'project_id'),
    projectName: text(row, 'project_name'),
    name: text(row, 'name'),
    status: ['Hyväksytty', 'Arkistoitu'].includes(text(row, 'status'))
      ? (text(row, 'status') as EstimateStatus)
      : 'Luonnos',
    vatRate: numeric(row, 'vat_rate'),
    overheadPercent: numeric(row, 'overhead_percent'),
    riskPercent: numeric(row, 'risk_percent'),
    marginPercent: numeric(row, 'margin_percent'),
    notes: text(row, 'notes'),
  }));

  const estimateLines: EstimateLine[] = estimateLineRows.map((row) => ({
    id: text(row, 'id'),
    estimateId: text(row, 'estimate_id'),
    category: text(row, 'category'),
    description: text(row, 'description'),
    quantity: numeric(row, 'quantity'),
    unit: text(row, 'unit'),
    unitPriceCents: numeric(row, 'unit_price_cents'),
  }));

  const takeoffs: QuantityTakeoff[] = takeoffRows.map((row) => ({
    id: text(row, 'id'),
    projectId: optionalText(row, 'project_id'),
    projectName: text(row, 'project_name'),
    name: text(row, 'name'),
    status: ['Valmis', 'Arkistoitu'].includes(text(row, 'status'))
      ? (text(row, 'status') as TakeoffStatus)
      : 'Luonnos',
    notes: text(row, 'notes'),
  }));

  const takeoffLines: QuantityTakeoffLine[] = takeoffLineRows.map((row) => ({
    id: text(row, 'id'),
    takeoffId: text(row, 'takeoff_id'),
    workPhase: text(row, 'work_phase'),
    description: text(row, 'description'),
    quantity: numeric(row, 'quantity'),
    unit: text(row, 'unit'),
    wastePercent: numeric(row, 'waste_percent'),
    notes: text(row, 'notes'),
  }));

  const templates: FormTemplate[] = templateRows.map((row) => ({
    id: text(row, 'id'),
    name: text(row, 'name'),
    category: text(row, 'category'),
    description: text(row, 'description'),
    fields: fieldsValue(row),
    active: booleanValue(row, 'active', true),
  }));

  const submissions: FormSubmission[] = submissionRows.map((row) => ({
    id: text(row, 'id'),
    templateId: text(row, 'template_id'),
    projectId: optionalText(row, 'project_id'),
    title: text(row, 'title'),
    status: ['Lähetetty', 'Hyväksytty', 'Hylätty'].includes(text(row, 'status'))
      ? (text(row, 'status') as FormSubmissionStatus)
      : 'Luonnos',
    data: objectValue(row, 'data'),
    submittedAt: optionalText(row, 'submitted_at'),
    submittedBy: optionalText(row, 'submitted_by'),
  }));

  return { estimates, estimateLines, takeoffs, takeoffLines, templates, submissions };
}

export function useFinanceFormsData() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = ['finance-forms-data', organizationId ?? 'none'] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => loadFinanceForms(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 20_000,
    retry: 1,
  });

  return {
    estimates: query.data?.estimates ?? [],
    estimateLines: query.data?.estimateLines ?? [],
    takeoffs: query.data?.takeoffs ?? [],
    takeoffLines: query.data?.takeoffLines ?? [],
    templates: query.data?.templates ?? [],
    submissions: query.data?.submissions ?? [],
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
