import { customerPreviewRpcArgs, type CustomerPreviewScope } from '@/lib/customerPortalAccess';
import { supabase } from '@/lib/supabase/client';
import {
  loadCustomerProjectChangeOrders,
  loadCustomerProjectDocuments,
  type CustomerProjectChangeOrder,
  type CustomerProjectDocument,
} from '@/lib/supabase/customerCollaboration';
import {
  loadCustomerProjectSummaries,
  loadProjectRequests,
  loadProjectConversationContext,
  type CustomerProjectSummary,
  type ProjectConversationContext,
  type ProjectRequest,
} from '@/lib/supabase/projectCollaboration';
import {
  loadCustomerWorkRequests,
  type CustomerRequestStatus,
  type CustomerRequestUrgency,
  type CustomerWorkRequest,
} from '@/lib/supabase/customerWorkRequests';

export interface CustomerPortalAccountV2 {
  customerId: string;
  customerName: string;
  accessScope: string;
  visibleProjectCount: number;
}

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
  return text(row, key) || null;
}

function numberValue(row: Row, key: string): number {
  const parsed = Number(row[key]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapProject(row: Row): CustomerProjectSummary {
  return {
    id: text(row, 'id'),
    customerId: text(row, 'customer_id'),
    name: text(row, 'name'),
    location: nullableText(row, 'location'),
    status: text(row, 'status'),
    startDate: nullableText(row, 'start_date'),
    endDate: nullableText(row, 'end_date'),
    progress: numberValue(row, 'progress'),
    description: nullableText(row, 'description'),
    supervisorName: nullableText(row, 'supervisor_name'),
    supervisorEmail: nullableText(row, 'supervisor_email'),
  };
}

function mapRequest(row: Row): ProjectRequest {
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    customerId: text(row, 'customer_id'),
    customerName: text(row, 'customer_name'),
    createdBy: text(row, 'created_by'),
    projectName: text(row, 'project_name'),
    location: text(row, 'location'),
    description: text(row, 'description'),
    desiredStartDate: text(row, 'desired_start_date'),
    desiredEndDate: text(row, 'desired_end_date'),
    contactName: text(row, 'contact_name'),
    contactPhone: text(row, 'contact_phone'),
    status: text(row, 'status') as ProjectRequest['status'],
    managementNote: text(row, 'management_note'),
    convertedProjectId: text(row, 'converted_project_id'),
    createdAt: text(row, 'created_at'),
    reviewedAt: text(row, 'reviewed_at'),
  };
}

function mapWorkRequest(row: Row): CustomerWorkRequest {
  const urgency = text(row, 'urgency');
  const status = text(row, 'status');
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    customerId: text(row, 'customer_id'),
    projectId: text(row, 'project_id'),
    createdBy: text(row, 'created_by'),
    title: text(row, 'title'),
    category: text(row, 'category'),
    description: text(row, 'description'),
    locationDetails: text(row, 'location_details'),
    contactName: text(row, 'contact_name'),
    contactPhone: text(row, 'contact_phone'),
    requestedDate: text(row, 'requested_date'),
    preferredTime: text(row, 'preferred_time'),
    urgency: (urgency === 'Kiireellinen' || urgency === 'Ei kiireellinen' ? urgency : 'Normaali') as CustomerRequestUrgency,
    accessInstructions: text(row, 'access_instructions'),
    safetyNotes: text(row, 'safety_notes'),
    status: (['Uusi', 'Käsittelyssä', 'Työmääräys luotu', 'Peruttu'].includes(status) ? status : 'Uusi') as CustomerRequestStatus,
    supervisorNote: text(row, 'supervisor_note'),
    workOrderId: text(row, 'work_order_id'),
    createdAt: text(row, 'created_at'),
  };
}

function mapDocument(row: Row): CustomerProjectDocument {
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
    visibleToCustomer: true,
  };
}

function mapChangeOrder(row: Row): CustomerProjectChangeOrder {
  return {
    id: text(row, 'id'),
    projectId: text(row, 'project_id'),
    changeNumber: nullableText(row, 'change_number'),
    title: text(row, 'title'),
    description: nullableText(row, 'description'),
    status: text(row, 'status'),
    amountCents: numberValue(row, 'amount_cents'),
    requestedAt: nullableText(row, 'requested_at'),
    customerDecision: nullableText(row, 'customer_decision') as CustomerProjectChangeOrder['customerDecision'],
    customerDecisionNote: nullableText(row, 'customer_decision_note'),
    submittedToCustomerAt: nullableText(row, 'submitted_to_customer_at'),
    customerDecidedAt: nullableText(row, 'customer_decided_at'),
  };
}

