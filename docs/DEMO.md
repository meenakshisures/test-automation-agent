# Demo guide

## 30-second pitch
You give a CSV of test cases. A Copilot agent turns each row into a Playwright script with Page Objects
and assertions, checks the scripts, asks you about anything vague, and gives one report.
It needs no application and no credentials.

## How it works
```
CSV -> parse (IR) -> page objects -> specs -> validate -> fix (max 3) -> report
        |
   vague? -> the agent asks you instead of guessing
```
The AI does the fuzzy work (reading the wording, inferring locators, fixing). Parsing, validation, retry
limits and reporting are plain code, so results are repeatable.

## Live demo (about 6 minutes)
Before: `npm install`; run `npm run agent` once so you know it works.
1. **Input (1 min):** open `inputs/testcases.csv`. Point at the columns and at TC-006 ("It works").
2. **Run the agent (2 min):** Copilot Chat -> **test-author** -> `Run the test cases in inputs/testcases.csv`.
   Approve terminal prompts. It should ask you about TC-006.
3. **Answer the question (1 min):** e.g. "After checkout the page shows 'Order confirmed' and the cart is empty".
   It updates the case and generates TC-006.
4. **Generated code (1 min):** open `tests/login.spec.ts` and `pages/LoginPage.ts`: Page Objects, one test per
   id, an `expect()` per expected result.
5. **Report (1 min):** open `reports/report.html`: counts, filters, a card per case with checks and script.
6. **Optional:** break a script (delete an `expect()`), run `npm run validate`, show it flagged INVALID.

## Likely questions
- **Does it run the tests?** No. There is no app, so scripts are validated statically (compile, collected,
  an assertion per expected result, no hard sleeps). Set `BASE_URL` and `npm test` to execute them.
- **Will the locators work on our app?** They are inferred from the wording and marked UNVERIFIED. Expect to
  adjust some. Running against the real app (with a grounding step) is the next phase.
- **What is the pass-rate target (X%)?** It cannot be measured without executing. The report gives valid
  scripts / clear cases, which is a different number; do not present it as a pass rate.
- **What if the CSV is vague?** It is flagged NEEDS CLARIFICATION and the agent asks. It never invents an expected result.
- **Other input formats?** One new adapter into the IR; nothing downstream changes.

## Say these limitations first
- POC: 5 sample cases + 1 deliberately vague; nothing executed.
- Valid != passes.
- Generated scripts should be reviewed before committing.
