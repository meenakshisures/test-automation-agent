// Generated from IR: TC-001 (source: ir/TC-001.json). Not run against an app.
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ProductsPage } from '../pages/ProductsPage';

test('TC-001 Login succeeds with valid credentials', async ({ page }) => {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error('Set TEST_USERNAME and TEST_PASSWORD to run this login test.');
  }

  const loginPage = new LoginPage(page);
  const productsPage = new ProductsPage(page);

  await page.goto('/login');
  await loginPage.login(username, password);

  await expect(productsPage.heading).toBeVisible();
  await expect(productsPage.productList).toBeVisible();
});
