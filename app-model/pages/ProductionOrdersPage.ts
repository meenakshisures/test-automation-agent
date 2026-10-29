import { type Page, type Locator, expect } from '@playwright/test';

/** Page Object for /productionOrders. */
export class ProductionOrdersPage {
  readonly heading: Locator;
  readonly search: Locator;
  readonly createNewOrder: Locator;
  readonly table: Locator;
  readonly createDialog: Locator;
  readonly dialogClose: Locator;
  readonly dialogSubmit: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'All Production Orders' });
    this.search = page.getByRole('textbox', { name: 'Search orders' });
    this.createNewOrder = page.getByRole('button', { name: 'Create New Order' });
    this.table = page.getByRole('table');
    this.createDialog = page.getByRole('dialog', { name: 'Create New Production Order' });
    this.dialogClose = this.createDialog.getByRole('button', { name: 'Close' }).first();
    this.dialogSubmit = this.createDialog.getByRole('button', { name: 'Submit' });
  }

  async goto() {
    await this.page.goto('/productionOrders');
    await expect(this.heading).toBeVisible({ timeout: 45_000 }); // app shows an auth-bootstrap spinner first
  }

  columnHeader(name: string) {
    return this.table.getByRole('columnheader', { name });
  }
}
