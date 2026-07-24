import { supabase } from './client';
import type {
  Estimate,
  EstimateLine,
  FormSubmission,
  FormTemplate,
  QuantityTakeoff,
  QuantityTakeoffLine,
} from '@/hooks/useFinanceFormsData';

type TableName =
  | 'estimates'
  | 'estimate_lines'
  | 'quantity_takeoffs'
  | 'quantity_takeoff_lines'
  | 'form_templates'
  | 'form_submissions';

type Payload = Record<string, unknown>;

async function insert(table: TableName, payload: Payload): Promise<void> {
  const { error } = await supabase.from(table).insert(payload);
  if (error) throw new Error(`Tallennus epäonnistui: ${error.message}`);
}

async function update(
  table: TableName,
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

async function remove(table: TableName, organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);
  if (error) throw new Error(`Poistaminen epäonnistui: ${error.message}`);
}

function base(organizationId: string, userId?: string): Payload {
  return {
    organization_id: organizationId,
    ...(userId ? { created_by: userId } : {}),
  };
}

function estimatePayload(value: Omit<Estimate, 'id'> | Partial<Estimate>): Payload {
  const payload: Payload = {};
  if (value.projectId !== undefined) payload.project_id = value.projectId || null;
  if (value.projectName !== undefined) payload.project_name = value.projectName || null;
  if (value.name !== undefined) payload.name = value.name;
  if (value.status !== undefined) payload.status = value.status;
  if (value.vatRate !== undefined) payload.vat_rate = value.vatRate;
  if (value.overheadPercent !== undefined) payload.overhead_percent = value.overheadPercent;
  if (value.riskPercent !== undefined) payload.risk_percent = value.riskPercent;
  if (value.marginPercent !== undefined) payload.margin_percent = value.marginPercent;
  if (value.notes !== undefined) payload.notes = value.notes || null;
  return payload;
}

export const createEstimate = (
  organizationId: string,
  userId: string | undefined,
  estimate: Omit<Estimate, 'id'>,
) => insert('estimates', { ...base(organizationId, userId), ...estimatePayload(estimate) });

export const updateEstimate = (
  organizationId: string,
  id: string,
  estimate: Partial<Estimate>,
) => update('estimates', organizationId, id, estimatePayload(estimate));

export const deleteEstimate = (organizationId: string, id: string) =>
  remove('estimates', organizationId, id);

function estimateLinePayload(value: Omit<EstimateLine, 'id'> | Partial<EstimateLine>): Payload {
  const payload: Payload = {};
  if (value.estimateId !== undefined) payload.estimate_id = value.estimateId;
  if (value.category !== undefined) payload.category = value.category;
  if (value.description !== undefined) payload.description = value.description;
  if (value.quantity !== undefined) payload.quantity = value.quantity;
  if (value.unit !== undefined) payload.unit = value.unit;
  if (value.unitPriceCents !== undefined) payload.unit_price_cents = value.unitPriceCents;
  return payload;
}

export const createEstimateLine = (
  organizationId: string,
  userId: string | undefined,
  line: Omit<EstimateLine, 'id'>,
) => insert('estimate_lines', { ...base(organizationId, userId), ...estimateLinePayload(line) });

export const updateEstimateLine = (
  organizationId: string,
  id: string,
  line: Partial<EstimateLine>,
) => update('estimate_lines', organizationId, id, estimateLinePayload(line));

export const deleteEstimateLine = (organizationId: string, id: string) =>
  remove('estimate_lines', organizationId, id);

function takeoffPayload(value: Omit<QuantityTakeoff, 'id'> | Partial<QuantityTakeoff>): Payload {
  const payload: Payload = {};
  if (value.projectId !== undefined) payload.project_id = value.projectId || null;
  if (value.projectName !== undefined) payload.project_name = value.projectName || null;
  if (value.name !== undefined) payload.name = value.name;
  if (value.status !== undefined) payload.status = value.status;
  if (value.notes !== undefined) payload.notes = value.notes || null;
  return payload;
}

