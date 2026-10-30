---
name: playwright-generator
description: Generate TypeScript Playwright specs from clear Test Case IR using the Page Objects and the team coding standards. Use after parsing and Page Object building, before validation.
---

# Playwright generator

Produce a reviewable spec per clear IR. Code against Page Objects, never raw selectors.

## Output contract
- Files in `tests/<feature>.spec.ts`; group related cases with `test.describe`.
- One `test()` per IR, titled with its id first: `test('TC-002 Login fails with an invalid password', ...)`.
  The validator finds the case by that id prefix.
- Map every IR `expected` entry to **at least one `expect()` inside the test body**. A script with fewer
  `expect()` calls than expected results is invalid.
- Preconditions become setup (`test.beforeEach` or opening steps). Steps become Page Object calls.
- Test data comes from the IR `testData` (and CSV); secrets via `process.env`.
- Header comment: `Generated from IR: <ids> (source: <file>). Not run against an app.`

## Coding standards
- Web-first assertions (`await expect(locator).toBeVisible()`), which auto-wait. **No `waitForTimeout`.**
- Relative URLs only (`page.goto('/login')`).
- Independent, idempotent tests.
- Skip cases with `needsClarification: true`; do not write placeholder scripts for them.

## Gate before validation
Run `npx tsc --noEmit`. Fix type errors here, before `npm run validate`.
