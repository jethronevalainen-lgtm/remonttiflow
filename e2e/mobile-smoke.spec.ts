import { expect, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test.describe('VaKantti mobile smoke', () => {
  test('login view fits a phone viewport and remains usable', async ({ page }) => {
    await page.goto('/#/login');

    await expect(page.getByText('VaKantti', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Sähköposti')).toBeVisible();
    await expect(page.getByLabel('Salasana')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kirjaudu sisään' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByLabel('Sähköposti').fill('virheellinen');
    await page.getByLabel('Salasana').fill('testi');
    await page.getByRole('button', { name: 'Kirjaudu sisään' }).click();

    await expect(page.getByText('Syötä kelvollinen sähköpostiosoite')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('protected routes redirect cleanly on mobile', async ({ page }) => {
    await page.goto('/#/dashboard');
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole('button', { name: 'Kirjaudu sisään' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
