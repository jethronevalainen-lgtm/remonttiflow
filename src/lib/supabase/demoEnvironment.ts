import { administratorSupabase } from '@/lib/supabase/client';
import type { OrganizationRole } from '@/lib/supabase/types';

export const DEMO_ACCOUNT_EMAIL_SUFFIX = '@demo.vakantti.invalid';
export const DEMO_SOURCE_ORGANIZATION_STORAGE_KEY = 'vakantti-v1-demo-source-org';

export interface DemoAccountSummary {
  userId: string;
  email: string;
  displayName: string;
  role: Exclude<OrganizationRole, 'admin'>;
}

export interface DemoEnvironmentResult {
  organizationId: string;
  organizationName: string;
  accounts: DemoAccountSummary[];
  seeded: {
    projects: number;
    workOrders: number;
    timeEntries: number;
  };
}

interface FunctionResponse {
  ok?: unknown;
  organizationId?: unknown;
  organizationName?: unknown;
  accounts?: unknown;
  seeded?: unknown;
}

type Row = Record<string, unknown>;

function asRow(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Row
    : {};
}

function isRole(value: unknown): value is DemoAccountSummary['role'] {
  return value === 'supervisor'
    || value === 'project_coordinator'
    || value === 'worker'
    || value === 'customer';
}

export function isDemoAccountEmail(value: string | null | undefined): boolean {
  return Boolean(value?.trim().toLowerCase().endsWith(DEMO_ACCOUNT_EMAIL_SUFFIX));
}

export function isDemoOrganizationBusinessId(value: string | null | undefined): boolean {
  return Boolean(value?.trim().toUpperCase().startsWith('DEMO-'));
}

export function demoRoleOrder(role: OrganizationRole): number {
  return ['supervisor', 'project_coordinator', 'worker', 'customer', 'admin'].indexOf(role);
}

export function rememberDemoSourceOrganization(organizationId: string): void {
  const normalized = organizationId.trim();
  if (!normalized) return;
  try {
    window.localStorage.setItem(DEMO_SOURCE_ORGANIZATION_STORAGE_KEY, normalized);
  } catch {
    // Demoympäristö toimii myös ilman selaimen pysyvää tallennustilaa.
  }
}

export function readDemoSourceOrganization(): string | null {
  try {
    return window.localStorage.getItem(DEMO_SOURCE_ORGANIZATION_STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
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
      // Use the connector error or stable fallback below.
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
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

function parseResponse(value: FunctionResponse): DemoEnvironmentResult {
  const organizationId = typeof value.organizationId === 'string' ? value.organizationId : '';
  const organizationName = typeof value.organizationName === 'string'
    ? value.organizationName
    : 'VaKantti demoympäristö';
  const rawAccounts = Array.isArray(value.accounts) ? value.accounts : [];
  const accounts = rawAccounts.flatMap((item): DemoAccountSummary[] => {
    const row = asRow(item);
    const userId = typeof row.userId === 'string' ? row.userId : '';
    const email = typeof row.email === 'string' ? row.email : '';
    const displayName = typeof row.displayName === 'string' ? row.displayName : '';
    if (!userId || !email || !displayName || !isRole(row.role)) return [];
    return [{ userId, email, displayName, role: row.role }];
  }).sort((a, b) => demoRoleOrder(a.role) - demoRoleOrder(b.role));
  const seeded = asRow(value.seeded);

  if (value.ok !== true || !organizationId || accounts.length !== 4) {
    throw new Error('Palvelin palautti puutteellisen demoympäristön.');
  }

  return {
    organizationId,
    organizationName,
    accounts,
    seeded: {
      projects: Number(seeded.projects) || 0,
      workOrders: Number(seeded.workOrders) || 0,
      timeEntries: Number(seeded.timeEntries) || 0,
    },
  };
}

async function invoke(sourceOrganizationId: string, forceRefresh = false) {
  const accessToken = await administratorAccessToken(forceRefresh);
  return administratorSupabase.functions.invoke<FunctionResponse>('provision-demo-environment', {
    body: { sourceOrganizationId },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function provisionDemoEnvironment(sourceOrganizationId: string): Promise<DemoEnvironmentResult> {
  let result = await invoke(sourceOrganizationId);
  if (result.error) {
    const firstMessage = await readFunctionError(result.error, 'Demoympäristön luonti epäonnistui.');
    const invalidSession = firstMessage === 'Istunto ei ole voimassa.'
      || /invalid\s+(?:jwt|token)|jwt\s+expired|token\s+expired/i.test(firstMessage);
    if (invalidSession) result = await invoke(sourceOrganizationId, true);
  }
  if (result.error) {
    throw new Error(await readFunctionError(result.error, 'Demoympäristön luonti epäonnistui.'));
  }
  return parseResponse(result.data ?? {});
}
