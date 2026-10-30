# Architecture

An AI agent that turns written test cases (CSV, or free text) into Playwright TypeScript scripts with
Page Objects, validates them, and reports per case. It runs as a custom agent in GitHub Copilot Chat.
No live application is used.

## Design principles

1. **LLM only at the fuzzy edges.** Understanding wording, inferring locators and fixing scripts use the
   model. Parsing, validation, retry limits and reporting are plain deterministic code.
2. **An Intermediate Representation (IR).** Every input becomes one structured test case
   (`ir/schema.json`) before any code is written. A new input type is just a new adapter.
3. **Ask, don't guess.** Vague steps or expected results ("it works") are flagged and the agent asks the user.
   An expected result is never invented.
4. **Honest validation.** With no app to run against, scripts are validated statically and the report
   says they were not executed.

## Pipeline

| # | Layer | What it does | Skill | Code | Output |
|--:|-------|--------------|-------|------|--------|
| 1 | Parse | CSV/prompt -> IR, flags ambiguity | `test-case-parser` | `scripts/parse.mjs` | `ir/*.json` |
| 2 | Page objects | Infer locators from step wording | `page-object-builder` | (LLM) | `pages/*.ts` |
| 3 | Generate | Spec per case, assertion per expected result | `playwright-generator` | (LLM), `tsc` gate | `tests/*.spec.ts` |
| 4 | Validate | compiles / collected / assertions / no sleeps | `script-validator` | `scripts/validate.mjs` | `reports/validation.json` |
| 5 | Fix | Diagnose failed checks, fix, max 3 tries | `failure-analyzer` | (LLM) | edits to specs/pages |
| 6 | Report | Consolidated per-case report | `report-generator` | `scripts/report.mjs` | `reports/report.html`, `.md` |

The `test-author` agent (`.github/agents/test-author.agent.md`) orchestrates the layers.
`scripts/run.mjs` chains the deterministic steps (parse -> validate -> report).

```
CSV -> parse -> IR --(vague?)--> ask user
                 |
                 v
        page objects -> specs -> validate --(invalid?)--> fix (max 3) -> validate
                                    |
                                    v
                                  report
```

## Validation checks (per case)

1. A `test('<id> ...')` exists in `tests/*.spec.ts`
2. It compiles (`tsc --noEmit`), errors attributed to that test or its page objects
3. Playwright collects it (`playwright test --list`)
4. `expect()` count >= number of IR `expected` entries
5. No `waitForTimeout`

Statuses: `VALID`, `INVALID`, `NOT_GENERATED`, `NOT_NORMALIZED`, `NEEDS_CLARIFICATION`.

## Limits

- Locators are inferred from wording, not from a real page. They may need adjusting on the real app.
- "Valid" does not mean "passes". To measure a real pass rate, set `BASE_URL` and run `npm test`.
- Quality depends on how precisely the CSV describes steps and expected results.

## Extending

- **Execute against an app:** set `BASE_URL`; add a grounding step (read the accessibility tree) to replace
  inferred locators with real ones; feed run failures to `failure-analyzer` (locator / timing / assertion / app bug).
- **More input types (Gherkin, TestRail):** add an adapter in `scripts/parse.mjs` that outputs the IR.
- **Other apps:** nothing is app-specific, so only the CSV changes.
