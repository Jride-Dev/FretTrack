import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const styles = read('src/styles.css');
const jobPrintSheet = read('src/modules/jobs/JobPrintSheet.js');
const printActions = read('src/modules/jobs/PrintActions.js');
const documentEmailDialog = read('src/modules/jobs/JobDocumentEmailDialog.jsx');
const printStyles = styles.slice(styles.indexOf('@media print'));

assert.ok(printStyles.startsWith('@media print'), 'Print stylesheet must exist.');
assert.ok(jobPrintSheet.includes('className="print-sheet job-sheet-print"'), 'Job Sheet must use the scoped print wrapper.');
assert.ok(printActions.includes('printJobSheet'), 'Job Sheet print action must remain available.');
assert.match(printStyles, /@page\s*{[\s\S]*size:\s*letter portrait;[\s\S]*margin:\s*0\.5in;/, 'Print pages must keep explicit Letter margins.');
assert.match(printStyles, /html,\s*body\s*{[\s\S]*background:\s*#fff\s*!important;[\s\S]*border:\s*0\s*!important;[\s\S]*margin:\s*0\s*!important;/, 'The print document canvas must be white and borderless.');
assert.match(printStyles, /\.job-sheet-print\s*{[\s\S]*background:\s*#fff\s*!important;[\s\S]*border:\s*0\s*!important;[\s\S]*margin:\s*0\s*!important;[\s\S]*max-width:\s*none;[\s\S]*padding:\s*0\s*!important;/, 'Job Sheet must not add a page frame or a second margin layer.');
assert.doesNotMatch(printStyles, /\.job-sheet-print\s*{[^}]*border:\s*1px\s+solid\s+#000/, 'Job Sheet must not receive a page-wide black border.');
assert.ok(documentEmailDialog.includes('Include with this email'), 'Document email selections must remain separate from print-page styling.');

console.log('Job Sheet print layout checks passed.');
