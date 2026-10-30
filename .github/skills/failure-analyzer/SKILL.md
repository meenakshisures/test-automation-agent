---
name: failure-analyzer
description: Diagnose scripts that failed static validation and apply the smallest correct fix within a strict retry budget. Use after validation reports INVALID or NOT_GENERATED cases.
---

# Failure analyzer & auto-fixer

Classify before you fix. Fix the real cause, not the symptom.

## Budget
**Max 3 fix attempts per case.** After 3, stop and report it as unresolved with your best diagnosis.

## Classify from `reports/validation.json`
| Failed check | Class | Correct fix |
|---|---|---|
| Script exists | missing | Generate the spec, title must start with the testId |
| Compiles (tsc) | type/syntax | Fix the code or the Page Object method signature it calls |
| Collected by Playwright | structure | Fix imports / the `test()` call so `--list` finds it |
| Assertion per expected result | coverage | Add the missing `expect()` for the unasserted expected entry (re-read the IR) |
| No hard sleeps | timing | Replace `waitForTimeout` with a web-first assertion on the real state |
| (not a validation failure) the case is vague | ambiguity | **Stop. Ask the user.** |

## Hard rules
- Never delete, weaken, or `.skip()` an assertion to turn a check green.
- One change per attempt, so you know what fixed it.
- If the IR itself is wrong or vague, do not patch the script: ask the user.
- Re-run `npm run validate` after each fix; record class + change for the report.
- If the user later executes the specs and one fails, apply the same discipline: classify (locator,
  timing, assertion, data, app bug), and for a real app bug stop and report it.
