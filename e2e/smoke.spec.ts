import { test, expect, type Page } from '@playwright/test';

/**
 * Critical smoke paths for the VaKantti application.
 *
 * Unauthenticated checks always run. Authenticated checks only run when the
 * CI environment provides E2E_USER_EMAIL and E2E_USER_PASSWORD. Credentials
 * must never be committed to the repository or written to workflow logs.
 */
const E2E_EMAIL = process.env.E2E_USER_EMAIL?.trim() ?? '';
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? '';
const HAS_E2E_CREDENTIALS = Boolean(E2E_EMAIL && E2E_PASSWORD);

/** Login against Supabase and wait for the dashboard. */
async function login(page: Page) {
  if (!HAS_E2E_CREDENTIALS) {
    throw new Error('E2E credentials are not configured.');
  }

  await page.goto('/#/login');
  await page.getByLabel('Sähköposti').fill(E2E_EMAIL);
  await page.getByLabel('Salasana').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Kirjaudu sisään' }).click();
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Yleisnäkymä' })).toBeVisible();
}

/** Click a main-nav item in the desktop sidebar by its visible label. */
async function clickSidebarItem(page: Page, label: string) {
  const sidebar = page.locator('aside').first();
  await sidebar
    .locator('button:has(span.truncate)', { hasText: label })
    .click();
}

test.describe('smoke: public authentication shell', () => {
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
    await expect(page.getByText('VaKantti', { exact: true })).toBeVisible();
    await expect(page.getByText('Rakennusalan työnhallinta')).toBeVisible();
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
    await page.getByLabel('Sähköposti').fill('not-a-user@vakantti.invalid');
    await page.getByLabel('Salasana').fill('invalid-password');
    await page.getByRole('button', { name: 'Kirjaudu sisään' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toHaveText('Virheellinen sähköposti tai salasana');
    await expect(page).toHaveURL(/#\/login/);
  });
});

test.describe('smoke: authenticated critical paths', () => {
  test.skip(
    !HAS_E2E_CREDENTIALS,
    'Authenticated smoke tests require E2E_USER_EMAIL and E2E_USER_PASSWORD secrets.',
  );

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('valid login lands on the dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/#\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Yleisnäkymä' })).toBeVisible();
    await expect(page.getByText('Aktiiviset projektit')).toBeVisible();
  });

  test('authenticated sidebar navigation opens the Projektit page', async ({
    page,
  }) => {
    await login(page);
    await clickSidebarItem(page, 'Projektit');

    await expect(page).toHaveURL(/#\/projektit/);
    await expect(
      page.getByRole('heading', { name: 'Projektit', exact: true }),
    ).toBeVisible();
  });

  test('authenticated sidebar navigation opens worksite receipts', async ({
    page,
  }) => {
    await login(page);
    await clickSidebarItem(page, 'Kuittaukset');

    await expect(page).toHaveURL(/#\/kuittaukset/);
    await expect(
      page.getByRole('heading', { name: 'Työmaakuittaukset', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Uusi kuittaus' }),
    ).toBeVisible();
  });

  test('unknown route while authenticated renders the 404 page', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/#/jotain-olematonta');

    await expect(page.getByText('404', { exact: true })).toBeVisible();
    await expect(page.getByText('Sivua ei löytynyt')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Takaisin etusivulle' }),
    ).toBeVisible();
  });

  test('logout redirects back to the login page', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Kirjaudu ulos' }).click();

    await expect(page).toHaveURL(/#\/login/, { timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: 'Kirjaudu sisään' }),
    ).toBeVisible();
  });
});
