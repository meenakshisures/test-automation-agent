#!/usr/bin/env node
/**
 * Layer 7 (deterministic): turn Playwright's JSON result into a per-test-case report.
 * Status is never swallowed: every spec appears with its status, steps/expected (from the IR),
 * the generated script, screenshot, trace/video, and the full error on failure.
 *
 * Reads   reports/results.json, ir/*.json, tests/*.spec.ts, artifacts/
 * Writes  reports/report.html   self-contained (screenshots embedded) - open this one
 *         reports/report.md     same content as Markdown
 *         reports/evidence/<id>/  copies of screenshots/traces/videos (artifacts/ is wiped each run)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname, relative, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = join(ROOT, 'reports');
const RESULTS = join(REPORTS, 'results.json');
const EVIDENCE = join(REPORTS, 'evidence');

if (!existsSync(RESULTS)) {
  console.error(`No results at ${relative(ROOT, RESULTS)} - run \`npm test\` first.`);
  process.exit(1);
}

const data = JSON.parse(readFileSync(RESULTS, 'utf8'));
const ANSI = /\u001b\[[0-9;]*m/g;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
const rel = (p) => relative(REPORTS, p).split('\\').join('/');

rmSync(EVIDENCE, { recursive: true, force: true });
const specs = [];
let auth = null;

/** Copy an attachment into reports/evidence/<id>/ so it outlives the next run. */
function keep(id, att, attempt) {
  if (!att.path || !existsSync(att.path)) return null;
  const dir = join(EVIDENCE, slug(id));
  mkdirSync(dir, { recursive: true });
  const name = `${attempt > 0 ? `retry${attempt}-` : ''}${att.name}${extname(att.path)}`;
  const dest = join(dir, name);
  copyFileSync(att.path, dest);
  return { name: att.name, attempt, path: dest, type: att.contentType || '' };
}

function walk(suite) {
  for (const s of suite.suites || []) walk(s);
  for (const spec of suite.specs || []) {
    const test = spec.tests?.[0];
    const results = test?.results || [];
    const last = results[results.length - 1];
    const file = spec.file || suite.file || '';
    if (/\.setup\.ts$/.test(file)) {
      auth = { outcome: last?.status || 'unknown', durationMs: last?.duration || 0, error: (last?.error?.message || '').replace(ANSI, '') };
      return;
    }
    const testId = (spec.title.match(/^([A-Z]+-\d+(?:-[A-Z]+)?)\b/) || [])[1] || slug(spec.title);
    const evidence = [];
    results.forEach((r, i) => (r.attachments || []).forEach((a) => { const k = keep(testId, a, i); if (k) evidence.push(k); }));

    let ir = null;
    const irFile = join(ROOT, 'ir', `${testId}.json`);
    if (existsSync(irFile)) ir = JSON.parse(readFileSync(irFile, 'utf8'));

    const specPath = join(ROOT, 'tests', basename(file));
    specs.push({
      testId,
      title: spec.title.replace(new RegExp(`^${testId}\\s*`), '') || spec.title,
      file: `tests/${basename(file)}`,
      source: existsSync(specPath) ? readFileSync(specPath, 'utf8') : '',
      status: test?.status || 'unknown', // expected | unexpected | flaky | skipped
      outcome: last?.status || 'unknown', // passed | failed | timedOut | skipped
      durationMs: results.reduce((t, r) => t + (r.duration || 0), 0),
      attempts: results.length || 1,
      error: (last?.error?.message || '').replace(ANSI, ''),
      stdout: (last?.stdout || []).map((o) => o.text || '').join(''),
      evidence,
      ir,
    });
  }
}
for (const s of data.suites || []) walk(s);

const isFail = (s) => s.outcome === 'failed' || s.outcome === 'timedOut';
const pass = specs.filter((s) => s.outcome === 'passed' && s.status !== 'flaky').length;
const flaky = specs.filter((s) => s.status === 'flaky').length;
const fail = specs.filter(isFail).length;
const skipped = specs.filter((s) => s.outcome === 'skipped').length;
const total = specs.length;
const rate = total ? Math.round(((pass + flaky) / total) * 100) : 0;
const started = data.stats?.startTime ? new Date(data.stats.startTime) : new Date();
const wall = ((data.stats?.duration || 0) / 1000).toFixed(1);
const baseURL = data.config?.projects?.[0]?.use?.baseURL || process.env.BASE_URL || '';

