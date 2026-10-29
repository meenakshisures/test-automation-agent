// Playwright reporter: rebuilds reports/report.md after EVERY run (npm test, npx playwright test, VS Code
// Test Explorer, the Copilot agent...), so the Markdown report can never be stale vs results.json.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export default class MarkdownReportReporter {
  // onExit runs after every other reporter (incl. the JSON one) has finished writing.
  async onExit() {
    const script = join(dirname(fileURLToPath(import.meta.url)), 'report.mjs');
    const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    if (r.error || r.stderr) console.error(`[md-reporter] report.mjs failed:\n${r.stderr || r.stdout}`);
  }
  printsToStdio() { return false; }
}
