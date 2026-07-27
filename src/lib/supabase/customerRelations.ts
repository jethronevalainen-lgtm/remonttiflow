import { supabase } from './client';

type Row = Record<string, unknown>;

function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tietokanta palautti virheellisen tietueen.');
  }
  return value as Row;
}

function text(item: Row, key: string): string {
  return typeof item[key] === 'string' ? item[key] as string : '';
}

function optionalText(item: Row, key: string): string | undefined {
  return text(item, key) || undefined;
}

function booleanValue(item: Row, key: string): boolean {
  return item[key] === true;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  title?: string;
  role?: string;
  email?: string;
  phone?: string;
  preferredChannel?: string;
  receivesQuotes: boolean;
  receivesReports: boolean;
  receivesInvoices: boolean;
  availabilityNotes?: string;
  isPrimary: boolean;
  notes?: string;
  createdAt: string;
}

export interface CustomerSite {
  id: string;
  customerId: string;
  name: string;
  address?: string;
  postalCode?: string;
  city?: string;
  accessInstructions?: string;
  contactInstructions?: string;
  notes?: string;
  status: 'Aktiivinen' | 'Epäaktiivinen';
  createdAt: string;
}

export type CrmActivityPriority = 'Matala' | 'Normaali' | 'Korkea' | 'Kriittinen';

export interface CrmActivity {
  id: string;
  leadId?: string;
  customerId?: string;
  siteId?: string;
  projectId?: string;
  activityType: string;
  subject: string;
  description?: string;
  outcome?: string;
  priority: CrmActivityPriority;
  dueAt?: string;
  completedAt?: string;
  completedBy?: string;
  assignedUserId?: string;
  createdBy?: string;
  customerVisible: boolean;
  createdAt: string;
}

async function listRows(table: string, organizationId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`${table}-tietojen haku epäonnistui: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(row);
}

export async function loadCustomerRelations(organizationId: string) {
  const [contacts, activities, sites] = await Promise.all([
    listRows('customer_contacts', organizationId),
    listRows('crm_activities', organizationId),
    listRows('customer_sites', organizationId),
  ]);
  return {
    contacts: contacts.map((item): CustomerContact => ({
      id: text(item, 'id'),
      customerId: text(item, 'customer_id'),
      name: text(item, 'name'),
      title: optionalText(item, 'title'),
      role: optionalText(item, 'role'),
      email: optionalText(item, 'email'),
      phone: optionalText(item, 'phone'),
      preferredChannel: optionalText(item, 'preferred_channel'),
      receivesQuotes: booleanValue(item, 'receives_quotes'),
      receivesReports: booleanValue(item, 'receives_reports'),
      receivesInvoices: booleanValue(item, 'receives_invoices'),
      availabilityNotes: optionalText(item, 'availability_notes'),
      isPrimary: booleanValue(item, 'is_primary'),
      notes: optionalText(item, 'notes'),
      createdAt: text(item, 'created_at'),
    })),
    sites: sites.map((item): CustomerSite => ({
      id: text(item, 'id'),
      customerId: text(item, 'customer_id'),
      name: text(item, 'name'),
      address: optionalText(item, 'address'),
      postalCode: optionalText(item, 'postal_code'),
      city: optionalText(item, 'city'),
      accessInstructions: optionalText(item, 'access_instructions'),
      contactInstructions: optionalText(item, 'contact_instructions'),
      notes: optionalText(item, 'notes'),
      status: text(item, 'status') === 'Epäaktiivinen' ? 'Epäaktiivinen' : 'Aktiivinen',
      createdAt: text(item, 'created_at'),
    })),
    activities: activities.map((item): CrmActivity => ({
      id: text(item, 'id'),
      leadId: optionalText(item, 'lead_id'),
      customerId: optionalText(item, 'customer_id'),
      siteId: optionalText(item, 'site_id'),
      projectId: optionalText(item, 'project_id'),
      activityType: text(item, 'activity_type'),
      subject: text(item, 'subject'),
      description: optionalText(item, 'description'),
      outcome: optionalText(item, 'outcome'),
      priority: ['Matala', 'Korkea', 'Kriittinen'].includes(text(item, 'priority'))
        ? text(item, 'priority') as CrmActivityPriority
        : 'Normaali',
      dueAt: optionalText(item, 'due_at'),
      completedAt: optionalText(item, 'completed_at'),
      completedBy: optionalText(item, 'completed_by'),
      assignedUserId: optionalText(item, 'assigned_user_id'),
      createdBy: optionalText(item, 'created_by'),
      customerVisible: booleanValue(item, 'customer_visible'),
      createdAt: text(item, 'created_at'),
    })),
  };
}

export async function createCustomerContact(input: {
  organizationId: string;
  customerId: string;
  userId?: string;
  name: string;
  title?: string;
  role?: string;
  email?: string;
  phone?: string;
  preferredChannel?: string;
  receivesQuotes?: boolean;
  receivesReports?: boolean;
  receivesInvoices?: boolean;
  availabilityNotes?: string;
  isPrimary?: boolean;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('customer_contacts').insert({
    organization_id: input.organizationId,
    customer_id: input.customerId,
    created_by: input.userId,
    name: input.name.trim(),
    title: input.title?.trim() || null,
    role: input.role?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    preferred_channel: input.preferredChannel?.trim() || null,
    receives_quotes: input.receivesQuotes ?? false,
    receives_reports: input.receivesReports ?? false,
    receives_invoices: input.receivesInvoices ?? false,
    availability_notes: input.availabilityNotes?.trim() || null,
    is_primary: input.isPrimary ?? false,
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error(`Yhteyshenkilön tallennus epäonnistui: ${error.message}`);
}

export async function updateCustomerContact(input: {
  organizationId: string;
  id: string;
  name: string;
  title?: string;
  role?: string;
  email?: string;
  phone?: string;
  preferredChannel?: string;
  receivesQuotes?: boolean;
  receivesReports?: boolean;
  receivesInvoices?: boolean;
  availabilityNotes?: string;
  isPrimary?: boolean;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('customer_contacts')
    .update({
      name: input.name.trim(),
      title: input.title?.trim() || null,
      role: input.role?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      preferred_channel: input.preferredChannel?.trim() || null,
      receives_quotes: input.receivesQuotes ?? false,
      receives_reports: input.receivesReports ?? false,
      receives_invoices: input.receivesInvoices ?? false,
      availability_notes: input.availabilityNotes?.trim() || null,
      is_primary: input.isPrimary ?? false,
      notes: input.notes?.trim() || null,
    })
    .eq('organization_id', input.organizationId)
    .eq('id', input.id);
  if (error) throw new Error(`Yhteyshenkilön päivitys epäonnistui: ${error.message}`);
}

export async function deleteCustomerContact(organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('customer_contacts')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Yhteyshenkilön poistaminen epäonnistui: ${error.message}`);
}

