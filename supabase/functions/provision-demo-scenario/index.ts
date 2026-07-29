import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.110.8';

const DATASET_VERSION = 3;
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

interface Payload {
  sourceOrganizationId?: unknown;
  scenario?: unknown;
}

interface DemoAccount {
  userId: string;
  role: DemoRole;
  displayName: string;
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
  return value === 'normal' || value === 'busy' || value === 'late' || value === 'empty' || value === 'handover';
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
      // Fall back to the standard Supabase secret.
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
  rows: Record<string, unknown>[],
  onConflict = 'id',
): Promise<void> {
  if (!rows.length) return;
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}-skenaarion tallennus epäonnistui: ${error.message}`);
}

async function deleteIds(admin: SupabaseClient, table: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await admin.from(table).delete().in('id', ids);
  if (error) throw new Error(`${table}-skenaarion siivous epäonnistui: ${error.message}`);
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
  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);
  if (profileError) throw new Error(`Demoprofiilien haku epäonnistui: ${profileError.message}`);
  const names = new Map((profiles ?? []).map((profile) => [String(profile.id), String(profile.full_name || '')]));

  return rows.map((row) => ({
    userId: String(row.user_id),
    role: row.role as DemoRole,
    displayName: names.get(String(row.user_id)) || `Demo ${String(row.role)}`,
  }));
}

async function scenarioIds(ownerUserId: string) {
  const id = (suffix: string) => deterministicUuid(`${ownerUserId}:demo:${suffix}`);
  return {
    customer: await id('customer'),
    activeProject: await id('project:active'),
    lateProject: await id('project:late'),
    plannedProject: await id('project:planned'),
    extraProjectA: await id('project:extra-a'),
    extraProjectB: await id('project:extra-b'),
    workerEmployee: await id('employee:worker'),
    supervisorEmployee: await id('employee:supervisor'),
    coordinatorEmployee: await id('employee:coordinator'),
    baseWorkOrders: [
      await id('work-order:kitchen'),
      await id('work-order:late'),
      await id('work-order:done'),
    ],
    extraWorkOrders: await Promise.all(Array.from({ length: 7 }, (_, index) => id(`work-order:extra-${index + 1}`))),
    baseTimeEntries: [await id('time:approved'), await id('time:pending')],
    extraTimeEntries: await Promise.all(Array.from({ length: 4 }, (_, index) => id(`time:extra-${index + 1}`))),
    baseSafety: await id('safety'),
    extraSafety: [await id('safety:extra-1'), await id('safety:extra-2')],
    baseDiary: await id('diary'),
    basePhases: [await id('phase:active'), await id('phase:late')],
  };
}

async function clearScenarioExtras(admin: SupabaseClient, ids: Awaited<ReturnType<typeof scenarioIds>>) {
  await deleteIds(admin, 'time_entries', ids.extraTimeEntries);
  await deleteIds(admin, 'safety_items', ids.extraSafety);
  await deleteIds(admin, 'work_orders', ids.extraWorkOrders);
  await deleteIds(admin, 'projects', [ids.extraProjectA, ids.extraProjectB]);
}

async function clearBaseline(admin: SupabaseClient, organizationId: string, ids: Awaited<ReturnType<typeof scenarioIds>>) {
  await deleteIds(admin, 'time_entries', [...ids.baseTimeEntries, ...ids.extraTimeEntries]);
  await deleteIds(admin, 'diary_entries', [ids.baseDiary]);
  await deleteIds(admin, 'safety_items', [ids.baseSafety, ...ids.extraSafety]);
  await deleteIds(admin, 'project_phases', ids.basePhases);
  await deleteIds(admin, 'work_orders', [...ids.baseWorkOrders, ...ids.extraWorkOrders]);
  await deleteIds(admin, 'projects', [ids.activeProject, ids.lateProject, ids.plannedProject, ids.extraProjectA, ids.extraProjectB]);
  await deleteIds(admin, 'employees', [ids.workerEmployee, ids.supervisorEmployee, ids.coordinatorEmployee]);
  const { error: accessError } = await admin.from('customer_users').delete().eq('organization_id', organizationId).eq('customer_id', ids.customer);
  if (accessError) throw new Error(`Tilaajademon siivous epäonnistui: ${accessError.message}`);
  await deleteIds(admin, 'customers', [ids.customer]);
}

async function applyScenario(
  admin: SupabaseClient,
  ownerUserId: string,
  organizationId: string,
  sourceOrganizationId: string,
  scenario: DemoScenario,
  accounts: DemoAccount[],
) {
  const today = todayInHelsinki();
  const ids = await scenarioIds(ownerUserId);
  const byRole = new Map(accounts.map((account) => [account.role, account]));
  const supervisor = byRole.get('supervisor');
  const coordinator = byRole.get('project_coordinator');
  const worker = byRole.get('worker');
  const customer = byRole.get('customer');
  if (!supervisor || !coordinator || !worker || !customer) throw new Error('Demoroolit ovat puutteelliset.');

  await clearScenarioExtras(admin, ids);

  if (scenario === 'empty') {
    await clearBaseline(admin, organizationId, ids);
    return { projects: 0, workOrders: 0, timeEntries: 0, safetyItems: 0 };
  }

  if (scenario === 'normal') {
    return { projects: 3, workOrders: 3, timeEntries: 2, safetyItems: 1 };
  }

  if (scenario === 'late') {
    await upsertRows(admin, 'projects', [
      { id: ids.activeProject, status: 'Suunniteltu', start_date: addDays(today, -45), end_date: addDays(today, -7), progress: 68, spent: 102000, description: 'Aikataulusta jäänyt keittiökorjaus, jossa useita avoimia tehtäviä.' },
      { id: ids.lateProject, status: 'Suunniteltu', start_date: addDays(today, -60), end_date: addDays(today, -14), progress: 82, spent: 27900 },
      { id: ids.plannedProject, status: 'Suunniteltu', start_date: addDays(today, -20), end_date: addDays(today, -2), progress: 35, spent: 13000, description: 'Myöhästynyt maalausprojekti poikkeamien tarkistamiseen.' },
    ]);
    await upsertRows(admin, 'work_orders', ids.baseWorkOrders.map((id, index) => ({
      id,
      due_date: addDays(today, -(index + 1)),
      planned_end_date: addDays(today, -(index + 1)),
      status: index === 2 ? 'Valmis' : index === 0 ? 'Käynnissä' : 'Odottaa',
      priority: index === 2 ? 'Normaali' : 'Korkea',
    })));
    const extraRows = ids.extraWorkOrders.slice(0, 3).map((id, index) => ({
      id,
      organization_id: organizationId,
      created_by: supervisor.userId,
      project_id: index === 2 ? ids.plannedProject : ids.activeProject,
      title: ['Korjaa puuttuva silikonisauma', 'Täydennä luovutuskuvat', 'Selvitä materiaaliviive'][index],
      project: index === 2 ? 'Demokatu 12 – yleisten tilojen maalaus' : 'Demokatu 12 – keittiökorjaukset',
      assignee: worker.displayName,
      due_date: addDays(today, -(index + 2)),
      planned_start_date: addDays(today, -(index + 5)),
      planned_end_date: addDays(today, -(index + 2)),
      planned_start_time: '07:00',
      planned_end_time: '15:30',
      priority: 'Korkea',
      status: index === 2 ? 'Odottaa' : 'Avoin',
      type: index === 2 ? 'Selvitys' : 'Viimeistely',
      description: 'Myöhässä olevan skenaarion kiireellinen tehtävä.',
      assignment_scope: 'people',
      location: `Demokatu 12 ${index + 5}`,
      occupancy_status: 'occupied',
      resident_notification_required: true,
    }));
    await upsertRows(admin, 'work_orders', extraRows);
    await upsertRows(admin, 'work_order_assignees', extraRows.map((row) => ({ organization_id: organizationId, work_order_id: row.id, user_id: worker.userId, assigned_by: supervisor.userId, responsibility: 'vastuuhenkilö' })), 'work_order_id,user_id');
    await upsertRows(admin, 'safety_items', [{
      id: ids.extraSafety[0], organization_id: organizationId, created_by: worker.userId,
      project_id: ids.activeProject, project: 'Demokatu 12 – keittiökorjaukset', type: 'observation',
      title: 'Poistumistie tukossa materiaalitoimituksen vuoksi', description: 'Kulkureitti on vapautettava välittömästi.',
      date: today, severity: 'Korkea', status: 'Osoitettu', assignee: supervisor.displayName,
      assignee_user_id: supervisor.userId, due_date: today, location: 'Demokatu 12 A, porrashuone', corrective_action: 'Siirrä materiaalit varastoon ja dokumentoi korjaus.',
    }]);
    return { projects: 3, workOrders: 6, timeEntries: 2, safetyItems: 2 };
  }

  if (scenario === 'handover') {
    await upsertRows(admin, 'projects', [
      { id: ids.activeProject, status: 'Suunniteltu', start_date: addDays(today, -50), end_date: addDays(today, 3), progress: 94, spent: 137500, description: 'Luovutusvaiheessa oleva keittiökorjaus.' },
      { id: ids.lateProject, status: 'Valmis', start_date: addDays(today, -45), end_date: addDays(today, -2), progress: 100, spent: 28100, description: 'Valmis vesivahingon jälkityö tilaajan tarkastukseen.' },
      { id: ids.plannedProject, status: 'Suunniteltu', start_date: addDays(today, 20), end_date: addDays(today, 45), progress: 0, spent: 0 },
    ]);
    await upsertRows(admin, 'work_orders', [
      { id: ids.baseWorkOrders[0], status: 'Odottaa', due_date: addDays(today, 1), planned_end_date: addDays(today, 1), title: 'Tee itselleluovutus asuntoon A 4', type: 'Itselleluovutus' },
      { id: ids.baseWorkOrders[1], status: 'Valmis', due_date: addDays(today, -2), planned_end_date: addDays(today, -2), completion_approved: true },
      { id: ids.baseWorkOrders[2], status: 'Valmis', completion_approved: true },
    ]);
    const handoverRows = ids.extraWorkOrders.slice(0, 2).map((id, index) => ({
      id,
      organization_id: organizationId,
      created_by: coordinator.userId,
      project_id: ids.activeProject,
      title: index === 0 ? 'Koosta luovutuskansio tilaajalle' : 'Korjaa tarkastuksessa löytynyt listapuutteet',
      project: 'Demokatu 12 – keittiökorjaukset',
      assignee: index === 0 ? coordinator.displayName : worker.displayName,
      due_date: addDays(today, index + 1),
      planned_start_date: today,
      planned_end_date: addDays(today, index + 1),
      planned_start_time: '08:00', planned_end_time: '15:30',
      priority: index === 0 ? 'Normaali' : 'Korkea', status: index === 0 ? 'Käynnissä' : 'Odottaa',
      type: index === 0 ? 'Dokumentointi' : 'Viimeistely',
      description: 'Luovutusvaiheen esimerkkitehtävä.', assignment_scope: 'people',
      location: 'Demokatu 12', occupancy_status: 'occupied', resident_notification_required: false,
    }));
    await upsertRows(admin, 'work_orders', handoverRows);
    await upsertRows(admin, 'work_order_assignees', handoverRows.map((row, index) => ({ organization_id: organizationId, work_order_id: row.id, user_id: index === 0 ? coordinator.userId : worker.userId, assigned_by: supervisor.userId, responsibility: 'vastuuhenkilö' })), 'work_order_id,user_id');
    return { projects: 3, workOrders: 5, timeEntries: 2, safetyItems: 1 };
  }

  const extraProjects = [
    {
      id: ids.extraProjectA, organization_id: organizationId, created_by: ownerUserId, customer_id: ids.customer,
      project_number: 'DEMO-004', name: 'Demokatu 14 – kylpyhuonekorjaukset', customer: 'Asunto Oy Demokatu 12',
      location: 'Demokatu 14, Helsinki', status: 'Suunniteltu', start_date: addDays(today, -8), end_date: addDays(today, 42),
      budget: 188000, spent: 21500, progress: 18, description: 'Kiireisen työmaan rinnakkainen kylpyhuoneprojekti.',
      responsible_supervisor_id: supervisor.userId, project_manager_id: coordinator.userId, archived_at: null,
    },
    {
      id: ids.extraProjectB, organization_id: organizationId, created_by: ownerUserId, customer_id: ids.customer,
      project_number: 'DEMO-005', name: 'Demokatu 16 – julkisivun paikkakorjaukset', customer: 'Asunto Oy Demokatu 12',
      location: 'Demokatu 16, Helsinki', status: 'Suunniteltu', start_date: addDays(today, -2), end_date: addDays(today, 20),
      budget: 73000, spent: 8200, progress: 12, description: 'Useita yhtäaikaisia resursseja kuormittava projekti.',
      responsible_supervisor_id: supervisor.userId, project_manager_id: coordinator.userId, archived_at: null,
    },
  ];
  await upsertRows(admin, 'projects', extraProjects);
  await upsertRows(admin, 'project_members', extraProjects.flatMap((project) => [worker, coordinator, supervisor].map((account) => ({ organization_id: organizationId, project_id: project.id, user_id: account.userId, role: account.role === 'worker' ? 'asentaja' : account.role === 'supervisor' ? 'työnjohtaja' : 'projektikoordinaattori' }))), 'project_id,user_id');
  await upsertRows(admin, 'customer_user_projects', extraProjects.map((project) => ({ organization_id: organizationId, customer_id: ids.customer, user_id: customer.userId, project_id: project.id, created_by: ownerUserId })), 'organization_id,customer_id,user_id,project_id');

  const busyWorkOrders = ids.extraWorkOrders.map((id, index) => {
    const project = index < 4 ? extraProjects[0] : extraProjects[1];
    return {
      id, organization_id: organizationId, created_by: supervisor.userId, project_id: project.id,
      title: ['Pura vanhat kalusteet', 'Tee vedeneristyksen tarkastus', 'Asenna laatoitus', 'Tilaa puuttuvat hanat', 'Suojaa julkisivun kulkureitti', 'Korjaa rappausvaurio', 'Dokumentoi päivän työvaiheet'][index],
      project: project.name, assignee: worker.displayName, due_date: addDays(today, index - 1),
      planned_start_date: addDays(today, index - 2), planned_end_date: addDays(today, index - 1),
      planned_start_time: '07:00', planned_end_time: '15:30', priority: index < 3 ? 'Korkea' : 'Normaali',
      status: index === 0 ? 'Käynnissä' : index === 3 ? 'Odottaa' : 'Avoin', type: 'Rakennustyö',
      description: 'Kiireisen skenaarion rinnakkainen työmääräys.', assignment_scope: 'people',
      location: project.location, occupancy_status: index % 2 ? 'occupied' : 'vacant', resident_notification_required: index % 2 === 1,
    };
  });
  await upsertRows(admin, 'work_orders', busyWorkOrders);
  await upsertRows(admin, 'work_order_assignees', busyWorkOrders.map((row) => ({ organization_id: organizationId, work_order_id: row.id, user_id: worker.userId, assigned_by: supervisor.userId, responsibility: 'vastuuhenkilö' })), 'work_order_id,user_id');

  const busyTimes = ids.extraTimeEntries.map((id, index) => ({
    id, organization_id: organizationId, created_by: worker.userId, user_id: worker.userId,
    employee_id: ids.workerEmployee, project_id: index < 2 ? ids.extraProjectA : ids.extraProjectB,
    work_order_id: ids.extraWorkOrders[index], date: addDays(today, -(index + 1)), employee: worker.displayName,
    project: index < 2 ? extraProjects[0].name : extraProjects[1].name, hours: 7.5 + (index % 2) * 0.5,
    overtime: index === 1 ? 1 : 0, break_minutes: 30, description: 'Kiireisen skenaarion työpäivä.',
    status: index < 2 ? 'Odottaa' : 'Hyväksytty', source: 'manual', break_source: 'manual',
    start_time: '07:00', end_time: index === 1 ? '16:00' : '15:00', billable: true,
    billing_status: index < 2 ? 'recorded' : 'approved', approved_by: index < 2 ? null : supervisor.userId,
    approved_at: index < 2 ? null : `${addDays(today, -index)}T12:00:00.000Z`,
  }));
  await upsertRows(admin, 'time_entries', busyTimes);
  await upsertRows(admin, 'safety_items', ids.extraSafety.map((id, index) => ({
    id, organization_id: organizationId, created_by: worker.userId, project_id: index === 0 ? ids.extraProjectA : ids.extraProjectB,
    project: index === 0 ? extraProjects[0].name : extraProjects[1].name, type: 'observation',
    title: index === 0 ? 'Työalueen valaistus puutteellinen' : 'Telineen kulkutie vaatii siivouksen',
    description: 'Kiireisen työmaan turvallisuushavainto.', date: today, severity: 'Keskitasoinen', status: 'Osoitettu',
    assignee: supervisor.displayName, assignee_user_id: supervisor.userId, due_date: addDays(today, 1),
    location: index === 0 ? 'Demokatu 14' : 'Demokatu 16', corrective_action: 'Korjaa puute ja kuittaa toimenpide.',
  })));
  return { projects: 5, workOrders: 10, timeEntries: 6, safetyItems: 3 };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return response({ error: 'Vain POST-pyyntö on sallittu.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'Kirjautuminen vaaditaan.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = namedSecret('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const serviceKey = namedSecret('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishableKey || !serviceKey) return response({ error: 'Palvelimen Supabase-konfiguraatio puuttuu.' }, 503);

  let payload: Payload;
  try {
    payload = await request.json() as Payload;
  } catch {
    return response({ error: 'Pyynnön JSON ei ole kelvollinen.' }, 400);
  }

  const sourceOrganizationId = stringValue(payload.sourceOrganizationId);
  const scenarioValue = stringValue(payload.scenario) || 'normal';
  if (!isUuid(sourceOrganizationId)) return response({ error: 'Lähdeorganisaation tunniste puuttuu tai on virheellinen.' }, 400);
  if (!isScenario(scenarioValue)) return response({ error: 'Tuntematon demodataskenaario.' }, 400);

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
  if (sourceMembership?.role !== 'admin') return response({ error: 'Vain organisaation ylläpitäjä voi vaihtaa demodataskenaarion.' }, 403);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  try {
    const { data: environment, error: environmentError } = await admin
      .from('demo_environments')
      .select('organization_id')
      .eq('owner_user_id', actor.id)
      .maybeSingle();
    if (environmentError || !environment?.organization_id) throw new Error(environmentError?.message || 'Demoympäristöä ei ole vielä luotu.');
    const organizationId = String(environment.organization_id);
    const accounts = await loadDemoAccounts(admin, organizationId);
    const seeded = await applyScenario(admin, actor.id, organizationId, sourceOrganizationId, scenarioValue, accounts);
    const refreshedAt = new Date().toISOString();

    const { error: updateError } = await admin.from('demo_environments').update({
      source_organization_id: sourceOrganizationId,
      active_scenario: scenarioValue,
      dataset_version: DATASET_VERSION,
      seeded_counts: seeded,
      refreshed_at: refreshedAt,
    }).eq('owner_user_id', actor.id);
    if (updateError) throw new Error(`Demoympäristön metatietojen päivitys epäonnistui: ${updateError.message}`);

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
    return response({ error: caught instanceof Error ? caught.message : 'Demodataskenaarion valmistelu epäonnistui.' }, 500);
  }
});
