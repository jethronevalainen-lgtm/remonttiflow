import { supabase } from './client';
import type { CrmLead, Customer } from '@/types';

type Payload = Record<string, unknown>;

function customerPayload(customer: Omit<Customer, 'id'> | Partial<Customer>): Payload {
  const payload: Payload = {};
  if (customer.name !== undefined) payload.name = customer.name;
  if (customer.type !== undefined) payload.type = customer.type;
  if (customer.contactPerson !== undefined) payload.contact_person = customer.contactPerson || null;
  if (customer.phone !== undefined) payload.phone = customer.phone || null;
  if (customer.email !== undefined) payload.email = customer.email || null;
  if (customer.address !== undefined) payload.address = customer.address || null;
  if (customer.status !== undefined) payload.status = customer.status;
  if (customer.businessId !== undefined) payload.business_id = customer.businessId || null;
  if (customer.notes !== undefined) payload.notes = customer.notes || null;
  if (customer.archivedAt !== undefined) payload.archived_at = customer.archivedAt || null;
  return payload;
}

export async function createCustomerRecord(
  organizationId: string,
  userId: string | undefined,
  customer: Omit<Customer, 'id'>,
): Promise<void> {
  const { error } = await supabase.from('customers').insert({
    organization_id: organizationId,
    created_by: userId,
    ...customerPayload(customer),
  });
  if (error) throw new Error(`Asiakkaan tallennus epäonnistui: ${error.message}`);
}

export async function updateCustomerRecord(
  organizationId: string,
  id: string,
  customer: Partial<Customer>,
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update(customerPayload(customer))
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Asiakkaan päivitys epäonnistui: ${error.message}`);
}

export async function deleteCustomerRecord(
  organizationId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Asiakkaan poistaminen epäonnistui: ${error.message}`);
}

function leadPayload(lead: Omit<CrmLead, 'id'> | Partial<CrmLead>): Payload {
  const payload: Payload = {};
  if (lead.name !== undefined) payload.name = lead.name.trim();
  if (lead.company !== undefined) payload.company = lead.company.trim() || null;
  if (lead.customerId !== undefined) payload.customer_id = lead.customerId || null;
  if (lead.siteId !== undefined) payload.site_id = lead.siteId || null;
  if (lead.value !== undefined) payload.value = lead.value;
  if (lead.estimatedCost !== undefined) payload.estimated_cost = lead.estimatedCost ?? 0;
  if (lead.stage !== undefined) payload.stage = lead.stage;
  if (lead.assignee !== undefined) payload.assignee = lead.assignee.trim() || null;
  if (lead.assigneeUserId !== undefined) payload.assignee_user_id = lead.assigneeUserId || null;
  if (lead.probability !== undefined) payload.probability = lead.probability ?? null;
  if (lead.source !== undefined) payload.source = lead.source.trim() || null;
  if (lead.description !== undefined) payload.description = lead.description.trim() || null;
  if (lead.nextAction !== undefined) payload.next_action = lead.nextAction.trim() || null;
  if (lead.nextActionDueAt !== undefined) payload.next_action_due_at = lead.nextActionDueAt || null;
  if (lead.expectedDecisionDate !== undefined) payload.expected_decision_date = lead.expectedDecisionDate || null;
  if (lead.quotedAt !== undefined) payload.quoted_at = lead.quotedAt || null;
  if (lead.wonAt !== undefined) payload.won_at = lead.wonAt || null;
  if (lead.lostAt !== undefined) payload.lost_at = lead.lostAt || null;
  if (lead.frozenUntil !== undefined) payload.frozen_until = lead.frozenUntil || null;
  if (lead.lostReason !== undefined) payload.lost_reason = lead.lostReason.trim() || null;
  if (lead.convertedProjectId !== undefined) payload.converted_project_id = lead.convertedProjectId || null;
  if (lead.date !== undefined) payload.expected_date = lead.date || null;
  return payload;
}

export async function createCrmLeadRecord(
  organizationId: string,
  userId: string | undefined,
  lead: Omit<CrmLead, 'id'>,
): Promise<void> {
  const { error } = await supabase.from('crm_leads').insert({
    organization_id: organizationId,
    created_by: userId,
    ...leadPayload(lead),
  });
  if (error) throw new Error(`Myyntimahdollisuuden tallennus epäonnistui: ${error.message}`);
}

export async function updateCrmLeadRecord(
  organizationId: string,
  id: string,
  lead: Partial<CrmLead>,
): Promise<void> {
  const { error } = await supabase
    .from('crm_leads')
    .update(leadPayload(lead))
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Myyntimahdollisuuden päivitys epäonnistui: ${error.message}`);
}

export async function deleteCrmLeadRecord(
  organizationId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('crm_leads')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', id);
  if (error) throw new Error(`Myyntimahdollisuuden poistaminen epäonnistui: ${error.message}`);
}
