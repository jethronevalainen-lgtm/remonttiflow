import { supabase } from './client';

export type ChangeOrderStatus =
  | 'Luonnos'
  | 'Lähetetty'
  | 'Hyväksytty'
  | 'Hylätty'
  | 'Toteutuksessa'
  | 'Valmis';

export type ChangeOrderCategory = 'Työ' | 'Materiaali' | 'Kalusto' | 'Aliurakka' | 'Muu';
export type ChangeOrderDecision = 'Odottaa' | 'Hyväksytty' | 'Hylätty';

export interface ChangeOrderLine {
  id?: string;
  lineNumber: number;
  category: ChangeOrderCategory;
  description: string;
  quantity: number;
  unit: string;
  costUnitPriceCents: number;
  saleUnitPriceCents: number;
  costTotalCents: number;
  saleTotalCents: number;
  customerVisible: boolean;
}

export interface ManagedChangeOrder {
  id: string;
  projectId: string;
  changeNumber: string | null;
  title: string;
  description: string | null;
  status: ChangeOrderStatus;
  amountCents: number;
  costCents: number;
  requestedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  customerDecision: ChangeOrderDecision | null;
  customerDecisionNote: string | null;
  submittedToCustomerAt: string | null;
  customerDecidedAt: string | null;
  customerVersion: number;
  vatRate: number;
  scheduleEffectDays: number;
  decisionSource: 'customer_portal' | 'manual' | null;
  decisionEvidenceNote: string | null;
  lineCount: number;
  lines: ChangeOrderLine[];
  createdAt: string;
  updatedAt: string;
}

export interface ChangeOrderDraftLineInput {
  category: ChangeOrderCategory;
  description: string;
  quantity: number;
  unit: string;
  costUnitPriceCents: number;
  saleUnitPriceCents: number;
  customerVisible: boolean;
}

export interface SaveChangeOrderDraftInput {
  organizationId: string;
  projectId: string;
  changeOrderId?: string | null;
  title: string;
  description?: string;
  requestedAt?: string;
  vatRate: number;
  scheduleEffectDays: number;
  lines: ChangeOrderDraftLineInput[];
}

export interface ChangeOrderTotals {
  saleCents: number;
  costCents: number;
  marginCents: number;
  marginPercent: number;
}

type Row = Record<string, unknown>;

function asRow(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen muutostyötietueen.');
  }
  return value as Row;
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function optionalText(row: Row, key: string): string | null {
  const value = text(row, key);
  return value || null;
}

