---
name: script-validator
description: Statically validate the generated Playwright scripts (compile, collect, assertion coverage, no hard sleeps) and write reports/validation.json. Use after generation. Replaces live execution when no app is available.
---

# Script validator

Deterministic. Do not improvise; run and read the result.

## Run
`npm run validate` (writes `reports/validation.json`, prints a summary, exits non-zero if any script is invalid).

## Per-case checks
1. **Script exists**: a `test('<id> ...')` is found in `tests/*.spec.ts`.
2. **Compiles**: `tsc --noEmit`; errors are attributed to the test whose lines contain them, or to every
   test in the same file / page objects it imports.
3. **Collected by Playwright**: the title appears in `playwright test --list`.
4. **Assertion per expected result**: number of `expect()` in the test body >= number of IR `expected` entries.
5. **No hard sleeps**: no `waitForTimeout`.

## Statuses
`VALID`, `INVALID` (a check failed), `NOT_GENERATED` (no script), `NOT_NORMALIZED` (IR still a stub),
`NEEDS_CLARIFICATION` (waiting for the user; not a failure).

## Limits (always say so)
This proves the scripts are well-formed and tied to the expected results. It does **not** prove they pass:
nothing runs against an app. If the user later provides `BASE_URL`, `npm test` can execute them.

## Hand off
Pass INVALID / NOT_GENERATED cases and their reasons to `failure-analyzer`.
