import { test, expect } from './fixtures';
import { DashboardPage } from '../app-model/pages/DashboardPage';
import { ProductionOrdersPage } from '../app-model/pages/ProductionOrdersPage';

/** Generated from IR: TC-001, TC-002, TC-003. */
test.describe('Dashboard & navigation', () => {
  test('TC-001 Signed-in user lands on the dashboard', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    // expected: Dashboard heading and Operational Analytics section visible
    await expect(dashboard.heading).toBeVisible();
    await expect(dashboard.analytics).toBeVisible();
  });

  test('TC-002 Sidebar navigates to Production Orders', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const orders = new ProductionOrdersPage(page);
    await dashboard.goto();
    await dashboard.navLink('Production Orders').click();

    // expected: URL /productionOrders, heading and table visible
    await expect(page).toHaveURL(/\/productionOrders/);
    await expect(orders.heading).toBeVisible();
    await expect(orders.table).toBeVisible();
  });

  test('TC-003 Production Orders table shows the expected columns', async ({ page }) => {
    const orders = new ProductionOrdersPage(page);
    await orders.goto();

    // expected: one assertion per listed column
    for (const col of ['Production Order', 'Breaker Type', 'Control Voltage', 'Current Rating', 'Customer', 'Created By', 'Status']) {
      await expect(orders.columnHeader(col)).toBeVisible();
    }
  });
});
