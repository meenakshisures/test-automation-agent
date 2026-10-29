import { test, expect } from './fixtures';
import { SettingsPage } from '../app-model/pages/SettingsPage';

/** Generated from IR: PR-002. */
test('PR-002 Settings shows the Users section with search and Add New User', async ({ page }) => {
  const settings = new SettingsPage(page);
  await settings.goto();

  await expect(settings.usersHeading).toBeVisible();
  await expect(settings.searchUsers).toBeVisible();
  await expect(settings.addNewUser).toBeVisible();
});
