import { test, expect } from '@playwright/test';

/**
 * Post-deployment checks that never mutate production data and do not require
 * user credentials. The deployment workflow supplies PLAYWRIGHT_BASE_URL and
 * EXPECTED_COMMIT_SHA.
 */
const IS_DEPLOYMENT_CHECK = Boolean(
  process.env.PLAYWRIGHT_BASE_URL && process.env.EXPECTED_COMMIT_SHA,
);

test.describe('production deployment', () => {
  test.skip(
    !IS_DEPLOYMENT_CHECK,
    'Production smoke tests only run after a real deployment.',
  );

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('serves the exact deployed commit metadata', async ({ request }) => {
    const response = await request.get('/version.json', {
      headers: { 'cache-control': 'no-cache' },
    });

    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');

    const metadata = (await response.json()) as {
      commit?: string;
      repository?: string;
    };
    const expectedCommit = process.env.EXPECTED_COMMIT_SHA;

    expect(metadata.repository).toBe('jethronevalainen-lgtm/remonttiflow');
    expect(metadata.commit).toBe(expectedCommit);
  });

  test('renders the login shell without browser errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/#/login', { waitUntil: 'networkidle' });

    await expect(page).toHaveTitle(/VaKantti/);
    await expect(page.getByText('VaKantti', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Sähköposti')).toBeVisible();
    await expect(page.getByLabel('Salasana')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Kirjaudu sisään' }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
