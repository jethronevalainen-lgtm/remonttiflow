import { test, expect, type Page } from '@playwright/test';

import { ROLE_ROUTES, type UserRole } from '../src/auth/permissions';

/**
 * Critical browser paths for the VaKantti application.
 *
 * GitHub Actions authenticates the fixture provisioning request with OIDC. The
 * provisioner creates or updates an isolated administrator and deterministic
 * test identities for every other role before the browser signs in.
 */
const E2E_EMAIL = process.env.E2E_USER_EMAIL?.trim() ?? '';
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? '';
const E2E_PROVISION_TOKEN = process.env.E2E_PROVISION_TOKEN?.trim() ?? '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim() ?? '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
const HAS_E2E_CREDENTIALS = Boolean(
  E2E_EMAIL
  && E2E_PASSWORD
  && E2E_PROVISION_TOKEN
  && SUPABASE_URL
  && SUPABASE_KEY,
);

const ROLE_EMAILS: Record<Exclude<UserRole, 'admin'>, string> = {
  supervisor: 'supervisor@roles.vakantti.invalid',
  project_coordinator: 'project-coordinator@roles.vakantti.invalid',
  worker: 'worker@roles.vakantti.invalid',
  customer: 'customer@roles.vakantti.invalid',
};

interface E2EFixtures {
  organizationId: string;
  projectId: string;
  workOrderId: string;
}

interface ProvisionResponse {
  ok?: boolean;
  error?: string;
  adminEmail?: string;
  organizationId?: string;
  projectId?: string;
  workOrderId?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function provisionRoleFixtures(): Promise<E2EFixtures> {
  const provisionResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/provision-e2e-role-users`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${E2E_PROVISION_TOKEN}`,
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: E2E_PASSWORD }),
    },
  );

  let data: ProvisionResponse;
  try {
    data = await provisionResponse.json() as ProvisionResponse;
  } catch {
    throw new Error(`E2E-roolien valmistelu palautti virheellisen vastauksen (HTTP ${provisionResponse.status}).`);
  }

  if (!provisionResponse.ok) {
    throw new Error(
      `E2E-roolien valmistelu epäonnistui (HTTP ${provisionResponse.status}): ${data.error ?? 'tuntematon virhe'}`,
    );
  }
  if (
    data.ok !== true
    || data.adminEmail !== E2E_EMAIL
    || !data.organizationId
    || !data.projectId
    || !data.workOrderId
  ) {
    throw new Error('E2E-roolien valmistelu palautti puutteellisen fixture-vastauksen.');
  }

  return {
    organizationId: String(data.organizationId),
    projectId: String(data.projectId),
    workOrderId: String(data.workOrderId),
  };
}

async function clearBrowserState(page: Page): Promise<void> {
  await page.context().addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

/** Login against Supabase with the isolated administrator prepared for this run. */
async function loginAsAdministrator(page: Page): Promise<void> {
  if (!HAS_E2E_CREDENTIALS) throw new Error('E2E credentials are not configured.');

  await page.goto('/#/login');
  await page.getByLabel('Sähköposti').fill(E2E_EMAIL);
  await page.getByLabel('Salasana').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Kirjaudu sisään' }).click();
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Yleisnäkymä' })).toBeVisible();

  await page.goto('/#/kayttajaesikatselu');
  await expect(page.getByRole('heading', { name: 'Toimi käyttäjänä' })).toBeVisible({ timeout: 30_000 });
}

async function expectApplicationSection(page: Page, route: string): Promise<void> {
  await page.goto(`/#${route}`);
  await expect(page).toHaveURL(new RegExp(`#${escapeRegExp(route)}(?:[/?]|$)`), { timeout: 30_000 });
  await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Ladataan osiota…', { exact: true })).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText('Jokin meni pieleen', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Sivua ei löytynyt', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Työtilaa ei voitu avata', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kirjaudu sisään' })).toHaveCount(0);
}

async function startImpersonation(page: Page, role: Exclude<UserRole, 'admin'>): Promise<void> {
  await page.goto('/#/kayttajaesikatselu');
  await expect(page.getByRole('heading', { name: 'Toimi käyttäjänä' })).toBeVisible({ timeout: 30_000 });

  const email = ROLE_EMAILS[role];
  const search = page.getByPlaceholder('Hae käyttäjää tai roolia');
  await search.fill(email);

  const row = page.locator('div.grid').filter({ hasText: email }).filter({
    has: page.getByRole('button', { name: 'Toimi käyttäjänä' }),
  }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole('button', { name: 'Toimi käyttäjänä' }).click();

  const expectedHome = role === 'customer' ? '/tilaajan-tyot' : '/dashboard';
  await expect(page).toHaveURL(new RegExp(`#${escapeRegExp(expectedHome)}(?:[/?]|$)`), { timeout: 30_000 });
  await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
}

async function stopImpersonation(page: Page): Promise<void> {
  await page.goto('/#/kayttajaesikatselu');
  const returnButton = page.getByRole('button', { name: 'Palaa admin-istuntoon' });
  await expect(returnButton).toBeVisible({ timeout: 30_000 });
  await returnButton.click();
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 30_000 });
}

