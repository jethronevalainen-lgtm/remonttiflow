/**
 * Organization context fetch helpers (no React).
 *
 * These functions back OrganizationContext: they answer
 * "which organizations can the current user see" and "what is the
 * current user's role in organization X". Errors are thrown as
 * OrgContextError with Finnish messages so UI layers can surface them
 * directly.
 */
import { supabase } from './client';
import type {
  OrganizationMemberRow,
  OrganizationRole,
  OrganizationRow,
} from './types';

/** Error thrown by the org-context helpers; carries a Finnish message. */
export class OrgContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgContextError';
  }
}

/** An organization the current user belongs to, plus their role in it. */
export interface MyOrganization extends OrganizationRow {
  role: OrganizationRole;
}

/** Shape returned by the organization_members -> organizations join. */
interface MembershipWithOrganization {
  role: OrganizationRole;
  organizations: OrganizationRow | null;
}

/**
 * Lists every organization the signed-in user belongs to. The explicit
 * user_id filter is required because management roles may otherwise be able
 * to read other organization members through RLS and accidentally resolve the
 * wrong workspace role.
 */
export async function getMyOrganizations(
  userId: string,
  signal?: AbortSignal,
): Promise<MyOrganization[]> {
  const query = supabase
    .from('organization_members')
    .select('role, organizations(*)')
    .eq('user_id', userId);

  if (signal) query.abortSignal(signal);

  const { data, error } = await query;

  if (error) {
    const timedOut = /abort|timeout/i.test(error.message);
    throw new OrgContextError(
      timedOut
        ? 'Työtilan lataus aikakatkaistiin. Tarkista verkkoyhteys ja yritä uudelleen.'
        : `Organisaatioiden haku epäonnistui: ${error.message}`,
    );
  }

  const rows = (data ?? []) as unknown as MembershipWithOrganization[];
  return rows.flatMap((row) =>
    row.organizations ? [{ ...row.organizations, role: row.role }] : [],
  );
}

/**
 * Returns the current user's membership row (including role) for the
 * given organization, or null when the user is not a member.
 */
export async function getMyMembership(
  organizationId: string,
): Promise<OrganizationMemberRow | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new OrgContextError(
      `Käyttäjätietojen haku epäonnistui: ${userError.message}`,
    );
  }
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new OrgContextError(`Jäsenyyden haku epäonnistui: ${error.message}`);
  }

  return data;
}
