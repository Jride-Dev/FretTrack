import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildAmplifierJobDraft,
  filterAmplifierJobs,
  isAmplifierJob,
  normalizeAmplifierDetails
} from '../src/modules/amplifiers/amplifierRepair.js';
import { getBrandsForInstrumentType, getModelsForBrand } from '../src/modules/instruments/instrumentService.js';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const app = read('src/app/App.jsx');
const appActions = read('src/app/useJobWorkspaceActions.js');
const appAccess = read('src/app/appAccess.js');
const permissionService = read('src/modules/auth/permissionService.js');
const entitlementService = read('src/modules/billing/entitlementService.js');
const router = read('src/app/WorkspaceRouter.jsx');
const navigation = read('src/app/useWorkspaceNavigation.js');
const workspaceState = read('src/app/workspaceState.js');
const page = read('src/modules/amplifiers/AmplifierRepairPage.jsx');
const detail = read('src/modules/amplifiers/AmplifierJobDetail.jsx');
const jobMutations = read('src/modules/jobs/jobServiceMutations.js');
const makeModelFields = read('src/modules/amplifiers/AmplifierMakeModelFields.jsx');
const electrical = read('src/modules/amplifiers/AmplifierElectricalMeasurements.jsx');
const evidenceSection = read('src/modules/amplifiers/AmplifierEvidenceSection.jsx');
const evidenceService = read('src/modules/amplifiers/jobEvidenceService.js');
const authoritativeMigration = 'supabase/migrations/20260814215521_amplifier_job_evidence.sql';
assert.ok(existsSync(join(root, authoritativeMigration)), 'The authoritative amplifier migration must exist in repository state.');
const evidenceMigration = read(authoritativeMigration);
const evidenceIntegration = read('scripts/test-local-amplifier-evidence.mjs');
const service = read('src/modules/instruments/instrumentService.js');
const catalog = read('src/modules/instruments/instrumentCatalog.js');
const jobForm = read('src/modules/jobs/JobForm.jsx');
const jobInfo = read('src/modules/jobs/JobInfoSection.js');
const styles = ['src/styles/foundations.css', 'src/styles/workspace.css', 'src/styles.css'].map(read).join('\n');
const packageJson = read('package.json');

const amplifierJob = buildAmplifierJobDraft({
  customerName: 'Test Customer',
  guitarBrand: 'Fender',
  model: 'Deluxe Reverb',
  amplifierType: 'Combo',
  technology: 'Tube',
  priority: 'high',
  reasonForVisit: 'Intermittent output',
  dateReceived: '2026-08-14'
});

assert.equal(amplifierJob.instrumentType, 'Amplifier', 'Amplifier intake must create the authoritative instrument type.');
assert.equal(amplifierJob.techDetails.instrumentType, 'Amplifier', 'Amplifier type must persist in techDetails for the existing jobs schema.');
assert.equal(amplifierJob.techDetails.stringCount, 0, 'Amplifier records must not invent guitar strings.');
assert.deepEqual(amplifierJob.techDetails.stringGauges, [], 'Amplifier records must not carry guitar string-gauge rows.');
assert.equal(amplifierJob.techDetails.amplifier.amplifierType, 'Combo', 'Amplifier type must be snapshotted in amplifier technical details.');
assert.equal(amplifierJob.techDetails.amplifier.technology, 'Tube', 'Amplifier technology must be snapshotted in amplifier technical details.');
assert.equal(isAmplifierJob(amplifierJob), true, 'Amplifier work orders must be recognized for dedicated routing.');
assert.equal(isAmplifierJob({ instrumentType: 'Electric' }), false, 'Guitar jobs must stay on the established guitar workflow.');
assert.equal(normalizeAmplifierDetails({ diagnosis: 'Failed filter capacitor' }).finalTestStatus, 'Not tested', 'Missing amplifier fields must receive stable defaults.');
assert.deepEqual(
  filterAmplifierJobs([
    { ...amplifierJob, id: 'open', jobNumber: 'A-1', status: 'On Bench' },
    { ...amplifierJob, id: 'closed', jobNumber: 'A-2', status: 'Picked Up' },
    { id: 'guitar', instrumentType: 'Electric', status: 'On Bench' }
  ]).map((job) => job.id),
  ['open'],
  'The amplifier queue must exclude guitar jobs and closed work by default.'
);