async function expectRoleStaticRoutes(page: Page, role: UserRole): Promise<void> {
  const routes = ROLE_ROUTES[role].filter((route) => route !== '/tilaajan-projektit');
  for (const route of routes) {
    await test.step(`${role}: ${route}`, async () => {
      await expectApplicationSection(page, route);
    });
  }
}

test.describe('smoke: public authentication shell', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserState(page);
  });

  test('unauthenticated visit to / redirects to the login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByText('VaKantti', { exact: true })).toBeVisible();
    await expect(page.getByText('Rakennusalan työnhallinta')).toBeVisible();
    await expect(page.getByLabel('Sähköposti')).toBeVisible();
    await expect(page.getByLabel('Salasana')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kirjaudu sisään' })).toBeVisible();
  });

  test('invalid credentials show a Finnish error alert and stay on /login', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByLabel('Sähköposti').fill('not-a-user@vakantti.invalid');
    await page.getByLabel('Salasana').fill('invalid-password');
    await page.getByRole('button', { name: 'Kirjaudu sisään' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toHaveText('Virheellinen sähköposti tai salasana');
    await expect(page).toHaveURL(/#\/login/);
  });
});

test.describe('smoke: authenticated role and dynamic route matrix', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(
    !HAS_E2E_CREDENTIALS,
    'Authenticated smoke tests require the E2E password, GitHub OIDC token and Supabase public configuration.',
  );

  let fixtures: E2EFixtures;

  test.beforeAll(async () => {
    fixtures = await provisionRoleFixtures();
  });

  test.beforeEach(async ({ page }) => {
    await clearBrowserState(page);
  });

  test('admin, supervisor, coordinator, worker and customer routes match the permission contract', async ({ page }) => {
    test.setTimeout(720_000);
    await loginAsAdministrator(page);

    await expectRoleStaticRoutes(page, 'admin');
    for (const route of [
      `/projektit/${fixtures.projectId}`,
      `/projektit/${fixtures.projectId}/tyotila`,
      `/projektit/${fixtures.projectId}/tilaajayhteistyo`,
      `/projektikeskustelut/${fixtures.projectId}`,
    ]) {
      await expectApplicationSection(page, route);
    }

    await startImpersonation(page, 'supervisor');
    await expectRoleStaticRoutes(page, 'supervisor');
    await expectApplicationSection(page, `/projektit/${fixtures.projectId}`);
    await expectApplicationSection(page, `/projektit/${fixtures.projectId}/tyotila`);
    await stopImpersonation(page);

    await startImpersonation(page, 'project_coordinator');
    await expectRoleStaticRoutes(page, 'project_coordinator');
    await expectApplicationSection(page, `/projektit/${fixtures.projectId}`);
    await expectApplicationSection(page, `/projektit/${fixtures.projectId}/tyotila`);
    for (const forbidden of [
      '/henkilosto',
      '/henkilokortit',
      '/palkka-aineisto',
      '/matkakulut',
      '/kirjaukset',
      '/tyovuorokalenteri',
      '/raportit',
    ]) {
      await page.goto(`/#${forbidden}`);
      await expect(page).toHaveURL(/#\/dashboard(?:[/?]|$)/, { timeout: 30_000 });
    }
    await stopImpersonation(page);

    await startImpersonation(page, 'worker');
    await expectRoleStaticRoutes(page, 'worker');
    await expectApplicationSection(page, `/projektikeskustelut/${fixtures.projectId}`);
    await expectApplicationSection(page, '/tyomaaraykset');
    await expect(page.getByText('Automaatiotestin työmääräys', { exact: true })).toBeVisible({ timeout: 30_000 });
    await stopImpersonation(page);

    await startImpersonation(page, 'customer');
    await expectRoleStaticRoutes(page, 'customer');
    await expectApplicationSection(page, `/tilaajan-projektit/${fixtures.projectId}`);
    await expectApplicationSection(page, `/projektikeskustelut/${fixtures.projectId}`);
    await page.goto('/#/dashboard');
    await expect(page).toHaveURL(/#\/tilaajan-tyot(?:[/?]|$)/, { timeout: 30_000 });
    await stopImpersonation(page);
  });

  test('unknown route renders 404 and logout returns to login', async ({ page }) => {
    await loginAsAdministrator(page);
    await page.goto('/#/jotain-olematonta');
    await expect(page.getByText('404', { exact: true })).toBeVisible();
    await expect(page.getByText('Sivua ei löytynyt')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Takaisin etusivulle' })).toBeVisible();

    await page.getByRole('button', { name: 'Kirjaudu ulos' }).click();
    await expect(page).toHaveURL(/#\/login/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Kirjaudu sisään' })).toBeVisible();
  });
});
