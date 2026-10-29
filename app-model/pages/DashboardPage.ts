import { type Page, type Locator, expect } from '@playwright/test';

/** Page Object for /dashboard plus the shared sidebar navigation. */
export class DashboardPage {
  readonly heading: Locator;
  readonly analytics: Locator;
  readonly nav: Locator;
  readonly expandReports: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Dashboard', level: 1 });
    this.analytics = page.getByRole('heading', { name: 'Operational Analytics' });
    this.nav = page.getByRole('navigation');
    this.expandReports = page.getByRole('button', { name: 'Expand reports submenu' });
  }

  async goto() {
    await this.page.goto('/dashboard');
    await expect(this.heading).toBeVisible({ timeout: 45_000 }); // app shows an auth-bootstrap spinner first
  }

  navLink(name: string) {
    return this.nav.getByRole('link', { name, exact: true });
  }
}
