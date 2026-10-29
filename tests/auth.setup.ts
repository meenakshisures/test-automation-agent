import { test as setup } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { credsFromEnv, loginWithMicrosoft, expectLoggedIn } from '../auth/microsoft-login';

export const AUTH_FILE = '.auth/user.json';
export const SESSION_FILE = '.auth/session.json';

/** Logs in once (incl. MFA) and saves browser state; every spec then starts already authenticated. */
setup('authenticate', async ({ page, baseURL }) => {
  setup.setTimeout(300_000);
  mkdirSync('.auth', { recursive: true });
  await loginWithMicrosoft(page, new URL('/login', baseURL).href, credsFromEnv());
  await expectLoggedIn(page);
  await page.context().storageState({ path: AUTH_FILE });
  // MSAL may keep tokens in sessionStorage, which storageState does not capture.
  const session = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(sessionStorage))));
  writeFileSync(SESSION_FILE, session);
});
