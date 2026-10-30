# Test Automation Agent - POC

Give it test cases in a **CSV**; it produces **Playwright (TypeScript) scripts with Page Objects**,
validates them, and reports per test case. It runs as a **custom agent in GitHub Copilot Chat (VS Code)**.
No application, URL or credentials are needed.

```
inputs/testcases.csv
   └─ parse     -> ir/*.json                     one structured test case per row (asks you if vague)
        └─ page objects -> pages/*.ts            locators inferred from the wording of the steps
             └─ generate -> tests/*.spec.ts      one test() per case, >=1 expect() per expected result
                  └─ validate -> reports/validation.json   compiles? collected? assertions? no sleeps?
                       └─ report -> reports/report.html (+ .md)
```

> **Important:** scripts are validated **statically** and are **not executed**. "Valid" means well-formed
> and tied to the expected results, not that it passes on your real app (locators are inferred, not
> inspected). To execute them later, set `BASE_URL` in `.env` and run `npm test`.

## Setup

Prerequisites: Node.js 18+ (20.12+ recommended), VS Code with GitHub Copilot + Copilot Chat (Agent mode).

```bash
npm install
```

That is all; no browser download is needed for generation and validation.
(To also execute scripts: `npx playwright install chromium`, set `BASE_URL`, `npm test`.)

## CSV format

Columns: `TestID, Title, Preconditions, Steps, Test Data, Expected Result` (extra columns allowed).
Steps and expected results can be numbered, one per line, or separated by `;`.
Test data is `key=value; key2=value2`. See `inputs/testcases.csv` (TC-006 is deliberately vague to show
the clarification question).

## Use it

In VS Code open this folder, open Copilot Chat (Ctrl+Alt+I), pick the **test-author** agent and send:

> Run the test cases in inputs/testcases.csv

or type `/run-test-cases`, or point at any file: *"Run the test cases in C:\path\to\my-cases.csv"*.
You can also paste a single case: *"Verify login fails with an invalid password"*.

Without Copilot, the deterministic parts run from the terminal:

```bash
npm run parse -- path/to/cases.csv   # CSV -> ir/*.json   (omit the path to use inputs/)
npm run validate                     # check the scripts in tests/
npm run report                       # build reports/report.html
npm run agent                        # all three
```

## Folders

| Path | Purpose |
|------|---------|
| `inputs/` | Your CSV (`testcases.csv`) and optional `prompts.txt` |
| `ir/` | Structured test cases (+ `schema.json`) |
| `pages/` | Generated Page Objects (locators are `UNVERIFIED`) |
| `tests/` | Generated `*.spec.ts` |
| `scripts/` | Deterministic code: `parse.mjs`, `validate.mjs`, `report.mjs`, `run.mjs` |
| `reports/` | `validation.json`, `report.html`, `report.md` (generated, gitignored) |
| `.github/` | Copilot agent (`agents/`), 6 skills (`skills/`), repo rules, `/run-test-cases` prompt |
| `docs/` | `ARCHITECTURE.md`, `DEMO.md` |

## What "valid" means

For each clear case, `npm run validate` checks: the script exists (test titled with the id), it compiles
(`tsc`), Playwright collects it (`--list`), it has at least one `expect()` per expected result, and it has
no `waitForTimeout`. Cases the parser cannot make assertable are reported as **NEEDS CLARIFICATION**
(not failures, and not silently skipped).

## Acceptance criteria -> where met

| Criterion | Where |
|-----------|-------|
| Accepts CSV (and prompts) with no manual reformatting | `scripts/parse.mjs` |
| Ask for clarification when ambiguous | parser flags + agent asks the listed questions |
| Assertions tied to each expected result | validator check "Assertion per expected result" |
| Failures reported clearly, not skipped | `reports/report.html` lists every case and reason |
| Scripts run unedited for >= X% | **Cannot be measured without an app.** Report shows valid scripts / clear cases; execute with `BASE_URL` to measure real pass rate |
| Reproducible setup | this README |
