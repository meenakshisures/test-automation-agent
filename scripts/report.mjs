#!/usr/bin/env node
/**
 * Layer 7 (deterministic): one consolidated report from reports/validation.json.
 * Every test case appears with its status and reason - nothing is silently skipped.
 * The scripts are validated statically; the report says so explicitly (they were NOT run against an app).
 *
 * Reads   reports/validation.json
 * Writes  reports/report.html (open this)  and  reports/report.md
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'reports', 'validation.json');
if (!existsSync(SRC)) {
  console.error('No reports/validation.json - run `npm run validate` first.');
  process.exit(1);
}
const v = JSON.parse(readFileSync(SRC, 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const META = {
  VALID: { label: 'VALID', cls: 'pass', icon: '✅' },
  INVALID: { label: 'INVALID', cls: 'fail', icon: '❌' },
  NOT_GENERATED: { label: 'NOT GENERATED', cls: 'fail', icon: '❌' },
  NOT_NORMALIZED: { label: 'NOT NORMALIZED', cls: 'fail', icon: '❌' },
  NEEDS_CLARIFICATION: { label: 'NEEDS CLARIFICATION', cls: 'ask', icon: '❓' },
};
const order = ['INVALID', 'NOT_GENERATED', 'NOT_NORMALIZED', 'NEEDS_CLARIFICATION', 'VALID'];
const cases = [...v.cases].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
const s = v.summary;
const considered = s.total - s.NEEDS_CLARIFICATION;
const rate = considered ? Math.round((s.VALID / considered) * 100) : 0;
const bad = s.INVALID + s.NOT_GENERATED + s.NOT_NORMALIZED;
const failReason = (c) => c.checks.filter((k) => !k.ok).map((k) => `${k.name}: ${k.detail}`).join(' | ') || c.questions.join(' | ') || '-';

/* ---------------- Markdown ---------------- */
let md = `# Test Automation Agent - Validation Report\n\n`;
md += `_Generated ${v.generatedAt}_\n\n`;
md += `> **The scripts were not executed against any application.** "Valid" means each script compiles, is collected by Playwright, has an assertion for every expected result and has no hard sleeps. It does not prove the locators match a real app.\n\n`;
md += `| Total | ✅ Valid | ❌ Invalid / missing | ❓ Need clarification | Valid rate* |\n|:--:|:--:|:--:|:--:|:--:|\n`;
md += `| ${s.total} | ${s.VALID} | ${bad} | ${s.NEEDS_CLARIFICATION} | **${rate}%** |\n\n`;
md += `*Valid scripts out of the ${considered} cases that were clear enough to generate.\n\n`;
md += `| Status | ID | Test case | Script | Why |\n|:--:|----|-----------|--------|-----|\n`;
for (const c of cases) md += `| ${META[c.status].icon} | ${c.testId} | ${c.title.replace(/\|/g, '/')} | ${c.file ? '`' + c.file + '`' : '-'} | ${failReason(c).replace(/\|/g, '/')} |\n`;
md += `\n## Case detail\n`;
for (const c of cases) {
  md += `\n### ${META[c.status].icon} ${c.testId} - ${c.title}\n\n- **Status:** ${META[c.status].label}\n`;
  if (c.preconditions.length) md += `- **Preconditions:** ${c.preconditions.join('; ')}\n`;
  if (c.steps.length) md += `- **Steps:** ${c.steps.map((x, i) => `${i + 1}. ${x}`).join(' ')}\n`;
  if (c.expected.length) md += `- **Expected:** ${c.expected.join('; ')}\n`;
  for (const k of c.checks) md += `- ${k.ok ? '✅' : '❌'} ${k.name}: ${k.detail}\n`;
  for (const q of c.questions) md += `- ❓ ${q}\n`;
}
writeFileSync(join(ROOT, 'reports', 'report.md'), md);

