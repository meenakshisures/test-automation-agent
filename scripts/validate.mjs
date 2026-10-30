#!/usr/bin/env node
/**
 * Layer 5 (deterministic): static validation of the generated Playwright scripts.
 *
 * No app is executed, so this proves the scripts are well-formed and tied to the stated expected
 * results - NOT that they pass against a real app. Checks per test case:
 *   1. a test titled with the testId exists in tests/*.spec.ts
 *   2. it compiles (tsc --noEmit, errors mapped to the test's line range)
 *   3. Playwright can collect it (playwright test --list)
 *   4. it has at least one expect() per IR "expected" entry
 *   5. it has no hard sleeps (waitForTimeout)
 *
 * Reads   ir/*.json, tests/*.spec.ts
 * Writes  reports/validation.json
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = {
  tsc: join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
  playwright: join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'),
};
const run = ([tool, ...args]) => spawnSync(process.execPath, [BIN[tool], ...args], { cwd: ROOT, encoding: 'utf8' });
const rel = (p) => relative(ROOT, p).split('\\').join('/');

/* ---- load IR + specs ---- */
const irs = readdirSync(join(ROOT, 'ir'))
  .filter((f) => f.endsWith('.json') && f !== 'schema.json')
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'ir', f), 'utf8')))
  .sort((a, b) => a.testId.localeCompare(b.testId, undefined, { numeric: true }));

const specDir = join(ROOT, 'tests');
const specFiles = existsSync(specDir) ? readdirSync(specDir).filter((f) => /\.spec\.ts$/.test(f)) : [];
const sources = Object.fromEntries(specFiles.map((f) => [`tests/${f}`, readFileSync(join(specDir, f), 'utf8')]));

/** Find `test('<id> ...', async (...) => { ... })` and return its body and line range. */
function findTest(id) {
  const re = new RegExp(`\\btest(?:\\.only)?\\s*\\(\\s*(['"\`])${id}\\b`);
  for (const [file, src] of Object.entries(sources)) {
    const m = re.exec(src);
    if (!m) continue;
    const arrow = src.indexOf('=>', m.index);
    const open = arrow === -1 ? -1 : src.indexOf('{', arrow);
    if (open === -1) continue;
    let depth = 0, end = -1, q = null;
    for (let i = open; i < src.length; i++) {
      const c = src[i], n = src[i + 1];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i === -1) break; continue; }
      if (c === '/' && n === '*') { i = src.indexOf('*/', i) + 1; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) { end = i; break; }
    }
    if (end === -1) continue;
    const line = (idx) => src.slice(0, idx).split('\n').length;
    return { file, body: src.slice(open, end + 1), startLine: line(m.index), endLine: line(end) };
  }
  return null;
}

/* ---- whole-project checks ---- */
const tsc = run(['tsc', '--noEmit', '-p', '.']);
const tscErrors = [...(tsc.stdout || '').matchAll(/^(.+?)\((\d+),\d+\): error (TS\d+): (.+)$/gm)].map((m) => ({
  file: m[1].split('\\').join('/'), line: Number(m[2]), code: m[3], message: m[4],
}));

const list = specFiles.length ? run(['playwright', 'test', '--list', '--reporter=json']) : { status: 0, stdout: '{}' };
const collected = new Set();
let listError = '';
try {
  const j = JSON.parse(list.stdout || '{}');
  (function walk(s) { (s.suites || []).forEach(walk); (s.specs || []).forEach((sp) => collected.add(sp.title)); })(j);
  if (j.errors?.length) listError = j.errors.map((e) => (e.message || '').split('\n')[0]).join('; ');
} catch { listError = (list.stderr || list.stdout || 'could not run playwright --list').split('\n')[0]; }

/* ---- per test case ---- */
const cases = irs.map((ir) => {
  const base = {
    testId: ir.testId, title: ir.title, source: ir.source,
    preconditions: ir.preconditions || [], steps: ir.steps || [], expected: (ir.expected || []).map((e) => e.description),
    questions: ir.clarificationQuestions || [], file: null, script: '', checks: [],
  };
  if (ir.needsClarification) return { ...base, status: 'NEEDS_CLARIFICATION' };
  if (ir.needsLlmNormalization) return { ...base, status: 'NOT_NORMALIZED' };

  const t = findTest(ir.testId);
  if (!t) return { ...base, status: 'NOT_GENERATED', checks: [{ name: 'Script exists', ok: false, detail: `no test titled "${ir.testId} ..." in tests/*.spec.ts` }] };

  const expects = (t.body.match(/\bexpect(?:\.soft)?\s*\(/g) || []).length;
  const sleeps = (t.body.match(/waitForTimeout\s*\(/g) || []).length;
  const mine = tscErrors.filter((e) => e.file === t.file && e.line >= t.startLine && e.line <= t.endLine);
  const imported = [...sources[t.file].matchAll(/from\s+['"]\.\.\/(pages\/[^'"]+)['"]/g)].map((m) => m[1] + '.ts');
  const other = tscErrors.filter((e) => !mine.includes(e) && (e.file === t.file || imported.includes(e.file)));
  const titleCollected = [...collected].some((c) => c.startsWith(ir.testId));
  const need = base.expected.length;

  const checks = [
    { name: 'Script exists', ok: true, detail: `${t.file}:${t.startLine}-${t.endLine}` },
    { name: 'Compiles (tsc)', ok: mine.length === 0 && other.length === 0, detail: mine.length ? mine.map((e) => `line ${e.line}: ${e.code} ${e.message}`).join(' | ') : other.length ? `${other.length} type error(s) in the same file or its page objects, first: ${other[0].file}:${other[0].line} ${other[0].message}` : 'no type errors' },
    { name: 'Collected by Playwright', ok: titleCollected && !listError, detail: listError || (titleCollected ? 'found by playwright test --list' : 'not listed') },
    { name: 'Assertion per expected result', ok: expects >= need, detail: `${expects} expect() for ${need} expected result(s)` },
    { name: 'No hard sleeps', ok: sleeps === 0, detail: sleeps ? `${sleeps} waitForTimeout call(s)` : 'none' },
  ];
  return { ...base, file: t.file, script: sources[t.file], checks, status: checks.every((c) => c.ok) ? 'VALID' : 'INVALID' };
});

const out = {
  generatedAt: new Date().toISOString(),
  executed: false,
  tsc: { ok: tscErrors.length === 0, errors: tscErrors.length },
  cases,
  summary: ['VALID', 'INVALID', 'NOT_GENERATED', 'NEEDS_CLARIFICATION', 'NOT_NORMALIZED'].reduce((o, k) => ({ ...o, [k]: cases.filter((c) => c.status === k).length }), { total: cases.length }),
};
mkdirSync(join(ROOT, 'reports'), { recursive: true });
writeFileSync(join(ROOT, 'reports', 'validation.json'), JSON.stringify(out, null, 2));

const s = out.summary;
console.log(`Validated ${s.total} case(s): ${s.VALID} valid, ${s.INVALID} invalid, ${s.NOT_GENERATED} not generated, ${s.NEEDS_CLARIFICATION} need clarification, ${s.NOT_NORMALIZED} not normalized.`);
for (const c of cases.filter((c) => c.status !== 'VALID')) {
  console.log(`  ${c.testId}  ${c.status}${c.checks.filter((k) => !k.ok).map((k) => `\n      x ${k.name}: ${k.detail}`).join('')}${c.questions.map((q) => `\n      ? ${q}`).join('')}`);
}
if (s.INVALID + s.NOT_GENERATED + s.NOT_NORMALIZED > 0) process.exitCode = 1;
