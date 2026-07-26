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

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
  notes?: string;
  createdAt: string;
}

export interface CrmActivity {
  id: string;
  leadId?: string;
  customerId?: string;
  activityType: string;
  subject: string;
  description?: string;
  dueAt?: string;
  completedAt?: string;
  assignedUserId?: string;
  createdBy?: string;
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
  const [contacts, activities] = await Promise.all([
    listRows('customer_contacts', organizationId),
    listRows('crm_activities', organizationId),
  ]);
  return {
    contacts: contacts.map((item): CustomerContact => ({
      id: text(item, 'id'),
      customerId: text(item, 'customer_id'),
      name: text(item, 'name'),
      title: optionalText(item, 'title'),
      email: optionalText(item, 'email'),
      phone: optionalText(item, 'phone'),
      isPrimary: item.is_primary === true,
      notes: optionalText(item, 'notes'),
      createdAt: text(item, 'created_at'),
    })),
    activities: activities.map((item): CrmActivity => ({
      id: text(item, 'id'),
      leadId: optionalText(item, 'lead_id'),
      customerId: optionalText(item, 'customer_id'),
      activityType: text(item, 'activity_type'),
      subject: text(item, 'subject'),
      description: optionalText(item, 'description'),
      dueAt: optionalText(item, 'due_at'),
      completedAt: optionalText(item, 'completed_at'),
      assignedUserId: optionalText(item, 'assigned_user_id'),
      createdBy: optionalText(item, 'created_by'),
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
  email?: string;
  phone?: string;
  isPrimary?: boolean;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('customer_contacts').insert({
    organization_id: input.organizationId,
    customer_id: input.customerId,
    created_by: input.userId,
    name: input.name.trim(),
    title: input.title?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
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
  email?: string;
  phone?: string;
  isPrimary?: boolean;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('customer_contacts')
    .update({
      name: input.name.trim(),
      title: input.title?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      is_primary: input.isPrimary ?? false,
      notes: input.notes?.trim() || null,
    })
    .eq('organization_id', input.organizationId)
    .eq('id', input.id);
  if (error) throw new Error(`Yhteyshenkilön päivitys epäonnistui: ${error.message}`);
}

export async function deleteCustomerContact(
  organizationId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('customer_contacts')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Yhteyshenkilön poistaminen epäonnistui: ${error.message}`);
}

export async function createCrmActivity(input: {
  organizationId: string;
  leadId?: string;
  customerId?: string;
  userId?: string;
  assignedUserId?: string;
  activityType: string;
  subject: string;
  description?: string;
  dueAt?: string;
}): Promise<void> {
  if (!input.leadId && !input.customerId) {
    throw new Error('Valitse aktiviteetille myyntimahdollisuus tai asiakas.');
  }
  if (!input.subject.trim()) {
    throw new Error('Aktiviteetin otsikko on pakollinen.');
  }

  const { error } = await supabase.from('crm_activities').insert({
    organization_id: input.organizationId,
    lead_id: input.leadId || null,
    customer_id: input.customerId || null,
    created_by: input.userId,
    assigned_user_id: input.assignedUserId || null,
    activity_type: input.activityType.trim(),
    subject: input.subject.trim(),
    description: input.description?.trim() || null,
    due_at: input.dueAt || null,
  });
  if (error) throw new Error(`CRM-aktiviteetin tallennus epäonnistui: ${error.message}`);
}

export async function completeCrmActivity(
  organizationId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('crm_activities')
    .update({ completed_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`CRM-aktiviteetin kuittaus epäonnistui: ${error.message}`);
}

export async function deleteCrmActivity(
  organizationId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('crm_activities')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`CRM-aktiviteetin poistaminen epäonnistui: ${error.message}`);
}
