#!/usr/bin/env node
/**
 * One-off helper: records the LLM-normalized IR for the prompt stubs written by parse.mjs.
 * (In normal use the test-case-parser skill does this step; this keeps the POC reproducible offline.)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const fill = (id, preconditions, steps, expected, tags) => {
  const path = `ir/${id}.json`;
  const ir = JSON.parse(readFileSync(path, 'utf8'));
  Object.assign(ir, { preconditions, steps, expected: expected.map((description) => ({ description })), tags, needsClarification: false });
  delete ir.needsLlmNormalization;
  writeFileSync(path, JSON.stringify(ir, null, 2) + '\n');
};

fill('PR-001', ['User is not signed in'], ['Open the login page'],
  ['The Welcome Back heading is visible', 'The Sign in with Microsoft button is visible and enabled'], ['login', 'unauthenticated']);
fill('PR-002', ['User is signed in'], ['Open the Settings page'],
  ['The Users section heading is visible', 'A Search users box is visible', 'An Add New User button is visible'], ['settings']);
fill('PR-003', ['User is signed in'], ['Open the Lookup page'],
  ['Radio options for production order, purchase order and customer name are visible', 'Production order is selected by default'], ['lookup']);
