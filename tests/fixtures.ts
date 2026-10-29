import { test as base, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Same as Playwright's `test`, but also restores sessionStorage saved by auth.setup.ts
 * (storageState only covers cookies + localStorage, and MSAL may keep tokens in sessionStorage).
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    if (existsSync('.auth/session.json')) {
      const data = readFileSync('.auth/session.json', 'utf8');
      await context.addInitScript((json) => {
        if (location.hostname.endsWith('azurestaticapps.net')) {
          for (const [k, v] of Object.entries(JSON.parse(json))) sessionStorage.setItem(k, v as string);
        }
      }, data);
    }
    await use(context);
  },
});

export { expect };
