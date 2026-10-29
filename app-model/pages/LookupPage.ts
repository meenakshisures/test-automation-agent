import { type Page, type Locator, expect } from '@playwright/test';

/** Page Object for /lookup. */
export class LookupPage {
  readonly heading: Locator;
  readonly byOrder: Locator;
  readonly byPurchaseOrder: Locator;
  readonly byCustomer: Locator;
  readonly orderInput: Locator;
  readonly lookUp: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Look Up Criteria' });
    this.byOrder = page.getByRole('radio', { name: 'Look Up by Production Order #' });
    this.byPurchaseOrder = page.getByRole('radio', { name: 'Look Up by Purchase Order' });
    this.byCustomer = page.getByRole('radio', { name: 'Look Up by Customer Name' });
    this.orderInput = page.getByRole('textbox', { name: /Enter 7-digit production order number/ });
    this.lookUp = page.getByRole('button', { name: 'Look Up' });
  }

  async goto() {
    await this.page.goto('/lookup');
    await expect(this.heading).toBeVisible({ timeout: 45_000 }); // app shows an auth-bootstrap spinner first
  }
}
