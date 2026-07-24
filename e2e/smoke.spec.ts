import { test, expect, type Page } from '@playwright/test';

/**
 * Critical smoke path for the VaKantti / RemonttiFlow app (Supabase auth era).
 *
 * App facts verified against src/ (App.tsx, Login.tsx, Header.tsx,
 * Navbar.tsx, contexts/AuthContext.tsx, config/brand.ts):
 * - HashRouter: URLs look like /#/dashboard. /login is the only public
 *   route; RequireAuth redirects everything else to /#/login without a
 *   session (loading state "Ladataan…" renders while the session resolves).
 * - Real Supabase auth over the network — no auto-login. Login submit
 *   therefore gets generous timeouts; global expect timeout is raised in
 *   playwright.config.ts.
 * - Login page: brand card ("VaKantti" / "Rakennusalan työnhallinta"),
 *   labels "Sähköposti" + "Salasana", submit "Kirjaudu sisään"
 *   ("Kirjaudutaan…" while submitting). Invalid credentials render
 *   role="alert" with "Virheellinen sähköposti tai salasana"
 *   (SIGN_IN_INVALID_CREDENTIALS_ERROR in AuthContext).
 * - Header (authenticated): org name "VaKantti Demo Oy", role badge
 *   "Järjestelmänvalvoja", user name "Demo Admin", logout button named
 *   "Kirjaudu ulos" (visible span at xl viewport + title attribute).
 * - The sidebar "Projektit" nav item shares its accessible name with the
 *   "Projektit" collapsible section header → disambiguated via the nav
 *   item's `span.truncate` label wrapper.
 * - NotFound (path "*") renders a Card with "404" and "Sivua ei löytynyt"
 *   (CardTitle is a <div>, not a heading element).
 */

const DEMO_EMAIL = 'demo@vakantti.fi';
const DEMO_PASSWORD = 'VakanttiDemo2026!';

/** Login against the real Supabase project and wait for the dashboard. */
async function loginAsDemo(page: Page) {
  await page.goto('/#/login');
  await page.getByLabel('Sähköposti').fill(DEMO_EMAIL);
  await page.getByLabel('Salasana').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Kirjaudu sisään' }).click();
  // Network round-trip to Supabase + profile/org fetch — generous timeout.
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 30_000 });
  await expect(
    page.getByRole('heading', { name: 'Yleisnäkymä' }),
  ).toBeVisible();
}

/** Click a main-nav item in the desktop sidebar by its visible label. */
async function clickSidebarItem(page: Page, label: string) {
  const sidebar = page.locator('aside').first();
  await sidebar
    .locator('button:has(span.truncate)', { hasText: label })
    .click();
}

test.describe('smoke: critical paths', () => {
  // Playwright already gives every test a fresh browser context, but the
  // Supabase session lives in localStorage — clear it defensively before
  // any app script runs so every test deterministically starts logged-out.
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('unauthenticated visit to / redirects to the login page', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/#\/login/);
    // Branding
    await expect(page.getByText('VaKantti', { exact: true })).toBeVisible();
    await expect(page.getByText('Rakennusalan työnhallinta')).toBeVisible();
    // Form fields + submit
    await expect(page.getByLabel('Sähköposti')).toBeVisible();
    await expect(page.getByLabel('Salasana')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Kirjaudu sisään' }),
    ).toBeVisible();
  });

  test('invalid credentials show a Finnish error alert and stay on /login', async ({
    page,
  }) => {
    await page.goto('/#/login');
    await page.getByLabel('Sähköposti').fill(DEMO_EMAIL);
    await page.getByLabel('Salasana').fill('wrong-password');
    await page.getByRole('button', { name: 'Kirjaudu sisään' }).click();

    // Supabase auth round-trip — generous timeout.
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toHaveText('Virheellinen sähköposti tai salasana');
    await expect(page).toHaveURL(/#\/login/);
  });

  test('valid login lands on the dashboard with user/org/role in the header', async ({
    page,
  }) => {
    await loginAsDemo(page);

    await expect(page).toHaveURL(/#\/dashboard/);
    const header = page.locator('header');
    await expect(header.getByText('Demo Admin')).toBeVisible();
    await expect(header.getByText('VaKantti Demo Oy')).toBeVisible();
    await expect(header.getByText('Järjestelmänvalvoja')).toBeVisible();

    // Dashboard content
    await expect(
      page.getByRole('heading', { name: 'Yleisnäkymä' }),
    ).toBeVisible();
    await expect(page.getByText('Aktiiviset projektit')).toBeVisible();
  });

  test('authenticated sidebar navigation opens the Projektit page', async ({
    page,
  }) => {
    await loginAsDemo(page);

    await clickSidebarItem(page, 'Projektit');

    await expect(page).toHaveURL(/#\/projektit/);
    await expect(
      page.getByRole('heading', { name: 'Projektit', exact: true }),
    ).toBeVisible();
  });

  test('authenticated sidebar navigation opens the worksite receipts page', async ({
    page,
  }) => {
    await loginAsDemo(page);

    await clickSidebarItem(page, 'Kuittaukset');

    await expect(page).toHaveURL(/#\/kuittaukset/);
    await expect(
      page.getByRole('heading', { name: 'Työmaakuittaukset', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Uusi kuittaus' })).toBeVisible();
  });

  test('unknown route while authenticated renders the 404 NotFound page', async ({
    page,
  }) => {
    await loginAsDemo(page);

    await page.goto('/#/jotain-olemastaonta');

    await expect(page.getByText('404', { exact: true })).toBeVisible();
    await expect(page.getByText('Sivua ei löytynyt')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Takaisin etusivulle' }),
    ).toBeVisible();
  });

  test('logout via "Kirjaudu ulos" redirects back to the login page', async ({
    page,
  }) => {
    await loginAsDemo(page);

    await page.getByRole('button', { name: 'Kirjaudu ulos' }).click();

    // signOut hits Supabase over the network, then RequireAuth redirects.
    await expect(page).toHaveURL(/#\/login/, { timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: 'Kirjaudu sisään' }),
    ).toBeVisible();
  });
});
