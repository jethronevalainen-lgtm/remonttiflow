import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.110.8';

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

type OrganizationRole = 'supervisor' | 'project_coordinator' | 'worker' | 'customer';

interface Payload {
  sourceOrganizationId?: unknown;
}

interface DemoAccountDefinition {
  role: OrganizationRole;
  displayName: string;
  jobTitle: string;
}

interface DemoAccount extends DemoAccountDefinition {
  userId: string;
  email: string;
}

const DEMO_ACCOUNTS: DemoAccountDefinition[] = [
  { role: 'supervisor', displayName: 'Demo Työnjohtaja', jobTitle: 'Työnjohtaja' },
  { role: 'project_coordinator', displayName: 'Demo Projektikoordinaattori', jobTitle: 'Projektikoordinaattori' },
  { role: 'worker', displayName: 'Demo Työntekijä', jobTitle: 'Rakennustyöntekijä' },
  { role: 'customer', displayName: 'Demo Tilaaja', jobTitle: 'Tilaajan yhteyshenkilö' },
];

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
      // Use the standard Supabase function secret below.
    }
  }
  return Deno.env.get(fallback) ?? null;
}

function todayInHelsinki(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function deterministicUuid(seed: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed)));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomPassword(): string {
  // bcrypt accepts at most 72 bytes; keep the demo password clearly under that.
  return `VkDemo-${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
}

function authErrorMessage(error: { message?: string; code?: string; status?: number } | null | undefined, fallback: string): string {
  if (!error) return fallback;
  const message = typeof error.message === 'string' ? error.message.trim() : '';
  if (message && message !== '{}' && message !== '[object Object]') return message;
  const code = typeof error.code === 'string' ? error.code.trim() : '';
  if (code) return code;
  if (typeof error.status === 'number' && error.status > 0) return `HTTP ${error.status}`;
  return fallback;
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Demokäyttäjien haku epäonnistui: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureDemoUser(
  admin: SupabaseClient,
  ownerUserId: string,
  organizationId: string,
  definition: DemoAccountDefinition,
): Promise<DemoAccount> {
  const email = `${definition.role.replaceAll('_', '-')}.${ownerUserId}@demo.vakantti.invalid`;
  let user = await findAuthUserByEmail(admin, email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: {
        full_name: definition.displayName,
        demo_account: true,
        demo_owner_user_id: ownerUserId,
        demo_role: definition.role,
      },
    });
    if (error || !data.user) {
      // Race / prior partial create: if the email already exists, continue with it.
      const existing = await findAuthUserByEmail(admin, email);
      if (!existing) {
        throw new Error(
          `Roolin ${definition.displayName} demotilin luonti epäonnistui: ${authErrorMessage(error, 'käyttäjää ei palautettu')}`,
        );
      }
      user = existing;
    } else {
      user = data.user;
    }
  }

  if (!user.email_confirmed_at) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        full_name: definition.displayName,
        demo_account: true,
        demo_owner_user_id: ownerUserId,
        demo_role: definition.role,
      },
    });
    if (error || !data.user) {
      throw new Error(`Demotilin aktivointi epäonnistui: ${authErrorMessage(error, 'tuntematon virhe')}`);
    }
    user = data.user;
  } else {
    const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        full_name: definition.displayName,
        demo_account: true,
        demo_owner_user_id: ownerUserId,
        demo_role: definition.role,
      },
    });
    if (metadataError) {
      throw new Error(`Demotilin metatietojen päivitys epäonnistui: ${authErrorMessage(metadataError, 'tuntematon virhe')}`);
    }
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: user.id,
    email,
    full_name: definition.displayName,
    phone: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (profileError) throw new Error(`Demoprofiilin tallennus epäonnistui: ${profileError.message}`);

  const now = new Date().toISOString();
  const { error: membershipError } = await admin.from('organization_members').upsert({
    organization_id: organizationId,
    user_id: user.id,
    role: definition.role,
    invitation_status: 'active',
    activated_at: now,
    disabled_at: null,
  }, { onConflict: 'organization_id,user_id' });
  if (membershipError) throw new Error(`Demojäsenyyden tallennus epäonnistui: ${membershipError.message}`);

  return { ...definition, userId: user.id, email };
}

async function upsertRows(
  admin: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict = 'id',
): Promise<void> {
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}-demodatan tallennus epäonnistui: ${error.message}`);
}

