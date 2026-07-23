import { test, expect, type Page } from '@playwright/test';

/**
 * Critical smoke path for the VaKantti / RemonttiFlow app.
 *
 * App facts verified against src/ (App.tsx, Navbar.tsx, Header.tsx,
 * AuthContext.tsx, pages/*):
 * - HashRouter: URLs look like /#/dashboard; "/" redirects to /dashboard.
 * - Auto-login as supervisor ("Työnjohtaja"); role switcher lives in the
 *   Header behind a button labelled with the current role name and opens a
 *   menu titled "Vaihda roolia".
 * - RoleGuard renders "Pääsy kielletty" (h2) for disallowed roles.
 * - NotFound (path "*") renders a Card with "404" and "Sivua ei löytynyt"
 *   (CardTitle is a <div>, not a heading element).
 * - The sidebar "Projektit" nav item shares its accessible name with the
 *   "Projektit" collapsible section header, so we disambiguate via the
 *   nav item's `span.truncate` label wrapper.
 */

/** Click a main-nav item in the desktop sidebar by its visible label. */
async function clickSidebarItem(page: Page, label: string) {
  const sidebar = page.locator('aside').first();
  await sidebar
    .locator('button:has(span.truncate)', { hasText: label })
    .click();
}

test.describe('smoke: critical paths', () => {
  test('app loads at / and redirects to the dashboard', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(
      page.getByRole('heading', { name: 'Yleisnäkymä' }),
    ).toBeVisible();

    // KPI cards
    await expect(page.getByText('Aktiiviset projektit')).toBeVisible();
    await expect(page.getByText('Avoimet työmääräykset')).toBeVisible();
  });

  test('sidebar navigation opens the Projektit page', async ({ page }) => {
    await page.goto('/');

    await clickSidebarItem(page, 'Projektit');

    await expect(page).toHaveURL(/#\/projektit$/);
    await expect(
      page.getByRole('heading', { name: 'Projektit', exact: true }),
    ).toBeVisible();
    // Project content renders (mock data row + header text)
    await expect(
      page.getByText('Kaikki projektit yhdessä näkymässä'),
    ).toBeVisible();
    await expect(page.getByText('Tampereen korjaustyö')).toBeVisible();
  });

  test('role switcher switches to Työntekijä and guards /raportit', async ({
    page,
  }) => {
    await page.goto('/');

    const header = page.locator('header');

    // Auto-logged-in role is supervisor ("Työnjohtaja").
    await header.getByRole('button', { name: 'Työnjohtaja' }).click();
    await expect(page.getByText('Vaihda roolia')).toBeVisible();

    await page.getByRole('button', { name: 'Työntekijä' }).click();

    // Wait for the role menu to finish its exit animation, otherwise the
    // still-mounted menu item collides with the trigger button's new label.
    await expect(page.getByText('Vaihda roolia')).toBeHidden();

    // Role UI updates in header and sidebar footer.
    await expect(
      header.getByRole('button', { name: 'Työntekijä' }),
    ).toBeVisible();
    await expect(
      page.locator('aside').getByText('Työntekijä'),
    ).toBeVisible();

    // A role-restricted route now shows the access-denied state.
    await page.goto('/#/raportit');
    await expect(
      page.getByRole('heading', { name: 'Pääsy kielletty' }),
    ).toBeVisible();
    await expect(
      page.getByText('Sinulla ei ole oikeuksia tälle sivulle.'),
    ).toBeVisible();
  });

  test('unknown route renders the 404 NotFound page', async ({ page }) => {
    await page.goto('/#/jotain-olemastaonta');

    await expect(page.getByText('404', { exact: true })).toBeVisible();
    await expect(page.getByText('Sivua ei löytynyt')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Takaisin etusivulle' }),
    ).toBeVisible();
  });
});
