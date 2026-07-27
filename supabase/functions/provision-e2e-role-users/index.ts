import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.110.8';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json; charset=utf-8' };

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

async function ensureRoleUser(
  admin: SupabaseClient,
  organizationId: string,
  spec: RoleUser,
): Promise<User> {
  let user = await findUserByEmail(admin, spec.email);
  if (!user) {
    const password = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: spec.displayName, e2e_role_user: true },
    });
    if (error || !data.user) throw error ?? new Error(`Käyttäjää ${spec.email} ei voitu luoda.`);
    user = data.user;
  } else if (!user.email_confirmed_at) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    if (error || !data.user) throw error ?? new Error(`Käyttäjää ${spec.email} ei voitu vahvistaa.`);
    user = data.user;
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: user.id,
    email: spec.email,
    full_name: spec.displayName,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (profileError) throw profileError;

  const { error: membershipError } = await admin.from('organization_members').upsert({
    organization_id: organizationId,
    user_id: user.id,
    role: spec.role,
  }, { onConflict: 'organization_id,user_id' });
  if (membershipError) throw membershipError;

  return user;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return response({ error: 'Vain POST-pyyntö on sallittu.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return response({ error: 'Kirjautuminen vaaditaan.' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = namedSecret('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const serviceKey = namedSecret('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishableKey || !serviceKey) {
    return response({ error: 'Palvelimen Supabase-konfiguraatio puuttuu.' }, 503);
  }

  const token = authorization.slice('Bearer '.length);
  const userClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: actorData, error: actorError } = await userClient.auth.getUser(token);
  if (actorError || !actorData.user) return response({ error: 'Istunto ei ole voimassa.' }, 401);

  const { data: membership, error: membershipError } = await userClient
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', actorData.user.id)
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) return response({ error: 'Ylläpitäjän jäsenyyttä ei voitu tarkistaa.' }, 500);
  if (!membership) return response({ error: 'Vain organisaation ylläpitäjä voi valmistella E2E-roolit.' }, 403);

  const organizationId = membership.organization_id as string;
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const ensuredUsers = new Map<RoleUser['role'], User>();
    for (const spec of ROLE_USERS) {
      ensuredUsers.set(spec.role, await ensureRoleUser(admin, organizationId, spec));
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
        created_by: actorData.user.id,
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
        created_by: actorData.user.id,
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
      created_by: actorData.user.id,
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
        created_by: actorData.user.id,
      }).select('id').single();
      if (error || !data) throw error ?? new Error('Testityömääräystä ei voitu luoda.');
      workOrderId = data.id as string;
    }

    const { error: assigneeError } = await admin.from('work_order_assignees').upsert({
      organization_id: organizationId,
      work_order_id: workOrderId,
      user_id: worker.id,
      assigned_by: actorData.user.id,
      responsibility: 'Automaatiotesti',
    }, { onConflict: 'work_order_id,user_id' });
    if (assigneeError) throw assigneeError;

    return response({
      ok: true,
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