async function ensureDemoOrganization(admin: SupabaseClient, ownerUserId: string): Promise<string> {
  const { data: existing, error: existingError } = await admin
    .from('demo_environments')
    .select('organization_id')
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();
  if (existingError) throw new Error(`Demoympäristön haku epäonnistui: ${existingError.message}`);

  let organizationId = typeof existing?.organization_id === 'string' ? existing.organization_id : '';
  if (!organizationId) {
    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert({
        name: 'VaKantti demoympäristö',
        business_id: `DEMO-${ownerUserId.slice(0, 8).toUpperCase()}`,
      })
      .select('id')
      .single();
    if (organizationError || !organization?.id) {
      throw new Error(`Demo-organisaation luonti epäonnistui: ${organizationError?.message ?? 'organisaatiota ei palautettu'}`);
    }
    organizationId = String(organization.id);
    const { error: environmentError } = await admin.from('demo_environments').insert({
      owner_user_id: ownerUserId,
      organization_id: organizationId,
    });
    if (environmentError) throw new Error(`Demoympäristön rekisteröinti epäonnistui: ${environmentError.message}`);
  } else {
    const { error: organizationError } = await admin.from('organizations').update({
      name: 'VaKantti demoympäristö',
      business_id: `DEMO-${ownerUserId.slice(0, 8).toUpperCase()}`,
      updated_at: new Date().toISOString(),
    }).eq('id', organizationId);
    if (organizationError) throw new Error(`Demo-organisaation päivitys epäonnistui: ${organizationError.message}`);
  }

  return organizationId;
}