export async function createCustomerSite(input: {
  organizationId: string;
  customerId: string;
  userId?: string;
  name: string;
  address?: string;
  postalCode?: string;
  city?: string;
  accessInstructions?: string;
  contactInstructions?: string;
  notes?: string;
}): Promise<void> {
  if (!input.customerId) throw new Error('Valitse kohteelle asiakas.');
  if (!input.name.trim()) throw new Error('Kohteen nimi on pakollinen.');
  const { error } = await supabase.from('customer_sites').insert({
    organization_id: input.organizationId,
    customer_id: input.customerId,
    created_by: input.userId,
    name: input.name.trim(),
    address: input.address?.trim() || null,
    postal_code: input.postalCode?.trim() || null,
    city: input.city?.trim() || null,
    access_instructions: input.accessInstructions?.trim() || null,
    contact_instructions: input.contactInstructions?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error(`Kohteen tallennus epäonnistui: ${error.message}`);
}

export async function updateCustomerSite(input: {
  organizationId: string;
  id: string;
  name: string;
  address?: string;
  postalCode?: string;
  city?: string;
  accessInstructions?: string;
  contactInstructions?: string;
  notes?: string;
  status?: 'Aktiivinen' | 'Epäaktiivinen';
}): Promise<void> {
  const { error } = await supabase
    .from('customer_sites')
    .update({
      name: input.name.trim(),
      address: input.address?.trim() || null,
      postal_code: input.postalCode?.trim() || null,
      city: input.city?.trim() || null,
      access_instructions: input.accessInstructions?.trim() || null,
      contact_instructions: input.contactInstructions?.trim() || null,
      notes: input.notes?.trim() || null,
      status: input.status ?? 'Aktiivinen',
    })
    .eq('organization_id', input.organizationId)
    .eq('id', input.id);
  if (error) throw new Error(`Kohteen päivitys epäonnistui: ${error.message}`);
}

export async function deleteCustomerSite(organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('customer_sites')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Kohteen poistaminen epäonnistui: ${error.message}`);
}

export async function createCrmActivity(input: {
  organizationId: string;
  leadId?: string;
  customerId?: string;
  siteId?: string;
  projectId?: string;
  userId?: string;
  assignedUserId?: string;
  activityType: string;
  subject: string;
  description?: string;
  outcome?: string;
  priority?: CrmActivityPriority;
  dueAt?: string;
  customerVisible?: boolean;
}): Promise<void> {
  if (!input.leadId && !input.customerId && !input.siteId && !input.projectId) {
    throw new Error('Liitä aktiviteetti myyntimahdollisuuteen, asiakkaaseen, kohteeseen tai projektiin.');
  }
  if (!input.subject.trim()) throw new Error('Aktiviteetin otsikko on pakollinen.');

  const { error } = await supabase.from('crm_activities').insert({
    organization_id: input.organizationId,
    lead_id: input.leadId || null,
    customer_id: input.customerId || null,
    site_id: input.siteId || null,
    project_id: input.projectId || null,
    created_by: input.userId,
    assigned_user_id: input.assignedUserId || null,
    activity_type: input.activityType.trim(),
    subject: input.subject.trim(),
    description: input.description?.trim() || null,
    outcome: input.outcome?.trim() || null,
    priority: input.priority ?? 'Normaali',
    due_at: input.dueAt || null,
    customer_visible: input.customerVisible ?? false,
  });
  if (error) throw new Error(`CRM-aktiviteetin tallennus epäonnistui: ${error.message}`);
}

export async function completeCrmActivity(
  organizationId: string,
  id: string,
  userId?: string,
  outcome?: string,
): Promise<void> {
  const { error } = await supabase
    .from('crm_activities')
    .update({
      completed_at: new Date().toISOString(),
      completed_by: userId || null,
      outcome: outcome?.trim() || null,
    })
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`CRM-aktiviteetin kuittaus epäonnistui: ${error.message}`);
}

export async function reopenCrmActivity(organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('crm_activities')
    .update({ completed_at: null, completed_by: null })
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`CRM-aktiviteetin avaaminen epäonnistui: ${error.message}`);
}

export async function deleteCrmActivity(organizationId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('crm_activities')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`CRM-aktiviteetin poistaminen epäonnistui: ${error.message}`);
}
