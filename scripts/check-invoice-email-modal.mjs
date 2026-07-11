import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dialog = readFileSync(join(root, 'src/modules/jobs/JobDocumentEmailDialog.jsx'), 'utf8');
const jobDetail = readFileSync(join(root, 'src/modules/jobs/JobDetail.jsx'), 'utf8');

function assertIncludes(source, expected, message) {
  assert.ok(source.includes(expected), message || `Expected source to include: ${expected}`);
}

assertIncludes(dialog, 'try {', 'Document email send must handle asynchronous failures.');
assertIncludes(dialog, '} finally {', 'Document email send must always settle busy state.');
assertIncludes(dialog, 'sendInFlightRef.current', 'Document email send must prevent rapid duplicate submissions.');
assertIncludes(dialog, 'sendInFlightRef.current = false;', 'Document email send lock must clear after every settled attempt.');
assertIncludes(dialog, "setSendState((current) => ({ ...current, sending: false }));", 'Document email send must clear busy state in finally.');
assertIncludes(dialog, 'if (!result?.ok)', 'Document email failures must remain visible and retryable.');
assertIncludes(dialog, 'onClose?.();', 'Successful document email sends must close the modal.');
assertIncludes(dialog, "window.addEventListener('keydown', handleKeyDown);", 'Document email modal must support Escape dismissal.');
assertIncludes(dialog, 'onClick={handleBackdropClick}', 'Document email modal must support backdrop dismissal.');
assertIncludes(dialog, 'onClick={(event) => event.stopPropagation()}', 'Document email form clicks must not dismiss the modal.');
assertIncludes(dialog, '<button type="button" className="button-tertiary" onClick={onClose}>', 'Cancel must remain reachable regardless of send state.');
assert.ok(!dialog.includes('onClick={onClose} disabled={sendState.sending}'), 'Cancel must not stay disabled after a send settles.');
assertIncludes(dialog, 'disabled={!canSend}', 'Send control must still prevent duplicate sends while busy.');
assertIncludes(jobDetail, "message: type === 'invoice' ? 'Invoice email sent.' : 'Work order email sent.'", 'Successful sends must leave a visible app-level confirmation after modal close.');

console.log('Invoice email modal checks passed.');
