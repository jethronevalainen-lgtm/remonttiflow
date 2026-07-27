import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.110.8';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';

const EXPECTED_REPOSITORY = 'jethronevalainen-lgtm/remonttiflow';
const EXPECTED_WORKFLOW_PATH = '/.github/workflows/pr-quality-gate.yml@';
const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_OIDC_AUDIENCE = 'vakantti-e2e-provisioner';
const GITHUB_OIDC_JWKS = createRemoteJWKSet(
  new URL(`${GITHUB_OIDC_ISSUER}/.well-known/jwks`),
);
const E2E_ADMIN_EMAIL = 'admin@roles.vakantti.invalid';
const E2E_ADMIN_NAME = 'Automaatiotesti Järjestelmänvalvoja';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = {
  ...CORS,
  'Cache-Control': 'private, no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

const ROLE_USERS = [
  {
    email: 'supervisor@roles.vakantti.invalid',
    displayName: 'Automaatiotesti Työnjohtaja',
    role: 'supervisor',
  },
  {
    email: 'project-coordinator@roles.vakantti.invalid',
    displayName: 'Automaatiotesti Projektikoordinaattori',
    role: 'project_coordinator',
  },
  {
    email: 'worker@roles.vakantti.invalid',
    displayName: 'Automaatiotesti Työntekijä',
    role: 'worker',
  },
  {
    email: 'customer@roles.vakantti.invalid',
    displayName: 'Automaatiotesti Tilaaja',
    role: 'customer',
  },
] as const;

type RoleUser = (typeof ROLE_USERS)[number];

interface ProvisionRequest {
  password?: unknown;
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function namedSecret(name: string, fallback: string): string | null {
  const raw = Deno.env.get(name);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === 'string' && value.length > 20) return value;
        if (value && typeof value === 'object' && 'key' in value) {
          const key = (value as { key?: unknown }).key;
          if (typeof key === 'string' && key.length > 20) return key;
        }
      }
    } catch {
      // Fall through to the standard Supabase environment variable.
    }
  }
  return Deno.env.get(fallback) ?? null;
}

async function verifyGitHubActionsToken(token: string): Promise<void> {
  const { payload } = await jwtVerify(token, GITHUB_OIDC_JWKS, {
    issuer: GITHUB_OIDC_ISSUER,
    audience: GITHUB_OIDC_AUDIENCE,
  });

  const repository = typeof payload.repository === 'string' ? payload.repository : '';
  const workflowRef = typeof payload.workflow_ref === 'string' ? payload.workflow_ref : '';
  if (repository !== EXPECTED_REPOSITORY) {
    throw new Error('OIDC-token ei kuulu VaKantti-repositoriolle.');
  }
  if (!workflowRef.startsWith(EXPECTED_REPOSITORY) || !workflowRef.includes(EXPECTED_WORKFLOW_PATH)) {
    throw new Error('OIDC-token ei kuulu hyväksytylle PR-laadunvarmistuksen työnkululle.');
  }
}

async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === normalized);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  throw new Error('Auth-käyttäjälistaus ylitti sallitun sivumäärän.');
}

async function ensureUser(
  admin: SupabaseClient,
  organizationId: string,
  email: string,
  displayName: string,
  role: 'admin' | RoleUser['role'],
  password?: string,
): Promise<User> {
  let user = await findUserByEmail(admin, email);
  const metadata = {
    ...(user?.user_metadata ?? {}),
    full_name: displayName,
    e2e_role_user: true,
  };

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: password ?? `${crypto.randomUUID()}-${crypto.randomUUID()}`,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error || !data.user) throw error ?? new Error(`Käyttäjää ${email} ei voitu luoda.`);
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      ...(password ? { password } : {}),
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error || !data.user) throw error ?? new Error(`Käyttäjää ${email} ei voitu päivittää.`);
    user = data.user;
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: user.id,
    email,
    full_name: displayName,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (profileError) throw profileError;

  const { error: membershipError } = await admin.from('organization_members').upsert({
    organization_id: organizationId,
    user_id: user.id,
    role,
  }, { onConflict: 'organization_id,user_id' });
  if (membershipError) throw membershipError;

  return user;
}

