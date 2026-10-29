import { test, expect } from './fixtures';
import { ProductionOrdersPage } from '../app-model/pages/ProductionOrdersPage';

/** Generated from IR: PR-004. */
test('PR-004 Verify that the Production Orders page has a Create New Order button', async ({ page }) => {
  const productionOrders = new ProductionOrdersPage(page);
  await productionOrders.goto();

  await expect(productionOrders.createNewOrder).toBeVisible();
});
