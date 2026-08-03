import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const detail = read('src/modules/jobs/JobDetail.jsx');
const header = read('src/modules/jobs/JobDetailHeader.jsx');
const dialogs = read('src/modules/jobs/JobDetailDialogs.jsx');
const damageReportView = read('src/modules/jobs/JobDamageReportView.jsx');
const printDocuments = read('src/modules/jobs/JobPrintDocuments.jsx');
const inspectionSections = read('src/modules/jobs/JobInspectionSections.jsx');
const workSections = read('src/modules/jobs/JobWorkSections.jsx');
const billingSections = read('src/modules/jobs/JobBillingSections.jsx');
const formattingPath = join(root, 'src/modules/jobs/jobDetailFormatting.js');
const packageJson = read('package.json');

assert.match(detail, /import JobDetailHeader from ['"]\.\/JobDetailHeader\.jsx['"]/, 'Job Detail must use the focused header boundary.');
assert.match(detail, /import JobDetailDialogs from ['"]\.\/JobDetailDialogs\.jsx['"]/, 'Job Detail must use the focused dialogs boundary.');
assert.match(detail, /from ['"]\.\/jobDetailFormatting\.js['"]/, 'Job Detail must use the pure formatting boundary.');
assert.match(detail, /import JobPrintDocuments from ['"]\.\/JobPrintDocuments\.jsx['"]/, 'Job Detail must use the focused print-document boundary.');
assert.match(detail, /import JobInspectionSections from ['"]\.\/JobInspectionSections\.jsx['"]/, 'Job Detail must use the focused inspection boundary.');
assert.match(detail, /import JobWorkSections from ['"]\.\/JobWorkSections\.jsx['"]/, 'Job Detail must use the focused work boundary.');
assert.match(detail, /import JobBillingSections from ['"]\.\/JobBillingSections\.jsx['"]/, 'Job Detail must use the focused billing boundary.');
assert.match(
  detail,
  /<JobDetailHeader[\s\S]*?onStatusChange=\{updateField\}[\s\S]*?onAssignmentChanged=\{handleAssignmentChanged\}/,
  'Status and assignment changes must retain their established Job Detail handlers.'
);
assert.doesNotMatch(detail, /className="detail-header"/, 'Header presentation must not remain duplicated in JobDetail.');
assert.doesNotMatch(detail, /function markerColorForReport|function getInstrumentSelectionPatch|function buildMeasurementDisplay|function formatMeasurementStageForExport/, 'Extracted pure helpers must not remain duplicated in JobDetail.');
for (const source of [header, dialogs, damageReportView, printDocuments, inspectionSections, workSections, billingSections]) {
  assert.doesNotMatch(source, /jobService|supabase/i, 'Job Detail presentation boundaries must not load or mutate job data directly.');
}
assert.match(header, /<JobStatusSelect canWrite=\{canWrite\}/, 'Job status editing must retain write permission enforcement.');
assert.match(header, /<JobAssignmentControl[\s\S]*?onAssignmentChanged=\{onAssignmentChanged\}/, 'Team assignment must remain connected through the header boundary.');
assert.match(header, /isDirty \|\| saveStatus === 'saving' \|\| saveStatus === 'error'/, 'Unsaved and failed save state must remain visible.');
assert.match(detail, /<JobDetailDialogs[\s\S]*?onSendDocumentEmail=\{handleSendDocumentEmail\}[\s\S]*?onSavePhotoCopy=\{saveEditedPhotoCopy\}[\s\S]*?onOverwritePhoto=\{overwriteEditedPhoto\}/, 'Dialog actions must retain their established Job Detail handlers.');
assert.match(dialogs, /onOverwrite=\{canOverwritePhotos \? onOverwritePhoto : null\}/, 'Photo overwrite must retain its permission gate.');
assert.match(dialogs, /onSend=\{onSendDocumentEmail\}/, 'Document email sending must remain connected.');
assert.match(dialogs, /onSend=\{onSendSubcontractorPickup\}/, 'Subcontractor email sending must remain connected.');
assert.match(detail, /<JobPrintDocuments[\s\S]*?lengthUnit=\{measurementOptions\.lengthUnit\}[\s\S]*?workOrderImages=\{workOrderImages\}/, 'Print documents must retain the active job, shop measurement unit, totals, and images.');
assert.match(printDocuments, /<JobPrintSheet[\s\S]*?lengthUnit=\{lengthUnit\}[\s\S]*?totals=\{totals\}/, 'Job Sheet rendering must retain calculated totals and the selected measurement unit.');
assert.match(printDocuments, /<CustomerDamageReport[\s\S]*?lengthUnit=\{lengthUnit\}[\s\S]*?reportDamageView=\{renderDamageView\}/, 'Customer Report rendering must retain measurement formatting and damage-map composition.');
assert.match(printDocuments, /<JobDamageReportView damageMap=\{draftJob\.techDetails\.damageMap \|\| \{\}\} viewName=\{viewName\} \/>/, 'Customer damage report rendering must retain the active job damage map.');
assert.match(detail, /<JobInspectionSections[\s\S]*?lengthUnit=\{measurementOptions\.lengthUnit\}[\s\S]*?onDamageMapChange=\{updateDamageMap\}[\s\S]*?onNeckInspectionChange=\{updateNeckInspection\}[\s\S]*?onTechFieldChange=\{updateTechField\}/, 'Inspection presentation must retain shop measurement units and established Job Detail handlers.');
assert.match(inspectionSections, /<TechDetailsSection[\s\S]*?canWrite=\{canWrite\}[\s\S]*?updateNeckInspection=\{onNeckInspectionChange\}[\s\S]*?updateTechField=\{onTechFieldChange\}/, 'Technical measurements must retain write permissions and controlled update handlers.');
assert.match(inspectionSections, /<DamageMapSection[\s\S]*?canWrite=\{canWrite\}[\s\S]*?onChange=\{onDamageMapChange\}[\s\S]*?onViewImageUpload=\{onDamageViewImageUpload\}/, 'Damage Map must retain write permissions, persistence, and upload handlers.');
assert.match(detail, /<JobWorkSections[\s\S]*?onAddService=\{addService\}[\s\S]*?onAppendWorkLog=\{appendWorkLog\}[\s\S]*?onSaveWorkLogChanges=\{saveWorkLogChanges\}[\s\S]*?onUpdateService=\{updateService\}/, 'Work presentation must retain established service and work-log handlers.');
assert.match(workSections, /<WorkLogSection[\s\S]*?canWrite=\{canWrite\}[\s\S]*?appendWorkLog=\{onAppendWorkLog\}[\s\S]*?saveWorkLogChanges=\{onSaveWorkLogChanges\}/, 'Work Log must retain write permissions, append behavior, and blur-save behavior.');
assert.match(workSections, /<ServicesList[\s\S]*?canWrite=\{canWrite\}[\s\S]*?onAddService=\{onAddService\}[\s\S]*?onUpdateService=\{onUpdateService\}[\s\S]*?onRemoveService=\{onRemoveService\}/, 'Work services must retain write permissions and controlled mutations.');
assert.match(detail, /<JobBillingSections[\s\S]*?onAddInventoryPart=\{addInventoryPart\}[\s\S]*?onAddPayment=\{addPayment\}[\s\S]*?onEmailInvoice=\{openInvoiceEmail\}[\s\S]*?shopTaxRate=\{getShopDefaultTaxRate\(shopSettings\)\}[\s\S]*?taxSettings=\{taxSettings\}/, 'Billing presentation must retain inventory, payment, invoice, and shop-tax behavior.');
assert.match(billingSections, /<PartsList[\s\S]*?canWrite=\{canWrite\}[\s\S]*?onAddInventoryPart=\{onAddInventoryPart\}[\s\S]*?onUpdatePart=\{onUpdatePart\}/, 'Billing parts must retain write permissions and controlled inventory mutations.');
assert.match(billingSections, /<TotalsSection[\s\S]*?canSendEmail=\{canSendEmail\}[\s\S]*?canWrite=\{canWrite\}[\s\S]*?emailInvoice=\{onEmailInvoice\}[\s\S]*?shopTaxRate=\{shopTaxRate\}[\s\S]*?useShopTaxRate=\{onUseShopTaxRate\}/, 'Totals and payments must retain email, permission, tax, and payment wiring.');
assert.match(damageReportView, /if \(!hasBaseImage && marks\.length === 0\)[\s\S]*?return null/, 'Completely empty damage maps must remain omitted from reports.');
assert.match(damageReportView, /hasBaseImage && imageUrl && marks\.length > 0/, 'Marker tables must remain tied to a visible reference image.');

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
