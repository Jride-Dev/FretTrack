import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildKeyboardJobDraft,
  filterKeyboardJobs,
  isKeyboardJob,
  normalizeKeyboardDetails
} from '../src/modules/keyboards/keyboardRepair.js';
import {
  getBrandsForInstrumentType,
  getModelsForBrand,
  isStringedInstrumentType,
  normalizeInstrumentType
} from '../src/modules/instruments/instrumentService.js';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const migrationPath = 'supabase/migrations/20260817003514_pro_keyboard_repair_foundation.sql';
assert.ok(existsSync(join(root, migrationPath)), 'The authoritative Keyboard Repair migration must exist.');

const app = read('src/app/App.jsx');
const appAccess = read('src/app/appAccess.js');
const router = read('src/app/WorkspaceRouter.jsx');
const navigation = read('src/app/useWorkspaceNavigation.js');
const workspaceState = read('src/app/workspaceState.js');
const entitlementService = read('src/modules/billing/entitlementService.js');
const permissionService = read('src/modules/auth/permissionService.js');
const jobForm = read('src/modules/jobs/JobForm.jsx');
const jobInfo = read('src/modules/jobs/JobInfoSection.js');
const jobService = read('src/modules/jobs/jobService.js');
const page = read('src/modules/keyboards/KeyboardRepairPage.jsx');
const detail = read('src/modules/keyboards/KeyboardJobDetail.jsx');
const tests = read('src/modules/keyboards/KeyboardFunctionalTests.jsx');
const keyboardRepairSource = read('src/modules/keyboards/keyboardRepair.js');
const migration = read(migrationPath);
const packageJson = read('package.json');

const keyboardJob = buildKeyboardJobDraft({
  customerName: 'Test Customer',
  guitarBrand: 'Roland',
  model: 'JUNO',
  keyboardType: 'Synthesizer',
  keyCount: '61',
  keyAction: 'Synth action',
  includedAccessories: 'Power adapter',
  priority: 'high',
  reasonForVisit: 'Intermittent C3 velocity',
  dateReceived: '2026-08-16'
});

assert.equal(keyboardJob.instrumentType, 'Keyboard', 'Keyboard intake must create the authoritative instrument type.');
assert.equal(keyboardJob.techDetails.instrumentType, 'Keyboard', 'Keyboard type must persist in techDetails.');
assert.equal(keyboardJob.techDetails.stringCount, 0, 'Keyboard records must not invent guitar strings.');
assert.deepEqual(keyboardJob.techDetails.stringGauges, [], 'Keyboard records must not carry string-gauge rows.');
assert.equal(keyboardJob.techDetails.keyboard.keyCount, '61', 'Keyboard intake must snapshot the key count.');
assert.equal(keyboardJob.techDetails.keyboard.includedAccessories, 'Power adapter', 'Keyboard intake must snapshot received accessories.');
assert.equal(isKeyboardJob(keyboardJob), true, 'Keyboard work orders must be recognized for dedicated routing.');
assert.equal(isKeyboardJob({ instrumentType: 'Electric' }), false, 'Guitar jobs must stay on the established detail workflow.');
assert.equal(normalizeInstrumentType('Digital Piano'), 'Keyboard', 'Keyboard aliases must normalize to the dedicated instrument type.');
assert.equal(isStringedInstrumentType('Keyboard'), false, 'Keyboard work must hide guitar string controls.');
assert.equal(normalizeKeyboardDetails({ diagnosis: 'Dirty contact' }).finalTestStatus, 'Not tested', 'Missing keyboard fields must receive stable defaults.');
assert.equal(normalizeKeyboardDetails({}).functionalTests.final.velocity, 'Not tested', 'Functional test stages must receive stable defaults.');
assert.deepEqual(
  filterKeyboardJobs([
    { ...keyboardJob, id: 'open', jobNumber: 'K-1', status: 'On Bench' },
    { ...keyboardJob, id: 'closed', jobNumber: 'K-2', status: 'Picked Up' },
    { id: 'guitar', instrumentType: 'Electric', status: 'On Bench' }
  ]).map((job) => job.id),
  ['open'],
  'The keyboard queue must exclude guitar jobs and closed work by default.'
);

const keyboardBrands = getBrandsForInstrumentType('Keyboard');
for (const brand of ['Yamaha', 'Roland', 'Korg', 'Nord', 'Moog', 'Rhodes']) {
  assert.ok(keyboardBrands.includes(brand), `The keyboard catalog must include ${brand}.`);
}
for (const [brand, model] of [['Yamaha', 'DX7'], ['Roland', 'JUNO'], ['Korg', 'Kronos'], ['Nord', 'Stage']]) {
  assert.ok(getModelsForBrand('Keyboard', brand).includes(model), `${brand} model suggestions must include ${model}.`);
}
assert.deepEqual(getModelsForBrand('Keyboard', 'Custom Boutique Make'), [], 'Unknown manufacturers must remain valid free-text values.');

