#!/usr/bin/env node
/**
 * Layer 1-2 (deterministic part): normalize raw inputs into Test Case IR.
 *
 *   - inputs/testcases.csv  -> fully normalized IR (one JSON file per row)
 *   - inputs/prompts.txt    -> stub IR flagged needsLlmNormalization=true
 *                              (the test-case-parser skill / LLM finishes these)
 *
 * No third-party deps: a correct CSV reader (handles quotes + embedded newlines)
 * is implemented inline so the POC installs only Playwright.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

try { process.loadEnvFile(); } catch {}
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IR_DIR = join(ROOT, 'ir');
const APP = process.env.APP || 'app';

mkdirSync(IR_DIR, { recursive: true });

/** RFC-4180-ish CSV parser: quotes, escaped quotes, commas + newlines in quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const HEADER_MAP = {
  testid: 'testId', id: 'testId',
  title: 'title', summary: 'title', name: 'title',
  preconditions: 'preconditions', precondition: 'preconditions', setup: 'preconditions',
  steps: 'steps', step: 'steps',
  testdata: 'testData', data: 'testData',
  expectedresult: 'expected', expectedresults: 'expected', expected: 'expected',
  priority: 'priority', tags: 'tags',
};
const normKey = (h) => h.trim().toLowerCase().replace(/[^a-z]/g, '');

/** Split a multi-step cell: numbered list, newlines, or semicolons. */
function splitList(s) {
  if (!s) return [];
  return s
    .split(/\r?\n|;\s*/)
    .map((x) => x.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

/** Parse "key=value; key2=value2" into an object; fall back to { _raw }. */
function parseData(s) {
  if (!s || !s.trim()) return {};
  if (!s.includes('=')) return { _raw: s.trim() };
  const out = {};
  for (const pair of s.split(/;|\n/)) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return out;
}

/** An expected result that cannot be turned into an assertion ("it works", "is correct"). */
const VAGUE = /^(it|this|that|everything|the (page|app|feature|system))?\s*(should\s+)?(works?|is working|is ok(ay)?|is fine|is correct|is right|succeeds|passes|behaves (correctly|properly))\.?$/i;

function clarificationsFor(id, steps, expected) {
  const q = [];
  if (!steps.length) q.push(`${id}: no steps given. What does the user do?`);
  if (!expected.length) q.push(`${id}: no expected result given. What should be true afterwards?`);
  for (const e of expected) {
    if (VAGUE.test(e.description.trim())) {
      q.push(`${id}: "${e.description}" cannot be checked. What exactly should the user see (text, URL, element, count)?`);
    }
  }
  return q;
}

function csvToIr(rows) {
  const headers = rows[0].map(normKey).map((k) => HEADER_MAP[k] || k);
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const rec = {};
    headers.forEach((h, c) => (rec[h] = (rows[r][c] ?? '').trim()));

    const expected = splitList(rec.expected).map((d) => ({ description: d }));
    const testId = rec.testId || `TC-${String(r).padStart(3, '0')}`;
    const steps = splitList(rec.steps);
    const questions = clarificationsFor(testId, steps, expected);
    records.push({
      testId,
      title: rec.title || '(untitled)',
      source: 'csv',
      app: APP,
      priority: (rec.priority || 'medium').toLowerCase(),
      preconditions: splitList(rec.preconditions),
      steps: steps.length ? steps : ['(no steps provided)'],
      testData: parseData(rec.testData),
      expected: expected.length ? expected : [{ description: '(no expected result provided)' }],
      tags: splitList(rec.tags),
      needsClarification: questions.length > 0,
      ...(questions.length ? { clarificationQuestions: questions } : {}),
    });
  }
  return records;
}

function promptsToIr(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  return lines.map((line, i) => ({
    testId: `PR-${String(i + 1).padStart(3, '0')}`,
    title: line,
    source: 'prompt',
    app: APP,
    priority: 'medium',
    preconditions: [],
    steps: [line],
    testData: {},
    expected: [{ description: 'Derived by LLM from the prompt' }],
    tags: [],
    // The deterministic parser cannot reliably decompose free text; hand off to the LLM skill.
    needsLlmNormalization: true,
  }));
}

function write(records) {
  for (const ir of records) {
    // Never clobber an IR the LLM parser already normalized with a fresh stub.
    const file = join(IR_DIR, `${ir.testId}.json`);
    if (ir.needsLlmNormalization && existsSync(file) && !JSON.parse(readFileSync(file, 'utf8')).needsLlmNormalization) continue;
    writeFileSync(join(IR_DIR, `${ir.testId}.json`), JSON.stringify(ir, null, 2) + '\n');
  }
  return records.length;
}

/** PDF -> text (kept in inputs/extracted/ for traceability) -> one stub per detected test-case block. */
async function pdfToIr(file) {
  const { createRequire } = await import('node:module');
  const pdfParse = createRequire(import.meta.url)('pdf-parse/lib/pdf-parse.js');
  const { text } = await pdfParse(readFileSync(file));
  const name = basename(file).replace(/\.pdf$/i, '');
  mkdirSync(join(ROOT, 'inputs', 'extracted'), { recursive: true });
  writeFileSync(join(ROOT, 'inputs', 'extracted', `${name}.txt`), text);

  // Split on lines that start a test case ("TC-001", "TC_12", "Test Case 3", ...).
  const start = /^\s*(?:test\s*case\s*#?\s*|TC[-_ ]?|TEST[-_ ]?)(\d+)\b/i;
  const lines = text.split(/\r?\n/);
  const blocks = [];
  for (const line of lines) {
    const m = line.match(start);
    if (m) blocks.push({ id: `TC-${m[1].padStart(3, '0')}`, lines: [line] });
    else if (blocks.length) blocks[blocks.length - 1].lines.push(line);
  }
  const make = (id, body) => ({
    testId: id,
    title: body.split(/\r?\n/).find((l) => l.trim())?.trim().slice(0, 140) || id,
    source: 'pdf',
    app: APP,
    priority: 'medium',
    preconditions: [],
    steps: ['(see rawText)'],
    testData: {},
    expected: [{ description: 'Derived by LLM from rawText' }],
    tags: [],
    rawText: body.trim(),
    needsLlmNormalization: true,
  });
  if (!blocks.length) return [make(`PDF-${name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20)}`, text)];
  return blocks.map((b) => make(b.id, b.lines.join('\n')));
}

let total = 0;
const arg = process.argv[2];

if (arg) {
  // npm run parse -- path/to/file.(csv|pdf|txt)
  const file = resolve(arg);
  if (!existsSync(file)) { console.error(`File not found: ${file}`); process.exit(1); }
  const ext = extname(file).toLowerCase();
  let recs;
  if (ext === '.csv') recs = csvToIr(parseCsv(readFileSync(file, 'utf8')));
  else if (ext === '.pdf') recs = await pdfToIr(file);
  else if (ext === '.txt') recs = promptsToIr(readFileSync(file, 'utf8'));
  else { console.error(`Unsupported file type "${ext}". Use .csv, .pdf or .txt`); process.exit(1); }
  // IDs must not silently overwrite a different case already in ir/.
  for (const r of recs) {
    const f = join(IR_DIR, `${r.testId}.json`);
    if (existsSync(f) && JSON.parse(readFileSync(f, 'utf8')).title !== r.title && !process.env.OVERWRITE) {
      const old = r.testId;
      r.testId = `${old}-${ext.slice(1).toUpperCase()}`;
      console.log(`  ${old} already exists with a different title -> saved as ${r.testId}`);
    }
  }
  total = write(recs);
  console.log(`${ext.slice(1).toUpperCase()} (${basename(file)}) -> ${total} IR files`);
} else {
  const csvPath = join(ROOT, 'inputs', 'testcases.csv');
  if (existsSync(csvPath)) {
    const n = write(csvToIr(parseCsv(readFileSync(csvPath, 'utf8'))));
    console.log(`CSV  -> ${n} IR files`);
    total += n;
  }
  const promptPath = join(ROOT, 'inputs', 'prompts.txt');
  if (existsSync(promptPath)) {
    const n = write(promptsToIr(readFileSync(promptPath, 'utf8')));
    console.log(`Prompts -> ${n} IR stubs (needsLlmNormalization)`);
    total += n;
  }
  // Any PDF dropped directly in inputs/ is treated as a written test-case document.
  for (const f of readdirSync(join(ROOT, 'inputs')).filter((f) => /\.pdf$/i.test(f))) {
    const n = write(await pdfToIr(join(ROOT, 'inputs', f)));
    console.log(`PDF (${f}) -> ${n} IR stubs (needsLlmNormalization)`);
    total += n;
  }
}
console.log(`\nWrote ${total} test case(s) to ir/. Normalized CSV is generation-ready; prompt/PDF stubs await the LLM parser.`);
