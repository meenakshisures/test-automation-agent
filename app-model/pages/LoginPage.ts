import { type Page, type Locator, expect } from '@playwright/test';

/** Page Object for /login (grounded from the live accessibility tree). */
export class LoginPage {
  readonly heading: Locator;
  readonly signInWithMicrosoft: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Welcome Back' });
    this.signInWithMicrosoft = page.getByRole('button', { name: 'Sign in with Microsoft' });
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.signInWithMicrosoft).toBeVisible();
  }
}