assert.match(catalog, /Amplifier:\s*\{[\s\S]*?label: 'Amplifier'/, 'The shared instrument catalog must recognize amplifiers.');
assert.match(service, /\{ value: 'Amplifier', label: INSTRUMENT_CATALOG\.Amplifier\.label \}/, 'Shared instrument options must expose Amplifier.');
assert.match(service, /\['Amplifier', 'Keyboard'\]\.includes\(normalizedType\)[\s\S]*?return 0/, 'Amplifiers must use a zero string-count default.');
assert.match(service, /if \(!isStringedInstrumentType\(instrumentType\)\)[\s\S]*?return instrumentType/, 'Shared labels must omit guitar string counts for amplifiers.');
assert.match(jobForm, /isStringedInstrumentType\(form\.instrumentType\)/, 'Generic intake must hide string-only controls for amplifiers.');
assert.match(jobInfo, /isStringedInstrumentType\(instrumentType\)/, 'Generic job information must hide string-only controls for amplifiers.');
const amplifierBrands = getBrandsForInstrumentType('Amplifier');
assert.ok(amplifierBrands.length >= 40, 'The amplifier catalog must provide a useful cross-section of manufacturers.');
for (const brand of ['Fender', 'Marshall', 'Vox', 'Ampeg', 'Gallien-Krueger', 'Kemper']) {
  assert.ok(amplifierBrands.includes(brand), `The amplifier catalog must include ${brand}.`);
}
for (const [brand, model] of [['Fender', 'Deluxe Reverb'], ['Marshall', 'JCM800 2203'], ['Ampeg', 'SVT'], ['Boss', 'Katana-50']]) {
  assert.ok(getModelsForBrand('Amplifier', brand).includes(model), `${brand} model suggestions must include ${model}.`);
}
assert.deepEqual(getModelsForBrand('Amplifier', 'Custom Boutique Make'), [], 'Unknown makes must remain valid free-text values rather than borrowing another make\'s models.');
assert.match(makeModelFields, /getBrandsForInstrumentType\(AMPLIFIER_INSTRUMENT_TYPE\)/, 'Amplifier make suggestions must use the shared instrument catalog.');
assert.match(makeModelFields, /getModelsForBrand\(AMPLIFIER_INSTRUMENT_TYPE, brand\)/, 'Model suggestions must be filtered by the entered make.');
assert.match(makeModelFields, /Manufacturer \/ Make[\s\S]*?<input[\s\S]*?list=\{brandListId\}[\s\S]*?Model[\s\S]*?list=\{modelListId\}/, 'Make and model must remain editable inputs backed by linked suggestion lists.');
assert.match(page, /<AmplifierMakeModelFields[\s\S]*?listIdPrefix="amplifier-intake"/, 'Amplifier intake must expose the shared make/model presets.');
assert.match(detail, /<AmplifierMakeModelFields[\s\S]*?listIdPrefix="amplifier-detail"/, 'Amplifier detail must expose the same make/model presets.');

assert.match(router, /lazy\(\(\) => import\('\.\.\/modules\/amplifiers\/AmplifierRepairPage\.jsx'\)\)/, 'The amplifier page must remain a lazy-loaded module.');
assert.match(router, /mode === 'amplifiers'[\s\S]*?<AmplifierRepairPage[\s\S]*?isEntitled=\{access\.amplifierRepairEnabled\}[\s\S]*?canWrite=\{access\.canEditAmplifierRepair\}/, 'Amplifier intake must combine Pro entitlement and role-aware write permission.');
assert.match(router, /mode === 'amplifier-detail'[\s\S]*?<AmplifierJobDetail[\s\S]*?onUpdate=\{actions\.onUpdateJob\}/, 'Amplifier detail must reuse the established job update path.');
assert.match(app, /isAmplifierJob\(job\)[\s\S]*?'amplifier-detail'/, 'Job selection must route amplifiers away from guitar-specific Job Detail.');
assert.match(app, /onCreateAmplifierJob: handleAmplifierJobCreate/, 'Amplifier creation must cross the workspace action boundary.');
assert.match(appActions, /const enabled = isAmplifier \? access\.amplifierRepairEnabled[\s\S]*?if \(!enabled\)[\s\S]*?Repair is available on Pro/, 'Amplifier creation must retain a defensive client entitlement guard.');
assert.match(appAccess, /const amplifierRepairEnabled = [^;]+canUseAmplifierRepair\(billingAccess\)/, 'App access must expose entitlement-only Amplifier Repair availability.');
assert.match(appAccess, /canEditAmplifierRepair: [^,]+canEditAmplifierRepairForRole\(permissionContext\)/, 'App access must expose role-aware Amplifier Repair writes.');
assert.match(permissionService, /canEditAmplifierRepair[\s\S]*?hasAmplifierRepairEntitlement/, 'Amplifier writes must require the Pro entitlement and an existing write role.');
assert.match(entitlementService, /AMPLIFIER_REPAIR: 'amplifier_repair'/, 'Amplifier Repair must use a named entitlement key.');
assert.match(entitlementService, /\[SUBSCRIPTION_TIERS\.PRO\]: \{[\s\S]*?amplifier_repair: true/, 'The Pro tier must enable Amplifier Repair.');
assert.match(jobForm, /amplifierRepairEnabled \|\| option\.value !== 'Amplifier'/, 'Generic intake must not expose Amplifier to non-Pro shops.');
assert.match(jobInfo, /amplifierRepairEnabled \|\| option\.value !== 'Amplifier'/, 'Generic job editing must not offer an Amplifier conversion to non-Pro shops.');
assert.match(page, /Amplifier Repair is available on Pro\.[\s\S]*?Existing amplifier work orders remain available to view/, 'Non-Pro shops must receive a clear upgrade message while retaining historical visibility.');
assert.match(navigation, /selectJob\(jobId, detailMode = 'detail', \{ skipDirtyGuard = false \} = \{\}\)/, 'Workspace selection must support a focused detail target and safe post-save transition without duplicating navigation.');
assert.match(navigation, /\['detail', 'guitar-detail', 'amplifier-detail', 'keyboard-detail'\]\.includes\(mode\)/, 'Close Detail must preserve the originating page for repair detail modes.');
assert.match(workspaceState, /instrumentType === 'amplifier'[\s\S]*?'amplifier-detail'/, 'Refresh restoration must correct amplifier detail routing.');

for (const label of ['Safety Notes', 'Diagnosis', 'Repair Performed', 'Parts Replaced', 'Bench Test Notes', 'Final Test']) {
  assert.ok(detail.includes(label), `Amplifier detail must include ${label}.`);
}
for (const label of ['AC mains at test point (V)', 'B+ in standby (V DC)', 'B+ operating under load (V DC)', 'Power-tube idle / bias current (mA)', 'Calculated plate dissipation (W)', 'Speaker voice-coil resistance (Ω)', 'Preamp Stage / Signal-Tracing Voltages']) {
  assert.ok(electrical.includes(label), `Professional electrical worksheet must include ${label}.`);
}
assert.match(electrical, /Baseline \/ Before Service[\s\S]*?Final \/ After Service/, 'Electrical measurements must retain distinct baseline and final stages.');
assert.match(electrical, /Qualified technicians only:[\s\S]*?lethal voltage/, 'High-voltage records must include a clear technician safety warning.');
assert.match(electrical, /Firmware Version[\s\S]*?Customer-Reported Trigger Conditions/, 'Digital/modeling amplifier diagnostics must include firmware and trigger conditions.');
assert.match(evidenceSection, /navigator\.mediaDevices\?\.getUserMedia/, 'Diagnostic evidence must support microphone capture where the browser permits it.');
assert.match(evidenceSection, /accept="audio\/webm,[^"]*image\/webp"/, 'Diagnostic evidence must support approved audio and diagnostic image uploads.');
for (const testLabel of ['Noise floor — controls at zero', '20 Hz–20 kHz frequency sweep', 'Clipping / distortion test', 'Intermittent pop / crackle / dropout', 'Oscilloscope — sine wave', 'RTA / spectrum analysis']) {
  assert.ok(evidenceService.includes(testLabel), `Diagnostic evidence must classify ${testLabel}.`);
}
assert.match(evidenceService, /\.from\('job_evidence'\)/, 'Evidence metadata must use its focused persistence table.');
assert.match(evidenceService, /\.from\(JOB_EVIDENCE_BUCKET\)[\s\S]*?\.createSignedUrl/, 'Private evidence playback must use signed Storage URLs.');
assert.match(evidenceService, /MAX_EVIDENCE_BYTES = 25 \* 1024 \* 1024/, 'Evidence files must retain the 25 MB client guard.');
assert.match(evidenceService, /reservePhotoUsage\([\s\S]*?bucket: JOB_EVIDENCE_BUCKET[\s\S]*?settlePhotoUsage/, 'Evidence uploads must use the established atomic storage reservation and settlement path.');
assert.match(evidenceService, /releaseDeletedPhotoStorage\([\s\S]*?bucket: JOB_EVIDENCE_BUCKET/, 'Evidence deletion must release authoritative storage bytes.');
assert.match(evidenceMigration, /create table if not exists public\.job_evidence/, 'The authoritative evidence migration must create the metadata table.');
assert.match(evidenceMigration, /alter table public\.job_evidence enable row level security/, 'Evidence metadata must have RLS enabled.');
assert.match(evidenceMigration, /\('shop', 'amplifier_repair', 'false'::jsonb\)[\s\S]*?\('pro', 'amplifier_repair', 'true'::jsonb\)/, 'The database plan matrix must reserve Amplifier Repair for Pro.');
assert.match(evidenceMigration, /create or replace function private\.enforce_amplifier_repair_entitlement\(\)[\s\S]*?old_is_amplifier or new_is_amplifier[\s\S]*?private\.shop_has_entitlement\(new\.shop_id, 'amplifier_repair'\)/, 'Job writes must enforce Amplifier Repair entitlement server-side, including historical amplifier rows.');
assert.match(evidenceMigration, /create trigger jobs_enforce_amplifier_repair_entitlement[\s\S]*?before insert or update on public\.jobs/, 'The server entitlement guard must run for job inserts and updates.');
assert.match(evidenceMigration, /private\.can_access_job\(job_id\)/, 'Evidence reads must remain shop-scoped through the linked job.');
assert.match(evidenceMigration, /private\.can_write_job\(job_id\)/, 'Evidence mutations must retain established job write permissions.');
assert.match(evidenceMigration, /job_evidence_insert_writer[\s\S]*?private\.shop_has_entitlement\(jobs\.shop_id, 'amplifier_repair'\)/, 'Evidence metadata writes must require Amplifier Repair entitlement.');
assert.match(evidenceMigration, /'job-evidence',[\s\S]*?false,[\s\S]*?26214400/, 'Evidence must use a private bucket with a 25 MB file limit.');
assert.match(evidenceMigration, /bucket_id = 'job-evidence'[\s\S]*?private\.can_access_job/, 'Evidence Storage reads must remain job/shop scoped.');
assert.match(evidenceMigration, /target_bucket in \('job-images', 'part-images', 'job-evidence'\)/, 'Evidence uploads must be recognized by the existing storage allowance reservation constraint.');
assert.match(evidenceMigration, /job_evidence_storage_insert_writer[\s\S]*?has_active_photo_usage_reservation/, 'Direct evidence uploads must be blocked without an active reservation.');
assert.match(evidenceIntegration, /Refusing to test amplifier evidence outside local Supabase/, 'Evidence integration testing must refuse hosted databases.');
assert.match(evidenceIntegration, /crossShopRows\?\.length !== 0/, 'Evidence integration testing must prove cross-shop rows stay hidden.');
assert.match(evidenceIntegration, /finally \{[\s\S]*?from\('job_evidence'\)\.delete[\s\S]*?storage\.from\('job-evidence'\)\.remove/, 'Evidence integration testing must clean up metadata and Storage objects.');
assert.match(detail, /disabled=\{!canWrite\}/, 'Amplifier fields must enforce read-only permissions.');
assert.match(detail, /window\.confirm\('You have unsaved amplifier repair changes\./, 'Close Detail must retain a focused dirty-state confirmation.');
assert.match(detail, /guitar-app-save-current-job/, 'Global Save Job must save amplifier detail through the established header action.');
assert.match(detail, /onUpdate\?\.\(draft, \{ expectedUpdatedAt: draft\.updatedAt \}\)/, 'Amplifier saves must submit the version loaded by the editing session.');
assert.match(jobMutations, /\.eq\('updated_at', expectedUpdatedAt\)/, 'Amplifier persistence must compare the loaded version atomically with the remote row.');
assert.match(jobMutations, /FRETTRACK_JOB_SAVE_CONFLICT/, 'Stale amplifier saves must return a recognizable conflict instead of reporting success.');
assert.match(jobMutations, /if \(expectedUpdatedAt\) \{[\s\S]*?await updateSupabaseJob\(job, \{ expectedUpdatedAt \}\)[\s\S]*?saveLocalJobs/, 'A version-guarded save must not overwrite the local record until the remote update succeeds.');
assert.doesNotMatch(detail, /NeckInspection|DamageMap|String Count|String Gauges/, 'Amplifier detail must not render guitar inspection controls.');
assert.match(page, /type="button" className="amplifier-job-card"/, 'Amplifier queue rows must remain keyboard-accessible buttons.');
assert.match(page, /onDirtyChange\?\.\(isDirty\)/, 'Amplifier intake must participate in shared unsaved-change protection.');
assert.match(styles, /\.amplifier-module-grid\s*\{[\s\S]*?grid-template-columns:/, 'Amplifier intake and queue must have a contained desktop layout.');
assert.match(styles, /@media \(max-width: 768px\)[\s\S]*?\.amplifier-detail-actions,[\s\S]*?width: 100%/, 'Amplifier detail actions must stack cleanly on small screens.');
assert.match(packageJson, /"check:amplifier-repair-module": "node scripts\/check-amplifier-repair-module\.mjs"/, 'The focused amplifier module check must be exposed.');
assert.match(packageJson, /"test:amplifier-evidence:local": "node scripts\/test-local-amplifier-evidence\.mjs"/, 'The local evidence integration check must be exposed.');

console.log('Amplifier repair module checks passed.');
