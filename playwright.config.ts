import { defineConfig, devices } from '@playwright/test';

// Node 20.12+/22 can load .env natively; no dotenv dependency needed.
try { process.loadEnvFile('.env'); } catch { /* no .env - rely on real environment variables */ }

/**
 * Layer 5 (deterministic execution). Artifacts are captured on failure/retry so
 * the failure-analyzer skill has real evidence (trace, screenshot, video) to
 * diagnose from - not guesses. Retries here absorb genuine flakiness; the
 * agent's self-heal loop is a separate, code-level fixing step.
 *
 * Auth: the `setup` project signs in once through Microsoft SSO (incl. MFA) and
 * saves state to .auth/; the `chromium` project reuses it so specs start logged in.
 * Specs that test the login flow itself opt out with `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './artifacts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['./scripts/md-reporter.mjs'], // -> reports/report.md
  ],

  use: {
    baseURL: process.env.BASE_URL,
    trace: 'retain-on-failure', // trace.zip for every failed attempt
    screenshot: 'on', // evidence for passing cases too, not just failures
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
