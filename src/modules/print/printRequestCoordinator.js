export const CUSTOMER_REPORT_PRINT_MODE = 'customer-report';

const CUSTOMER_REPORT_PRINT_CLASS = 'customer-report-printing';

export function beginPrintRequest(requestSequenceRef, mode, body) {
  const requestSequence = requestSequenceRef.current + 1;
  requestSequenceRef.current = requestSequence;
  body.classList.toggle(CUSTOMER_REPORT_PRINT_CLASS, mode === CUSTOMER_REPORT_PRINT_MODE);
  return requestSequence;
}

export function isCurrentPrintRequest(requestSequenceRef, requestSequence, mode, body) {
  if (requestSequenceRef.current !== requestSequence) {
    return false;
  }

  const isCustomerReportMode = body.classList.contains(CUSTOMER_REPORT_PRINT_CLASS);
  return mode === CUSTOMER_REPORT_PRINT_MODE ? isCustomerReportMode : !isCustomerReportMode;
}

export function cancelPrintRequests(requestSequenceRef, body) {
  requestSequenceRef.current += 1;
  body.classList.remove(CUSTOMER_REPORT_PRINT_CLASS);
}
