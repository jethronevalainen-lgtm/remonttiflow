import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
};

const DEFAULT_APP_ORIGIN = 'https://vakantti.pages.dev';

type OrganizationRole = 'admin' | 'supervisor' | 'project_coordinator' | 'worker' | 'customer';
type EmployeeStatus = 'Aktiivinen' | 'Lomalla' | 'Sairas' | 'Koulutuksessa' | 'Eroonnut';
type CustomerAccessScope = 'all_projects' | 'selected_projects';

interface CustomerAccessInput {
  customerId: string;
  accessScope: CustomerAccessScope;
  projectIds: string[];
}

interface EmployeeInput {
  jobTitle: string;
  department: string;
  phone: string;
  startDate: string;
  status: EmployeeStatus;
  hourlyCostCents: number | null;
  employmentType: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  supervisorUserId: string | null;
}

interface InviteRequest {
  organizationId?: unknown;
  email?: unknown;
  fullName?: unknown;
  role?: unknown;
  customerId?: unknown;
  customerAccess?: unknown;
  employee?: unknown;
}

type Row = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function readNamedKey(variableName: string, legacyName: string): string | null {
  const named = Deno.env.get(variableName);
  if (named) {
    try {
      const parsed = JSON.parse(named) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === 'string' && value.length > 20) return value;
        if (value && typeof value === 'object' && 'key' in value) {
          const key = (value as { key?: unknown }).key;
          if (typeof key === 'string' && key.length > 20) return key;
        }
      }
    } catch {
      // Fall back to the legacy single-value environment variable below.
    }
  }
  return Deno.env.get(legacyName) ?? null;
}

function isRole(value: unknown): value is OrganizationRole {
  return value === 'admin'
    || value === 'supervisor'
    || value === 'project_coordinator'
    || value === 'worker'
    || value === 'customer';
}

