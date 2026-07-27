import { supabase } from '@/lib/supabase/client';
import {
  customerPreviewRpcArgs,
  normalizeCustomerPreviewScope,
  type CustomerAccessAssignment,
  type CustomerAccessCatalogItem,
  type CustomerAccessProject,
  type CustomerPreviewScope,
} from '@/lib/customerPortalAccess';
import type {
  OrganizationRole,
  ProfileRow,
} from '@/lib/supabase/types';

export interface OrganizationMemberView {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: string;
  profile: ProfileRow | null;
}

interface MembershipRow {
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
}

interface InviteResponse {
  ok: boolean;
  invited: boolean;
  userId: string;
  message: string;
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function fetchOrganizationMembers(
  organizationId: string,
): Promise<OrganizationMemberView[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id, user_id, role, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  if (membershipError) {
    throw new Error(`Jäsenten haku epäonnistui: ${membershipError.message}`);
  }

  const membershipRows = (memberships ?? []) as MembershipRow[];
  const userIds = membershipRows.map((row) => row.user_id);
  if (userIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, phone, created_at, updated_at')
    .in('id', userIds);

  if (profileError) {
    throw new Error(`Profiilien haku epäonnistui: ${profileError.message}`);
  }

  const profileMap = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );

  return membershipRows.map((row) => ({
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    profile: profileMap.get(row.user_id) ?? null,
  }));
}

export async function fetchCustomerAccessCatalog(
  organizationId: string,
): Promise<CustomerAccessCatalogItem[]> {
  const { data, error } = await supabase.rpc('admin_customer_access_catalog', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(`Tilaaja-asiakkuuksien haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    customerId: text(row, 'customer_id'),
    customerName: text(row, 'customer_name'),
    projects: rows(row.projects).map((project): CustomerAccessProject => ({
      id: text(project, 'id'),
      name: text(project, 'name'),
      location: text(project, 'location') || null,
      status: text(project, 'status'),
    })).filter((project) => project.id),
  })).filter((item) => item.customerId);
}

export async function fetchCustomerUserAccess(
  organizationId: string,
  userId: string,
): Promise<CustomerAccessAssignment[]> {
  const { data, error } = await supabase.rpc('admin_customer_user_access', {
    p_organization_id: organizationId,
    p_user_id: userId,
  });
  if (error) throw new Error(`Tilaajan käyttöoikeuksien haku epäonnistui: ${error.message}`);
  return rows(data).map((row) => ({
    customerId: text(row, 'customer_id'),
    customerName: text(row, 'customer_name'),
    accessScope: text(row, 'access_scope') === 'selected_projects' ? 'selected_projects' : 'all_projects',
    projectIds: stringArray(row.project_ids),
  })).filter((item) => item.customerId);
}

export async function saveCustomerUserAccess(values: {
  organizationId: string;
  userId: string;
  access: CustomerAccessAssignment[];
}): Promise<void> {
  const payload = values.access.map((item) => ({
    customerId: item.customerId,
    accessScope: item.accessScope,
    projectIds: item.accessScope === 'selected_projects' ? item.projectIds : [],
  }));
  const { error } = await supabase.rpc('admin_set_customer_user_access', {
    p_organization_id: values.organizationId,
    p_user_id: values.userId,
    p_access: payload,
  });
  if (error) throw new Error(`Tilaajan käyttöoikeuksien tallennus epäonnistui: ${error.message}`);
}

export async function logCustomerPortalPreview(
  organizationId: string,
  scope: CustomerPreviewScope,
): Promise<void> {
  const normalized = normalizeCustomerPreviewScope(scope);
  const { error } = await supabase.rpc('admin_log_customer_preview', {
    p_organization_id: organizationId,
    ...customerPreviewRpcArgs(normalized),
  });
  if (error) throw new Error(`Tilaajaesikatselun auditointi epäonnistui: ${error.message}`);
}

export async function updateOrganizationDetails(
  organizationId: string,
  values: { name: string; businessId: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update({
      name: values.name.trim(),
      business_id: values.businessId?.trim() || null,
    })
    .eq('id', organizationId);

  if (error) {
    throw new Error(`Organisaation päivitys epäonnistui: ${error.message}`);
  }
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  userId: string,
  role: OrganizationRole,
): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('organization_id', organizationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Roolin päivitys epäonnistui: ${error.message}`);
  }
}

export async function removeOrganizationMember(
  organizationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Jäsenen poistaminen epäonnistui: ${error.message}`);
  }
}

async function readFunctionError(error: unknown): Promise<string> {
  if (
    typeof error === 'object' &&
    error !== null &&
    'context' in error &&
    (error as { context?: unknown }).context instanceof Response
  ) {
    const response = (error as { context: Response }).context;
    try {
      const body = await response.clone().json() as { error?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) return body.error;
    } catch {
      // Fall back to the connector error message below.
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Käyttäjäkutsu epäonnistui.';
}

export async function inviteOrganizationMember(values: {
  organizationId: string;
  email: string;
  fullName: string;
  role: OrganizationRole;
  customerId?: string;
  customerAccess?: CustomerAccessAssignment[];
}): Promise<InviteResponse> {
  const customerAccess = values.customerAccess?.map((item) => ({
    customerId: item.customerId,
    accessScope: item.accessScope,
    projectIds: item.accessScope === 'selected_projects' ? item.projectIds : [],
  })) ?? [];
  const { data, error } = await supabase.functions.invoke<InviteResponse>(
    'invite-organization-member',
    {
      body: {
        organizationId: values.organizationId,
        email: values.email.trim().toLowerCase(),
        fullName: values.fullName.trim(),
        role: values.role,
        customerId: values.customerId || customerAccess[0]?.customerId || null,
        customerAccess,
      },
    },
  );

  if (error) throw new Error(await readFunctionError(error));
  if (!data?.ok) throw new Error('Käyttäjäkutsu ei palauttanut onnistunutta vastausta.');
  return data;
}
