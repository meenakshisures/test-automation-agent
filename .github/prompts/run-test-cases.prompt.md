---
agent: test-author
description: Generate, run and report Playwright tests for all cases in inputs/
---

Process every test case in `inputs/testcases.csv` and `inputs/prompts.txt`: parse to IR, generate
any missing specs, run them, self-heal failures (max 3 attempts each), and give me the per-case
report with the real pass rate.
