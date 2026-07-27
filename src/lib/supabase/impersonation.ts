import type { Session } from '@supabase/supabase-js';

import {
  activateImpersonationSession,
  administratorSupabase,
  deactivateImpersonationSession,
} from '@/lib/supabase/client';
import type { OrganizationRole } from '@/lib/supabase/types';

export interface ImpersonationTarget {
  userId: string;
  displayName: string;
  email: string | null;
  role: OrganizationRole;
  organizationId: string;
}

export interface ActiveImpersonation {
  sessionId: string;
  target: ImpersonationTarget;
  startedAt: string;
}

interface StartResponse {
  ok?: unknown;
  tokenHash?: unknown;
  sessionId?: unknown;
  startedAt?: unknown;
  target?: unknown;
}

type Row = Record<string, unknown>;

function asRow(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Row
    : {};
}

function isRole(value: unknown): value is OrganizationRole {
  return value === 'admin'
    || value === 'supervisor'
    || value === 'project_coordinator'
    || value === 'worker'
    || value === 'customer';
}

async function readFunctionError(error: unknown, fallback: string): Promise<string> {
  if (
    error
    && typeof error === 'object'
    && 'context' in error
    && (error as { context?: unknown }).context instanceof Response
  ) {
    try {
      const body = await (error as { context: Response }).context.clone().json() as { error?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) return body.error;
    } catch {
      // Use the connector error or the stable Finnish fallback below.
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function parseStartResponse(value: StartResponse): {
  tokenHash: string;
  impersonation: ActiveImpersonation;
} {
  const target = asRow(value.target);
  const tokenHash = typeof value.tokenHash === 'string' ? value.tokenHash.trim() : '';
  const sessionId = typeof value.sessionId === 'string' ? value.sessionId.trim() : '';
  const startedAt = typeof value.startedAt === 'string' ? value.startedAt : new Date().toISOString();
  const userId = typeof target.userId === 'string' ? target.userId : '';
  const organizationId = typeof target.organizationId === 'string' ? target.organizationId : '';
  const displayName = typeof target.displayName === 'string' ? target.displayName : '';
  const email = typeof target.email === 'string' ? target.email : null;
  const role = target.role;

  if (!tokenHash || !sessionId || !userId || !organizationId || !isRole(role)) {
    throw new Error('Palvelin palautti puutteellisen käyttäjänä toimimisen istunnon.');
  }

  return {
    tokenHash,
    impersonation: {
      sessionId,
      startedAt,
      target: {
        userId,
        organizationId,
        displayName: displayName || email || 'Käyttäjä',
        email,
        role,
      },
    },
  };
}

export async function startAdministratorImpersonation(input: {
  organizationId: string;
  targetUserId: string;
}): Promise<ActiveImpersonation> {
  const { data, error } = await administratorSupabase.functions.invoke<StartResponse>(
    'admin-impersonation',
    {
      body: {
        action: 'start',
        organizationId: input.organizationId,
        targetUserId: input.targetUserId,
      },
    },
  );

  if (error) {
    throw new Error(await readFunctionError(error, 'Käyttäjänä toimimisen käynnistys epäonnistui.'));
  }

  const parsed = parseStartResponse(data ?? {});
  let session: Session | null = null;
  try {
    session = await activateImpersonationSession(parsed.tokenHash);
    if (session.user.id !== parsed.impersonation.target.userId) {
      throw new Error('Avattu istunto ei vastaa valittua käyttäjää.');
    }
    return parsed.impersonation;
  } catch (caught) {
    if (session) await deactivateImpersonationSession();
    throw caught;
  }
}

export async function stopAdministratorImpersonation(
  impersonation: ActiveImpersonation,
): Promise<void> {
  // Restore the administrator first. Audit logging must never be able to strand
  // the browser in the selected user's session.
  await deactivateImpersonationSession();

  const { error } = await administratorSupabase.functions.invoke('admin-impersonation', {
    body: {
      action: 'stop',
      organizationId: impersonation.target.organizationId,
      targetUserId: impersonation.target.userId,
      sessionId: impersonation.sessionId,
    },
  });
  if (error) {
    console.warn(
      await readFunctionError(error, 'Käyttäjänä toimimisen lopetuksen auditointi epäonnistui.'),
    );
  }
}
