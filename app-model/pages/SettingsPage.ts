import { type Page, type Locator, expect } from '@playwright/test';

/** Page Object for /settings (opens on the Users section). */
export class SettingsPage {
  readonly usersHeading: Locator;
  readonly searchUsers: Locator;
  readonly addNewUser: Locator;

  constructor(readonly page: Page) {
    this.usersHeading = page.getByRole('heading', { name: 'Users' });
    this.searchUsers = page.getByRole('textbox', { name: 'Search users' });
    this.addNewUser = page.getByRole('button', { name: 'Add New User' });
  }

  async goto() {
    await this.page.goto('/settings');
    await expect(this.usersHeading).toBeVisible({ timeout: 45_000 }); // app shows an auth-bootstrap spinner first
  }

  /** A section in the Settings menu (rendered as a button). */
  menuItem(name: string) {
    return this.page.getByRole('button', { name, exact: true });
  }
}
