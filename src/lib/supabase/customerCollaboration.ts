import { supabase } from '@/lib/supabase/client';

export type CustomerChangeDecision = 'Odottaa' | 'Hyväksytty' | 'Hylätty';

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value ? value : null;
}

function numberValue(row: Row, key: string): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function booleanValue(row: Row, key: string): boolean {
  return row[key] === true;
}

export interface CustomerProjectDocument {
  id: string;
  projectId: string;
  documentType: string;
  title: string;
  description: string | null;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  visibleToCustomer: boolean;
}

export interface CustomerProjectChangeOrder {
  id: string;
  projectId: string;
  changeNumber: string | null;
  title: string;
  description: string | null;
  status: string;
  amountCents: number;
  requestedAt: string | null;
  customerDecision: CustomerChangeDecision | null;
  customerDecisionNote: string | null;
  submittedToCustomerAt: string | null;
  customerDecidedAt: string | null;
}

function mapDocument(row: Row, management = false): CustomerProjectDocument {
  const roles = Array.isArray(row.visible_to_roles)
    ? row.visible_to_roles.filter((value): value is string => typeof value === 'string')
    : [];
  return {
    id: text(row, 'id'),
    projectId: text(row, 'project_id'),
    documentType: text(row, 'document_type'),
    title: text(row, 'title'),
    description: nullableText(row, 'description'),
    storagePath: text(row, 'storage_path'),
    fileName: text(row, 'file_name'),
    mimeType: text(row, 'mime_type'),
    sizeBytes: numberValue(row, 'size_bytes'),
    createdAt: text(row, 'created_at'),
    visibleToCustomer: management ? roles.includes('customer') : true,
  };
}

function mapChangeOrder(row: Row): CustomerProjectChangeOrder {
  const rawDecision = nullableText(row, 'customer_decision');
  return {
    id: text(row, 'id'),
    projectId: text(row, 'project_id'),
    changeNumber: nullableText(row, 'change_number'),
    title: text(row, 'title'),
    description: nullableText(row, 'description'),
    status: text(row, 'status'),
    amountCents: numberValue(row, 'amount_cents'),
    requestedAt: nullableText(row, 'requested_at'),
    customerDecision: rawDecision as CustomerChangeDecision | null,
    customerDecisionNote: nullableText(row, 'customer_decision_note'),
    submittedToCustomerAt: nullableText(row, 'submitted_to_customer_at'),
    customerDecidedAt: nullableText(row, 'customer_decided_at'),
  };
}

export async function loadCustomerProjectDocuments(projectId: string): Promise<CustomerProjectDocument[]> {
  const { data, error } = await supabase.rpc('customer_project_documents_v2', {
    p_project_id: projectId,
  });
  if (error) throw new Error(`Dokumenttien haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => mapDocument(row)).filter((item) => item.id);
}

export async function loadManagementProjectDocuments(
  organizationId: string,
  projectId: string,
): Promise<CustomerProjectDocument[]> {
  const { data, error } = await supabase
    .from('project_documents')
    .select('id, project_id, document_type, title, description, storage_path, file_name, mime_type, size_bytes, created_at, visible_to_roles')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Dokumenttien haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => mapDocument(row, true));
}

export async function setProjectDocumentCustomerVisibility(
  documentId: string,
  visible: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('set_project_document_customer_visibility_v2', {
    p_document_id: documentId,
    p_visible: visible,
  });
  if (error) throw new Error(`Dokumentin näkyvyyden päivitys epäonnistui: ${error.message}`);
}

export async function createCustomerDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('project-documents').createSignedUrl(storagePath, 600);
  if (error || !data?.signedUrl) {
    throw new Error(`Dokumentin avaaminen epäonnistui: ${error?.message ?? 'linkkiä ei voitu luoda'}`);
  }
  return data.signedUrl;
}

export async function loadCustomerProjectChangeOrders(projectId: string): Promise<CustomerProjectChangeOrder[]> {
  const { data, error } = await supabase.rpc('customer_project_change_orders_v2', {
    p_project_id: projectId,
  });
  if (error) throw new Error(`Lisä- ja muutostöiden haku epäonnistui: ${error.message}`);
  return rows(data).map(mapChangeOrder).filter((item) => item.id);
}

export async function loadManagementProjectChangeOrders(
  organizationId: string,
  projectId: string,
): Promise<CustomerProjectChangeOrder[]> {
  const { data, error } = await supabase
    .from('change_orders')
    .select('id, project_id, change_number, title, description, status, amount_cents, requested_at, customer_visible, customer_decision, customer_decision_note, submitted_to_customer_at, customer_decided_at')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Lisä- ja muutostöiden haku epäonnistui: ${error.message}`);
  return rows(data).filter((row) => booleanValue(row, 'customer_visible') || text(row, 'status') !== '').map(mapChangeOrder);
}

export async function submitChangeOrderToCustomer(changeOrderId: string): Promise<void> {
  const { error } = await supabase.rpc('submit_change_order_to_customer_v2', {
    p_change_order_id: changeOrderId,
  });
  if (error) throw new Error(`Muutostyön lähetys tilaajalle epäonnistui: ${error.message}`);
}

export async function decideCustomerChangeOrder(input: {
  changeOrderId: string;
  decision: Extract<CustomerChangeDecision, 'Hyväksytty' | 'Hylätty'>;
  note?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('decide_customer_change_order_v2', {
    p_change_order_id: input.changeOrderId,
    p_decision: input.decision,
    p_note: input.note || null,
  });
  if (error) throw new Error(`Muutostyön päätöksen tallennus epäonnistui: ${error.message}`);
}
