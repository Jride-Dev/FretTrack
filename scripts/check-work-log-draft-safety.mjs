import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const app = read('src/app/App.jsx');
const detail = read('src/modules/jobs/JobDetail.jsx');
const communicationActions = read('src/modules/jobs/jobDetailCommunicationActions.js');
const workLogSection = read('src/modules/jobs/WorkLogSection.js');
const packageJson = JSON.parse(read('package.json'));
const draftHelperPath = join(root, 'src/modules/jobs/workLogDraft.js');
const { appendWorkLogDraft, getPendingWorkLogText, getWorkLogSubmission, hasPendingWorkLogDraft } = await import(pathToFileURL(draftHelperPath));

assert.equal(getPendingWorkLogText('  setup completed  '), 'setup completed');
assert.equal(hasPendingWorkLogDraft('   '), false);
assert.equal(hasPendingWorkLogDraft('fret dress complete'), true);

const originalJob = {
  id: 'job-1',
  workLog: [{ id: 'existing', jobId: 'job-1', text: 'Intake', entry: 'Intake', timestamp: '2026-08-01T00:00:00.000Z' }]
};
const appendedJob = appendWorkLogDraft(originalJob, '  Completed setup and intonation.  ', {
  id: 'new-entry',
  timestamp: '2026-08-03T12:00:00.000Z'
});
assert.equal(originalJob.workLog.length, 1, 'Appending a Work Note must not mutate the current job object.');
assert.equal(appendedJob.workLog.length, 2, 'A saved Work Note must preserve existing entries and append one new entry.');
assert.deepEqual(appendedJob.workLog[1], {
  id: 'new-entry',
  jobId: 'job-1',
  text: 'Completed setup and intonation.',
  entry: 'Completed setup and intonation.',
  createdAt: '2026-08-03T12:00:00.000Z',
  timestamp: '2026-08-03T12:00:00.000Z'
});

const failedSubmission = getWorkLogSubmission(null, {
  jobId: 'job-1',
  text: '  Retry this note  ',
  id: 'retry-entry',
  timestamp: '2026-08-14T12:00:00.000Z'
});
const retriedSubmission = getWorkLogSubmission(failedSubmission, {
  jobId: 'job-1',
  text: 'Retry this note',
  id: 'replacement-entry',
  timestamp: '2026-08-14T12:01:00.000Z'
});
assert.strictEqual(retriedSubmission, failedSubmission, 'A failed Work Note retry must reuse the same row identity.');
assert.equal(retriedSubmission.id, 'retry-entry', 'Retrying must not generate a second Work Note UUID.');
const failedAttemptJob = appendWorkLogDraft(originalJob, failedSubmission.text, failedSubmission);
const retriedJob = appendWorkLogDraft(failedAttemptJob, retriedSubmission.text, retriedSubmission);
assert.equal(retriedJob.workLog.length, 2, 'Retrying an optimistically retained Work Note must not append its row a second time.');
assert.equal(retriedJob.workLog.filter((entry) => entry.id === failedSubmission.id).length, 1, 'A retry must retain exactly one row with the stable submission ID.');
const editedRetrySubmission = getWorkLogSubmission(failedSubmission, {
  jobId: 'job-1',
  text: 'Edited retry note',
  id: 'edited-entry',
  timestamp: '2026-08-14T12:02:00.000Z'
});
assert.equal(editedRetrySubmission.id, failedSubmission.id, 'Editing a failed Work Note retry must retain its original row identity.');
assert.equal(editedRetrySubmission.text, 'Edited retry note', 'Editing a failed Work Note retry must update the pending row content.');
const editedRetryJob = appendWorkLogDraft(failedAttemptJob, editedRetrySubmission.text, editedRetrySubmission);
assert.equal(editedRetryJob.workLog.length, 2, 'Editing a failed Work Note retry must replace its optimistic row instead of appending another note.');
assert.equal(editedRetryJob.workLog[1].text, 'Edited retry note', 'The retried Work Note must contain the user\'s latest text.');

