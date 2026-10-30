---
name: report-generator
description: Build the consolidated validation report (HTML + Markdown) with per-case status, reasons, steps, expected results and the generated script. Use as the final step.
---

# Report generator

Deterministic. One status per test case with the reason attached; nothing silently skipped.

## Run
`npm run report` reads `reports/validation.json` and writes:
- `reports/report.html`: open this. Summary tiles, filters, and a card per case (steps, expected,
  checks, questions for the user, generated script).
- `reports/report.md`: the same as Markdown.

## Summarize for the user
State plainly:
- `X/Y clear cases valid` (valid scripts / cases clear enough to generate), plus the count awaiting clarification,
- each invalid case and its failing check,
- every open question, quoted,
- that the scripts were **validated statically and not executed**, so locators are unverified.