// failed first, then flaky, then passed
const rank = (s) => (isFail(s) ? 0 : s.status === 'flaky' ? 1 : s.outcome === 'skipped' ? 2 : 3);
specs.sort((a, b) => rank(a) - rank(b) || a.testId.localeCompare(b.testId));

const label = (s) => (isFail(s) ? (s.outcome === 'timedOut' ? 'TIMED OUT' : 'FAILED') : s.status === 'flaky' ? 'FLAKY (passed on retry)' : s.outcome === 'skipped' ? 'SKIPPED' : 'PASSED');
const icon = (s) => (isFail(s) ? '❌' : s.status === 'flaky' ? '⚠️' : s.outcome === 'skipped' ? '⚪' : '✅');
const shots = (s) => s.evidence.filter((e) => e.type.startsWith('image/'));
const finalShot = (s) => shots(s).slice(-1)[0];
const dataUri = (e) => `data:${e.type};base64,${readFileSync(e.path).toString('base64')}`;
const firstLine = (s) => (s.error.split('\n').find((l) => l.trim()) || '').trim();
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

/* ---------------- Markdown ---------------- */
let md = `# Test Automation Agent - Run Report\n\n`;
md += `_Run started ${started.toISOString()} · ${wall}s wall time · target ${baseURL || 'n/a'}_\n\n`;
md += `| Total | ✅ Passed | ❌ Failed | ⚠️ Flaky | ⚪ Skipped | Pass rate |\n|:--:|:--:|:--:|:--:|:--:|:--:|\n`;
md += `| ${total} | ${pass} | ${fail} | ${flaky} | ${skipped} | **${rate}%** |\n\n`;
if (auth) md += `Sign-in (Microsoft SSO / MFA): ${auth.outcome === 'passed' ? '✅ passed' : `❌ ${auth.outcome} - ${firstLine({ error: auth.error })}`} (${secs(auth.durationMs)})\n\n`;
md += `| Status | ID | Test case | Duration | Attempts | Screenshot | Trace | Reason |\n|:--:|----|-----------|---------:|:--:|:--:|:--:|--------|\n`;
for (const s of specs) {
  const sh = finalShot(s), tr = s.evidence.find((e) => e.name === 'trace'), vid = s.evidence.find((e) => e.name === 'video');
  md += `| ${icon(s)} | ${s.testId} | ${s.title.replace(/\|/g, '\\|')} | ${secs(s.durationMs)} | ${s.attempts} | ${sh ? `[png](${rel(sh.path)})` : '-'} | ${[tr && `[trace](${rel(tr.path)})`, vid && `[video](${rel(vid.path)})`].filter(Boolean).join(' ') || '-'} | ${firstLine(s).replace(/\|/g, '\\|') || '-'} |\n`;
}
md += `\n## Case detail\n`;
for (const s of specs) {
  md += `\n### ${icon(s)} ${s.testId} - ${s.title}\n\n- **Status:** ${label(s)} · ${secs(s.durationMs)} · ${s.attempts} attempt(s)\n- **Generated script:** \`${s.file}\`\n`;
  if (s.ir?.preconditions?.length) md += `- **Preconditions:** ${s.ir.preconditions.join('; ')}\n`;
  if (s.ir?.steps?.length) md += `- **Steps:** ${s.ir.steps.map((x, i) => `${i + 1}. ${x}`).join(' ')}\n`;
  if (s.ir?.expected?.length) md += `- **Expected:** ${s.ir.expected.map((e) => e.description).join('; ')}\n`;
  if (isFail(s)) md += `- **Failure reason:**\n\n\`\`\`\n${s.error.trim()}\n\`\`\`\n`;
  const sh = finalShot(s);
  if (sh) md += `\n![${s.testId} screenshot](${rel(sh.path)})\n`;
  for (const e of s.evidence.filter((e) => !e.type.startsWith('image/'))) md += `- ${e.name}${e.attempt ? ` (retry ${e.attempt})` : ''}: \`${rel(e.path)}\`\n`;
}
md += `\n---\nTraces: \`npx playwright show-trace reports/evidence/<id>/trace.zip\` · Interactive report: \`npm run report:open\` · HTML version of this report: \`reports/report.html\`\n`;
writeFileSync(join(REPORTS, 'report.md'), md);

