import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const detail = read('src/modules/jobs/JobDetail.jsx');
const header = read('src/modules/jobs/JobDetailHeader.jsx');
const dialogs = read('src/modules/jobs/JobDetailDialogs.jsx');
const formattingPath = join(root, 'src/modules/jobs/jobDetailFormatting.js');
const packageJson = read('package.json');

assert.match(detail, /import JobDetailHeader from ['"]\.\/JobDetailHeader\.jsx['"]/, 'Job Detail must use the focused header boundary.');
assert.match(detail, /import JobDetailDialogs from ['"]\.\/JobDetailDialogs\.jsx['"]/, 'Job Detail must use the focused dialogs boundary.');
assert.match(detail, /from ['"]\.\/jobDetailFormatting\.js['"]/, 'Job Detail must use the pure formatting boundary.');
assert.match(
  detail,
  /<JobDetailHeader[\s\S]*?onStatusChange=\{updateField\}[\s\S]*?onAssignmentChanged=\{handleAssignmentChanged\}/,
  'Status and assignment changes must retain their established Job Detail handlers.'
);
assert.doesNotMatch(detail, /className="detail-header"/, 'Header presentation must not remain duplicated in JobDetail.');
assert.doesNotMatch(detail, /function markerColorForReport|function getInstrumentSelectionPatch|function buildMeasurementDisplay|function formatMeasurementStageForExport/, 'Extracted pure helpers must not remain duplicated in JobDetail.');
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

const { buildMeasurementDisplay, getInstrumentSelectionPatch, markerColorForReport } = await import(pathToFileURL(formattingPath));
assert.deepEqual(
  getInstrumentSelectionPatch({ guitarBrand: 'Custom', model: 'Prototype' }, 'Acoustic Guitar'),
  { instrumentType: 'Acoustic', guitarBrand: 'Custom', model: 'Prototype' },
  'Instrument selection must retain uncatalogued shop-entered brand and model values.'
);
assert.deepEqual(
  buildMeasurementDisplay({ techDetails: { neckInspection: { initial: { relief: '0.2' }, final: { relief: '0.1' } } } }, 'mm'),
  {
    lengthUnit: 'mm',
    initial: { relief: '0.2 mm', nutHighE: '', nutLowE: '', actionHighE12th: '', actionLowE12th: '' },
    final: { relief: '0.1 mm', nutHighE: '', nutLowE: '', actionHighE12th: '', actionLowE12th: '' }
  },
  'Job export measurements must retain the active shop length unit.'
);
assert.equal(markerColorForReport('Critical'), '#b3261e', 'Critical damage markers must retain their report color.');
assert.equal(markerColorForReport('Structural'), '#a15c00', 'Structural damage markers must retain their report color.');
assert.equal(markerColorForReport('Cosmetic'), '#255f85', 'Default damage markers must retain their report color.');
assert.match(packageJson, /"check:job-detail-module-boundaries": "node scripts\/check-job-detail-module-boundaries\.mjs"/, 'The focused Job Detail boundary check must be exposed.');

console.log('Job Detail module boundary checks passed.');
