import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const detail = read('src/modules/jobs/JobDetail.jsx');
const workLogSection = read('src/modules/jobs/WorkLogSection.js');
const packageJson = JSON.parse(read('package.json'));
const draftHelperPath = join(root, 'src/modules/jobs/workLogDraft.js');
const { appendWorkLogDraft, getPendingWorkLogText, hasPendingWorkLogDraft } = await import(pathToFileURL(draftHelperPath));

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

assert.match(workLogSection, /Save Work Note/, 'The Work Log draft action must be explicitly labeled as a save.');
assert.match(workLogSection, /Unsaved Work Note/, 'Pending Work Notes must have a visible unsaved-state warning.');
assert.match(workLogSection, /Discard Draft/, 'Users must be able to deliberately discard a pending Work Note.');
assert.match(detail, /hasUnsavedChanges = isDirty \|\| hasUnsettledWorkLog/, 'Pending and in-flight Work Notes must participate in page dirty-state protection.');
assert.match(detail, /beforeunload/, 'Pending Work Notes must participate in browser close/refresh protection.');
assert.match(detail, /const saveRequest = hasPendingWorkLog \? savePendingWorkLog : saveDraftNow/, 'The global Save Job action must save a pending Work Note.');
assert.match(detail, /const workLogSavePromiseRef = useRef\(null\)/, 'Work Note persistence must keep a synchronous in-flight save guard.');
assert.match(detail, /const hasUnsettledWorkLog = hasPendingWorkLog \|\| isSavingWorkLog/, 'An in-flight Work Note save must remain protected as unsettled work.');
assert.match(detail, /if \(!workLogSavePromiseRef\.current\) \{\s*setWorkLogText\(''\);/, 'Optimistic parent updates must not clear a Work Note while its remote save is still running.');
assert.match(detail, /if \(workLogSavePromiseRef\.current\) \{\s*return workLogSavePromiseRef\.current;/, 'Repeated Work Note submissions must coalesce onto the active save.');
assert.match(detail, /workLogSavePromiseRef\.current = savePromise/, 'The active Work Note save promise must be recorded before another submission can start.');
assert.match(workLogSection, /!hasPendingWorkLog \|\| isSavingWorkLog/, 'The Work Note save control must remain disabled while persistence is in flight.');
for (const actionName of ['printJobSheet', 'printCustomerReport', 'openWorkOrderEmail']) {
  const actionSource = detail.match(new RegExp(`function ${actionName}\\(\\) \\{([\\s\\S]*?)\\n  \\}`))?.[1] || '';
  assert.match(actionSource, /guardPendingWorkLogDocumentAction\(\)/, `${actionName} must use the pending Work Note guard.`);
}
assert.match(detail, /if \(hasPendingWorkLog\) \{\s*return \{ ok: false, error: PENDING_WORK_LOG_MESSAGE \};/, 'The document send handler must defensively reject a pending Work Note.');
assert.match(detail, /PENDING_WORK_LOG_MESSAGE/, 'Customer document actions must explain how to resolve a pending Work Note.');
assert.match(detail, /Work Note changes could not be saved/, 'Existing Work Note blur-save failures must be visible to the user.');
assert.equal(packageJson.scripts['check:work-log-draft-safety'], 'node scripts/check-work-log-draft-safety.mjs');

console.log('Work Log draft safety checks passed.');
