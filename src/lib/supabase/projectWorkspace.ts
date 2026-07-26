import { supabase } from './client';

export interface ProjectWorkspaceSummary {
  openWorkOrders: number;
  pendingHours: number;
  approvedHours: number;
  openSafetyItems: number;
  openFindings: number;
  documents: number;
  changeOrderAmountCents: number;
  changeOrderCostCents: number;
}

export interface ProjectActivityEvent {
  id: string;
  projectId: string;
  eventType: 'work_order' | 'time_entry' | 'safety' | 'diary' | 'document' | 'change_order';
  title: string;
  detail: string;
  eventAt: string;
  actorId?: string;
}

export interface ProjectDocument {
  id: string;
  projectId?: string;
  documentType: string;
  title: string;
  description?: string;
  version: number;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdBy?: string;
  createdAt: string;
  archivedAt?: string;
}

export type ChangeOrderStatus =
  | 'Luonnos'
  | 'Lähetetty'
  | 'Hyväksytty'
  | 'Hylätty'
  | 'Toteutuksessa'
  | 'Valmis';

export interface ChangeOrder {
  id: string;
  projectId: string;
  changeNumber?: string;
  title: string;
  description?: string;
  status: ChangeOrderStatus;
  amountCents: number;
  costCents: number;
  requestedAt?: string;
  approvedAt?: string;
  approvedByName?: string;
  createdAt: string;
  updatedAt: string;
}

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function optionalText(row: Row, key: string): string | undefined {
  const value = text(row, key);
  return value || undefined;
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function objectRow(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tietueen.');
  }
  return value as Row;
}

function mapSummary(value: unknown): ProjectWorkspaceSummary {
  const row = objectRow(value);
  return {
    openWorkOrders: numberValue(row, 'open_work_orders'),
    pendingHours: numberValue(row, 'pending_hours'),
    approvedHours: numberValue(row, 'approved_hours'),
    openSafetyItems: numberValue(row, 'open_safety_items'),
    openFindings: numberValue(row, 'open_findings'),
    documents: numberValue(row, 'documents'),
    changeOrderAmountCents: numberValue(row, 'change_order_amount_cents'),
    changeOrderCostCents: numberValue(row, 'change_order_cost_cents'),
  };
}

function mapActivity(value: unknown): ProjectActivityEvent {
  const row = objectRow(value);
  return {
    id: text(row, 'id'),
    projectId: text(row, 'project_id'),
    eventType: text(row, 'event_type') as ProjectActivityEvent['eventType'],
    title: text(row, 'title'),
    detail: text(row, 'detail'),
    eventAt: text(row, 'event_at'),
    actorId: optionalText(row, 'actor_id'),
  };
}

function mapDocument(value: unknown): ProjectDocument {
  const row = objectRow(value);
  return {
    id: text(row, 'id'),
    projectId: optionalText(row, 'project_id'),
    documentType: text(row, 'document_type'),
    title: text(row, 'title'),
    description: optionalText(row, 'description'),
    version: numberValue(row, 'version'),
    storagePath: text(row, 'storage_path'),
    fileName: text(row, 'file_name'),
    mimeType: text(row, 'mime_type'),
    sizeBytes: numberValue(row, 'size_bytes'),
    createdBy: optionalText(row, 'created_by'),
    createdAt: text(row, 'created_at'),
    archivedAt: optionalText(row, 'archived_at'),
  };
}

function mapChangeOrder(value: unknown): ChangeOrder {
  const row = objectRow(value);
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
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export async function loadProjectWorkspaceSummary(
  organizationId: string,
  projectId: string,
): Promise<ProjectWorkspaceSummary> {
  const { data, error } = await supabase.rpc('get_project_workspace_summary', {
    p_organization_id: organizationId,
    p_project_id: projectId,
  });
  if (error) throw new Error(`Projektin yhteenvedon haku epäonnistui: ${error.message}`);
  return mapSummary(data);
}

export async function listProjectActivity(
  organizationId: string,
  projectId: string,
): Promise<ProjectActivityEvent[]> {
  const { data, error } = await supabase
    .from('project_activity_feed')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .order('event_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`Projektin tapahtumien haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(mapActivity);
}

export async function listProjectDocuments(
  organizationId: string,
  projectId: string,
): Promise<ProjectDocument[]> {
  const { data, error } = await supabase
    .from('project_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Dokumenttien haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(mapDocument);
}

export async function listChangeOrders(
  organizationId: string,
  projectId: string,
): Promise<ChangeOrder[]> {
  const { data, error } = await supabase
    .from('change_orders')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Muutostöiden haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(mapChangeOrder);
}

function safeFileName(name: string): string {
  const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'tiedosto';
}

export async function uploadProjectDocument(input: {
  organizationId: string;
  projectId: string;
  userId: string;
  file: File;
  title: string;
  documentType: string;
  description?: string;
}): Promise<void> {
  const documentId = crypto.randomUUID();
  const fileName = safeFileName(input.file.name);
  const storagePath = `${input.organizationId}/${input.projectId}/${documentId}/${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from('project-documents')
    .upload(storagePath, input.file, { upsert: false, contentType: input.file.type });
  if (uploadError) throw new Error(`Tiedoston lataus epäonnistui: ${uploadError.message}`);

  const { error: insertError } = await supabase.from('project_documents').insert({
    id: documentId,
    organization_id: input.organizationId,
    project_id: input.projectId,
    document_type: input.documentType,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    storage_path: storagePath,
    file_name: input.file.name,
    mime_type: input.file.type || 'application/octet-stream',
    size_bytes: input.file.size,
    created_by: input.userId,
  });

  if (insertError) {
    await supabase.storage.from('project-documents').remove([storagePath]);
    throw new Error(`Dokumentin tietojen tallennus epäonnistui: ${insertError.message}`);
  }
}

export async function createProjectDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('project-documents')
    .createSignedUrl(storagePath, 600);
  if (error || !data?.signedUrl) {
    throw new Error(`Dokumentin avaaminen epäonnistui: ${error?.message ?? 'linkkiä ei voitu luoda'}`);
  }
  return data.signedUrl;
}

export async function archiveProjectDocument(
  organizationId: string,
  documentId: string,
): Promise<void> {
  const { error } = await supabase
    .from('project_documents')
    .update({ archived_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .eq('id', documentId);
  if (error) throw new Error(`Dokumentin arkistointi epäonnistui: ${error.message}`);
}

export async function createChangeOrder(input: {
  organizationId: string;
  projectId: string;
  userId?: string;
  changeNumber?: string;
  title: string;
  description?: string;
  status: ChangeOrderStatus;
  amountCents: number;
  costCents: number;
  requestedAt?: string;
}): Promise<void> {
  const { error } = await supabase.from('change_orders').insert({
    organization_id: input.organizationId,
    project_id: input.projectId,
    created_by: input.userId,
    change_number: input.changeNumber?.trim() || null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: input.status,
    amount_cents: input.amountCents,
    cost_cents: input.costCents,
    requested_at: input.requestedAt || null,
  });
  if (error) throw new Error(`Muutostyön tallennus epäonnistui: ${error.message}`);
}

export async function updateChangeOrderStatus(
  organizationId: string,
  changeOrderId: string,
  status: ChangeOrderStatus,
): Promise<void> {
  const approved = status === 'Hyväksytty';
  const { error } = await supabase
    .from('change_orders')
    .update({
      status,
      approved_at: approved ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('organization_id', organizationId)
    .eq('id', changeOrderId);
  if (error) throw new Error(`Muutostyön tilan päivitys epäonnistui: ${error.message}`);
}