assert.match(workLogSection, /Save Work Note/, 'The Work Log draft action must be explicitly labeled as a save.');
assert.match(workLogSection, /Unsaved Work Note/, 'Pending Work Notes must have a visible unsaved-state warning.');
assert.match(workLogSection, /Discard Draft/, 'Users must be able to deliberately discard a pending Work Note.');
assert.match(detail, /hasUnsavedChanges = isDirty \|\| hasUnsettledWorkLog/, 'Pending and in-flight Work Notes must participate in page dirty-state protection.');
assert.match(detail, /beforeunload/, 'Pending Work Notes must participate in browser close/refresh protection.');
assert.match(detail, /const saveRequest = hasPendingWorkLog \? savePendingWorkLog : saveDraftNow/, 'The global Save Job action must save a pending Work Note.');
assert.match(detail, /const workLogSavePromiseRef = useRef\(null\)/, 'Work Note persistence must keep a synchronous in-flight save guard.');
assert.match(detail, /const hasUnsettledWorkLog = hasPendingWorkLog \|\| isSavingWorkLog/, 'An in-flight Work Note save must remain protected as unsettled work.');
assert.match(detail, /const didSwitchJobs = hydratedJobIdRef\.current !== job\.id[\s\S]*?if \(didSwitchJobs\) \{[\s\S]*?setWorkLogText\(''\);[\s\S]*?setIsSavingWorkLog\(false\);/, 'Switching jobs must give the new job an independent blank Work Note state.');
assert.match(detail, /activeJobIdRef\.current === savingJobId[\s\S]*?setDraftJob\(savedJob \|\| jobToSave\);/, 'A completed save must update the draft only while its original job is still active.');
assert.match(app, /if \(selectedJobIdRef\.current !== job\.id\) \{[\s\S]*?return savedJob;/, 'A completed save for a departed job must not refresh and overwrite the newly selected job.');
assert.match(detail, /if \(workLogSavePromiseRef\.current\?\.jobId === draftJob\.id\) \{\s*return workLogSavePromiseRef\.current\.promise;/, 'Repeated Work Note submissions for the same job must coalesce onto the active save.');
assert.match(detail, /workLogSavePromiseRef\.current = \{ jobId: submission\.jobId, promise: savePromise \}/, 'The active Work Note save must retain its job identity before another submission can start.');
assert.match(detail, /getWorkLogSubmission\(workLogRetrySubmissionRef\.current/, 'Failed Work Note retries must reuse their original submission identity.');
assert.match(detail, /workLogRetrySubmissionRef\.current = submission/, 'The retry identity must be retained before remote persistence starts.');
assert.match(workLogSection, /!hasPendingWorkLog \|\| isSavingWorkLog/, 'The Work Note save control must remain disabled while persistence is in flight.');
for (const actionName of ['printJobSheet', 'printCustomerReport', 'openWorkOrderEmail']) {
  const actionSource = communicationActions.match(new RegExp(`function ${actionName}\\(\\) \\{([\\s\\S]*?)\\n  \\}`))?.[1] || '';
  assert.match(actionSource, /guardPendingWorkLogDocumentAction\(\)/, `${actionName} must use the pending Work Note guard.`);
}
assert.match(communicationActions, /if \(hasPendingWorkLog\) \{\s*return \{ ok: false, error: PENDING_WORK_LOG_MESSAGE \};/, 'The document send handler must defensively reject a pending Work Note.');
assert.match(communicationActions, /PENDING_WORK_LOG_MESSAGE/, 'Customer document actions must explain how to resolve a pending Work Note.');
assert.match(detail, /Work Note changes could not be saved/, 'Existing Work Note blur-save failures must be visible to the user.');
assert.equal(packageJson.scripts['check:work-log-draft-safety'], 'node scripts/check-work-log-draft-safety.mjs');

console.log('Work Log draft safety checks passed.');