export async function loadPortalAccounts(
  organizationId: string,
  preview?: CustomerPreviewScope | null,
): Promise<CustomerPortalAccountV2[]> {
  const { data, error } = preview
    ? await supabase.rpc('admin_preview_customer_accounts_v2', {
      p_organization_id: organizationId,
      ...customerPreviewRpcArgs(preview),
    })
    : await supabase.rpc('customer_portal_accounts_v2', {
      p_organization_id: organizationId,
    });
  if (error) throw new Error(`Tilaajatietojen haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    customerId: text(row, 'customer_id'),
    customerName: text(row, 'customer_name'),
    accessScope: text(row, 'access_scope'),
    visibleProjectCount: numberValue(row, 'visible_project_count'),
  })).filter((item) => item.customerId);
}

export async function loadPortalProjects(
  organizationId: string,
  preview?: CustomerPreviewScope | null,
): Promise<CustomerProjectSummary[]> {
  if (!preview) return loadCustomerProjectSummaries(organizationId);
  const { data, error } = await supabase.rpc('admin_preview_customer_project_summaries', {
    p_organization_id: organizationId,
    ...customerPreviewRpcArgs(preview),
  });
  if (error) throw new Error(`Projektien haku epäonnistui: ${error.message}`);
  return rows(data).map(mapProject).filter((item) => item.id);
}

export async function loadPortalProjectRequests(
  organizationId: string,
  preview?: CustomerPreviewScope | null,
): Promise<ProjectRequest[]> {
  if (!preview) return loadProjectRequests(organizationId);
  const { data, error } = await supabase.rpc('admin_preview_project_requests', {
    p_organization_id: organizationId,
    ...customerPreviewRpcArgs(preview),
  });
  if (error) throw new Error(`Projektipyyntöjen haku epäonnistui: ${error.message}`);
  return rows(data).map(mapRequest).filter((item) => item.id);
}

export async function loadPortalProjectContext(
  organizationId: string,
  projectId: string,
  preview?: CustomerPreviewScope | null,
): Promise<ProjectConversationContext> {
  if (!preview) return loadProjectConversationContext(projectId);
  const { data, error } = await supabase.rpc('admin_preview_customer_project_context', {
    p_organization_id: organizationId,
    p_project_id: projectId,
    ...customerPreviewRpcArgs(preview),
  });
  if (error) throw new Error(`Projektin tietojen haku epäonnistui: ${error.message}`);
  const row = rows(data)[0];
  if (!row) throw new Error('Projektia ei löytynyt tai se ei kuulu esikatselun rajaukseen.');
  return {
    projectId: text(row, 'project_id'),
    projectName: text(row, 'project_name'),
    customerName: text(row, 'customer_name'),
    location: nullableText(row, 'location'),
    status: text(row, 'status'),
    startDate: nullableText(row, 'start_date'),
    endDate: nullableText(row, 'end_date'),
    progress: numberValue(row, 'progress'),
    description: nullableText(row, 'description'),
    canUseInternal: false,
  };
}

export async function loadPortalWorkRequests(
  organizationId: string,
  preview?: CustomerPreviewScope | null,
): Promise<CustomerWorkRequest[]> {
  if (!preview) return loadCustomerWorkRequests(organizationId);
  const { data, error } = await supabase.rpc('admin_preview_customer_work_requests', {
    p_organization_id: organizationId,
    ...customerPreviewRpcArgs(preview),
  });
  if (error) throw new Error(`Työpyyntöjen haku epäonnistui: ${error.message}`);
  return rows(data).map(mapWorkRequest).filter((item) => item.id);
}

export async function loadPortalDocuments(
  organizationId: string,
  projectId: string,
  preview?: CustomerPreviewScope | null,
): Promise<CustomerProjectDocument[]> {
  if (!preview) return loadCustomerProjectDocuments(projectId);
  const { data, error } = await supabase.rpc('admin_preview_customer_documents', {
    p_organization_id: organizationId,
    p_project_id: projectId,
    ...customerPreviewRpcArgs(preview),
  });
  if (error) throw new Error(`Dokumenttien haku epäonnistui: ${error.message}`);
  return rows(data).map(mapDocument).filter((item) => item.id);
}

export async function loadPortalChangeOrders(
  organizationId: string,
  projectId: string,
  preview?: CustomerPreviewScope | null,
): Promise<CustomerProjectChangeOrder[]> {
  if (!preview) return loadCustomerProjectChangeOrders(projectId);
  const { data, error } = await supabase.rpc('admin_preview_customer_change_orders', {
    p_organization_id: organizationId,
    p_project_id: projectId,
    ...customerPreviewRpcArgs(preview),
  });
  if (error) throw new Error(`Lisä- ja muutostöiden haku epäonnistui: ${error.message}`);
  return rows(data).map(mapChangeOrder).filter((item) => item.id);
}