function isEmployeeStatus(value: unknown): value is EmployeeStatus {
  return value === 'Aktiivinen'
    || value === 'Lomalla'
    || value === 'Sairas'
    || value === 'Koulutuksessa'
    || value === 'Eroonnut';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function activationUrl(): string {
  const configured = Deno.env.get('VAKANTTI_APP_URL')?.trim() || DEFAULT_APP_ORIGIN;
  const origin = new URL(configured);
  if (origin.protocol !== 'https:') {
    throw new Error('VaKantin kutsuosoitteen pitää käyttää HTTPS-yhteyttä.');
  }
  return new URL('/auth/callback', origin.origin).toString();
}

function parseCustomerAccess(payload: InviteRequest): CustomerAccessInput[] {
  const source = Array.isArray(payload.customerAccess) ? payload.customerAccess : [];
  const parsed = source.flatMap((item): CustomerAccessInput[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Row;
    const customerId = cleanText(row.customerId, 80);
    const accessScope = row.accessScope === 'selected_projects' ? 'selected_projects' : 'all_projects';
    const projectIds = Array.isArray(row.projectIds)
      ? row.projectIds.filter((value): value is string => typeof value === 'string').map((value) => value.trim())
      : [];
    return customerId ? [{ customerId, accessScope, projectIds: [...new Set(projectIds)] }] : [];
  });
  if (parsed.length > 0) {
    return [...new Map(parsed.map((item) => [item.customerId, item])).values()];
  }
  const legacyCustomerId = cleanText(payload.customerId, 80);
  return legacyCustomerId ? [{ customerId: legacyCustomerId, accessScope: 'all_projects', projectIds: [] }] : [];
}

function parseEmployee(value: unknown): EmployeeInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Row;
  const hourlyCost = row.hourlyCostCents;
  const supervisorUserId = cleanText(row.supervisorUserId, 80);
  return {
    jobTitle: cleanText(row.jobTitle, 120),
    department: cleanText(row.department, 120),
    phone: cleanText(row.phone, 40),
    startDate: cleanText(row.startDate, 10),
    status: isEmployeeStatus(row.status) ? row.status : 'Aktiivinen',
    hourlyCostCents: typeof hourlyCost === 'number' && Number.isInteger(hourlyCost) && hourlyCost >= 0
      ? hourlyCost
      : null,
    employmentType: cleanText(row.employmentType, 80),
    emergencyContactName: cleanText(row.emergencyContactName, 120),
    emergencyContactPhone: cleanText(row.emergencyContactPhone, 40),
    supervisorUserId: supervisorUserId || null,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Vain POST-pyyntö on sallittu.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Kirjautuminen vaaditaan.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = readNamedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const secretKey = readNamedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: 'Palvelimen Supabase-konfiguraatio puuttuu.' }, 503);
  }

  let payload: InviteRequest;
  try {
    payload = await request.json() as InviteRequest;
  } catch {
    return json({ error: 'Pyynnön JSON ei ole kelvollinen.' }, 400);
  }

  const organizationId = cleanText(payload.organizationId, 80);
  const email = cleanText(payload.email, 254).toLowerCase();
  const fullName = cleanText(payload.fullName, 120);
  const role = payload.role;
  const customerAccess = parseCustomerAccess(payload);
  const employee = parseEmployee(payload.employee);

  if (!organizationId || !isUuid(organizationId)) return json({ error: 'Organisaation tunniste puuttuu tai on virheellinen.' }, 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Anna kelvollinen sähköpostiosoite.' }, 400);
  if (!isRole(role)) return json({ error: 'Rooli on virheellinen.' }, 400);
  if (!fullName) return json({ error: 'Nimi on pakollinen.' }, 400);
  if (role === 'customer' && customerAccess.length === 0) return json({ error: 'Valitse tilaajakäyttäjälle vähintään yksi asiakkuus.' }, 400);
  if (role !== 'customer' && (!employee?.jobTitle || !employee.department)) {
    return json({ error: 'Tehtävänimike ja osasto ovat pakollisia ennen kutsun lähettämistä.' }, 400);
  }
  if (employee?.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(employee.startDate)) {
    return json({ error: 'Aloituspäivä on virheellinen.' }, 400);
  }
  if (employee?.supervisorUserId && !isUuid(employee.supervisorUserId)) {
    return json({ error: 'Esihenkilön tunniste on virheellinen.' }, 400);
  }
  for (const item of customerAccess) {
    if (!isUuid(item.customerId)) return json({ error: 'Tilaaja-asiakkuuden tunniste on virheellinen.' }, 400);
    if (item.accessScope === 'selected_projects' && item.projectIds.length === 0) return json({ error: 'Valitse rajattuun tilaajaoikeuteen vähintään yksi projekti.' }, 400);
    if (item.projectIds.some((projectId) => !isUuid(projectId))) return json({ error: 'Projektin tunniste on virheellinen.' }, 400);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization } },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const actor = userData.user;
  if (userError || !actor) return json({ error: 'Istunto ei ole voimassa.' }, 401);

  const { data: actorMembership, error: membershipError } = await userClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', actor.id)
    .maybeSingle();
  if (membershipError) return json({ error: 'Käyttöoikeuden tarkistus epäonnistui.' }, 500);

  const actorRole = actorMembership?.role as OrganizationRole | undefined;
  const canInviteCustomers = actorRole === 'admin'
    || actorRole === 'supervisor'
    || actorRole === 'project_coordinator';
  if (!canInviteCustomers) {
    return json({ error: 'Vain ylläpitäjä, työnjohtaja tai projektikoordinaattori voi kutsua tilaajia.' }, 403);
  }
  if (actorRole !== 'admin' && role !== 'customer') {
    return json({ error: 'Sisäisen henkilöstön kutsuminen on sallittu vain organisaation ylläpitäjälle.' }, 403);
  }
  if (actorRole === 'project_coordinator' && customerAccess.some((item) => item.accessScope !== 'selected_projects')) {
    return json({ error: 'Projektikoordinaattori voi myöntää vain projektikohtaisia tilaajaoikeuksia.' }, 403);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const [{ data: organization, error: organizationError }, { data: actorProfile }] = await Promise.all([
    adminClient.from('organizations').select('id, name').eq('id', organizationId).maybeSingle(),
    adminClient.from('profiles').select('full_name, email').eq('id', actor.id).maybeSingle(),
  ]);
  if (organizationError || !organization) return json({ error: 'Organisaatiota ei löytynyt.' }, 404);

  if (employee?.supervisorUserId) {
    const { data: supervisorMembership, error: supervisorError } = await adminClient
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('user_id', employee.supervisorUserId)
      .eq('role', 'supervisor')
      .maybeSingle();
    if (supervisorError || !supervisorMembership) {
      return json({ error: 'Valittu esihenkilö ei ole organisaation työnjohtaja.' }, 400);
    }
  }

  const { data: existingProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, full_name')
    .ilike('email', email)
    .maybeSingle();
  if (profileError) return json({ error: 'Käyttäjän tarkistus epäonnistui.' }, 500);

  const { data: existingEmployee, error: employeeLookupError } = role === 'customer'
    ? { data: null, error: null }
    : await adminClient
      .from('employees')
      .select('*')
      .eq('organization_id', organizationId)
      .ilike('email', email)
      .is('archived_at', null)
      .maybeSingle();
  if (employeeLookupError) return json({ error: 'Henkilöstökortin tarkistus epäonnistui.' }, 500);

  let targetUserId = existingProfile?.id ?? null;
  let invited = false;
  let activationOrigin = DEFAULT_APP_ORIGIN;
  if (!targetUserId) {
    let redirectTo: string;
    try {
      redirectTo = activationUrl();
      activationOrigin = new URL(redirectTo).origin;
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Kutsun palautusosoite on virheellinen.' }, 503);
    }
    const inviterName = actorProfile?.full_name || actorProfile?.email || 'organisaation ylläpitäjä';
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        application_name: 'VaKantti',
        organization_name: organization.name,
        invited_role: role,
        inviter_name: inviterName,
        invitation_heading: 'Sinut on kutsuttu käyttämään VaKanttia',
      },
      redirectTo,
    });
    if (inviteError || !inviteData.user) {
      return json({ error: inviteError?.message || 'Sähköpostikutsun lähettäminen epäonnistui.' }, inviteError?.status === 429 ? 429 : 400);
    }
    targetUserId = inviteData.user.id;
    invited = true;
  } else if (fullName && !existingProfile?.full_name) {
    await adminClient.from('profiles').update({ full_name: fullName }).eq('id', targetUserId);
  }

  const { data: existingMembership, error: existingMembershipError } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (existingMembershipError) return json({ error: 'Jäsenyyden tarkistus epäonnistui.' }, 500);
  if (existingMembership) return json({ error: 'Käyttäjä kuuluu jo tähän organisaatioon.' }, 409);
  if (existingEmployee?.user_id && existingEmployee.user_id !== targetUserId) {
    return json({ error: 'Sähköpostiin liitetty henkilöstökortti kuuluu toiselle käyttäjätilille.' }, 409);
  }

  let employeeId: string | null = existingEmployee?.id ?? null;
  let createdEmployee = false;
  const previousEmployee = existingEmployee ? { ...existingEmployee } : null;

  const rollback = async () => {
    await adminClient.from('customer_user_projects').delete().eq('organization_id', organizationId).eq('user_id', targetUserId);
    await adminClient.from('customer_users').delete().eq('organization_id', organizationId).eq('user_id', targetUserId);
    await adminClient.from('supervisor_team_members').delete().eq('organization_id', organizationId).eq('employee_id', employeeId);
    if (createdEmployee && employeeId) {
      await adminClient.from('employees').delete().eq('organization_id', organizationId).eq('id', employeeId);
    } else if (previousEmployee && employeeId) {
      await adminClient.from('employees').update(previousEmployee).eq('organization_id', organizationId).eq('id', employeeId);
    }
    await adminClient.from('organization_members').delete().eq('organization_id', organizationId).eq('user_id', targetUserId);
    if (invited) await adminClient.auth.admin.deleteUser(targetUserId);
  };

  const now = new Date().toISOString();
  const { error: insertMembershipError } = await adminClient.from('organization_members').insert({
    organization_id: organizationId,
    user_id: targetUserId,
    role,
    invitation_status: invited ? 'pending' : 'active',
    invited_at: invited ? now : null,
    activated_at: invited ? null : now,
  });
  if (insertMembershipError) {
    if (invited) await adminClient.auth.admin.deleteUser(targetUserId);
    return json({ error: `Jäsenyyden luominen epäonnistui: ${insertMembershipError.message}` }, 400);
  }

  if (role !== 'customer' && employee) {
    const employeeValues = {
      organization_id: organizationId,
      user_id: targetUserId,
      name: fullName,
      role: employee.jobTitle,
      department: employee.department,
      phone: employee.phone || null,
      email,
      start_date: employee.startDate || null,
      status: employee.status,
      hourly_cost_cents: employee.hourlyCostCents,
      employment_type: employee.employmentType || null,
      emergency_contact_name: employee.emergencyContactName || null,
      emergency_contact_phone: employee.emergencyContactPhone || null,
      created_by: actor.id,
      archived_at: null,
    };
    if (employeeId) {
      const { error: updateEmployeeError } = await adminClient
        .from('employees')
        .update(employeeValues)
        .eq('organization_id', organizationId)
        .eq('id', employeeId);
      if (updateEmployeeError) {
        await rollback();
        return json({ error: `Henkilöstökortin linkittäminen epäonnistui: ${updateEmployeeError.message}` }, 400);
      }
    } else {
      const { data: insertedEmployee, error: insertEmployeeError } = await adminClient
        .from('employees')
        .insert(employeeValues)
        .select('id')
        .single();
      if (insertEmployeeError || !insertedEmployee) {
        await rollback();
        return json({ error: `Henkilöstökortin luominen epäonnistui: ${insertEmployeeError?.message ?? 'Tunniste puuttuu.'}` }, 400);
      }
      employeeId = insertedEmployee.id;
      createdEmployee = true;
    }

    if (employee.supervisorUserId && employeeId) {
      const { error: teamError } = await adminClient.from('supervisor_team_members').upsert({
        organization_id: organizationId,
        supervisor_user_id: employee.supervisorUserId,
        employee_id: employeeId,
        assigned_by: actor.id,
        is_active: true,
        assigned_at: now,
        removed_at: null,
      }, { onConflict: 'organization_id,supervisor_user_id,employee_id' });
      if (teamError) {
        await rollback();
        return json({ error: `Tiimin määrittäminen epäonnistui: ${teamError.message}` }, 400);
      }
    }
  }

  if (role === 'customer') {
    for (const access of customerAccess) {
      const { data: customer, error: customerError } = await adminClient
        .from('customers')
        .select('id')
        .eq('id', access.customerId)
        .eq('organization_id', organizationId)
        .is('archived_at', null)
        .maybeSingle();
      if (customerError || !customer) {
        await rollback();
        return json({ error: 'Valittu asiakas ei kuulu organisaatioon.' }, 400);
      }
      const { error: linkError } = await adminClient.from('customer_users').insert({
        organization_id: organizationId,
        customer_id: access.customerId,
        user_id: targetUserId,
        access_scope: access.accessScope,
      });
      if (linkError) {
        await rollback();
        return json({ error: `Tilaajakytkennän luominen epäonnistui: ${linkError.message}` }, 400);
      }
      if (access.accessScope === 'selected_projects') {
        const { data: projects, error: projectsError } = await adminClient
          .from('projects')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('customer_id', access.customerId)
          .in('id', access.projectIds)
          .is('archived_at', null);
        if (projectsError || (projects ?? []).length !== access.projectIds.length) {
          await rollback();
          return json({ error: 'Yksi tai useampi valittu projekti ei kuulu tilaaja-asiakkuuteen.' }, 400);
        }
        const { error: projectLinkError } = await adminClient.from('customer_user_projects').insert(
          access.projectIds.map((projectId) => ({
            organization_id: organizationId,
            customer_id: access.customerId,
            user_id: targetUserId,
            project_id: projectId,
            created_by: actor.id,
          })),
        );
        if (projectLinkError) {
          await rollback();
          return json({ error: `Projektioikeuksien luominen epäonnistui: ${projectLinkError.message}` }, 400);
        }
      }
    }
  }

  await adminClient.from('audit_logs').insert({
    organization_id: organizationId,
    user_id: actor.id,
    action: invited ? 'organization_member_invited' : 'organization_member_added_existing_user',
    table_name: 'organization_members',
    record_id: targetUserId,
    metadata: {
      target_user_id: targetUserId,
      employee_id: employeeId,
      email,
      role,
      actor_role: actorRole,
      supervisor_user_id: employee?.supervisorUserId ?? null,
      customer_access: role === 'customer' ? customerAccess : [],
      activation_origin: activationOrigin,
      invitation_heading: 'Sinut on kutsuttu käyttämään VaKanttia',
    },
  });

  return json({
    ok: true,
    invited,
    userId: targetUserId,
    employeeId,
    message: invited
      ? 'Henkilö luotiin ja sähköpostikutsu lähetettiin. Viestin otsikko on “Sinut on kutsuttu käyttämään VaKanttia”.'
      : 'Olemassa oleva käyttäjä liitettiin organisaatioon ja henkilöstökorttiin.',
  });
});
