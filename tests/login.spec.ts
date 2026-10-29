import { test, expect } from '@playwright/test';
import { LoginPage } from '../app-model/pages/LoginPage';

// Opt out of the saved session: this spec exercises the signed-out experience.
test.use({ storageState: { cookies: [], origins: [] } });

/** Generated from IR: PR-001. */
test('PR-001 Unauthenticated user sees Sign in with Microsoft on the login page', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();

  await expect(login.heading).toBeVisible();
  await expect(login.signInWithMicrosoft).toBeVisible();
  await expect(login.signInWithMicrosoft).toBeEnabled();
});
