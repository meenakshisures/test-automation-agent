# Architecture

AI test-automation agent that turns written test cases (free-text prompts, CSV
or PDF) into runnable, self-correcting Playwright tests. It runs as a **custom
agent in GitHub Copilot Chat (VS Code)** and is validated against the Meiden
Switchgear dashboard (Microsoft Entra ID SSO, MFA-capable).

New to this? Read [`DEMO.md`](./DEMO.md) first (5-minute walkthrough + demo script).

- **Editable diagram:** [`architecture.drawio`](./architecture.drawio) — open at
  [app.diagrams.net](https://app.diagrams.net) (File → Open) or with the
  **Draw.io Integration** extension in VS Code.
- **Rendered overview:** https://claude.ai/artifact/RkKLSnjLqg4WaXhnCTMTwk

## Design principles

The naïve approach — "LLM reads a test case and emits Playwright, retry on
failure" — plateaus near 40–50% usable scripts because the model hallucinates
selectors and has no model of the app. Four structural choices fix that:

1. **LLM only at the fuzzy edges.** Language understanding, selector choice, and
   failure diagnosis use the model; parsing, execution, retry control, and
   reporting are plain deterministic code.
2. **An Intermediate Representation (IR).** Every input normalizes to one
   canonical schema ([`../ir/schema.json`](../ir/schema.json)) before any code is
   generated. A new input source is just a new adapter — nothing downstream
   changes. This is the extensibility seam.
3. **Grounding in the real DOM.** Snapshot the live accessibility tree and build
   Page Objects from elements that actually exist. This is the biggest lever on
   the "runs without edits" rate.
4. **Diagnosing self-heal, not green-chasing.** Failures are classified before
   they are fixed, within a hard retry budget. A real app bug stops and is
   reported — the agent never weakens an assertion to force a pass.

## The pipeline

Data flows top to bottom through seven layers. Purple = LLM-driven, teal/green =
deterministic.

| Layer | Name | Responsibility | Kind |
|------:|------|----------------|------|
| 1 | Ingestion & Adapters | One adapter per source → raw intent | deterministic |
| 2 | Normalization → IR | Canonical schema; clarification gate on ambiguity | LLM |
| 3 | App Grounding | a11y snapshot → Page Objects + selector map | det + LLM |
| 4 | Script Generation | TS spec; ≥1 `expect()` per expected result; `tsc` gate | LLM |
| 5 | Execution | `playwright test`; trace / screenshot / video | deterministic |
| 6 | Analysis & Self-heal | Classify failure → fix the cause; retry ≤ 3 | LLM |
| 7 | Reporting | Per-case status + reason; nothing silently skipped | deterministic |

### Self-heal loop (Layer 6)

```
Execute → capture (error, DOM, trace) → classify → patch the real cause → re-run
```

Failure taxonomy and the correct response to each:

| Class | Signal | Fix |
|-------|--------|-----|
| locator | not found / strict-mode violation | re-ground; update Page Object selector |
| timing | ready-state race; passes on retry | web-first assertion on the right state (never `waitForTimeout`) |
| assertion | action ok, expected value wrong | re-read the IR `expected` |
| data / env | auth expired, data missing, wrong baseURL | fix fixtures / `.env` |
| app bug | app genuinely violates the expected result | **STOP and report** — do not alter the assertion |

Guard: **max 3 attempts per test**, then report as unresolved.

## Authentication (cross-cutting)

The app signs in through Microsoft Entra ID, so login is not part of any test case.
A Playwright **`setup` project** signs in once and every spec reuses the session:

```
tests/auth.setup.ts -> auth/microsoft-login.ts   state machine: email -> password -> [MFA] -> "Stay signed in?"
                       auth/totp.ts              RFC 6238 code generator (MFA_TOTP_SECRET in .env)
                    -> .auth/user.json           cookies + localStorage   (gitignored)
                    -> .auth/session.json        sessionStorage (MSAL tokens), restored by tests/fixtures.ts
```

MFA: set `MFA_TOTP_SECRET` for fully automatic codes, or run headed and approve manually
(`MFA_WAIT_MS`). Push approvals cannot be automated. Specs for the signed-out experience opt out
with an empty `storageState`. Credentials live only in `.env`.

## Reporting outputs (Layer 7)

One consolidated report per run, regenerated automatically after every `playwright test`
(custom reporter `scripts/md-reporter.mjs` -> `scripts/report.mjs`):

- `reports/report.html` - summary tiles, pass rate, filters, a card per case (steps, expected, script,
  screenshot, error), self-contained. `reports/report.md` is the same in Markdown.
- `reports/evidence/<id>/` - screenshot per case; trace, video, error-context for failures.
- `reports/html/` (Playwright's own report) and `reports/results.json` (raw data).

## Supporting structures

- **Persistence & registry:** IR store (versioned), generated spec repo (git),
  App Model Registry (Page Objects + selectors per app), run history / flakiness,
  Fix Memory (RAG of past patches to heal faster over time).
- **Cross-cutting foundation:** orchestrator / state machine, retry & token
  budgets, config & secrets (`.env`, Playwright `storageState`), observability,
  CI/CD, human-in-the-loop gates.

## Mapping to this repo

| Layer | Skill (`.github/skills/`) | Deterministic code | Artifacts |
|-------|---------------------------|--------------------|-----------|
| 1–2 | `test-case-parser` | `scripts/parse.mjs` (CSV, PDF via `pdf-parse`, prompts) | `ir/*.json`, `inputs/extracted/` |
| 3 | `app-grounding` | — | `app-model/selectors.json`, `app-model/pages/*.ts` |
| 4 | `playwright-generator` | `tsc` gate | `tests/*.spec.ts` |
| 5 | `test-executor` | `playwright.config.ts`, `auth/`, `tests/auth.setup.ts` | `reports/results.json`, `artifacts/` |
| 6 | `failure-analyzer` | — | (edits to specs / model) |
| 7 | `report-generator` | `scripts/report.mjs`, `scripts/md-reporter.mjs` | `reports/report.html`, `report.md`, `evidence/` |

The [`test-author`](../.github/agents/test-author.agent.md) custom agent orchestrates these
layers; `scripts/run.mjs` is the deterministic backbone they hang off.

## Phased delivery

- **Phase 1 (POC, this repo):** prompt + CSV → IR, static grounding on one app,
  generate + execute + Markdown report, self-heal for locator/timing. Target:
  80% unedited pass on the sample set.
- **Phase 2 (Beta):** live a11y grounding via Playwright MCP, Fix Memory (RAG),
  HTML report + CI, full failure taxonomy, Gherkin / TestRail adapters.
- **Phase 3 (Scale):** multi-app registry, selector-drift auto-refresh,
  scheduled regression, pluggable generator backends (API, mobile), review gates.
