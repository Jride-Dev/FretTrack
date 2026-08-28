import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CUSTOMER_REPORT_PRINT_MODE,
  beginPrintRequest,
  cancelPrintRequests,
  isCurrentPrintRequest
} from '../src/modules/print/printRequestCoordinator.js';

function createBody() {
  const classes = new Set();
  return {
    classList: {
      contains(value) {
        return classes.has(value);
      },
      remove(value) {
        classes.delete(value);
      },
      toggle(value, enabled) {
        if (enabled) {
          classes.add(value);
        } else {
          classes.delete(value);
        }
      }
    }
  };
}

test('a Job Sheet action cancels a customer report that is still waiting', async () => {
  const requestSequenceRef = { current: 0 };
  const body = createBody();
  const printCalls = [];
  let releaseCustomerReport;
  const customerReportReady = new Promise((resolve) => {
    releaseCustomerReport = resolve;
  });

  const customerReportRequest = beginPrintRequest(requestSequenceRef, CUSTOMER_REPORT_PRINT_MODE, body);
  const pendingCustomerReport = (async () => {
    await customerReportReady;
    if (isCurrentPrintRequest(requestSequenceRef, customerReportRequest, CUSTOMER_REPORT_PRINT_MODE, body)) {
      printCalls.push('customer-report');
    }
  })();

  const jobSheetRequest = beginPrintRequest(requestSequenceRef, 'job-sheet', body);
  if (isCurrentPrintRequest(requestSequenceRef, jobSheetRequest, 'job-sheet', body)) {
    printCalls.push('job-sheet');
  }

  releaseCustomerReport();
  await pendingCustomerReport;

  assert.deepEqual(printCalls, ['job-sheet']);
  assert.equal(body.classList.contains('customer-report-printing'), false);
});

test('only the most recent repeated print request can finish', () => {
  const requestSequenceRef = { current: 0 };
  const body = createBody();
  const firstRequest = beginPrintRequest(requestSequenceRef, CUSTOMER_REPORT_PRINT_MODE, body);
  const secondRequest = beginPrintRequest(requestSequenceRef, CUSTOMER_REPORT_PRINT_MODE, body);

  assert.equal(isCurrentPrintRequest(requestSequenceRef, firstRequest, CUSTOMER_REPORT_PRINT_MODE, body), false);
  assert.equal(isCurrentPrintRequest(requestSequenceRef, secondRequest, CUSTOMER_REPORT_PRINT_MODE, body), true);

  cancelPrintRequests(requestSequenceRef, body);
  assert.equal(isCurrentPrintRequest(requestSequenceRef, secondRequest, CUSTOMER_REPORT_PRINT_MODE, body), false);
  assert.equal(body.classList.contains('customer-report-printing'), false);
});
