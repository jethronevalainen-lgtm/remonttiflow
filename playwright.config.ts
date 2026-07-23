import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for RemonttiFlow / VaKantti.
 *
 * The app is a Vite SPA using React Router v6 HashRouter, so all in-app
 * URLs look like http://localhost:5173/#/dashboard.
 *
 * NOTE (Windows): Git Bash on this machine does not put `npm` on PATH, and
 * Playwright's webServer spawns the command via the system shell. `npm.cmd`
 * works both locally on Windows and on Windows CI runners; on POSIX shells
 * plain `npm` is correct.
 */
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `${npmCommand} run dev`,
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
