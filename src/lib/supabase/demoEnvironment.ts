import {
  DEMO_DATASET_VERSION,
  isDemoScenario,
  type DemoScenario,
} from '@/lib/demoQuality';
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

export interface DemoSeededCounts {
  projects: number;
  workOrders: number;
  timeEntries: number;
  safetyItems: number;
}

export interface DemoEnvironmentState {
  organizationId: string;
  sourceOrganizationId: string | null;
  scenario: DemoScenario;
  datasetVersion: number;
  refreshedAt: string;
  seeded: DemoSeededCounts;
}

export interface DemoEnvironmentResult extends DemoEnvironmentState {
  organizationName: string;
  accounts: DemoAccountSummary[];
}

interface FunctionResponse {
  ok?: unknown;
  organizationId?: unknown;
  organizationName?: unknown;
  accounts?: unknown;
  seeded?: unknown;
}

interface ScenarioFunctionResponse {
  ok?: unknown;
  organizationId?: unknown;
  scenario?: unknown;
  datasetVersion?: unknown;
  refreshedAt?: unknown;
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

function parseSeeded(value: unknown): DemoSeededCounts {
  const seeded = asRow(value);
  return {
    projects: Number(seeded.projects) || 0,
    workOrders: Number(seeded.workOrders ?? seeded.work_orders) || 0,
    timeEntries: Number(seeded.timeEntries ?? seeded.time_entries) || 0,
    safetyItems: Number(seeded.safetyItems ?? seeded.safety_items) || 0,
  };
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

function parseAccounts(value: FunctionResponse): {
  organizationId: string;
  organizationName: string;
  accounts: DemoAccountSummary[];
} {
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

  if (value.ok !== true || !organizationId || accounts.length !== 4) {
    throw new Error('Palvelin palautti puutteellisen demoympäristön.');
  }

  return { organizationId, organizationName, accounts };
}

function parseScenario(value: ScenarioFunctionResponse): DemoEnvironmentState {
  const organizationId = typeof value.organizationId === 'string' ? value.organizationId : '';
  const scenario = isDemoScenario(value.scenario) ? value.scenario : 'normal';
  const datasetVersion = Number(value.datasetVersion) || DEMO_DATASET_VERSION;
  const refreshedAt = typeof value.refreshedAt === 'string' ? value.refreshedAt : new Date().toISOString();
  if (value.ok !== true || !organizationId) {
    throw new Error('Palvelin palautti puutteellisen demodataskenaarion.');
  }
  return {
    organizationId,
    sourceOrganizationId: null,
    scenario,
    datasetVersion,
    refreshedAt,
    seeded: parseSeeded(value.seeded),
  };
}

async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
  forceRefresh = false,
) {
  const accessToken = await administratorAccessToken(forceRefresh);
  return administratorSupabase.functions.invoke<T>(name, {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function invokeWithRetry<T>(
  name: string,
  body: Record<string, unknown>,
  fallback: string,
) {
  let result = await invokeFunction<T>(name, body);
  if (result.error) {
    const firstMessage = await readFunctionError(result.error, fallback);
    const invalidSession = firstMessage === 'Istunto ei ole voimassa.'
      || /invalid\s+(?:jwt|token)|jwt\s+expired|token\s+expired/i.test(firstMessage);
    if (invalidSession) result = await invokeFunction<T>(name, body, true);
  }
  if (result.error) throw new Error(await readFunctionError(result.error, fallback));
  return result.data;
}

export async function provisionDemoEnvironment(
  sourceOrganizationId: string,
  scenario: DemoScenario = 'normal',
): Promise<DemoEnvironmentResult> {
  const baseData = await invokeWithRetry<FunctionResponse>(
    'provision-demo-environment',
    { sourceOrganizationId },
    'Demoympäristön luonti epäonnistui.',
  );
  const base = parseAccounts(baseData ?? {});

  const scenarioData = await invokeWithRetry<ScenarioFunctionResponse>(
    'provision-demo-scenario',
    { sourceOrganizationId, scenario },
    'Demodataskenaarion valmistelu epäonnistui.',
  );
  const state = parseScenario(scenarioData ?? {});

  return {
    ...state,
    sourceOrganizationId,
    organizationName: base.organizationName,
    accounts: base.accounts,
  };
}

export async function fetchDemoEnvironmentState(
  organizationId: string,
): Promise<DemoEnvironmentState | null> {
  const { data, error } = await administratorSupabase
    .from('demo_environments')
    .select('organization_id, source_organization_id, active_scenario, dataset_version, refreshed_at, seeded_counts')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw new Error(`Demoympäristön metatietojen haku epäonnistui: ${error.message}`);
  if (!data) return null;
  const row = data as Row;
  return {
    organizationId: String(row.organization_id || ''),
    sourceOrganizationId: typeof row.source_organization_id === 'string' ? row.source_organization_id : null,
    scenario: isDemoScenario(row.active_scenario) ? row.active_scenario : 'normal',
    datasetVersion: Number(row.dataset_version) || DEMO_DATASET_VERSION,
    refreshedAt: typeof row.refreshed_at === 'string' ? row.refreshed_at : '',
    seeded: parseSeeded(row.seeded_counts),
  };
}

export async function listDemoAccounts(organizationId: string): Promise<DemoAccountSummary[]> {
  const { data: memberships, error: membershipError } = await administratorSupabase
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', organizationId)
    .in('role', ['supervisor', 'project_coordinator', 'worker', 'customer'])
    .eq('invitation_status', 'active')
    .is('disabled_at', null);
  if (membershipError) throw new Error(`Demoroolien haku epäonnistui: ${membershipError.message}`);

  const rows = (memberships ?? []) as Array<{ user_id: string; role: OrganizationRole }>;
  const userIds = rows.map((row) => row.user_id);
  if (!userIds.length) return [];
  const { data: profiles, error: profileError } = await administratorSupabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds);
  if (profileError) throw new Error(`Demoprofiilien haku epäonnistui: ${profileError.message}`);
  const profileMap = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));

  return rows.flatMap((membership): DemoAccountSummary[] => {
    const profile = profileMap.get(membership.user_id);
    const email = typeof profile?.email === 'string' ? profile.email : '';
    const displayName = typeof profile?.full_name === 'string' ? profile.full_name : '';
    if (!isRole(membership.role) || !isDemoAccountEmail(email) || !displayName) return [];
    return [{ userId: membership.user_id, email, displayName, role: membership.role }];
  }).sort((a, b) => demoRoleOrder(a.role) - demoRoleOrder(b.role));
}
