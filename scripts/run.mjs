#!/usr/bin/env node
/**
 * Deterministic backbone of the pipeline: parse inputs -> validate generated scripts -> report.
 * The LLM-driven stages (normalize prompts, write Page Objects + specs, fix validation failures) are
 * done by the test-author agent in Copilot Chat between `parse` and `validate`.
 * Exit code is non-zero if any script is invalid or missing (so CI fails honestly).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const step = (label, args) => {
  console.log(`\n-- ${label} --`);
  return spawnSync('node', args, { cwd: ROOT, stdio: 'inherit' }).status ?? 1;
};

step('1/3  Parse inputs -> IR', ['scripts/parse.mjs', ...process.argv.slice(2)]);
const status = step('2/3  Validate generated scripts', ['scripts/validate.mjs']);
step('3/3  Report', ['scripts/report.mjs']);

console.log('\nDone. Open reports/report.html');
process.exit(status === 0 ? 0 : 1);