/* ---------------- HTML ---------------- */
const tile = (n, l, c) => `<div class="tile ${c}"><b>${n}</b><span>${l}</span></div>`;
const cards = specs.map((s) => {
  const cls = isFail(s) ? 'fail' : s.status === 'flaky' ? 'flaky' : s.outcome === 'skipped' ? 'skip' : 'pass';
  const sh = finalShot(s);
  const others = s.evidence.filter((e) => !e.type.startsWith('image/'));
  const earlier = shots(s).filter((e) => e !== sh);
  return `<details class="case ${cls}" data-status="${cls}" ${isFail(s) ? 'open' : ''}>
<summary><span class="badge ${cls}">${label(s)}</span> <b>${esc(s.testId)}</b> ${esc(s.title)} <span class="meta">${secs(s.durationMs)} · ${s.attempts} attempt${s.attempts > 1 ? 's' : ''}</span></summary>
<div class="body">
<div class="cols"><div>
<table class="kv">
<tr><th>Script</th><td><code>${esc(s.file)}</code></td></tr>
${s.ir?.preconditions?.length ? `<tr><th>Preconditions</th><td>${s.ir.preconditions.map(esc).join('<br>')}</td></tr>` : ''}
${s.ir?.steps?.length ? `<tr><th>Steps</th><td><ol>${s.ir.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></td></tr>` : ''}
${s.ir?.expected?.length ? `<tr><th>Expected</th><td><ul>${s.ir.expected.map((e) => `<li>${esc(e.description)}</li>`).join('')}</ul></td></tr>` : ''}
${others.length ? `<tr><th>Artifacts</th><td>${others.map((e) => `<a href="${rel(e.path)}">${esc(e.name)}${e.attempt ? ` (retry ${e.attempt})` : ''}</a>`).join(' · ')}</td></tr>` : ''}
</table>
${isFail(s) ? `<h4>Failure reason</h4><pre class="err">${esc(s.error.trim())}</pre>` : ''}
${s.stdout ? `<h4>Console output</h4><pre>${esc(s.stdout.trim())}</pre>` : ''}
<details><summary>Generated script source</summary><pre class="code">${esc(s.source)}</pre></details>
</div>
<div class="shot">${sh ? `<a href="${rel(sh.path)}" target="_blank"><img alt="${esc(s.testId)} screenshot" src="${dataUri(sh)}"></a><small>${isFail(s) ? 'Screenshot at failure' : 'Final state screenshot'}</small>` : '<small>No screenshot captured</small>'}
${earlier.map((e) => `<a href="${rel(e.path)}" target="_blank"><img class="thumb" alt="earlier attempt" src="${dataUri(e)}"></a>`).join('')}</div></div>
</div></details>`;
}).join('\n');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test Run Report</title><style>
:root{--bg:#f6f7f9;--card:#fff;--fg:#1c2330;--mut:#667085;--bd:#e3e6ec;--pass:#15803d;--fail:#b42318;--flaky:#b45309;--skip:#667085;--code:#f0f2f6}
@media(prefers-color-scheme:dark){:root{--bg:#12151b;--card:#1b2029;--fg:#e6e9ef;--mut:#98a2b3;--bd:#2c3340;--pass:#4ade80;--fail:#f87171;--flaky:#fbbf24;--skip:#98a2b3;--code:#232a35}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,Segoe UI,sans-serif;padding:24px 16px}
main{max-width:1100px;margin:0 auto}h1{margin:0 0 4px;font-size:22px}.sub{color:var(--mut);margin-bottom:16px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px}
.tile{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:12px;border-top:4px solid var(--bd)}
.tile b{display:block;font-size:26px}.tile span{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.tile.pass{border-top-color:var(--pass)}.tile.fail{border-top-color:var(--fail)}.tile.flaky{border-top-color:var(--flaky)}.tile.skip{border-top-color:var(--skip)}
.bar{height:10px;border-radius:6px;background:var(--bd);overflow:hidden;display:flex;margin:6px 0 14px}.bar i{display:block}
.auth{margin-bottom:14px;color:var(--mut)}.filters{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.filters button{border:1px solid var(--bd);background:var(--card);color:var(--fg);padding:5px 12px;border-radius:999px;cursor:pointer}.filters button.on{background:var(--fg);color:var(--bg)}
.case{background:var(--card);border:1px solid var(--bd);border-left:5px solid var(--bd);border-radius:10px;margin-bottom:10px}
.case.pass{border-left-color:var(--pass)}.case.fail{border-left-color:var(--fail)}.case.flaky{border-left-color:var(--flaky)}.case.skip{border-left-color:var(--skip)}
.case>summary{padding:12px 14px;cursor:pointer;list-style:none}.meta{color:var(--mut);float:right;font-size:12px}
.badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;color:#fff;margin-right:6px}
.badge.pass{background:var(--pass)}.badge.fail{background:var(--fail)}.badge.flaky{background:var(--flaky)}.badge.skip{background:var(--skip)}
.body{padding:0 14px 14px}.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,420px);gap:16px}@media(max-width:800px){.cols{grid-template-columns:1fr}}
.kv{border-collapse:collapse;width:100%}.kv th{text-align:left;color:var(--mut);font-weight:600;padding:4px 10px 4px 0;vertical-align:top;white-space:nowrap}.kv td{padding:4px 0}
.kv ol,.kv ul{margin:0;padding-left:18px}pre{background:var(--code);padding:10px;border-radius:8px;overflow:auto;font-size:12px;white-space:pre-wrap;word-break:break-word}
pre.err{border-left:4px solid var(--fail)}pre.code{max-height:360px}h4{margin:12px 0 4px}code{background:var(--code);padding:1px 5px;border-radius:4px}
.shot img{width:100%;border:1px solid var(--bd);border-radius:8px}.shot img.thumb{width:90px;margin:6px 6px 0 0}.shot small{color:var(--mut)}a{color:#2563eb}
</style></head><body><main>
<h1>Test Run Report</h1>
<div class="sub">${started.toLocaleString()} · ${wall}s wall time · ${esc(baseURL)}</div>
<div class="tiles">${tile(total, 'Total', '')}${tile(pass, 'Passed', 'pass')}${tile(fail, 'Failed', 'fail')}${tile(flaky, 'Flaky', 'flaky')}${tile(skipped, 'Skipped', 'skip')}${tile(rate + '%', 'Pass rate', rate === 100 ? 'pass' : 'fail')}</div>
<div class="bar"><i style="width:${total ? (pass / total) * 100 : 0}%;background:var(--pass)"></i><i style="width:${total ? (flaky / total) * 100 : 0}%;background:var(--flaky)"></i><i style="width:${total ? (fail / total) * 100 : 0}%;background:var(--fail)"></i><i style="width:${total ? (skipped / total) * 100 : 0}%;background:var(--skip)"></i></div>
${auth ? `<div class="auth">Sign-in (Microsoft SSO / MFA): <b style="color:var(--${auth.outcome === 'passed' ? 'pass' : 'fail'})">${esc(auth.outcome)}</b> in ${secs(auth.durationMs)}${auth.outcome === 'passed' ? '' : ' - ' + esc(firstLine({ error: auth.error }))}</div>` : ''}
<div class="filters">${['all', 'fail', 'flaky', 'pass', 'skip'].map((f, i) => `<button class="${i ? '' : 'on'}" data-f="${f}">${f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>
${cards}
</main><script>
document.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filters button').forEach(x=>x.classList.toggle('on',x===b));
document.querySelectorAll('.case').forEach(c=>c.style.display=(b.dataset.f==='all'||c.dataset.status===b.dataset.f)?'':'none')});
</script></body></html>`;
writeFileSync(join(REPORTS, 'report.html'), html);

console.log(`Wrote reports/report.html + report.md - ${pass + flaky}/${total} passed (${rate}%), ${fail} failed, ${flaky} flaky, ${skipped} skipped.`);
if (fail > 0) process.exitCode = 1;
