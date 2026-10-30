---
agent: test-author
description: Convert every test case in inputs/ into validated Playwright scripts and report
---

Process every test case in `inputs/testcases.csv` and `inputs/prompts.txt`: parse to IR, ask me about
any ambiguous case, generate Page Objects and specs for the clear ones, validate them, fix validation
failures (max 3 attempts each), and give me the per-case report. Be explicit that nothing was executed.
