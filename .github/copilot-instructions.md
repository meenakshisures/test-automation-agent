# Repo instructions (GitHub Copilot)

This repo is a Playwright (TypeScript) test-script generator. Input is a CSV of test cases
(`TestID, Title, Preconditions, Steps, Test Data, Expected Result`); output is Playwright specs with
Page Objects, a static validation, and a report. There is **no live app**: scripts are generated and
validated statically, not executed. Use the `test-author` custom agent; skills are in `.github/skills/`.

Pipeline: `inputs/` -> `ir/*.json` -> `pages/*.ts` + `tests/*.spec.ts` -> `reports/validation.json` -> `reports/report.html`.

## Conventions for generated code
- Specs import `{ test, expect }` from `@playwright/test` and drive Page Objects in `pages/`; no raw
  selectors in specs.
- One `test()` per test case, titled `TC-001 <title>` (the id first). Group related cases in `test.describe`.
- At least one `expect()` per IR `expected` entry, inside the `test()` body (not hidden in a helper).
- Locators come from the wording of the steps, in this order: `getByRole` (+ name), `getByLabel`,
  `getByPlaceholder`, `getByText`, `getByTestId`. Never CSS chains or XPath.
- Use relative URLs (`page.goto('/login')`); the base URL comes from `BASE_URL` in `.env`.
- Never use `waitForTimeout`; rely on web-first assertions.
- Page Object header comment must say `UNVERIFIED: locators inferred from the test case wording`.
- Test data comes from the CSV `Test Data` column; use `process.env` for anything secret.

## Rules
- Ambiguous steps or expected results: ask the user, do not guess.
- Never remove or weaken an assertion to make validation pass.
- Report honestly: scripts were validated statically, not executed.

## Commands
`npm run agent` (parse + validate + report) · `npm run parse -- <csv>` · `npm run validate` ·
`npm run report` · `npm run test:list` · `npx tsc --noEmit`
