# Demo guide

## The 30-second pitch

You write a test case in plain English, CSV or PDF. A Copilot custom agent turns it into a
Playwright TypeScript test, runs it against the real app, fixes its own mistakes (max 3 tries),
and gives you one report with pass/fail counts, screenshots and failure reasons.

## How it works (one picture)

```
 Prompt / CSV / PDF
        |
   1. PARSE      test-case-parser     -> ir/*.json      one structured test case per input
        |                                                (asks you if steps/expected are ambiguous)
   2. GROUND     app-grounding        -> app-model/     Page Objects from the REAL page (no guessed selectors)
        |
   3. GENERATE   playwright-generator -> tests/*.spec.ts  >=1 expect() per expected result; tsc must pass
        |
   4. EXECUTE    test-executor        -> results, screenshots, traces, videos
        |            (logs in once via Microsoft SSO + MFA, session reused)
   5. HEAL       failure-analyzer     classify failure -> fix the cause -> retry (max 3)
        |                              real app bug => STOP and report, never weaken the assertion
   6. REPORT     report-generator     -> reports/report.html (+ .md, evidence/)
```

Key idea to say out loud: **the AI only does the fuzzy work** (understanding text, choosing
locators, diagnosing failures). Parsing, running, retry limits and reporting are plain code, so
results are reliable and repeatable.

## Where things live

| Folder / file | What it is |
|---|---|
| `.github/agents/test-author.agent.md` | The custom agent (appears in Copilot Chat's agent dropdown) |
| `.github/skills/*/SKILL.md` | The 6 reusable skills |
| `.github/copilot-instructions.md` | Repo rules Copilot always follows |
| `inputs/` | Test cases in (`testcases.csv`, `prompts.txt`, PDFs, `samples/`) |
| `ir/` | Normalized test cases (the canonical format between every stage) |
| `app-model/` | Page Objects + selector map for the app |
| `tests/` | Generated specs, plus `auth.setup.ts` and `fixtures.ts` |
| `auth/` | Microsoft login + MFA (TOTP) helper |
| `scripts/` | Deterministic code: `parse.mjs`, `report.mjs`, `run.mjs`, `md-reporter.mjs` |
| `reports/` | `report.html`, `report.md`, `evidence/<id>/` |

Deeper detail: [`ARCHITECTURE.md`](./ARCHITECTURE.md) and the diagram [`architecture.drawio`](./architecture.drawio).

## Requirement -> where it is met

| Requirement | Where |
|---|---|
| Accepts prompt and CSV (and PDF) without reformatting | `scripts/parse.mjs` + `test-case-parser` skill |
| Asks for clarification when ambiguous | parser skill's ambiguity gate |
| Locators, waits, assertions, Page Objects | `playwright-generator` + `app-model/pages/` |
| Execute and capture pass/fail, logs, screenshots, traces | `playwright.config.ts` |
| Self-correct with a retry limit (3) | `failure-analyzer` skill |
| Summary per test case + script + status | `reports/report.html` |
| Failures reported with reason, never skipped | report lists every case; failures first with full error |
| Reproducible setup | `README.md` |

## Live demo script (about 8 minutes)

Before you start: `cd test_agent` (inner folder), `npm install`, `npm run install:browsers`,
`.env` filled in. **Do one full run beforehand** so you know it works on the day (the app and
login take ~20-60s).

1. **Show the inputs** (1 min): open `inputs/samples/sample-testcases.csv`. Point at the columns.
2. **Run the agent** (3 min): Copilot Chat -> pick **test-author** -> send
   `Run the test cases in inputs/samples/sample-testcases.csv`. Narrate as it parses, writes specs, runs.
   Approve the terminal prompts.
3. **Show a generated spec** (1 min): open `tests/sample-csv.spec.ts`. Point out the Page Objects and
   one `expect()` per expected result.
4. **Show the report** (2 min): open `reports/report.html`. Tiles, filters, open a case card
   (steps, expected, screenshot).
5. **Show failure handling** (1 min): edit one expected column name in the CSV to something wrong,
   re-run that case. Show the failed card: reason, screenshot, trace, and that the agent reports
   it instead of quietly changing the assertion.
6. **Show one-line input** (optional): `Verify that the Assembly page has a search box`.

## Likely questions

- **Why not just ask the LLM for a script?** It guesses selectors; grounding in the real page and
  the heal loop are what make scripts run unedited.
- **How does it handle login/MFA?** Signs in once through Microsoft SSO, saves the session; MFA via
  TOTP secret in `.env`, or manual approval when run headed. Push approvals cannot be automated.
- **What's the pass rate?** Read it off the report. All 15 current sample cases pass, but that is a small
  sample on one app; do not claim a general percentage.
- **What if the app is genuinely broken?** Classified as an app bug; agent stops and reports.
- **Adding another input type (Gherkin, TestRail)?** One new adapter into the IR; nothing downstream changes.
- **Security?** Credentials only in `.env` (gitignored); `.auth/` session files are gitignored too.

## Honest limitations (say these before they are asked)

- POC: one app, ~15 cases; PDFs must be text-based (no scans).
- Page load is slow (~10-15s spinner), so tests are slow; waits are generous on purpose.
- The self-heal quality depends on Copilot's model; always review generated specs before committing.
- Selectors are grounded from a snapshot; if the UI changes, specs need re-grounding.