assert.match(router, /lazy\(\(\) => import\('\.\.\/modules\/keyboards\/KeyboardRepairPage\.jsx'\)\)/, 'Keyboard Repair must remain lazy loaded.');
assert.match(router, /mode === 'keyboards'[\s\S]*?<KeyboardRepairPage[\s\S]*?isEntitled=\{access\.keyboardRepairEnabled\}[\s\S]*?canWrite=\{access\.canEditKeyboardRepair\}/, 'Keyboard intake must combine entitlement and role-aware write permission.');
assert.match(router, /mode === 'keyboard-detail'[\s\S]*?<KeyboardJobDetail[\s\S]*?onUpdate=\{actions\.onUpdateJob\}/, 'Keyboard detail must reuse the established job update path.');
assert.match(app, /isKeyboardJob\(job\)[\s\S]*?'keyboard-detail'/, 'Job selection must route keyboards away from guitar-specific detail.');
assert.match(app, /onCreateKeyboardJob: handleKeyboardJobCreate/, 'Keyboard creation must cross the workspace action boundary.');
assert.match(app, /if \(!keyboardRepairEnabled\)[\s\S]*?Keyboard Repair is available on Pro/, 'Keyboard creation must retain a defensive client entitlement guard.');
assert.match(appAccess, /const keyboardRepairEnabled = [^;]+canUseKeyboardRepair\(billingAccess\)/, 'App access must expose entitlement-only Keyboard Repair availability.');
assert.match(appAccess, /canEditKeyboardRepair: [^,]+canEditKeyboardRepairForRole\(permissionContext\)/, 'App access must expose role-aware Keyboard Repair writes.');
assert.match(permissionService, /canEditKeyboardRepair[\s\S]*?hasKeyboardRepairEntitlement/, 'Keyboard writes must require the entitlement and an established write role.');
assert.match(entitlementService, /KEYBOARD_REPAIR: 'keyboard_repair'/, 'Keyboard Repair must use a named entitlement key.');
assert.match(entitlementService, /\[SUBSCRIPTION_TIERS\.PRO\]: \{[\s\S]*?keyboard_repair: true/, 'The Pro tier must enable Keyboard Repair.');
assert.match(jobForm, /keyboardRepairEnabled \|\| option\.value !== 'Keyboard'/, 'Generic intake must hide Keyboard from non-Pro shops.');
assert.match(jobInfo, /keyboardRepairEnabled \|\| option\.value !== 'Keyboard'/, 'Generic job editing must not offer a Keyboard conversion to non-Pro shops.');
assert.match(page, /Keyboard Repair is available on Pro\.[\s\S]*?Existing keyboard work orders remain available to view/, 'Downgraded shops must keep historical visibility with a clear upgrade message.');
assert.match(navigation, /'keyboards'[\s\S]*?'keyboard-detail'/, 'Workspace navigation must recognize Keyboard Repair modes.');
assert.match(workspaceState, /instrumentType === 'keyboard'[\s\S]*?'keyboard-detail'/, 'Refresh restoration must correct keyboard detail routing.');

for (const label of ['Keyboard Identity', 'Affected Keys', 'Keybed / Contact Notes', 'Power Supply Readings', 'Diagnosis', 'Repair Performed', 'Parts Replaced', 'Calibration / Adjustment Notes', 'Final Test']) {
  assert.ok(detail.includes(label), `Keyboard detail must include ${label}.`);
}
for (const label of ['Keys and key return', 'Velocity response', 'Aftertouch', 'Main audio outputs', 'MIDI DIN', 'USB data / host', 'Pedal inputs', 'Power and startup']) {
  assert.ok(keyboardRepairSource.includes(label), `Keyboard function testing must include ${label}.`);
}
assert.match(tests, /Initial function test[\s\S]*?Final function test/, 'Functional checks must retain distinct initial and final stages.');
assert.match(detail, /Qualified technicians only:[\s\S]*?hazardous voltage/, 'Keyboard power inspection must include a technician safety warning.');
assert.match(detail, /disabled=\{!canWrite\}/, 'Keyboard fields must enforce read-only permissions.');
assert.match(detail, /window\.confirm\('You have unsaved keyboard repair changes\./, 'Keyboard detail must protect dirty navigation.');
assert.match(detail, /onUpdate\?\.\(draft, \{ expectedUpdatedAt: draft\.updatedAt \}\)/, 'Keyboard saves must submit the loaded version.');
assert.match(jobService, /\.eq\('updated_at', expectedUpdatedAt\)/, 'Keyboard persistence must atomically compare the loaded version.');
assert.match(jobService, /const remotePayload = toDbJob\(newJob, \{ includeAssignment: true \}\);[\s\S]*?remotePayload\.job_number = '';[\s\S]*?create_job_with_number/, 'Hosted job creation must let PostgreSQL assign the final job number so concurrent repair intakes cannot claim the same browser preview.');
assert.doesNotMatch(detail, /NeckInspection|DamageMap|String Count|String Gauges/, 'Keyboard detail must not render guitar inspection controls.');

assert.match(migration, /\('shop', 'keyboard_repair', 'false'::jsonb\)[\s\S]*?\('pro', 'keyboard_repair', 'true'::jsonb\)/, 'The database plan matrix must reserve Keyboard Repair for Pro.');
assert.match(migration, /create or replace function private\.enforce_keyboard_repair_entitlement\(\)[\s\S]*?old_is_keyboard or new_is_keyboard[\s\S]*?private\.shop_has_entitlement\(new\.shop_id, 'keyboard_repair'\)/, 'Job writes must enforce the entitlement server-side, including historical keyboard rows.');
assert.match(migration, /security invoker[\s\S]*?set search_path = ''/, 'The entitlement trigger must be invoker-safe with a pinned search path.');
assert.match(migration, /revoke all on function private\.enforce_keyboard_repair_entitlement\(\) from public, anon, authenticated, service_role/, 'Clients must not execute the trigger helper directly.');
assert.match(migration, /create trigger jobs_enforce_keyboard_repair_entitlement[\s\S]*?before insert or update on public\.jobs/, 'The server entitlement guard must run for inserts and updates.');
assert.match(packageJson, /"check:keyboard-repair-module": "node scripts\/check-keyboard-repair-module\.mjs"/, 'The focused Keyboard Repair checker must be exposed.');

console.log('Keyboard repair module checks passed.');
