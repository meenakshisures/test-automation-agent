---
name: failure-analyzer
description: Diagnose failed Playwright tests from the trace/error and apply the smallest correct fix, within a strict retry budget. Use after execution when tests fail.
---

# Failure analyzer & auto-fixer

Classify before you fix. Fix the real cause, not the symptom.

## Budget

**Max 3 fix attempts per test.** If still failing after 3, stop and report it as
unresolved with the best diagnosis.

## Classify each failure

Read the error message and open the trace (`npx playwright show-trace <zip>`):

| Class | Signal | Correct fix |
|-------|--------|-------------|
| **locator** | "strict mode violation", "not found", 0 elements | Re-ground via `app-grounding`; update the Page Object selector. |
| **timing** | element found but not ready; passes on retry | Use/await a web-first assertion on the right state. **Never** add `waitForTimeout`. |
| **assertion** | action succeeded, expected value wrong | Re-read the IR `expected`. Only change the assertion if it misread the IR. |
| **data / env** | auth expired, test data missing, baseURL wrong | Fix fixtures/`.env`, not the test logic. |
| **app bug** | app genuinely violates the expected result | **STOP. Report it.** Do not alter the assertion to pass. |

## Hard rules

- Never weaken, delete, or `.skip()` an assertion to force green.
- One change per attempt, so you can tell what fixed it.
- Record each fix (what class, what change) for the report and Fix Memory.
