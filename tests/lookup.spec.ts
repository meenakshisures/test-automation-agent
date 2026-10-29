import { test, expect } from './fixtures';
import { LookupPage } from '../app-model/pages/LookupPage';

/** Generated from IR: TC-004, PR-003. */
test.describe('Lookup', () => {
  test('TC-004 Look Up button is disabled until an order number is entered', async ({ page }) => {
    const lookup = new LookupPage(page);
    await lookup.goto();

    // expected: disabled while empty ...
    await expect(lookup.lookUp).toBeDisabled();
    // ... enabled after a 7-digit number
    await lookup.orderInput.fill('1234567');
    await expect(lookup.lookUp).toBeEnabled();
  });

  test('PR-003 Look Up page offers three search modes', async ({ page }) => {
    const lookup = new LookupPage(page);
    await lookup.goto();

    await expect(lookup.byOrder).toBeVisible();
    await expect(lookup.byPurchaseOrder).toBeVisible();
    await expect(lookup.byCustomer).toBeVisible();
    await expect(lookup.byOrder).toBeChecked(); // default mode
  });
});
