import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const jobDetail = read('src/modules/jobs/JobDetail.jsx');
const communicationActions = read('src/modules/jobs/jobDetailCommunicationActions.js');
const coordinator = read('src/modules/print/printRequestCoordinator.js');

assert.match(jobDetail, /const printRequestSequenceRef = useRef\(0\);/, 'Job Detail must keep one print request sequence across both actions.');
assert.match(
  communicationActions,
  /async function printJobSheet\(\)[\s\S]*?beginPrintRequest\(printRequestSequenceRef, 'job-sheet', documentBody\)[\s\S]*?await waitForJobSheetPrintReady\(\);[\s\S]*?!isCurrentPrintRequest\(printRequestSequenceRef, requestSequence, 'job-sheet', documentBody\)[\s\S]*?window\.print\(\);/,
  'Job Sheet printing must invalidate and reject older asynchronous print actions.'
);
assert.match(
  communicationActions,
  /async function printCustomerReport\(\)[\s\S]*?beginPrintRequest\(printRequestSequenceRef, CUSTOMER_REPORT_PRINT_MODE, documentBody\)[\s\S]*?await waitForCustomerReportPrintReady\(\);[\s\S]*?!isCurrentPrintRequest\(printRequestSequenceRef, requestSequence, CUSTOMER_REPORT_PRINT_MODE, documentBody\)[\s\S]*?window\.print\(\);/,
  'Customer report printing must verify that its request is still current after readiness settles.'
);
assert.match(coordinator, /requestSequenceRef\.current = requestSequence/, 'Starting a print action must advance the shared request sequence synchronously.');
assert.match(coordinator, /requestSequenceRef\.current !== requestSequence/, 'A superseded print request must be rejected before printing.');
assert.match(coordinator, /body\.classList\.toggle\(CUSTOMER_REPORT_PRINT_CLASS, mode === CUSTOMER_REPORT_PRINT_MODE\)/, 'The active request must own the matching print mode.');

console.log('Print action arbitration checks passed.');
