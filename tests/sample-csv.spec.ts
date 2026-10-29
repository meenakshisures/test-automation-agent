import { test, expect } from './fixtures';
import { AssemblyPage } from '../app-model/pages/AssemblyPage';
import { TestingPage } from '../app-model/pages/TestingPage';
import { DashboardPage } from '../app-model/pages/DashboardPage';
import { ProductionOrdersPage } from '../app-model/pages/ProductionOrdersPage';
import { LookupPage } from '../app-model/pages/LookupPage';
import { SettingsPage } from '../app-model/pages/SettingsPage';

/** Generated from IR (inputs/samples/sample-testcases.csv): TC-201 ... TC-207. */
test.describe('Sample CSV cases', () => {
  test('TC-201 Assembly page lists the expected columns', async ({ page }) => {
    const assembly = new AssemblyPage(page);
    await assembly.goto();

    await expect(assembly.heading).toBeVisible();
    for (const col of ['Production Order', 'Breaker Type', 'Current Rating', 'Control Voltage', 'Customer', 'Status']) {
      await expect(assembly.columnHeader(col)).toBeVisible();
    }
  });

  test('TC-202 Testing page lists the expected columns', async ({ page }) => {
    const testing = new TestingPage(page);
    await testing.goto();

    await expect(testing.heading).toBeVisible();
    for (const col of ['Production Order', 'Breaker Type', 'Control Voltage', 'Current Rating', 'Customer Name', 'Testing Status']) {
      await expect(testing.columnHeader(col)).toBeVisible();
    }
  });

  test('TC-203 Reports submenu expands in the sidebar', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expandReports.click();

    await expect(dashboard.navLink('Test Reports')).toBeVisible();
    await expect(dashboard.navLink('Labor Hours Summary Reports')).toBeVisible();
  });

  test('TC-204 Create New Order opens the package upload dialog', async ({ page }) => {
    const orders = new ProductionOrdersPage(page);
    await orders.goto();
    await orders.createNewOrder.click();

    await expect(orders.createDialog).toBeVisible();
    await expect(orders.dialogSubmit).toBeDisabled(); // nothing uploaded yet
  });

  test('TC-205 Create New Order dialog can be closed', async ({ page }) => {
    const orders = new ProductionOrdersPage(page);
    await orders.goto();
    await orders.createNewOrder.click();
    await expect(orders.createDialog).toBeVisible();
    await orders.dialogClose.click();

    await expect(orders.createDialog).toBeHidden();
  });

  test('TC-206 Lookup can switch to search by customer name', async ({ page }) => {
    const lookup = new LookupPage(page);
    await lookup.goto();
    await lookup.byCustomer.check();

    await expect(lookup.byCustomer).toBeChecked();
    await expect(lookup.byOrder).not.toBeChecked();
  });

  test('TC-207 Settings lists its configuration sections', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    for (const item of ['User Management', 'Roles and Permissions', 'Assembly Configuration', 'Testing Configuration']) {
      await expect(settings.menuItem(item)).toBeVisible();
    }
  });
});
