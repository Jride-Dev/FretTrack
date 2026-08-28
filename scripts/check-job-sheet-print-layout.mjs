import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const styles = read('src/styles.css');
const documentStyles = read('src/modules/print/PrintStyles.css');
const jobPrintSheet = read('src/modules/print/PrintJobSheet.jsx');
const jobDetail = read('src/modules/jobs/JobDetail.jsx');
const printActions = read('src/modules/jobs/PrintActions.js');
const documentEmailDialog = read('src/modules/jobs/JobDocumentEmailDialog.jsx');
const printStyles = styles.slice(styles.indexOf('@media print'));

assert.ok(printStyles.startsWith('@media print'), 'Print stylesheet must exist.');
assert.ok(!existsSync(resolve(root, 'src/modules/jobs/JobPrintSheet.js')), 'The legacy Job Sheet renderer must be removed.');
assert.ok(jobPrintSheet.includes('className="print-job-sheet" data-print-document="job-sheet"'), 'Job Sheet must use one isolated document root.');
assert.match(jobPrintSheet, /instrumentType === 'Amplifier'[\s\S]*?<h2>Amplifier service summary<\/h2>/, 'Amplifier Job Sheets must use amplifier terminology.');
assert.match(jobPrintSheet, /instrumentType === 'Keyboard'[\s\S]*?<h2>Keyboard service summary<\/h2>/, 'Keyboard Job Sheets must use keyboard terminology.');
assert.match(jobPrintSheet, /isGuitarFamily[\s\S]*?<GuitarFinalInspection/, 'Guitar measurements must remain limited to guitar-family Job Sheets.');
assert.match(jobPrintSheet, /<h2>Invoice summary<\/h2>[\s\S]*?totals\.totalDue[\s\S]*?totals\.paidTotal[\s\S]*?totals\.balanceDue/, 'Job Sheet must retain invoice totals, payments, and balance.');
assert.match(documentStyles, /body:not\(\.customer-report-printing\) \.print-job-sheet\s*{[\s\S]*display:\s*block !important;[\s\S]*max-width:\s*7\.5in;/, 'Job Sheet must own its print-only Letter layout.');
assert.match(documentStyles, /\.print-job-sheet-totals\s*{[\s\S]*max-width:\s*3\.45in;/, 'Job Sheet invoice totals must use the isolated financial summary layout.');
assert.ok(jobDetail.includes('await waitForJobSheetPrintReady();'), 'Job Sheet printing must wait for document images and layout.');
assert.ok(printActions.includes('printJobSheet'), 'Job Sheet print action must remain available.');
assert.ok(printActions.includes('>Close Detail</button>'), 'The detail-only action must be labeled Close Detail.');
assert.ok(!printActions.includes('Close Job Detail'), 'The detail-only action must not imply that it closes the job.');
assert.match(printStyles, /@page\s*{[\s\S]*size:\s*letter portrait;[\s\S]*margin:\s*0\.5in;/, 'Print pages must keep explicit Letter margins.');
assert.ok(documentEmailDialog.includes('Include with this email'), 'Document email selections must remain separate from print-page styling.');

console.log('Job Sheet print layout checks passed.');
