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

interface ImpersonationRequest {
  action: 'start' | 'stop';
  organizationId: string;
  targetUserId: string;
  sessionId?: string;
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

async function administratorAccessToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    const { data, error } = await administratorSupabase.auth.refreshSession();
    if (error || !data.session?.access_token) {
      throw new Error(error?.message || 'Admin-istunnon päivittäminen epäonnistui.');
    }
    return data.session.access_token;
  }

  const { data, error } = await administratorSupabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error(error?.message || 'Admin-istunto ei ole voimassa.');
  }

  const expiresAtMs = (data.session.expires_at ?? 0) * 1000;
  if (!expiresAtMs || expiresAtMs - Date.now() < 60_000) {
    return administratorAccessToken(true);
  }
  return data.session.access_token;
}

async function invokeImpersonationFunction<T>(
  body: ImpersonationRequest,
  forceRefresh = false,
) {
  const accessToken = await administratorAccessToken(forceRefresh);
  return administratorSupabase.functions.invoke<T>('admin-impersonation', {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function invokeWithSessionRetry<T>(body: ImpersonationRequest) {
  let result = await invokeImpersonationFunction<T>(body);
  if (!result.error) return result;

  const firstMessage = await readFunctionError(result.error, 'Käyttäjänä toimimisen palvelukutsu epäonnistui.');
  const invalidSession = firstMessage === 'Istunto ei ole voimassa.'
    || /invalid\s+(?:jwt|token)|jwt\s+expired|token\s+expired/i.test(firstMessage);
  if (!invalidSession) return { ...result, resolvedMessage: firstMessage };

  result = await invokeImpersonationFunction<T>(body, true);
  if (!result.error) return result;
  return {
    ...result,
    resolvedMessage: await readFunctionError(result.error, 'Käyttäjänä toimimisen palvelukutsu epäonnistui.'),
  };
}

export async function startAdministratorImpersonation(input: {
  organizationId: string;
  targetUserId: string;
}): Promise<ActiveImpersonation> {
  const result = await invokeWithSessionRetry<StartResponse>({
    action: 'start',
    organizationId: input.organizationId,
    targetUserId: input.targetUserId,
  });

  if (result.error) {
    throw new Error(
      'resolvedMessage' in result && typeof result.resolvedMessage === 'string'
        ? result.resolvedMessage
        : await readFunctionError(result.error, 'Käyttäjänä toimimisen käynnistys epäonnistui.'),
    );
  }

  const parsed = parseStartResponse(result.data ?? {});
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

  try {
    const result = await invokeWithSessionRetry({
      action: 'stop',
      organizationId: impersonation.target.organizationId,
      targetUserId: impersonation.target.userId,
      sessionId: impersonation.sessionId,
    });
    if (result.error) {
      console.warn(
        'resolvedMessage' in result && typeof result.resolvedMessage === 'string'
          ? result.resolvedMessage
          : await readFunctionError(result.error, 'Käyttäjänä toimimisen lopetuksen auditointi epäonnistui.'),
      );
    }
  } catch (caught) {
    console.warn(
      caught instanceof Error
        ? caught.message
        : 'Käyttäjänä toimimisen lopetuksen auditointi epäonnistui.',
    );
  }
}