function numberValue(row: Row, key: string): number {
  const parsed = Number(row[key]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(row: Row, key: string): boolean {
  return row[key] === true;
}

function mapLine(value: unknown): ChangeOrderLine {
  const row = asRow(value);
  return {
    id: optionalText(row, 'id') ?? undefined,
    lineNumber: numberValue(row, 'lineNumber'),
    category: (text(row, 'category') || 'Muu') as ChangeOrderCategory,
    description: text(row, 'description'),
    quantity: numberValue(row, 'quantity'),
    unit: text(row, 'unit') || 'kpl',
    costUnitPriceCents: numberValue(row, 'costUnitPriceCents'),
    saleUnitPriceCents: numberValue(row, 'saleUnitPriceCents'),
    costTotalCents: numberValue(row, 'costTotalCents'),
    saleTotalCents: numberValue(row, 'saleTotalCents'),
    customerVisible: row.customerVisible === undefined ? true : booleanValue(row, 'customerVisible'),
  };
}

function mapManagedChangeOrder(value: unknown): ManagedChangeOrder {
  const row = asRow(value);
  const rawLines = Array.isArray(row.lines) ? row.lines : [];
  return {
    id: text(row, 'id'),
    projectId: text(row, 'project_id'),
    changeNumber: optionalText(row, 'change_number'),
    title: text(row, 'title'),
    description: optionalText(row, 'description'),
    status: text(row, 'status') as ChangeOrderStatus,
    amountCents: numberValue(row, 'amount_cents'),
    costCents: numberValue(row, 'cost_cents'),
    requestedAt: optionalText(row, 'requested_at'),
    approvedAt: optionalText(row, 'approved_at'),
    approvedByName: optionalText(row, 'approved_by_name'),
    customerDecision: optionalText(row, 'customer_decision') as ChangeOrderDecision | null,
    customerDecisionNote: optionalText(row, 'customer_decision_note'),
    submittedToCustomerAt: optionalText(row, 'submitted_to_customer_at'),
    customerDecidedAt: optionalText(row, 'customer_decided_at'),
    customerVersion: numberValue(row, 'customer_version'),
    vatRate: numberValue(row, 'vat_rate'),
    scheduleEffectDays: numberValue(row, 'schedule_effect_days'),
    decisionSource: optionalText(row, 'decision_source') as ManagedChangeOrder['decisionSource'],
    decisionEvidenceNote: optionalText(row, 'decision_evidence_note'),
    lineCount: numberValue(row, 'line_count'),
    lines: rawLines.map(mapLine),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export function calculateChangeOrderTotals(lines: ChangeOrderDraftLineInput[]): ChangeOrderTotals {
  const saleCents = lines.reduce(
    (sum, line) => sum + (line.customerVisible
      ? Math.round(line.quantity * line.saleUnitPriceCents)
      : 0),
    0,
  );
  const costCents = lines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.costUnitPriceCents),
    0,
  );
  const marginCents = saleCents - costCents;
  return {
    saleCents,
    costCents,
    marginCents,
    marginPercent: saleCents > 0 ? (marginCents / saleCents) * 100 : 0,
  };
}

export function nextChangeOrderAction(status: ChangeOrderStatus):
  | 'edit'
  | 'submit'
  | 'decision'
  | 'revise'
  | 'start'
  | 'complete'
  | 'none' {
  switch (status) {
    case 'Luonnos': return 'submit';
    case 'Lähetetty': return 'decision';
    case 'Hylätty': return 'revise';
    case 'Hyväksytty': return 'start';
    case 'Toteutuksessa': return 'complete';
    case 'Valmis': return 'none';
    default: return 'none';
  }
}

export async function listManagedChangeOrders(
  organizationId: string,
  projectId: string,
): Promise<ManagedChangeOrder[]> {
  const { data, error } = await supabase.rpc('list_management_change_orders_v2', {
    p_organization_id: organizationId,
    p_project_id: projectId,
  });
  if (error) throw new Error(`Muutostöiden haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(mapManagedChangeOrder).filter((item) => item.id);
}

export async function saveChangeOrderDraft(input: SaveChangeOrderDraftInput): Promise<string> {
  const normalizedLines = input.lines.map((line) => ({
    category: line.category,
    description: line.description.trim(),
    quantity: line.quantity,
    unit: line.unit.trim(),
    costUnitPriceCents: Math.round(line.costUnitPriceCents),
    saleUnitPriceCents: Math.round(line.saleUnitPriceCents),
    customerVisible: line.customerVisible,
  }));
  const { data, error } = await supabase.rpc('save_change_order_draft_v2', {
    p_organization_id: input.organizationId,
    p_project_id: input.projectId,
    p_change_order_id: input.changeOrderId ?? null,
    p_title: input.title.trim(),
    p_description: input.description?.trim() || null,
    p_requested_at: input.requestedAt || null,
    p_vat_rate: input.vatRate,
    p_schedule_effect_days: input.scheduleEffectDays,
    p_lines: normalizedLines,
  });
  if (error) throw new Error(`Muutostyön tallennus epäonnistui: ${error.message}`);
  if (typeof data !== 'string' || !data) throw new Error('Muutostyön tunnistetta ei saatu tallennuksesta.');
  return data;
}

export async function submitChangeOrderToCustomer(changeOrderId: string): Promise<void> {
  const { error } = await supabase.rpc('submit_change_order_to_customer_v2', {
    p_change_order_id: changeOrderId,
  });
  if (error) throw new Error(`Muutostyön lähetys tilaajalle epäonnistui: ${error.message}`);
}

export async function recordManualChangeOrderDecision(input: {
  changeOrderId: string;
  decision: Extract<ChangeOrderDecision, 'Hyväksytty' | 'Hylätty'>;
  approvedByName: string;
  evidenceNote: string;
}): Promise<void> {
  const { error } = await supabase.rpc('record_manual_change_order_decision_v2', {
    p_change_order_id: input.changeOrderId,
    p_decision: input.decision,
    p_approved_by_name: input.approvedByName.trim(),
    p_evidence_note: input.evidenceNote.trim(),
  });
  if (error) throw new Error(`Tilaajapäätöksen kirjaaminen epäonnistui: ${error.message}`);
}

export async function transitionChangeOrderExecution(
  changeOrderId: string,
  targetStatus: Extract<ChangeOrderStatus, 'Toteutuksessa' | 'Valmis'>,
): Promise<void> {
  const { error } = await supabase.rpc('transition_change_order_execution_v2', {
    p_change_order_id: changeOrderId,
    p_target_status: targetStatus,
  });
  if (error) throw new Error(`Muutostyön tilan muuttaminen epäonnistui: ${error.message}`);
}

export async function deleteChangeOrderDraft(changeOrderId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_change_order_draft_v2', {
    p_change_order_id: changeOrderId,
  });
  if (error) throw new Error(`Muutostyön luonnoksen poistaminen epäonnistui: ${error.message}`);
}
