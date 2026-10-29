import { type Page, type Locator, expect } from '@playwright/test';

/** Page Object for /assembly. */
export class AssemblyPage {
  readonly heading: Locator;
  readonly table: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'All Breakers in Assembly' });
    this.table = page.getByRole('table');
  }

  async goto() {
    await this.page.goto('/assembly');
    await expect(this.heading).toBeVisible({ timeout: 45_000 }); // app shows an auth-bootstrap spinner first
  }

  columnHeader(name: string) {
    return this.table.getByRole('columnheader', { name });
  }
}
