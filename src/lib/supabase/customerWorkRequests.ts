import { supabase } from '@/lib/supabase/client';
import type { WorkAssignmentScope, WorkOrderPriority } from '@/types';

export type CustomerRequestStatus = 'Uusi' | 'Käsittelyssä' | 'Työmääräys luotu' | 'Peruttu';
export type CustomerRequestUrgency = 'Kiireellinen' | 'Normaali' | 'Ei kiireellinen';

export interface CustomerPortalCustomer {
  customerId: string;
}

export interface CustomerPortalProject {
  id: string;
  customerId: string;
  name: string;
  location: string | null;
}

export interface CustomerWorkRequest {
  id: string;
  organizationId: string;
  customerId: string;
  projectId: string;
  createdBy: string;
  title: string;
  category: string;
  description: string;
  locationDetails: string;
  contactName: string;
  contactPhone: string;
  requestedDate: string;
  preferredTime: string;
  urgency: CustomerRequestUrgency;
  accessInstructions: string;
  safetyNotes: string;
  status: CustomerRequestStatus;
  supervisorNote: string;
  workOrderId: string;
  createdAt: string;
}

function toRequest(row: Record<string, unknown>): CustomerWorkRequest {
  const text = (key: string) => typeof row[key] === 'string' ? row[key] as string : '';
  const urgency = text('urgency');
  const status = text('status');
  return {
    id: text('id'), organizationId: text('organization_id'), customerId: text('customer_id'),
    projectId: text('project_id'), createdBy: text('created_by'), title: text('title'),
    category: text('category'), description: text('description'), locationDetails: text('location_details'),
    contactName: text('contact_name'), contactPhone: text('contact_phone'), requestedDate: text('requested_date'),
    preferredTime: text('preferred_time'),
    urgency: urgency === 'Kiireellinen' || urgency === 'Ei kiireellinen' ? urgency : 'Normaali',
    accessInstructions: text('access_instructions'), safetyNotes: text('safety_notes'),
    status: ['Uusi', 'Käsittelyssä', 'Työmääräys luotu', 'Peruttu'].includes(status)
      ? status as CustomerRequestStatus : 'Uusi',
    supervisorNote: text('supervisor_note'), workOrderId: text('work_order_id'), createdAt: text('created_at'),
  };
}

export async function loadCustomerPortalCustomers(organizationId: string): Promise<CustomerPortalCustomer[]> {
  const { data, error } = await supabase.from('customer_users')
    .select('customer_id').eq('organization_id', organizationId);
  if (error) throw new Error(`Tilaajatietojen haku epäonnistui: ${error.message}`);
  return (data ?? []).flatMap((row) => typeof row.customer_id === 'string' ? [{ customerId: row.customer_id }] : []);
}

export async function loadCustomerPortalProjects(organizationId: string): Promise<CustomerPortalProject[]> {
  const { data, error } = await supabase.rpc('customer_portal_projects', { p_organization_id: organizationId });
  if (error) throw new Error(`Kohteiden haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const source = row as Record<string, unknown>;
    return typeof source.id === 'string' && typeof source.customer_id === 'string' && typeof source.name === 'string'
      ? [{ id: source.id, customerId: source.customer_id, name: source.name, location: typeof source.location === 'string' ? source.location : null }]
      : [];
  });
}

export async function loadCustomerWorkRequests(organizationId: string): Promise<CustomerWorkRequest[]> {
  const { data, error } = await supabase.from('customer_work_requests')
    .select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
  if (error) throw new Error(`Tilausten haku epäonnistui: ${error.message}`);
  return (data ?? []).map((row) => toRequest(row as Record<string, unknown>));
}

export async function createCustomerWorkRequest(values: {
  organizationId: string;
  customerId: string;
  projectId: string;
  title: string;
  category: string;
  description: string;
  locationDetails?: string;
  contactName?: string;
  contactPhone?: string;
  requestedDate?: string;
  preferredTime?: string;
  urgency: CustomerRequestUrgency;
  accessInstructions?: string;
  safetyNotes?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_customer_work_request', {
    p_organization_id: values.organizationId, p_customer_id: values.customerId, p_project_id: values.projectId,
    p_title: values.title, p_category: values.category, p_description: values.description,
    p_location_details: values.locationDetails || null, p_contact_name: values.contactName || null,
    p_contact_phone: values.contactPhone || null, p_requested_date: values.requestedDate || null,
    p_preferred_time: values.preferredTime || null, p_urgency: values.urgency,
    p_access_instructions: values.accessInstructions || null, p_safety_notes: values.safetyNotes || null,
  });
  if (error) throw new Error(`Tilauksen lähetys epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tietokanta ei palauttanut tilauksen tunnistetta.');
  return data;
}

export async function convertCustomerWorkRequest(values: {
  requestId: string;
  priority: WorkOrderPriority;
  dueDate?: string;
  assignmentScope: WorkAssignmentScope;
  assigneeUserIds: string[];
  supervisorNote?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('convert_customer_work_request', {
    p_request_id: values.requestId, p_priority: values.priority, p_due_date: values.dueDate || null,
    p_assignment_scope: values.assignmentScope, p_assignee_user_ids: values.assigneeUserIds,
    p_supervisor_note: values.supervisorNote || null,
  });
  if (error) throw new Error(`Työmääräyksen luonti epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Tietokanta ei palauttanut työmääräyksen tunnistetta.');
  return data;
}
