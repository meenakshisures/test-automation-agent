---
name: test-case-parser
description: Normalize CSV rows (or free-text prompts) into the canonical Test Case IR in ir/. Use before generating any Playwright code. Asks the user when a step or expected result is ambiguous.
---

# Test case parser

Turn any input into one validated IR object per test case. The deterministic `scripts/parse.mjs`
does the CSV work; you finish anything it could not.

## Steps

1. Run `npm run parse` (reads `inputs/testcases.csv`, `inputs/prompts.txt`, `inputs/*.pdf`) or
   `npm run parse -- path/to/file.csv` for one file. Expected CSV columns:
   `TestID, Title, Preconditions, Steps, Test Data, Expected Result` (extra columns such as Priority or
   Tags are kept). Steps and expected results may be one per line, numbered, or separated by `;`.
2. CSV rows become complete `ir/<id>.json`. Prompt lines and PDF blocks become stubs with
   `needsLlmNormalization: true`: infer `preconditions`, split `steps` into single user actions,
   extract `testData` as key/value, and rewrite `expected` as assertable statements. Then set the flag false.
3. **Ambiguity gate.** The parser sets `needsClarification: true` with `clarificationQuestions` when
   steps are missing or an expected result cannot be asserted ("it works", "is correct", empty).
   For those cases **ask the user the listed questions**. Do not guess, and do not generate a script
   until answered. Keep processing the other cases.
   When the user answers, update the CSV row (or the IR), set `needsClarification` false and re-run.

## Assertable means
Checkable with a Playwright assertion: visible/hidden text or element, URL, count, value, enabled/disabled,
checked state. Each `expected` entry maps to at least one `expect()`.

## Validate
Every IR must conform to `ir/schema.json`: `testId`, `title`, `source`, non-empty `steps`, non-empty `expected`.
