import { type Locator, type Page } from '@playwright/test';

// UNVERIFIED: locators inferred from the test case wording; no real page was inspected.
export class ProductsPage {
  readonly heading: Locator;
  readonly productList: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Products' });
    this.productList = page.getByRole('list');
  }
}
