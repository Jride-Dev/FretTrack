import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const detail = read('src/modules/jobs/JobDetail.jsx');
const header = read('src/modules/jobs/JobDetailHeader.jsx');
const dialogs = read('src/modules/jobs/JobDetailDialogs.jsx');
const packageJson = read('package.json');

assert.match(detail, /import JobDetailHeader from ['"]\.\/JobDetailHeader\.jsx['"]/, 'Job Detail must use the focused header boundary.');
assert.match(detail, /import JobDetailDialogs from ['"]\.\/JobDetailDialogs\.jsx['"]/, 'Job Detail must use the focused dialogs boundary.');
assert.match(
  detail,
  /<JobDetailHeader[\s\S]*?onStatusChange=\{updateField\}[\s\S]*?onAssignmentChanged=\{handleAssignmentChanged\}/,
  'Status and assignment changes must retain their established Job Detail handlers.'
);
assert.doesNotMatch(detail, /className="detail-header"/, 'Header presentation must not remain duplicated in JobDetail.');
for (const source of [header, dialogs]) {
  assert.doesNotMatch(source, /jobService|supabase/i, 'Job Detail presentation boundaries must not load or mutate job data directly.');
}
assert.match(header, /<JobStatusSelect canWrite=\{canWrite\}/, 'Job status editing must retain write permission enforcement.');
assert.match(header, /<JobAssignmentControl[\s\S]*?onAssignmentChanged=\{onAssignmentChanged\}/, 'Team assignment must remain connected through the header boundary.');
assert.match(header, /isDirty \|\| saveStatus === 'saving' \|\| saveStatus === 'error'/, 'Unsaved and failed save state must remain visible.');
assert.match(detail, /<JobDetailDialogs[\s\S]*?onSendDocumentEmail=\{handleSendDocumentEmail\}[\s\S]*?onSavePhotoCopy=\{saveEditedPhotoCopy\}[\s\S]*?onOverwritePhoto=\{overwriteEditedPhoto\}/, 'Dialog actions must retain their established Job Detail handlers.');
assert.match(dialogs, /onOverwrite=\{canOverwritePhotos \? onOverwritePhoto : null\}/, 'Photo overwrite must retain its permission gate.');
assert.match(dialogs, /onSend=\{onSendDocumentEmail\}/, 'Document email sending must remain connected.');
assert.match(dialogs, /onSend=\{onSendSubcontractorPickup\}/, 'Subcontractor email sending must remain connected.');
assert.match(packageJson, /"check:job-detail-module-boundaries": "node scripts\/check-job-detail-module-boundaries\.mjs"/, 'The focused Job Detail boundary check must be exposed.');

console.log('Job Detail module boundary checks passed.');
