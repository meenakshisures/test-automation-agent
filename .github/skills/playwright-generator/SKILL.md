---
name: playwright-generator
description: Generate TypeScript Playwright specs from Test Case IR using the grounded Page Objects and team coding standards. Use after parsing and grounding, before execution.
---

# Playwright generator

Produce a reviewable spec per IR. Code against Page Objects, never raw selectors.

## Output contract

- One file under `tests/`, grouped by feature; one `test()` per IR.
- Title each test with its `testId`, e.g. `test('TC-002 Login fails ...')`.
- Map every IR `expected` entry to **at least one `expect()`**. This is
  mandatory — a spec with no assertion for a stated expected result is invalid.
- Translate `preconditions` into setup (a `beforeEach`, fixture, or opening
  steps). Drive all interaction through Page Object methods.

## Coding standards

- Use web-first assertions (`await expect(locator).to...`) — they auto-retry.
- **No** `page.waitForTimeout` / hard sleeps. Rely on auto-waiting and
  assertion retry.
- Prefer `getByRole` / `data-test` locators exposed by the Page Object.
- Keep tests independent and idempotent (fresh login per test unless a fixture
  provides `storageState`).

## Gate before running

Run `npx tsc --noEmit`. The spec must type-check (and lint, if configured)
before it is executed. Fix type errors here, not in the heal loop.
