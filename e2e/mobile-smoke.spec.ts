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

  test('header panels stay inside narrow mobile viewports', async ({ page }) => {
    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/#/login');

      for (const closeLabel of ['Sulje ilmoitukset', 'Sulje organisaatiovalikko']) {
        const bounds = await page.evaluate((label) => {
          const header = document.createElement('header');
          const closeButton = document.createElement('button');
          const panel = document.createElement('div');
          const panelHeader = document.createElement('div');
          const panelAction = document.createElement('button');

          closeButton.setAttribute('aria-label', label);
          panel.className =
            'absolute right-0 top-full z-50 mt-1 w-[min(390px,calc(100vw-16px))] overflow-y-auto';
          panel.style.height = '160px';
          panelHeader.className = 'flex items-start justify-between gap-3';
          panelHeader.appendChild(panelAction);
          panel.appendChild(panelHeader);
          header.append(closeButton, panel);
          document.body.appendChild(header);

          const rect = panel.getBoundingClientRect();
          const computedPanel = window.getComputedStyle(panel);
          const computedHeader = window.getComputedStyle(panelHeader);
          const result = {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            viewport: window.innerWidth,
            position: computedPanel.position,
            flexDirection: computedHeader.flexDirection,
          };

          header.remove();
          return result;
        }, closeLabel);

        expect(bounds.position).toBe('fixed');
        expect(bounds.left).toBeGreaterThanOrEqual(7);
        expect(bounds.right).toBeLessThanOrEqual(bounds.viewport - 7);
        expect(bounds.width).toBeLessThanOrEqual(bounds.viewport - 15);
        if (closeLabel === 'Sulje ilmoitukset') {
          expect(bounds.flexDirection).toBe('column');
        }
      }

      await expectNoHorizontalOverflow(page);
    }
  });
});
