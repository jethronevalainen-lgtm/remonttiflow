import { defineConfig, devices } from '@playwright/test';

/**
 * Local and CI browser-test configuration.
 *
 * By default Playwright starts the local Vite development server. Production
 * verification sets PLAYWRIGHT_BASE_URL, in which case Playwright targets the
 * deployed application and does not start a local server.
 */
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const localBaseUrl = 'http://localhost:5173';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: externalBaseUrl || localBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  expect: { timeout: 15_000 },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `${npmCommand} run dev`,
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
