import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.110.8';

const DATASET_VERSION = 4;
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

type DemoScenario = 'normal' | 'busy' | 'late' | 'empty' | 'handover';
type DemoRole = 'supervisor' | 'project_coordinator' | 'worker' | 'customer';

type Row = Record<string, unknown>;

interface Payload {
  sourceOrganizationId?: unknown;
  scenario?: unknown;
}

interface DemoAccount {
  userId: string;
  role: DemoRole;
  displayName: string;
  email: string;
}

interface ScenarioProject {
  id: string;
  projectNumber: string;
  name: string;
  location: string;
  startOffset: number;
  endOffset: number;
  budget: number;
  spent: number;
  progress: number;
  completed?: boolean;
  description: string;
}

interface ScenarioWorkOrder {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  location: string;
  startOffset: number;
  endOffset: number;
  status: 'Avoin' | 'Käynnissä' | 'Odottaa' | 'Valmis';
  priority: 'Korkea' | 'Normaali' | 'Matala';
  type: string;
  assignee: DemoAccount;
  occupied?: boolean;
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isScenario(value: string): value is DemoScenario {
  return value === 'normal'
    || value === 'busy'
    || value === 'late'
    || value === 'empty'
    || value === 'handover';
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

async function upsertRows(
  admin: SupabaseClient,
  table: string,
  rows: Row[],
  onConflict = 'id',
): Promise<void> {
  if (!rows.length) return;
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}-demodatan tallennus epäonnistui: ${error.message}`);
}

async function deleteIds(admin: SupabaseClient, table: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await admin.from(table).delete().in('id', ids);
  if (error) throw new Error(`${table}-demodatan siivous epäonnistui: ${error.message}`);
}

async function loadDemoAccounts(admin: SupabaseClient, organizationId: string): Promise<DemoAccount[]> {
  const { data: memberships, error: membershipError } = await admin
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', organizationId)
    .in('role', ['supervisor', 'project_coordinator', 'worker', 'customer'])
    .eq('invitation_status', 'active')
    .is('disabled_at', null);
  if (membershipError) throw new Error(`Demoroolien haku epäonnistui: ${membershipError.message}`);

  const rows = memberships ?? [];
  const userIds = rows.map((row) => String(row.user_id));
  if (userIds.length !== 4) throw new Error('Demoympäristössä ei ole kaikkia neljää roolia.');

  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);
  if (profileError) throw new Error(`Demoprofiilien haku epäonnistui: ${profileError.message}`);
  const profileMap = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));

  return rows.map((membership) => {
    const profile = profileMap.get(String(membership.user_id));
    return {
      userId: String(membership.user_id),
      role: membership.role as DemoRole,
      displayName: String(profile?.full_name || `Demo ${String(membership.role)}`),
      email: String(profile?.email || ''),
    };
  });
}

async function scenarioIds(ownerUserId: string) {
  const id = (suffix: string) => deterministicUuid(`${ownerUserId}:demo:${suffix}`);
  return {
    customer: await id('customer'),
    projects: await Promise.all(Array.from({ length: 5 }, (_, index) => id(`project:${index + 1}`))),
    legacyProjects: [
      await id('project:active'),
      await id('project:late'),
      await id('project:planned'),
      await id('project:extra-a'),
      await id('project:extra-b'),
    ],
    employees: {
      worker: await id('employee:worker'),
      supervisor: await id('employee:supervisor'),
      coordinator: await id('employee:coordinator'),
      installerA: await id('employee:installer-a'),
      installerB: await id('employee:installer-b'),
      electrician: await id('employee:electrician'),
      painter: await id('employee:painter'),
      apprentice: await id('employee:apprentice'),
    },
    workOrders: await Promise.all(Array.from({ length: 10 }, (_, index) => id(`work-order:${index + 1}`))),
    legacyWorkOrders: [
      await id('work-order:kitchen'),
      await id('work-order:late'),
      await id('work-order:done'),
      ...await Promise.all(Array.from({ length: 7 }, (_, index) => id(`work-order:extra-${index + 1}`))),
    ],
    timeEntries: await Promise.all(Array.from({ length: 6 }, (_, index) => id(`time:${index + 1}`))),
    legacyTimeEntries: [
      await id('time:approved'),
      await id('time:pending'),
      ...await Promise.all(Array.from({ length: 4 }, (_, index) => id(`time:extra-${index + 1}`))),
    ],
    safetyItems: await Promise.all(Array.from({ length: 3 }, (_, index) => id(`safety:${index + 1}`))),
    legacySafetyItems: [await id('safety'), await id('safety:extra-1'), await id('safety:extra-2')],
    phases: await Promise.all(Array.from({ length: 4 }, (_, index) => id(`phase:${index + 1}`))),
    legacyPhases: [await id('phase:active'), await id('phase:late')],
    diary: await id('diary:scenario'),
    legacyDiary: await id('diary'),
  };
}

async function clearDemoBusinessData(
  admin: SupabaseClient,
  organizationId: string,
  ids: Awaited<ReturnType<typeof scenarioIds>>,
): Promise<void> {
  await deleteIds(admin, 'time_entries', [...ids.timeEntries, ...ids.legacyTimeEntries]);
  await deleteIds(admin, 'diary_entries', [ids.diary, ids.legacyDiary]);
  await deleteIds(admin, 'safety_items', [...ids.safetyItems, ...ids.legacySafetyItems]);
  await deleteIds(admin, 'project_phases', [...ids.phases, ...ids.legacyPhases]);
  await deleteIds(admin, 'work_orders', [...ids.workOrders, ...ids.legacyWorkOrders]);
  await deleteIds(admin, 'projects', [...ids.projects, ...ids.legacyProjects]);

  const { error: teamError } = await admin
    .from('supervisor_team_members')
    .delete()
    .eq('organization_id', organizationId);
  if (teamError) throw new Error(`Demotiimin siivous epäonnistui: ${teamError.message}`);

  await deleteIds(admin, 'employees', Object.values(ids.employees));

  const { error: accessError } = await admin
    .from('customer_users')
    .delete()
    .eq('organization_id', organizationId)
    .eq('customer_id', ids.customer);
  if (accessError) throw new Error(`Tilaajademon siivous epäonnistui: ${accessError.message}`);
  await deleteIds(admin, 'customers', [ids.customer]);
}

function projectDefinitions(
  scenario: Exclude<DemoScenario, 'empty'>,
  ids: Awaited<ReturnType<typeof scenarioIds>>,
): ScenarioProject[] {
  const base: ScenarioProject[] = [
    {
      id: ids.projects[0], projectNumber: 'DEMO-001', name: 'Demokatu 12 – keittiökorjaukset',
      location: 'Demokatu 12, Helsinki', startOffset: -14, endOffset: 30,
      budget: 145000, spent: 48600, progress: 42,
      description: 'Kahdentoista huoneiston keittiökorjaukset porrastetulla toteutuksella.',
    },
    {
      id: ids.projects[1], projectNumber: 'DEMO-002', name: 'Demokatu 12 – vesivahingon jälkityöt',
      location: 'Demokatu 12 B 8, Helsinki', startOffset: -40, endOffset: -3,
      budget: 28500, spent: 26400, progress: 78,
      description: 'Aikataulupoikkeamien ja viimeistelytehtävien esimerkkiprojekti.',
    },
    {
      id: ids.projects[2], projectNumber: 'DEMO-003', name: 'Demokatu 12 – yleisten tilojen maalaus',
      location: 'Demokatu 12, Helsinki', startOffset: 10, endOffset: 35,
      budget: 42000, spent: 0, progress: 0,
      description: 'Tuleva projekti suunnittelun, resursoinnin ja aikataulutuksen tarkasteluun.',
    },
  ];

  if (scenario === 'normal') return base;
  if (scenario === 'late') {
    return base.map((project, index) => ({
      ...project,
      startOffset: -60 + index * 10,
      endOffset: -14 + index * 5,
      progress: [68, 82, 35][index],
      spent: [102000, 27900, 13000][index],
      description: `${project.name}: myöhässä oleva poikkeamatilanne.`,
    }));
  }
  if (scenario === 'handover') {
    return [
      { ...base[0], startOffset: -50, endOffset: 3, progress: 94, spent: 137500, description: 'Luovutusvaiheessa oleva keittiökorjaus.' },
      { ...base[1], startOffset: -45, endOffset: -2, progress: 100, spent: 28100, completed: true, description: 'Valmis vesivahingon jälkityö tilaajan tarkastukseen.' },
      { ...base[2], startOffset: 20, endOffset: 45 },
    ];
  }
  return [
    ...base,
    {
      id: ids.projects[3], projectNumber: 'DEMO-004', name: 'Demokatu 14 – kylpyhuonekorjaukset',
      location: 'Demokatu 14, Helsinki', startOffset: -8, endOffset: 42,
      budget: 188000, spent: 21500, progress: 18,
      description: 'Kiireisen työmaan rinnakkainen kylpyhuoneprojekti.',
    },
    {
      id: ids.projects[4], projectNumber: 'DEMO-005', name: 'Demokatu 16 – julkisivun paikkakorjaukset',
      location: 'Demokatu 16, Helsinki', startOffset: -2, endOffset: 20,
      budget: 73000, spent: 8200, progress: 12,
      description: 'Useita yhtäaikaisia resursseja kuormittava projekti.',
    },
  ];
}

function workOrderDefinitions(
  scenario: Exclude<DemoScenario, 'empty'>,
  projects: ScenarioProject[],
  ids: Awaited<ReturnType<typeof scenarioIds>>,
  worker: DemoAccount,
  coordinator: DemoAccount,
): ScenarioWorkOrder[] {
  const normal: ScenarioWorkOrder[] = [
    {
      id: ids.workOrders[0], projectId: projects[0].id, projectName: projects[0].name,
      title: 'Asenna keittiökalusteet asuntoon A 4', location: 'Demokatu 12 A 4',
      startOffset: 0, endOffset: 2, status: 'Käynnissä', priority: 'Korkea', type: 'Kalusteasennus', assignee: worker,
    },
    {
      id: ids.workOrders[1], projectId: projects[1].id, projectName: projects[1].name,
      title: 'Korjaa kylpyhuoneen oviaukon listoitus', location: 'Demokatu 12 B 8',
      startOffset: -4, endOffset: -1, status: 'Odottaa', priority: 'Korkea', type: 'Viimeistely', assignee: worker, occupied: true,
    },
    {
      id: ids.workOrders[2], projectId: projects[0].id, projectName: projects[0].name,
      title: 'Suojaa kulkureitti asuntoon A 2', location: 'Demokatu 12 A 2',
      startOffset: -6, endOffset: -5, status: 'Valmis', priority: 'Normaali', type: 'Suojaus', assignee: worker, occupied: true,
    },
  ];
  if (scenario === 'normal') return normal;
  if (scenario === 'late') {
    const titles = [
      'Korjaa puuttuva silikonisauma', 'Täydennä luovutuskuvat', 'Selvitä materiaaliviive',
      'Viimeistele listoitukset', 'Korjaa puuttuva palokatko', 'Sovi uusi käynti asukkaan kanssa',
    ];
    return titles.map((title, index) => ({
      id: ids.workOrders[index], projectId: projects[index % projects.length].id,
      projectName: projects[index % projects.length].name, title,
      location: projects[index % projects.length].location,
      startOffset: -(index + 6), endOffset: -(index + 1),
      status: index === 0 ? 'Käynnissä' : index === 5 ? 'Valmis' : 'Odottaa',
      priority: index === 5 ? 'Normaali' : 'Korkea', type: index === 2 ? 'Selvitys' : 'Viimeistely',
      assignee: worker, occupied: true,
    }));
  }
  if (scenario === 'handover') {
    const titles = [
      'Tee itselleluovutus asuntoon A 4', 'Koosta luovutuskansio tilaajalle',
      'Korjaa tarkastuksessa löytyneet listapuutteet', 'Hyväksy loppusiivous', 'Luovuta valmis kohde tilaajalle',
    ];
    return titles.map((title, index) => ({
      id: ids.workOrders[index], projectId: index === 4 ? projects[1].id : projects[0].id,
      projectName: index === 4 ? projects[1].name : projects[0].name,
      title, location: index === 4 ? projects[1].location : projects[0].location,
      startOffset: index - 2, endOffset: index - 1,
      status: index >= 3 ? 'Valmis' : index === 1 ? 'Käynnissä' : 'Odottaa',
      priority: index === 2 ? 'Korkea' : 'Normaali',
      type: index === 0 ? 'Itselleluovutus' : index === 1 ? 'Dokumentointi' : 'Viimeistely',
      assignee: index === 1 ? coordinator : worker, occupied: true,
    }));
  }

  const titles = [
    'Pura vanhat kalusteet', 'Tee vedeneristyksen tarkastus', 'Asenna laatoitus',
    'Tilaa puuttuvat hanat', 'Suojaa julkisivun kulkureitti', 'Korjaa rappausvaurio',
    'Dokumentoi päivän työvaiheet', 'Asenna keittiön työtaso', 'Tee loppusiivous', 'Tarkista materiaalitoimitus',
  ];
  return titles.map((title, index) => ({
    id: ids.workOrders[index], projectId: projects[index % projects.length].id,
    projectName: projects[index % projects.length].name, title,
    location: projects[index % projects.length].location,
    startOffset: index - 3, endOffset: index - 1,
    status: index === 0 ? 'Käynnissä' : index === 3 ? 'Odottaa' : index === 8 ? 'Valmis' : 'Avoin',
    priority: index < 3 ? 'Korkea' : 'Normaali', type: 'Rakennustyö', assignee: worker,
    occupied: index % 2 === 1,
  }));
}

async function seedScenario(
  admin: SupabaseClient,
  ownerUserId: string,
  organizationId: string,
  sourceOrganizationId: string,
  scenario: DemoScenario,
  accounts: DemoAccount[],
) {
  const ids = await scenarioIds(ownerUserId);
  await clearDemoBusinessData(admin, organizationId, ids);

  if (scenario === 'empty') {
    return { projects: 0, workOrders: 0, timeEntries: 0, safetyItems: 0 };
  }

  const byRole = new Map(accounts.map((account) => [account.role, account]));
  const supervisor = byRole.get('supervisor');
  const coordinator = byRole.get('project_coordinator');
  const worker = byRole.get('worker');
  const customerUser = byRole.get('customer');
  if (!supervisor || !coordinator || !worker || !customerUser) throw new Error('Demoroolit ovat puutteelliset.');

  const today = todayInHelsinki();
  const projects = projectDefinitions(scenario, ids);
  const workOrders = workOrderDefinitions(scenario, projects, ids, worker, coordinator);
  const timeCount = scenario === 'busy' ? 6 : 2;
  const safetyCount = scenario === 'busy' ? 3 : scenario === 'late' ? 2 : 1;

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
    project_count: projects.length,
    notes: `Eristetyn demoympäristön ${scenario}-skenaario.`,
    archived_at: null,
  }]);

  await upsertRows(admin, 'employees', [
    {
      id: ids.employees.worker, organization_id: organizationId, created_by: ownerUserId,
      user_id: worker.userId, name: worker.displayName, role: 'Rakennustyöntekijä', department: 'Tuotanto',
      email: worker.email, phone: '040 111 1111', start_date: addDays(today, -365), status: 'Aktiivinen',
      hourly_cost_cents: 2850, employment_type: 'Vakituinen', employment_category: 'employee',
      emergency_contact_name: 'Mari Rantanen', emergency_contact_phone: '040 111 0000',
      tax_number: '1234567-D', archived_at: null,
    },
    {
      id: ids.employees.supervisor, organization_id: organizationId, created_by: ownerUserId,
      user_id: supervisor.userId, name: supervisor.displayName, role: 'Työnjohtaja', department: 'Työnjohto',
      email: supervisor.email, phone: '040 222 2222', start_date: addDays(today, -700), status: 'Aktiivinen',
      hourly_cost_cents: 4200, employment_type: 'Vakituinen', employment_category: 'employee',
      emergency_contact_name: 'Sari Heikkinen', emergency_contact_phone: '040 222 0000',
      tax_number: '2234567-D', archived_at: null,
    },
    {
      id: ids.employees.coordinator, organization_id: organizationId, created_by: ownerUserId,
      user_id: coordinator.userId, name: coordinator.displayName, role: 'Projektikoordinaattori', department: 'Projektit',
      email: coordinator.email, phone: '040 333 3333', start_date: addDays(today, -200), status: 'Aktiivinen',
      hourly_cost_cents: 3600, employment_type: 'Vakituinen', employment_category: 'employee',
      emergency_contact_name: 'Antti Saarinen', emergency_contact_phone: '040 333 0000',
      tax_number: '3234567-D', archived_at: null,
    },
    {
      id: ids.employees.installerA, organization_id: organizationId, created_by: ownerUserId,
      user_id: null, name: 'Aino Virtanen', role: 'Asentaja', department: 'Tuotanto',
      email: `aino.virtanen.${ownerUserId.slice(0, 8)}@demo.vakantti.invalid`,
      phone: '040 444 1001', start_date: addDays(today, -520), status: 'Aktiivinen',
      hourly_cost_cents: 2750, employment_type: 'Vakituinen', employment_category: 'employee',
      emergency_contact_name: 'Pekka Virtanen', emergency_contact_phone: '040 444 0001',
      tax_number: '4234567-D', archived_at: null,
    },
    {
      id: ids.employees.installerB, organization_id: organizationId, created_by: ownerUserId,
      user_id: null, name: 'Mikko Korhonen', role: 'Asentaja', department: 'Tuotanto',
      email: `mikko.korhonen.${ownerUserId.slice(0, 8)}@demo.vakantti.invalid`,
      phone: '040 444 1002', start_date: addDays(today, -410), status: 'Aktiivinen',
      hourly_cost_cents: 2800, employment_type: 'Vakituinen', employment_category: 'employee',
      emergency_contact_name: 'Liisa Korhonen', emergency_contact_phone: '040 444 0002',
      tax_number: '5234567-D', archived_at: null,
    },
    {
      id: ids.employees.electrician, organization_id: organizationId, created_by: ownerUserId,
      user_id: null, name: 'Elias Nieminen', role: 'Sähköasentaja', department: 'Sähkö',
      email: `elias.nieminen.${ownerUserId.slice(0, 8)}@demo.vakantti.invalid`,
      phone: '040 555 1003', start_date: addDays(today, -640), status: 'Aktiivinen',
      hourly_cost_cents: 3200, employment_type: 'Vakituinen', employment_category: 'employee',
      emergency_contact_name: 'Noora Nieminen', emergency_contact_phone: '040 555 0003',
      tax_number: '6234567-D', archived_at: null,
    },
    {
      id: ids.employees.painter, organization_id: organizationId, created_by: ownerUserId,
      user_id: null, name: 'Sofia Laine', role: 'Maalari', department: 'Pintatyöt',
      email: `sofia.laine.${ownerUserId.slice(0, 8)}@demo.vakantti.invalid`,
      phone: '040 666 1004', start_date: addDays(today, -290), status: 'Aktiivinen',
      hourly_cost_cents: 2650, employment_type: 'Määräaikainen', employment_category: 'employee',
      emergency_contact_name: 'Kalle Laine', emergency_contact_phone: '040 666 0004',
      tax_number: '7234567-D', archived_at: null,
    },
    {
      id: ids.employees.apprentice, organization_id: organizationId, created_by: ownerUserId,
      user_id: null, name: 'Onni Mäkinen', role: 'Harjoittelija', department: 'Tuotanto',
      email: `onni.makinen.${ownerUserId.slice(0, 8)}@demo.vakantti.invalid`,
      phone: '040 777 1005', start_date: addDays(today, -60), status: 'Aktiivinen',
      hourly_cost_cents: 1800, employment_type: 'Harjoittelu', employment_category: 'employee',
      emergency_contact_name: 'Helena Mäkinen', emergency_contact_phone: '040 777 0005',
      tax_number: '8234567-D', archived_at: null,
    },
  ]);

  const teamEmployeeIds = [
    ids.employees.worker,
    ids.employees.installerA,
    ids.employees.installerB,
    ids.employees.electrician,
    ids.employees.painter,
    ids.employees.apprentice,
  ];
  await upsertRows(admin, 'supervisor_team_members', teamEmployeeIds.map((employeeId) => ({
    organization_id: organizationId,
    supervisor_user_id: supervisor.userId,
    employee_id: employeeId,
    assigned_by: ownerUserId,
    is_active: true,
    assigned_at: new Date().toISOString(),
    removed_at: null,
  })), 'organization_id,supervisor_user_id,employee_id');

  await upsertRows(admin, 'projects', projects.map((project) => ({
    id: project.id,
    organization_id: organizationId,
    created_by: ownerUserId,
    customer_id: ids.customer,
    project_number: project.projectNumber,
    name: project.name,
    customer: 'Asunto Oy Demokatu 12',
    location: project.location,
    status: project.completed ? 'Valmis' : 'Suunniteltu',
    start_date: addDays(today, project.startOffset),
    end_date: addDays(today, project.endOffset),
    budget: project.budget,
    spent: project.spent,
    progress: project.completed ? 100 : project.progress,
    description: project.description,
    responsible_supervisor_id: supervisor.userId,
    project_manager_id: coordinator.userId,
    archived_at: null,
  })));

  await upsertRows(admin, 'project_members', projects.flatMap((project) => [
    { organization_id: organizationId, project_id: project.id, user_id: worker.userId, role: 'asentaja' },
    { organization_id: organizationId, project_id: project.id, user_id: coordinator.userId, role: 'projektikoordinaattori' },
    { organization_id: organizationId, project_id: project.id, user_id: supervisor.userId, role: 'työnjohtaja' },
  ]), 'project_id,user_id');

  await upsertRows(admin, 'customer_users', [{
    organization_id: organizationId,
    customer_id: ids.customer,
    user_id: customerUser.userId,
    access_scope: 'selected_projects',
    portal_profile: 'approver',
    portal_permissions: {},
    disabled_at: null,
  }], 'organization_id,customer_id,user_id');
  await upsertRows(admin, 'customer_user_projects', projects.map((project) => ({
    organization_id: organizationId,
    customer_id: ids.customer,
    user_id: customerUser.userId,
    project_id: project.id,
    created_by: ownerUserId,
  })), 'organization_id,customer_id,user_id,project_id');

  await upsertRows(admin, 'work_orders', workOrders.map((order) => ({
    id: order.id,
    organization_id: organizationId,
    created_by: supervisor.userId,
    project_id: order.projectId,
    title: order.title,
    project: order.projectName,
    assignee: order.assignee.displayName,
    due_date: addDays(today, order.endOffset),
    planned_start_date: addDays(today, order.startOffset),
    planned_end_date: addDays(today, order.endOffset),
    planned_start_time: '07:00',
    planned_end_time: '15:30',
    priority: order.priority,
    status: order.status,
    type: order.type,
    description: `${order.title}. Dokumentoi työ ja mahdolliset poikkeamat.`,
    assignment_scope: 'people',
    location: order.location,
    location_detail: order.location,
    occupancy_status: order.occupied ? 'occupied' : 'vacant',
    access_notes: order.occupied ? 'Sovi käynti etukäteen ja ilmoita saapumisesta.' : 'Avain huoltoyhtiön avainkaapista.',
    resident_notification_required: Boolean(order.occupied),
    completed_at: order.status === 'Valmis' ? `${addDays(today, order.endOffset)}T12:00:00.000Z` : null,
    completion_approved: order.status === 'Valmis',
  })));
  await upsertRows(admin, 'work_order_assignees', workOrders.map((order) => ({
    organization_id: organizationId,
    work_order_id: order.id,
    user_id: order.assignee.userId,
    assigned_by: supervisor.userId,
    responsibility: 'vastuuhenkilö',
  })), 'work_order_id,user_id');

  await upsertRows(admin, 'project_phases', projects.slice(0, Math.min(4, projects.length)).map((project, index) => ({
    id: ids.phases[index],
    organization_id: organizationId,
    project_id: project.id,
    created_by: coordinator.userId,
    name: scenario === 'handover' ? ['Itselleluovutus', 'Luovutus tilaajalle', 'Tulevan työn suunnittelu'][index] ?? 'Luovutus' : ['Purku', 'Asennukset', 'Viimeistely', 'Dokumentointi'][index],
    project_name: project.name,
    start_date: addDays(today, project.startOffset),
    end_date: addDays(today, project.endOffset),
    status: project.completed ? 'Valmis' : project.endOffset < 0 ? 'Myöhässä' : project.startOffset <= 0 ? 'Käynnissä' : 'Suunniteltu',
    progress: project.completed ? 100 : project.progress,
    sequence_no: index + 1,
    default_priority: project.endOffset < 0 ? 'Korkea' : 'Normaali',
    notes: `${scenario}-skenaarion työvaihe.`,
  })));

  await upsertRows(admin, 'time_entries', Array.from({ length: timeCount }, (_, index) => {
    const order = workOrders[index % workOrders.length];
    const approved = index % 3 !== 1;
    return {
      id: ids.timeEntries[index],
      organization_id: organizationId,
      created_by: worker.userId,
      user_id: worker.userId,
      employee_id: ids.employees.worker,
      project_id: order.projectId,
      work_order_id: order.id,
      date: addDays(today, -(index + 1)),
      employee: worker.displayName,
      project: order.projectName,
      hours: index % 2 ? 8 : 7.5,
      overtime: index === 1 ? 0.5 : 0,
      break_minutes: 30,
      description: `${scenario}-skenaarion työpäivä.`,
      status: approved ? 'Hyväksytty' : 'Odottaa',
      approved_by: approved ? supervisor.userId : null,
      approved_at: approved ? `${addDays(today, -index)}T12:00:00.000Z` : null,
      source: 'manual',
      break_source: 'manual',
      start_time: '07:00',
      end_time: index % 2 ? '15:30' : '15:00',
      billable: true,
      billing_status: approved ? 'approved' : 'recorded',
    };
  }));

  await upsertRows(admin, 'safety_items', Array.from({ length: safetyCount }, (_, index) => {
    const project = projects[index % projects.length];
    const titles = ['Porraskäytävän suojamuovi irronnut', 'Poistumistie vaatii siivouksen', 'Työalueen valaistus puutteellinen'];
    return {
      id: ids.safetyItems[index],
      organization_id: organizationId,
      created_by: worker.userId,
      project_id: project.id,
      project: project.name,
      type: 'observation',
      title: titles[index],
      description: `${scenario}-skenaarion turvallisuushavainto.`,
      date: today,
      severity: scenario === 'late' && index === 0 ? 'Korkea' : 'Keskitasoinen',
      status: 'Osoitettu',
      assignee: supervisor.displayName,
      assignee_user_id: supervisor.userId,
      due_date: addDays(today, scenario === 'late' ? 0 : 1),
      location: project.location,
      corrective_action: 'Korjaa puute, dokumentoi toimenpide ja kuittaa havainto.',
    };
  }));

  await upsertRows(admin, 'diary_entries', [{
    id: ids.diary,
    organization_id: organizationId,
    created_by: supervisor.userId,
    project_id: projects[0].id,
    project: projects[0].name,
    date: addDays(today, -1),
    weather: 'Puolipilvinen',
    temperature: 18,
    workers: scenario === 'busy' ? 8 : 6,
    work_phases: `${scenario}-skenaarion päivän työvaiheet.`,
    deliveries: 'Materiaalitoimitus saapui klo 09.30.',
    issues: scenario === 'late' ? 'Aikataulu ja materiaalisaatavuus vaativat välittömiä toimenpiteitä.' : 'Ei vakavia poikkeamia.',
    author: supervisor.displayName,
    status: 'Hyväksytty',
    approved_by: supervisor.userId,
    approved_at: `${addDays(today, -1)}T16:00:00.000Z`,
  }]);

  const seeded = {
    projects: projects.length,
    workOrders: workOrders.length,
    timeEntries: timeCount,
    safetyItems: safetyCount,
  };

  const refreshedAt = new Date().toISOString();
  const { error: environmentError } = await admin.from('demo_environments').update({
    source_organization_id: sourceOrganizationId,
    active_scenario: scenario,
    dataset_version: DATASET_VERSION,
    seeded_counts: seeded,
    refreshed_at: refreshedAt,
  }).eq('owner_user_id', ownerUserId);
  if (environmentError) throw new Error(`Demoympäristön metatietojen päivitys epäonnistui: ${environmentError.message}`);

  return seeded;
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
  const scenarioValue = stringValue(payload.scenario) || 'normal';
  if (!isUuid(sourceOrganizationId)) {
    return response({ error: 'Lähdeorganisaation tunniste puuttuu tai on virheellinen.' }, 400);
  }
  if (!isScenario(scenarioValue)) {
    return response({ error: 'Tuntematon demodataskenaario.' }, 400);
  }

  const userClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization } },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return response({ error: 'Istunto ei ole voimassa.' }, 401);
  const actor = userData.user;

  const { data: sourceMembership, error: membershipError } = await userClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', sourceOrganizationId)
    .eq('user_id', actor.id)
    .maybeSingle();
  if (membershipError) return response({ error: 'Ylläpitäjän käyttöoikeuden tarkistus epäonnistui.' }, 500);
  if (sourceMembership?.role !== 'admin') {
    return response({ error: 'Vain organisaation ylläpitäjä voi vaihtaa demodataskenaarion.' }, 403);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const { data: environment, error: environmentError } = await admin
      .from('demo_environments')
      .select('organization_id')
      .eq('owner_user_id', actor.id)
      .maybeSingle();
    if (environmentError || !environment?.organization_id) {
      throw new Error(environmentError?.message || 'Demoympäristöä ei ole vielä luotu.');
    }

    const organizationId = String(environment.organization_id);
    const accounts = await loadDemoAccounts(admin, organizationId);
    const seeded = await seedScenario(
      admin,
      actor.id,
      organizationId,
      sourceOrganizationId,
      scenarioValue,
      accounts,
    );
    const refreshedAt = new Date().toISOString();

    await admin.from('audit_logs').insert({
      organization_id: organizationId,
      user_id: actor.id,
      action: 'demo_scenario_applied',
      table_name: 'demo_environments',
      record_id: organizationId,
      metadata: { scenario: scenarioValue, dataset_version: DATASET_VERSION, seeded },
    });

    return response({
      ok: true,
      organizationId,
      scenario: scenarioValue,
      datasetVersion: DATASET_VERSION,
      refreshedAt,
      seeded,
    });
  } catch (caught) {
    console.error('Demo scenario provisioning failed', caught);
    return response({
      error: caught instanceof Error ? caught.message : 'Demodataskenaarion valmistelu epäonnistui.',
    }, 500);
  }
});
