import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT) || 6176;
const CI = !!process.env.CI;

/**
 * Integration tests that drive the whole editor through the demo app in a real
 * browser. By default they run against the Vite dev server (resolves package
 * sources, so no build is needed). Set E2E_BUILD=1 to run against the production
 * build of the demo instead (`VITE_BASE=/ npm run build` first), which is what
 * the pipeline does so the shipped bundles are what gets tested.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: CI ? [['github'], ['html', { open: 'never', outputFolder: './playwright-report' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1600, height: 1000 },
    locale: 'en-GB',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The browsers are pre-installed in some environments; fall back to the bundled one.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } } }],
  webServer: {
    command: process.env.E2E_BUILD
      ? `npm run preview --workspace apps/demo -- --port ${PORT} --strictPort`
      : `npm run dev --workspace apps/demo`,
    cwd: '..',
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
