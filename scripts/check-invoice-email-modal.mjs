import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dialog = readFileSync(join(root, 'src/modules/jobs/JobDocumentEmailDialog.jsx'), 'utf8');
const communicationActions = readFileSync(join(root, 'src/modules/jobs/jobDetailCommunicationActions.js'), 'utf8');
const styles = ['src/styles/foundations.css', 'src/styles/workspace.css', 'src/styles.css']
  .map((file) => readFileSync(join(root, file), 'utf8'))
  .join('\n');

function assertIncludes(source, expected, message) {
  assert.ok(source.includes(expected), message || `Expected source to include: ${expected}`);
}

assertIncludes(dialog, 'try {', 'Document email send must handle asynchronous failures.');
assertIncludes(dialog, '} finally {', 'Document email send must always settle busy state.');
assertIncludes(dialog, 'sendInFlightRef.current', 'Document email send must prevent rapid duplicate submissions.');
assertIncludes(dialog, 'sendInFlightRef.current = false;', 'Document email send lock must clear after every settled attempt.');
assertIncludes(dialog, "setSendState((current) => ({ ...current, sending: false }));", 'Document email send must clear busy state in finally.');
assertIncludes(dialog, 'if (!result?.ok)', 'Document email failures must remain visible and retryable.');
assertIncludes(dialog, 'sendOperationRef', 'Document email retries must retain a stable send operation identity.');
assertIncludes(dialog, 'requestId\n      });', 'Document email sends must pass the retained request identity to the send path.');
assertIncludes(communicationActions, 'requestId\n    });', 'Document email communication must forward the retained request identity.');
assertIncludes(communicationActions, 'requestId', 'Document email communication must accept the retry identity.');
assertIncludes(dialog, 'onClose?.();', 'Successful document email sends must close the modal.');
assertIncludes(dialog, 'Send Job Sheet', 'Document email dialog must offer Job Sheet delivery.');
assertIncludes(dialog, 'Send Customer Report', 'Document email dialog must offer Customer Report delivery.');
assertIncludes(dialog, 'includeJobSheet: includedDocuments.jobSheet', 'Document email dialog must pass Job Sheet selection to the send path.');
assertIncludes(dialog, 'includeCustomerReport: includedDocuments.customerReport', 'Document email dialog must pass Customer Report selection to the send path.');
assertIncludes(dialog, "window.addEventListener('keydown', handleKeyDown);", 'Document email modal must support Escape dismissal.');
assertIncludes(dialog, 'onClick={handleBackdropClick}', 'Document email modal must support backdrop dismissal.');
assertIncludes(dialog, 'onClick={(event) => event.stopPropagation()}', 'Document email form clicks must not dismiss the modal.');
assertIncludes(dialog, '<button type="button" className="button-tertiary" onClick={onClose}>', 'Cancel must remain reachable regardless of send state.');
assert.ok(!dialog.includes('onClick={onClose} disabled={sendState.sending}'), 'Cancel must not stay disabled after a send settles.');
assertIncludes(dialog, 'disabled={!canSend}', 'Send control must still prevent duplicate sends while busy.');
assertIncludes(communicationActions, "message: type === 'estimate' ? 'Estimate email sent and logged.'", 'Successful sends must leave a visible app-level confirmation after modal close.');
assertIncludes(communicationActions, "import { logJobEventSafe } from './jobEventsService.js';", 'Document email audit logging must import the safe job-event helper.');
assertIncludes(communicationActions, 'logJobEventSafe({', 'Successful document sends must retain non-blocking job-event logging.');
assertIncludes(communicationActions, 'buildSelectedDocumentEmailContent', 'Document email send path must build selected document content.');
assertIncludes(communicationActions, 'buildEstimateEmailContent', 'Estimate emails must include the priced estimate document.');
assertIncludes(communicationActions, "templateKey: type === 'estimate' ? 'estimate_email'", 'Estimate emails must be logged with an explicit estimate template key.');
assertIncludes(communicationActions, 'buildDocumentEmailHtml', 'Document email send path must use formatted HTML when documents are selected.');
assertIncludes(styles, '.document-email-option input[type="checkbox"]', 'Document email checkbox sizing must stay scoped to the dialog.');
assertIncludes(styles, 'width: auto;', 'Document email checkboxes must override full-width text input styling.');

const emailDocuments = readFileSync(join(root, 'src/modules/jobs/emailDocuments.js'), 'utf8');
assertIncludes(emailDocuments, 'buildJobSheetEmailSection', 'Document email helper must build the Job Sheet content.');
assertIncludes(emailDocuments, 'buildCustomerReportEmailSection', 'Document email helper must build the Customer Report content.');
assertIncludes(emailDocuments, 'buildEstimateEmailContent', 'Document email helper must build the Estimate content.');
assertIncludes(emailDocuments, 'escapeHtml', 'Document email helper must escape customer and job text before rendering HTML.');

const jobMessaging = readFileSync(join(root, 'src/modules/jobs/jobServiceMessaging.js'), 'utf8');
assertIncludes(jobMessaging, "html: message.html || ''", 'Document email client must forward formatted document HTML to the email function.');

const emailFunction = readFileSync(join(root, 'supabase/functions/send-email/index.ts'), 'utf8');
assertIncludes(emailFunction, "...(html ? { html } : {})", 'Email function must send formatted document HTML when provided.');

console.log('Invoice email modal checks passed.');