export const createTakeoff = (
  organizationId: string,
  userId: string | undefined,
  takeoff: Omit<QuantityTakeoff, 'id'>,
) => insert('quantity_takeoffs', { ...base(organizationId, userId), ...takeoffPayload(takeoff) });

export const updateTakeoff = (
  organizationId: string,
  id: string,
  takeoff: Partial<QuantityTakeoff>,
) => update('quantity_takeoffs', organizationId, id, takeoffPayload(takeoff));

export const deleteTakeoff = (organizationId: string, id: string) =>
  remove('quantity_takeoffs', organizationId, id);

function takeoffLinePayload(
  value: Omit<QuantityTakeoffLine, 'id'> | Partial<QuantityTakeoffLine>,
): Payload {
  const payload: Payload = {};
  if (value.takeoffId !== undefined) payload.takeoff_id = value.takeoffId;
  if (value.workPhase !== undefined) payload.work_phase = value.workPhase;
  if (value.description !== undefined) payload.description = value.description;
  if (value.quantity !== undefined) payload.quantity = value.quantity;
  if (value.unit !== undefined) payload.unit = value.unit;
  if (value.wastePercent !== undefined) payload.waste_percent = value.wastePercent;
  if (value.notes !== undefined) payload.notes = value.notes || null;
  return payload;
}

export const createTakeoffLine = (
  organizationId: string,
  userId: string | undefined,
  line: Omit<QuantityTakeoffLine, 'id'>,
) => insert('quantity_takeoff_lines', { ...base(organizationId, userId), ...takeoffLinePayload(line) });

export const updateTakeoffLine = (
  organizationId: string,
  id: string,
  line: Partial<QuantityTakeoffLine>,
) => update('quantity_takeoff_lines', organizationId, id, takeoffLinePayload(line));

export const deleteTakeoffLine = (organizationId: string, id: string) =>
  remove('quantity_takeoff_lines', organizationId, id);

function templatePayload(value: Omit<FormTemplate, 'id'> | Partial<FormTemplate>): Payload {
  const payload: Payload = {};
  if (value.name !== undefined) payload.name = value.name;
  if (value.category !== undefined) payload.category = value.category;
  if (value.description !== undefined) payload.description = value.description || null;
  if (value.fields !== undefined) payload.fields = value.fields;
  if (value.active !== undefined) payload.active = value.active;
  return payload;
}

export const createFormTemplate = (
  organizationId: string,
  userId: string | undefined,
  template: Omit<FormTemplate, 'id'>,
) => insert('form_templates', { ...base(organizationId, userId), ...templatePayload(template) });

export const updateFormTemplate = (
  organizationId: string,
  id: string,
  template: Partial<FormTemplate>,
) => update('form_templates', organizationId, id, templatePayload(template));

export const deleteFormTemplate = (organizationId: string, id: string) =>
  remove('form_templates', organizationId, id);

function submissionPayload(
  value: Omit<FormSubmission, 'id'> | Partial<FormSubmission>,
): Payload {
  const payload: Payload = {};
  if (value.templateId !== undefined) payload.template_id = value.templateId;
  if (value.projectId !== undefined) payload.project_id = value.projectId || null;
  if (value.title !== undefined) payload.title = value.title;
  if (value.status !== undefined) payload.status = value.status;
  if (value.data !== undefined) payload.data = value.data;
  if (value.submittedAt !== undefined) payload.submitted_at = value.submittedAt || null;
  return payload;
}

export async function createFormSubmission(
  organizationId: string,
  userId: string | undefined,
  submission: Omit<FormSubmission, 'id'>,
): Promise<void> {
  const payload = submissionPayload(submission);
  await insert('form_submissions', {
    organization_id: organizationId,
    ...(userId ? { submitted_by: userId } : {}),
    ...payload,
  });
}

export const updateFormSubmission = (
  organizationId: string,
  id: string,
  submission: Partial<FormSubmission>,
) => update('form_submissions', organizationId, id, submissionPayload(submission));

export const deleteFormSubmission = (organizationId: string, id: string) =>
  remove('form_submissions', organizationId, id);
