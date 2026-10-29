# Test Automation Agent — POC

An AI-driven agent that turns written test cases (free-text **prompts** or
**CSV**) into runnable **Playwright** tests, executes them against a web app,
self-corrects failures, and reports honestly.

Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · editable diagram
[`docs/architecture.drawio`](docs/architecture.drawio) · rendered overview
https://claude.ai/artifact/RkKLSnjLqg4WaXhnCTMTwk

## Pipeline

```
inputs/ (prompt + CSV)
   └─ parse        → ir/*.json          Canonical Test Case IR  (deterministic + LLM)
        └─ ground  → app-model/         Page Objects + selector map  (grounded in the real app)
             └─ generate → tests/*.spec.ts   TypeScript specs, 1 expect() per expected result  (LLM)
                  └─ execute → reports/results.json + artifacts/   (deterministic Playwright)
                       └─ analyze+heal → classify failure, fix cause, retry ≤3  (LLM)
                            └─ report → reports/report.md + HTML   (deterministic)
```

The **LLM** does only the fuzzy work (normalize prompts, generate specs, diagnose
failures). Parsing, execution, and reporting are plain Node — reliable and
testable. Everything flows through one **IR** (`ir/schema.json`), so a new input
source is just a new adapter and nothing downstream changes.

## Prerequisites

- Node.js 18+ and npm
- Internet access to the target app (the POC targets the Meiden Switchgear dashboard, which signs in via Microsoft Entra ID SSO)
- A test account for that app

## Setup

```bash
cd test_agent
npm install
npm run install:browsers      # downloads Chromium for Playwright
copy .env.example .env        # Windows (use cp on macOS/Linux), then fill in BASE_URL + TEST_USERNAME/TEST_PASSWORD
```

## Authentication & MFA

The app uses **Sign in with Microsoft**. The `setup` Playwright project (`tests/auth.setup.ts`
-> `auth/microsoft-login.ts`) signs in once, saves the session to `.auth/` (gitignored), and every
spec reuses it. Specs that test the signed-out experience opt out with
`test.use({ storageState: { cookies: [], origins: [] } })`.

If the account is prompted for MFA, pick one:

| Option | How |
|--------|-----|
| **TOTP (fully automated)** | Put the base32 secret from the Authenticator setup screen ("enter key manually") in `MFA_TOTP_SECRET`. Codes are generated automatically. |
| **Manual approval** | Leave `MFA_TOTP_SECRET` empty and run `npm run test:headed`. Login waits up to `MFA_WAIT_MS` (default 120s) while you approve the push or type the code. |

Push notifications ("Approve sign-in") cannot be automated; use TOTP or a CI-friendly account
excluded from MFA by Conditional Access. Never commit `.env`.

## Run it

```bash
# Full pipeline: parse inputs → run tests → write report
npm run agent

# …or step by step
npm run parse                 # inputs/ → ir/*.json
npm test                      # run the generated specs
npm run report                # reports/results.json → reports/report.md
npm run report:open           # open the interactive Playwright HTML report
```

Expected: all 7 cases (4 CSV `TC-00x`, 3 prompt `PR-00x`) pass, and `reports/report.md`
shows a per-case status table. Note the app takes ~10-15s to boot after sign-in, so
Page Object `goto()` methods wait up to 45s for the first heading.

## Test case inputs

| Input | How |
|-------|-----|
| Free-text prompt | Type it in Copilot Chat, or add a line to `inputs/prompts.txt` |
| CSV | `inputs/testcases.csv` (columns `TestID, Title, Preconditions, Steps, Test Data, Expected Result`), or `npm run parse -- path/to/cases.csv` |
| PDF | Drop it in `inputs/` or `npm run parse -- path/to/cases.pdf`. Text is extracted and split into one case per `TC-xxx` / `Test Case n` heading; Copilot then normalizes each into IR. Needs a text-based PDF (not a scan). A sample is in `inputs/samples/testcases.pdf`. |