async function resolveOrganizationId(admin: SupabaseClient): Promise<string> {
  const { data: membership, error: membershipError } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (membership?.organization_id) return String(membership.organization_id);

  const { data: organization, error: organizationError } = await admin
    .from('organizations')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization?.id) throw new Error('Testiorganisaatiota ei löytynyt.');
  return String(organization.id);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return response({ error: 'Vain POST-pyyntö on sallittu.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return response({ error: 'GitHub Actions OIDC -todennus vaaditaan.' }, 401);
  }

  try {
    await verifyGitHubActionsToken(authorization.slice('Bearer '.length));
  } catch (caught) {
    console.error(caught);
    return response({ error: 'GitHub Actions OIDC -todennus epäonnistui.' }, 403);
  }

  let body: ProvisionRequest;
  try {
    body = await request.json() as ProvisionRequest;
  } catch {
    return response({ error: 'Pyyntörunko ei ole kelvollista JSON-dataa.' }, 400);
  }
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 12 || password.length > 128) {
    return response({ error: 'E2E-salasanan pituuden on oltava 12–128 merkkiä.' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = namedSecret('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return response({ error: 'Palvelimen Supabase-konfiguraatio puuttuu.' }, 503);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const organizationId = await resolveOrganizationId(admin);
    const testAdmin = await ensureUser(
      admin,
      organizationId,
      E2E_ADMIN_EMAIL,
      E2E_ADMIN_NAME,
      'admin',
      password,
    );

    const ensuredUsers = new Map<RoleUser['role'], User>();
    for (const spec of ROLE_USERS) {
      ensuredUsers.set(
        spec.role,
        await ensureUser(admin, organizationId, spec.email, spec.displayName, spec.role),
      );
    }

    const { data: customer, error: customerReadError } = await admin
      .from('customers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('email', 'customer@roles.vakantti.invalid')
      .maybeSingle();
    if (customerReadError) throw customerReadError;

    let customerId = customer?.id as string | undefined;
    if (!customerId) {
      const { data, error } = await admin.from('customers').insert({
        organization_id: organizationId,
        name: 'VaKantti automaatiotilaaja',
        type: 'Yritys',
        email: 'customer@roles.vakantti.invalid',
        status: 'Aktiivinen',
        created_by: testAdmin.id,
        notes: 'Automaattisen käyttöoikeus- ja reittitestauksen hallittu testiasiakas.',
      }).select('id').single();
      if (error || !data) throw error ?? new Error('Testiasiakasta ei voitu luoda.');
      customerId = data.id as string;
    }

    const { data: project, error: projectReadError } = await admin
      .from('projects')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('project_number', 'E2E-ROLE-AUDIT')
      .maybeSingle();
    if (projectReadError) throw projectReadError;

    let projectId = project?.id as string | undefined;
    if (!projectId) {
      const { data, error } = await admin.from('projects').insert({
        organization_id: organizationId,
        name: 'VaKantti automaatiotestiprojekti',
        customer: 'VaKantti automaatiotilaaja',
        customer_id: customerId,
        location: 'Automaatiotesti',
        status: 'Suunniteltu',
        progress: 0,
        budget: 0,
        spent: 0,
        project_number: 'E2E-ROLE-AUDIT',
        description: 'Hallittu testiprojekti dynaamisten reittien, roolien ja RLS-oikeuksien tarkistukseen.',
        created_by: testAdmin.id,
      }).select('id').single();
      if (error || !data) throw error ?? new Error('Testiprojektia ei voitu luoda.');
      projectId = data.id as string;
    }

    const worker = ensuredUsers.get('worker');
    const coordinator = ensuredUsers.get('project_coordinator');
    const customerUser = ensuredUsers.get('customer');
    if (!worker || !coordinator || !customerUser) throw new Error('Kaikkia roolikäyttäjiä ei luotu.');

    const { error: memberError } = await admin.from('project_members').upsert([
      { organization_id: organizationId, project_id: projectId, user_id: worker.id, role: 'worker' },
      { organization_id: organizationId, project_id: projectId, user_id: coordinator.id, role: 'project_coordinator' },
    ], { onConflict: 'project_id,user_id' });
    if (memberError) throw memberError;

    const { error: customerUserError } = await admin.from('customer_users').upsert({
      organization_id: organizationId,
      customer_id: customerId,
      user_id: customerUser.id,
      access_scope: 'selected_projects',
    }, { onConflict: 'organization_id,customer_id,user_id' });
    if (customerUserError) throw customerUserError;

    const { error: customerProjectError } = await admin.from('customer_user_projects').upsert({
      organization_id: organizationId,
      customer_id: customerId,
      user_id: customerUser.id,
      project_id: projectId,
      created_by: testAdmin.id,
    }, { onConflict: 'organization_id,customer_id,user_id,project_id' });
    if (customerProjectError) throw customerProjectError;

    const { data: workOrder, error: workOrderReadError } = await admin
      .from('work_orders')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('work_reference', 'E2E-ROLE-AUDIT-WORK')
      .maybeSingle();
    if (workOrderReadError) throw workOrderReadError;

    let workOrderId = workOrder?.id as string | undefined;
    if (!workOrderId) {
      const { data, error } = await admin.from('work_orders').insert({
        organization_id: organizationId,
        project_id: projectId,
        title: 'Automaatiotestin työmääräys',
        project: 'VaKantti automaatiotestiprojekti',
        assignee: 'Automaatiotesti Työntekijä',
        priority: 'Normaali',
        status: 'Avoin',
        type: 'Testi',
        assignment_scope: 'people',
        work_reference: 'E2E-ROLE-AUDIT-WORK',
        description: 'Hallittu testityö työntekijän dynaamisten näkymien tarkistukseen.',
        created_by: testAdmin.id,
      }).select('id').single();
      if (error || !data) throw error ?? new Error('Testityömääräystä ei voitu luoda.');
      workOrderId = data.id as string;
    }

    const { error: assigneeError } = await admin.from('work_order_assignees').upsert({
      organization_id: organizationId,
      work_order_id: workOrderId,
      user_id: worker.id,
      assigned_by: testAdmin.id,
      responsibility: 'Automaatiotesti',
    }, { onConflict: 'work_order_id,user_id' });
    if (assigneeError) throw assigneeError;

    return response({
      ok: true,
      adminEmail: E2E_ADMIN_EMAIL,
      organizationId,
      projectId,
      workOrderId,
      users: ROLE_USERS.map((spec) => ({
        email: spec.email,
        role: spec.role,
        userId: ensuredUsers.get(spec.role)?.id,
      })),
    });
  } catch (caught) {
    console.error(caught);
    return response({
      error: caught instanceof Error ? caught.message : 'E2E-roolikäyttäjien valmistelu epäonnistui.',
    }, 500);
  }
});
