#!/usr/bin/env node
/**
 * Orchestrator (the deterministic backbone of the agent's pipeline):
 *   parse inputs -> run Playwright -> generate report.
 *
 * The LLM-driven stages (normalize prompts, generate new specs, analyze+heal
 * failures) are performed by the test-author subagent via its skills; this
 * script is the plumbing those stages hang off, and runs the parts that must
 * be deterministic. Non-zero exit if any test failed (so CI fails honestly).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const step = (label, cmd, args) => {
  console.log(`\n── ${label} ──`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status ?? 1;
};

step('1/3  Parse inputs -> IR', 'node', ['scripts/parse.mjs']);
// Tests may fail — that is expected input to the report, so don't abort here.
const testStatus = step('2/3  Execute Playwright specs', 'npx', ['playwright', 'test']);
step('3/3  Generate Markdown report', 'node', ['scripts/report.mjs']);

console.log(`\nDone. See reports/report.md (and \`npm run report:open\` for the HTML report).`);
process.exit(testStatus === 0 ? 0 : 1);