In Copilot Chat you can also just say: *"Run the test cases in inputs/samples/testcases.pdf"*
(or attach the file). Rows/blocks whose steps or expected result are ambiguous trigger a
clarification question instead of a guess.

## Reports

Every test run (`npm test`, `npm run agent`, VS Code Test Explorer, Copilot) regenerates:

- **`reports/report.html`** - open in a browser. Summary tiles (total / passed / failed / flaky / skipped /
  pass rate), sign-in status, filter buttons, and one card per test case with its steps, expected result,
  generated script, **screenshot**, trace/video links and the full error for failures. Failures are listed first.
- **`reports/report.md`** - the same, as Markdown.
- **`reports/evidence/<id>/`** - screenshot for every case; `trace.zip`, `video.webm` and `error-context.md` for failures
  (`npx playwright show-trace reports/evidence/<id>/trace.zip`). `artifacts/` is wiped each run; `evidence/` is what to keep.
- `npm run report:open` - the interactive Playwright HTML report.

## Using the agent (GitHub Copilot in VS Code)

The agent is a Copilot **custom agent**; everything it needs is in `.github/`:

- `.github/agents/test-author.agent.md` - the orchestrating agent
- `.github/skills/` - one skill per layer: `test-case-parser`, `app-grounding`,
  `playwright-generator`, `test-executor`, `failure-analyzer`, `report-generator`
- `.github/copilot-instructions.md` - repo conventions Copilot always loads
- `.github/prompts/run-test-cases.prompt.md` - one-click "process everything in `inputs/`"

Requirements: VS Code with the GitHub Copilot + Copilot Chat extensions, signed in to a plan
with Agent mode. Open this folder (`test_agent`, the one with `package.json`) as the workspace.

1. Open Copilot Chat (Ctrl+Alt+I) and pick **test-author** in the agent dropdown.
   (If it is missing: Chat > agent picker > *Configure Custom Agents*, or reload the window.)
2. Ask, e.g.:

   > Verify that the Settings page shows the Users table with an Add New User button

   or type `/run-test-cases` to process all of `inputs/`.
3. Approve the terminal commands Copilot proposes (`npm run parse`, `npm test`, ...).

It normalizes the prompt to IR, reuses/extends the grounded Page Objects, generates a spec with
assertions, runs it, heals failures within the retry budget, and updates the report.

## Layout

| Path | Purpose |
|------|---------|
| `inputs/` | Raw sources: `prompts.txt`, `testcases.csv` |
| `ir/` | Canonical Test Case IR + `schema.json` |
| `app-model/` | Grounded Page Objects (`pages/`) + `selectors.json` |
| `tests/` | Generated `*.spec.ts` |
| `scripts/` | Deterministic core: `parse.mjs`, `report.mjs`, `run.mjs` |
| `auth/` | Microsoft SSO login + TOTP MFA helper (used by `tests/auth.setup.ts`) |
| `reports/` | `report.html` (open this), `report.md`, `evidence/<id>/` (screenshots, traces, videos), `html/` (Playwright report), `results.json` |
| `artifacts/` | Traces, screenshots, videos (failures) |
| `.github/` | Copilot agent, skills, instructions, prompts |

## Adapting to your own app

1. Set `BASE_URL`/`APP` in `.env`.
2. Ground the app: add pages/elements to `app-model/selectors.json` and a Page
   Object per page (see `app-grounding` skill — snapshot the accessibility tree,
   prefer `getByRole`/`data-test`).
3. Put your test cases in `inputs/` and run `npm run agent`.

## Acceptance criteria → where they're met

| Criterion | Where |
|-----------|-------|
| Prompt **and** CSV without reformatting | `scripts/parse.mjs` + adapters → IR |
| Scripts run unedited for ≥ target % | grounding + `tsc` gate + heal loop; actual % in the report |
| Every script asserts the expected result | `playwright-generator` contract: ≥1 `expect()` per IR `expected` |
| Failures reported clearly, never skipped | `report.mjs` lists every case + reason; app bugs flagged |
| Reproducible setup | this README; all state in-repo |