async function seedDemoData(
  admin: SupabaseClient,
  ownerUserId: string,
  organizationId: string,
  accounts: DemoAccount[],
): Promise<{ projects: number; workOrders: number; timeEntries: number }> {
  const byRole = new Map(accounts.map((account) => [account.role, account]));
  const supervisor = byRole.get('supervisor');
  const coordinator = byRole.get('project_coordinator');
  const worker = byRole.get('worker');
  const customerUser = byRole.get('customer');
  if (!supervisor || !coordinator || !worker || !customerUser) {
    throw new Error('Demoroolien valmistelu jäi puutteelliseksi.');
  }

  const today = todayInHelsinki();
  const ids = {
    customer: await deterministicUuid(`${ownerUserId}:demo:customer`),
    activeProject: await deterministicUuid(`${ownerUserId}:demo:project:active`),
    lateProject: await deterministicUuid(`${ownerUserId}:demo:project:late`),
    plannedProject: await deterministicUuid(`${ownerUserId}:demo:project:planned`),
    workerEmployee: await deterministicUuid(`${ownerUserId}:demo:employee:worker`),
    supervisorEmployee: await deterministicUuid(`${ownerUserId}:demo:employee:supervisor`),
    coordinatorEmployee: await deterministicUuid(`${ownerUserId}:demo:employee:coordinator`),
    workOrderKitchen: await deterministicUuid(`${ownerUserId}:demo:work-order:kitchen`),
    workOrderLate: await deterministicUuid(`${ownerUserId}:demo:work-order:late`),
    workOrderDone: await deterministicUuid(`${ownerUserId}:demo:work-order:done`),
    phaseActive: await deterministicUuid(`${ownerUserId}:demo:phase:active`),
    phaseLate: await deterministicUuid(`${ownerUserId}:demo:phase:late`),
    timeApproved: await deterministicUuid(`${ownerUserId}:demo:time:approved`),
    timePending: await deterministicUuid(`${ownerUserId}:demo:time:pending`),
    diary: await deterministicUuid(`${ownerUserId}:demo:diary`),
    safety: await deterministicUuid(`${ownerUserId}:demo:safety`),
  };

  await upsertRows(admin, 'customers', [{
    id: ids.customer,
    organization_id: organizationId,
    created_by: ownerUserId,
    name: 'Asunto Oy Demokatu 12',
    type: 'Taloyhtiö',
    contact_person: customerUser.displayName,
    email: customerUser.email,
    phone: '040 123 4567',
    address: 'Demokatu 12, 00100 Helsinki',
    status: 'Aktiivinen',
    project_count: 3,
    notes: 'Eristetyn demoympäristön tilaaja-asiakas.',
    archived_at: null,
  }]);

  await upsertRows(admin, 'projects', [
    {
      id: ids.activeProject,
      organization_id: organizationId,
      created_by: ownerUserId,
      customer_id: ids.customer,
      project_number: 'DEMO-001',
      name: 'Demokatu 12 – keittiökorjaukset',
      customer: 'Asunto Oy Demokatu 12',
      location: 'Demokatu 12, Helsinki',
      status: 'Suunniteltu',
      start_date: addDays(today, -14),
      end_date: addDays(today, 30),
      budget: 145000,
      spent: 48600,
      progress: 42,
      description: 'Kahdentoista huoneiston keittiökorjaukset porrastetulla toteutuksella.',
      responsible_supervisor_id: supervisor.userId,
      project_manager_id: coordinator.userId,
      archived_at: null,
    },
    {
      id: ids.lateProject,
      organization_id: organizationId,
      created_by: ownerUserId,
      customer_id: ids.customer,
      project_number: 'DEMO-002',
      name: 'Demokatu 12 – vesivahingon jälkityöt',
      customer: 'Asunto Oy Demokatu 12',
      location: 'Demokatu 12 B 8, Helsinki',
      status: 'Suunniteltu',
      start_date: addDays(today, -40),
      end_date: addDays(today, -3),
      budget: 28500,
      spent: 26400,
      progress: 78,
      description: 'Myöhässä oleva esimerkkiprojekti poikkeamien ja reagointinäkymien testaamiseen.',
      responsible_supervisor_id: supervisor.userId,
      project_manager_id: coordinator.userId,
      archived_at: null,
    },
    {
      id: ids.plannedProject,
      organization_id: organizationId,
      created_by: ownerUserId,
      customer_id: ids.customer,
      project_number: 'DEMO-003',
      name: 'Demokatu 12 – yleisten tilojen maalaus',
      customer: 'Asunto Oy Demokatu 12',
      location: 'Demokatu 12, Helsinki',
      status: 'Suunniteltu',
      start_date: addDays(today, 10),
      end_date: addDays(today, 35),
      budget: 42000,
      spent: 0,
      progress: 0,
      description: 'Tuleva projekti suunnittelun, resursoinnin ja aikataulutuksen tarkasteluun.',
      responsible_supervisor_id: supervisor.userId,
      project_manager_id: coordinator.userId,
      archived_at: null,
    },
  ]);

  await upsertRows(admin, 'project_members', [
    { organization_id: organizationId, project_id: ids.activeProject, user_id: worker.userId, role: 'asentaja' },
    { organization_id: organizationId, project_id: ids.activeProject, user_id: coordinator.userId, role: 'projektikoordinaattori' },
    { organization_id: organizationId, project_id: ids.activeProject, user_id: supervisor.userId, role: 'työnjohtaja' },
    { organization_id: organizationId, project_id: ids.lateProject, user_id: worker.userId, role: 'asentaja' },
    { organization_id: organizationId, project_id: ids.lateProject, user_id: coordinator.userId, role: 'projektikoordinaattori' },
    { organization_id: organizationId, project_id: ids.lateProject, user_id: supervisor.userId, role: 'työnjohtaja' },
  ], 'project_id,user_id');

  await upsertRows(admin, 'employees', [
    {
      id: ids.workerEmployee,
      organization_id: organizationId,
      created_by: ownerUserId,
      user_id: worker.userId,
      name: worker.displayName,
      role: worker.jobTitle,
      department: 'Tuotanto',
      email: worker.email,
      phone: '040 111 1111',
      start_date: addDays(today, -365),
      status: 'Aktiivinen',
      hourly_cost_cents: 2850,
      employment_type: 'Vakituinen',
      employment_category: 'employee',
      archived_at: null,
    },
    {
      id: ids.supervisorEmployee,
      organization_id: organizationId,
      created_by: ownerUserId,
      user_id: supervisor.userId,
      name: supervisor.displayName,
      role: supervisor.jobTitle,
      department: 'Työnjohto',
      email: supervisor.email,
      start_date: addDays(today, -700),
      status: 'Aktiivinen',
      employment_type: 'Vakituinen',
      employment_category: 'employee',
      archived_at: null,
    },
    {
      id: ids.coordinatorEmployee,
      organization_id: organizationId,
      created_by: ownerUserId,
      user_id: coordinator.userId,
      name: coordinator.displayName,
      role: coordinator.jobTitle,
      department: 'Projektit',
      email: coordinator.email,
      start_date: addDays(today, -200),
      status: 'Aktiivinen',
      employment_type: 'Vakituinen',
      employment_category: 'employee',
      archived_at: null,
    },
  ]);

  await upsertRows(admin, 'work_orders', [
    {
      id: ids.workOrderKitchen,
      organization_id: organizationId,
      created_by: supervisor.userId,
      project_id: ids.activeProject,
      title: 'Asenna keittiökalusteet asuntoon A 4',
      project: 'Demokatu 12 – keittiökorjaukset',
      assignee: worker.displayName,
      due_date: addDays(today, 2),
      planned_start_date: today,
      planned_end_date: addDays(today, 2),
      planned_start_time: '07:00',
      planned_end_time: '15:30',
      priority: 'Korkea',
      status: 'Käynnissä',
      type: 'Kalusteasennus',
      description: 'Asenna rungot, ovet, sokkelit ja listoitukset. Dokumentoi lopputulos kuvilla.',
      assignment_scope: 'people',
      location: 'Demokatu 12 A 4',
      location_detail: 'A-rappu, 2. kerros, asunto A 4',
      occupancy_status: 'vacant',
      access_notes: 'Avain huoltoyhtiön avainkaapista. Koodi löytyy projektin ohjeista.',
      worker_note: 'Tarkista ennen aloitusta, että välitilan levyt ovat kohteessa.',
      resident_notification_required: false,
    },
    {
      id: ids.workOrderLate,
      organization_id: organizationId,
      created_by: supervisor.userId,
      project_id: ids.lateProject,
      title: 'Korjaa kylpyhuoneen oviaukon listoitus',
      project: 'Demokatu 12 – vesivahingon jälkityöt',
      assignee: worker.displayName,
      due_date: addDays(today, -1),
      planned_start_date: addDays(today, -4),
      planned_end_date: addDays(today, -1),
      planned_start_time: '08:00',
      planned_end_time: '12:00',
      priority: 'Korkea',
      status: 'Odottaa',
      type: 'Viimeistely',
      description: 'Lista on vaurioitunut. Vaihda lista ja paikkaa maalipinta.',
      assignment_scope: 'people',
      location: 'Demokatu 12 B 8',
      location_detail: 'B-rappu, 3. kerros, asunto B 8',
      occupancy_status: 'occupied',
      start_constraints: 'Aloitus vasta asukkaan kanssa sovitun ajan jälkeen.',
      access_notes: 'Soita asukkaalle 30 minuuttia ennen saapumista.',
      resident_notification_required: true,
    },
    {
      id: ids.workOrderDone,
      organization_id: organizationId,
      created_by: supervisor.userId,
      project_id: ids.activeProject,
      title: 'Suojaa kulkureitti asuntoon A 2',
      project: 'Demokatu 12 – keittiökorjaukset',
      assignee: worker.displayName,
      due_date: addDays(today, -5),
      planned_start_date: addDays(today, -6),
      planned_end_date: addDays(today, -5),
      planned_start_time: '07:00',
      planned_end_time: '10:00',
      priority: 'Normaali',
      status: 'Valmis',
      type: 'Suojaus',
      description: 'Suojaa porraskäytävä, hissi ja asunnon kulkureitti.',
      assignment_scope: 'people',
      location: 'Demokatu 12 A 2',
      location_detail: 'A-rappu, 1. kerros, asunto A 2',
      occupancy_status: 'occupied',
      completed_at: `${addDays(today, -5)}T10:15:00.000Z`,
      completion_approved: true,
    },
  ]);

  await upsertRows(admin, 'work_order_assignees', [
    { organization_id: organizationId, work_order_id: ids.workOrderKitchen, user_id: worker.userId, assigned_by: supervisor.userId, responsibility: 'vastuuhenkilö' },
    { organization_id: organizationId, work_order_id: ids.workOrderLate, user_id: worker.userId, assigned_by: supervisor.userId, responsibility: 'vastuuhenkilö' },
    { organization_id: organizationId, work_order_id: ids.workOrderDone, user_id: worker.userId, assigned_by: supervisor.userId, responsibility: 'tekijä' },
  ], 'work_order_id,user_id');

  await upsertRows(admin, 'customer_users', [{
    organization_id: organizationId,
    customer_id: ids.customer,
    user_id: customerUser.userId,
    access_scope: 'selected_projects',
    portal_profile: 'approver',
    portal_permissions: {},
    disabled_at: null,
  }], 'organization_id,customer_id,user_id');

  await upsertRows(admin, 'customer_user_projects', [
    { organization_id: organizationId, customer_id: ids.customer, user_id: customerUser.userId, project_id: ids.activeProject, created_by: ownerUserId },
    { organization_id: organizationId, customer_id: ids.customer, user_id: customerUser.userId, project_id: ids.lateProject, created_by: ownerUserId },
    { organization_id: organizationId, customer_id: ids.customer, user_id: customerUser.userId, project_id: ids.plannedProject, created_by: ownerUserId },
  ], 'organization_id,customer_id,user_id,project_id');

  await upsertRows(admin, 'project_phases', [
    {
      id: ids.phaseActive,
      organization_id: organizationId,
      project_id: ids.activeProject,
      created_by: coordinator.userId,
      name: 'Kalusteasennukset',
      project_name: 'Demokatu 12 – keittiökorjaukset',
      start_date: addDays(today, -3),
      end_date: addDays(today, 8),
      status: 'Käynnissä',
      progress: 48,
      sequence_no: 3,
      default_priority: 'Normaali',
      notes: 'A-rapun asunnot työn alla.',
    },
    {
      id: ids.phaseLate,
      organization_id: organizationId,
      project_id: ids.lateProject,
      created_by: coordinator.userId,
      name: 'Viimeistely ja luovutus',
      project_name: 'Demokatu 12 – vesivahingon jälkityöt',
      start_date: addDays(today, -10),
      end_date: addDays(today, -3),
      status: 'Myöhässä',
      progress: 78,
      sequence_no: 4,
      default_priority: 'Korkea',
      notes: 'Kaksi viimeistelytehtävää avoinna.',
    },
  ]);

  await upsertRows(admin, 'time_entries', [
    {
      id: ids.timeApproved,
      organization_id: organizationId,
      created_by: worker.userId,
      user_id: worker.userId,
      employee_id: ids.workerEmployee,
      project_id: ids.activeProject,
      work_order_id: ids.workOrderDone,
      date: addDays(today, -5),
      employee: worker.displayName,
      project: 'Demokatu 12 – keittiökorjaukset',
      hours: 7.5,
      overtime: 0,
      break_minutes: 30,
      description: 'Suojaus ja purkutyön valmistelu.',
      status: 'Hyväksytty',
      approved_by: supervisor.userId,
      approved_at: `${addDays(today, -4)}T12:00:00.000Z`,
      source: 'manual',
      break_source: 'manual',
      start_time: '07:00',
      end_time: '15:00',
      billable: true,
      billing_status: 'approved',
    },
    {
      id: ids.timePending,
      organization_id: organizationId,
      created_by: worker.userId,
      user_id: worker.userId,
      employee_id: ids.workerEmployee,
      project_id: ids.activeProject,
      work_order_id: ids.workOrderKitchen,
      date: addDays(today, -1),
      employee: worker.displayName,
      project: 'Demokatu 12 – keittiökorjaukset',
      hours: 8,
      overtime: 0.5,
      break_minutes: 30,
      description: 'Keittiökalusteiden runkoasennukset.',
      status: 'Odottaa',
      source: 'manual',
      break_source: 'manual',
      start_time: '07:00',
      end_time: '15:30',
      billable: true,
      billing_status: 'recorded',
    },
  ]);

  await upsertRows(admin, 'diary_entries', [{
    id: ids.diary,
    organization_id: organizationId,
    created_by: supervisor.userId,
    project_id: ids.activeProject,
    project: 'Demokatu 12 – keittiökorjaukset',
    date: addDays(today, -1),
    weather: 'Puolipilvinen',
    temperature: 18,
    workers: 4,
    work_phases: 'A-rapun kalusteasennukset ja B-rapun purkutyöt.',
    deliveries: 'Työtasot ja välitilalevyt saapuivat klo 09.30.',
    issues: 'Asunnon A 6 vesipiste vaatii LVI-tarkistuksen.',
    author: supervisor.displayName,
    status: 'Hyväksytty',
    approved_by: supervisor.userId,
    approved_at: `${addDays(today, -1)}T16:00:00.000Z`,
  }]);

  await upsertRows(admin, 'safety_items', [{
    id: ids.safety,
    organization_id: organizationId,
    created_by: worker.userId,
    project_id: ids.activeProject,
    project: 'Demokatu 12 – keittiökorjaukset',
    type: 'observation',
    title: 'Porraskäytävän suojamuovi irronnut',
    description: 'Suojamuovin reuna aiheutti kompastumisvaaran A-rapun toisessa kerroksessa.',
    date: today,
    severity: 'Keskitasoinen',
    status: 'Osoitettu',
    assignee: supervisor.displayName,
    assignee_user_id: supervisor.userId,
    due_date: addDays(today, 1),
    location: 'Demokatu 12 A, 2. kerros',
    corrective_action: 'Kiinnitä suojamuovi teipillä koko käytävän leveydeltä.',
  }]);

  await admin.from('demo_environments').update({ refreshed_at: new Date().toISOString() }).eq('owner_user_id', ownerUserId);
  await admin.from('audit_logs').insert({
    organization_id: organizationId,
    user_id: ownerUserId,
    action: 'demo_environment_provisioned',
    table_name: 'demo_environments',
    record_id: organizationId,
    metadata: {
      account_roles: accounts.map((account) => account.role),
      seeded_projects: 3,
      seeded_work_orders: 3,
    },
  });

  return { projects: 3, workOrders: 3, timeEntries: 2 };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return response({ error: 'Vain POST-pyyntö on sallittu.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'Kirjautuminen vaaditaan.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = namedSecret('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const serviceKey = namedSecret('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishableKey || !serviceKey) {
    return response({ error: 'Palvelimen Supabase-konfiguraatio puuttuu.' }, 503);
  }

  let payload: Payload;
  try {
    payload = await request.json() as Payload;
  } catch {
    return response({ error: 'Pyynnön JSON ei ole kelvollinen.' }, 400);
  }

  const sourceOrganizationId = stringValue(payload.sourceOrganizationId);
  if (!isUuid(sourceOrganizationId)) {
    return response({ error: 'Lähdeorganisaation tunniste puuttuu tai on virheellinen.' }, 400);
  }

  const userClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization } },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return response({ error: 'Istunto ei ole voimassa.' }, 401);
  const actor = userData.user;

  const { data: actorMembership, error: actorMembershipError } = await userClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', sourceOrganizationId)
    .eq('user_id', actor.id)
    .maybeSingle();
  if (actorMembershipError) return response({ error: 'Ylläpitäjän käyttöoikeuden tarkistus epäonnistui.' }, 500);
  if (actorMembership?.role !== 'admin') {
    return response({ error: 'Vain organisaation ylläpitäjä voi luoda demoympäristön.' }, 403);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const organizationId = await ensureDemoOrganization(admin, actor.id);
    const now = new Date().toISOString();
    const { error: actorDemoMembershipError } = await admin.from('organization_members').upsert({
      organization_id: organizationId,
      user_id: actor.id,
      role: 'admin',
      invitation_status: 'active',
      activated_at: now,
      disabled_at: null,
    }, { onConflict: 'organization_id,user_id' });
    if (actorDemoMembershipError) throw new Error(`Ylläpitäjän demo-oikeuden tallennus epäonnistui: ${actorDemoMembershipError.message}`);

    const accounts: DemoAccount[] = [];
    for (const definition of DEMO_ACCOUNTS) {
      accounts.push(await ensureDemoUser(admin, actor.id, organizationId, definition));
    }
    const seeded = await seedDemoData(admin, actor.id, organizationId, accounts);

    return response({
      ok: true,
      organizationId,
      organizationName: 'VaKantti demoympäristö',
      accounts: accounts.map(({ userId, email, displayName, role }) => ({ userId, email, displayName, role })),
      seeded,
    });
  } catch (caught) {
    console.error('Demo environment provisioning failed', caught);
    return response({
      error: caught instanceof Error ? caught.message : 'Demoympäristön luonti epäonnistui.',
    }, 500);
  }
});