/* ---------------- HTML ---------------- */
const tile = (n, l, cls) => `<div class="tile ${cls}"><b>${n}</b><span>${l}</span></div>`;
const cards = cases.map((c) => {
  const m = META[c.status];
  return `<details class="case ${m.cls}" data-status="${m.cls}" ${c.status !== 'VALID' ? 'open' : ''}>
<summary><span class="badge ${m.cls}">${m.label}</span> <b>${esc(c.testId)}</b> ${esc(c.title)}</summary>
<div class="body">
<table class="kv">
${c.file ? `<tr><th>Script</th><td><code>${esc(c.file)}</code></td></tr>` : ''}
${c.preconditions.length ? `<tr><th>Preconditions</th><td>${c.preconditions.map(esc).join('<br>')}</td></tr>` : ''}
${c.steps.length ? `<tr><th>Steps</th><td><ol>${c.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></td></tr>` : ''}
${c.expected.length ? `<tr><th>Expected</th><td><ul>${c.expected.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></td></tr>` : ''}
${c.checks.length ? `<tr><th>Checks</th><td><ul class="checks">${c.checks.map((k) => `<li class="${k.ok ? 'ok' : 'bad'}"><b>${k.ok ? '✓' : '✗'} ${esc(k.name)}</b> - ${esc(k.detail)}</li>`).join('')}</ul></td></tr>` : ''}
${c.questions.length ? `<tr><th>Question for you</th><td>${c.questions.map((q) => `<div class="q">${esc(q)}</div>`).join('')}</td></tr>` : ''}
</table>
${c.script ? `<details><summary>Generated script (${esc(c.file)})</summary><pre class="code">${esc(c.script)}</pre></details>` : ''}
</div></details>`;
}).join('\n');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Validation Report</title><style>
:root{--bg:#f6f7f9;--card:#fff;--fg:#1c2330;--mut:#667085;--bd:#e3e6ec;--pass:#15803d;--fail:#b42318;--ask:#b45309;--code:#f0f2f6;--warn:#fff7e6}
@media(prefers-color-scheme:dark){:root{--bg:#12151b;--card:#1b2029;--fg:#e6e9ef;--mut:#98a2b3;--bd:#2c3340;--pass:#4ade80;--fail:#f87171;--ask:#fbbf24;--code:#232a35;--warn:#2a2415}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,Segoe UI,sans-serif;padding:24px 16px}
main{max-width:1000px;margin:0 auto}h1{margin:0 0 4px;font-size:22px}.sub{color:var(--mut);margin-bottom:12px}
.note{background:var(--warn);border:1px solid var(--ask);border-radius:10px;padding:10px 14px;margin-bottom:14px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px}
.tile{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:12px;border-top:4px solid var(--bd)}
.tile b{display:block;font-size:26px}.tile span{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.tile.pass{border-top-color:var(--pass)}.tile.fail{border-top-color:var(--fail)}.tile.ask{border-top-color:var(--ask)}
.filters{display:flex;gap:8px;margin:12px 0;flex-wrap:wrap}.filters button{border:1px solid var(--bd);background:var(--card);color:var(--fg);padding:5px 12px;border-radius:999px;cursor:pointer}.filters button.on{background:var(--fg);color:var(--bg)}
.case{background:var(--card);border:1px solid var(--bd);border-left:5px solid var(--bd);border-radius:10px;margin-bottom:10px}
.case.pass{border-left-color:var(--pass)}.case.fail{border-left-color:var(--fail)}.case.ask{border-left-color:var(--ask)}
.case>summary{padding:12px 14px;cursor:pointer;list-style:none}.body{padding:0 14px 14px}
.badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;color:#fff;margin-right:6px}
.badge.pass{background:var(--pass)}.badge.fail{background:var(--fail)}.badge.ask{background:var(--ask)}
.kv{border-collapse:collapse;width:100%}.kv th{text-align:left;color:var(--mut);font-weight:600;padding:4px 12px 4px 0;vertical-align:top;white-space:nowrap}.kv td{padding:4px 0}
.kv ol,.kv ul{margin:0;padding-left:18px}.checks{list-style:none!important;padding:0!important}.checks .ok b{color:var(--pass)}.checks .bad b{color:var(--fail)}
.q{background:var(--warn);border-left:4px solid var(--ask);padding:6px 10px;border-radius:6px;margin-bottom:4px}
pre{background:var(--code);padding:10px;border-radius:8px;overflow:auto;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:380px}code{background:var(--code);padding:1px 5px;border-radius:4px}
</style></head><body><main>
<h1>Validation Report</h1>
<div class="sub">${esc(new Date(v.generatedAt).toLocaleString())}</div>
<div class="note"><b>Not executed.</b> These scripts were generated from the CSV and checked statically (compiles, collected by Playwright, an assertion for every expected result, no hard sleeps). They were <b>not run against an application</b>, so a "valid" script is not proof that its locators match a real page.</div>
<div class="tiles">${tile(s.total, 'Total', '')}${tile(s.VALID, 'Valid', 'pass')}${tile(bad, 'Invalid / missing', 'fail')}${tile(s.NEEDS_CLARIFICATION, 'Need clarification', 'ask')}${tile(rate + '%', 'Valid rate*', rate === 100 ? 'pass' : 'fail')}</div>
<div class="sub">*Valid scripts out of the ${considered} cases that were clear enough to generate.</div>
<div class="filters">${[['all', 'All'], ['fail', 'Invalid'], ['ask', 'Need clarification'], ['pass', 'Valid']].map(([f, l], i) => `<button class="${i ? '' : 'on'}" data-f="${f}">${l}</button>`).join('')}</div>
${cards}
</main><script>
document.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filters button').forEach(x=>x.classList.toggle('on',x===b));
document.querySelectorAll('.case').forEach(c=>c.style.display=(b.dataset.f==='all'||c.dataset.status===b.dataset.f)?'':'none')});
</script></body></html>`;
writeFileSync(join(ROOT, 'reports', 'report.html'), html);

console.log(`Wrote reports/report.html + report.md - ${s.VALID}/${considered} clear cases valid (${rate}%), ${s.NEEDS_CLARIFICATION} need clarification, ${bad} invalid/missing.`);
