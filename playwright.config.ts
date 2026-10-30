import { defineConfig, devices } from '@playwright/test';

// Node 20.12+/22 can load .env natively; no dotenv dependency needed.
try { process.loadEnvFile('.env'); } catch { /* no .env - rely on real environment variables */ }

/**
 * The agent generates specs from CSV test cases and validates them statically (see scripts/validate.mjs);
 * it does not need a live app. If you later want to execute the specs, set BASE_URL in .env and run
 * `npm test` - the specs use relative URLs, so they run against whatever BASE_URL points at.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './artifacts',
  fullyParallel: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },

  reporter: [['list'], ['html', { outputFolder: 'reports/html', open: 'never' }]],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
