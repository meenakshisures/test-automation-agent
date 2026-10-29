// Builds inputs/samples/testcases.pdf (a realistic written test-case document) for trying PDF input.
import { chromium } from '@playwright/test';
const html = `<html><body style="font-family:Arial;font-size:13px">
<h1>Meiden Dashboard - Test Cases</h1>
<p><b>TC-101</b> Reports menu expands</p>
<p>Preconditions: User is signed in.</p>
<p>Steps: 1. Open the Dashboard. 2. Click the expand arrow next to Reports in the sidebar.</p>
<p>Expected: The Reports submenu opens and shows more than one sub-link.</p>
<br/>
<p><b>TC-102</b> Production order search box accepts text</p>
<p>Preconditions: User is signed in.</p>
<p>Steps: 1. Open Production Orders. 2. Type 123 in the Search orders box.</p>
<p>Expected: The Search orders box contains the text 123.</p>
</body></html>`;
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(html);
await p.pdf({ path: 'inputs/samples/testcases.pdf', format: 'A4' });
await b.close();
console.log('wrote inputs/samples/testcases.pdf');
