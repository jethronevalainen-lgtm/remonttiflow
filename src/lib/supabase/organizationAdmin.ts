import { supabase } from '@/lib/supabase/client';
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

  const rows = (memberships ?? []) as MembershipRow[];
  const userIds = rows.map((row) => row.user_id);
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

  return rows.map((row) => ({
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    profile: profileMap.get(row.user_id) ?? null,
  }));
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
}): Promise<InviteResponse> {
  const { data, error } = await supabase.functions.invoke<InviteResponse>(
    'invite-organization-member',
    {
      body: {
        organizationId: values.organizationId,
        email: values.email.trim().toLowerCase(),
        fullName: values.fullName.trim(),
        role: values.role,
      },
    },
  );

  if (error) throw new Error(await readFunctionError(error));
  if (!data?.ok) throw new Error('Käyttäjäkutsu ei palauttanut onnistunutta vastausta.');
  return data;
}
