import { supabase } from '@/lib/supabase/client';

export interface CustomerOrderContext {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  requestType: string;
  location: string;
  description: string;
  status: string;
  desiredStartDate: string;
  desiredEndDate: string;
  deadlineFlexibility: string;
  occupancyStatus: string;
  accessMethod: string;
  allowedWorkingHours: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  managementNote: string;
  convertedProjectId: string;
  projectName: string;
  projectStatus: string;
  progress: number;
  workOrderTotal: number;
  workOrderCompleted: number;
  messageCount: number;
  createdAt: string;
  submittedAt: string;
  reviewedAt: string;
}

export interface CustomerOrderMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
  editedAt: string;
}

export interface CustomerOrderEvent {
  id: string;
  eventType: string;
  title: string;
  description: string;
  progress: number | null;
  createdAt: string;
}

export interface CustomerOrderParticipant {
  userId: string;
  displayName: string;
  role: string;
  participation: string;
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

function numberValue(row: Row, key: string): number {
  const parsed = Number(row[key]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadCustomerOrderContext(organizationId: string, requestId: string): Promise<CustomerOrderContext> {
  const { data, error } = await supabase.rpc('customer_order_context', {
    p_organization_id: organizationId,
    p_request_id: requestId,
  });
  if (error) throw new Error(`Tilauksen haku epäonnistui: ${error.message}`);
  const row = rows(data)[0];
  if (!row) throw new Error('Tilausta ei löytynyt tai käyttöoikeus puuttuu.');
  return {
    id: text(row, 'id'),
    customerId: text(row, 'customer_id'),
    customerName: text(row, 'customer_name'),
    title: text(row, 'title'),
    requestType: text(row, 'request_type'),
    location: text(row, 'location'),
    description: text(row, 'description'),
    status: text(row, 'status'),
    desiredStartDate: text(row, 'desired_start_date'),
    desiredEndDate: text(row, 'desired_end_date'),
    deadlineFlexibility: text(row, 'deadline_flexibility'),
    occupancyStatus: text(row, 'occupancy_status'),
    accessMethod: text(row, 'access_method'),
    allowedWorkingHours: text(row, 'allowed_working_hours'),
    contactName: text(row, 'contact_name'),
    contactPhone: text(row, 'contact_phone'),
    contactEmail: text(row, 'contact_email'),
    managementNote: text(row, 'management_note'),
    convertedProjectId: text(row, 'converted_project_id'),
    projectName: text(row, 'project_name'),
    projectStatus: text(row, 'project_status'),
    progress: numberValue(row, 'progress'),
    workOrderTotal: numberValue(row, 'work_order_total'),
    workOrderCompleted: numberValue(row, 'work_order_completed'),
    messageCount: numberValue(row, 'message_count'),
    createdAt: text(row, 'created_at'),
    submittedAt: text(row, 'submitted_at'),
    reviewedAt: text(row, 'reviewed_at'),
  };
}

export async function loadCustomerOrderMessages(organizationId: string, requestId: string): Promise<CustomerOrderMessage[]> {
  const { data, error } = await supabase.rpc('customer_order_messages', {
    p_organization_id: organizationId,
    p_request_id: requestId,
  });
  if (error) throw new Error(`Keskustelun haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    id: text(row, 'id'),
    authorId: text(row, 'author_id'),
    authorName: text(row, 'author_name'),
    authorRole: text(row, 'author_role'),
    body: text(row, 'body'),
    createdAt: text(row, 'created_at'),
    editedAt: text(row, 'edited_at'),
  })).filter((item) => item.id);
}

export async function loadCustomerOrderEvents(organizationId: string, requestId: string): Promise<CustomerOrderEvent[]> {
  const { data, error } = await supabase.rpc('customer_order_events', {
    p_organization_id: organizationId,
    p_request_id: requestId,
  });
  if (error) throw new Error(`Tapahtumien haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    id: text(row, 'id'),
    eventType: text(row, 'event_type'),
    title: text(row, 'title'),
    description: text(row, 'description'),
    progress: row.progress === null || row.progress === undefined ? null : numberValue(row, 'progress'),
    createdAt: text(row, 'created_at'),
  })).filter((item) => item.id);
}

export async function loadCustomerOrderParticipants(organizationId: string, requestId: string): Promise<CustomerOrderParticipant[]> {
  const { data, error } = await supabase.rpc('customer_order_participants', {
    p_organization_id: organizationId,
    p_request_id: requestId,
  });
  if (error) throw new Error(`Osallistujien haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    userId: text(row, 'user_id'),
    displayName: text(row, 'display_name'),
    role: text(row, 'role'),
    participation: text(row, 'participation'),
  })).filter((item) => item.userId);
}

export async function postCustomerOrderMessage(organizationId: string, requestId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('post_customer_order_message', {
    p_organization_id: organizationId,
    p_request_id: requestId,
    p_body: body,
  });
  if (error) throw new Error(`Viestin lähetys epäonnistui: ${error.message}`);
}

export async function publishCustomerOrderEvent(input: {
  organizationId: string;
  requestId: string;
  title: string;
  description: string;
  progress?: number | null;
}): Promise<void> {
  const { error } = await supabase.rpc('publish_customer_order_event', {
    p_organization_id: input.organizationId,
    p_request_id: input.requestId,
    p_title: input.title,
    p_description: input.description || null,
    p_progress: input.progress ?? null,
  });
  if (error) throw new Error(`Tilannepäivityksen julkaisu epäonnistui: ${error.message}`);
}
