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
  buildKeyboardCustomerReport,
  buildKeyboardRepairAnalytics,
  findKeyboardInventoryMatches,
  keyboardMidiRange,
  midiNoteLabel,
  normalizeKeyboardChecklist,
  parseMidiDiagnosticLog
} from '../src/modules/keyboards/keyboardDiagnostics.js';
import {
  getBrandsForInstrumentType,
  getModelsForBrand,
  isStringedInstrumentType,
  normalizeInstrumentType
} from '../src/modules/instruments/instrumentService.js';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const migrationPath = 'supabase/migrations/20260817003514_pro_keyboard_repair_foundation.sql';
const workflowMigrationPath = 'supabase/migrations/20260817005658_keyboard_repair_crm_workflow.sql';
const fulfillmentMigrationPath = 'supabase/migrations/20260817011009_keyboard_part_request_fulfillment.sql';
const hardeningMigrationPath = 'supabase/migrations/20260817011534_harden_keyboard_repair_workflow.sql';
const normalizedMigrationPath = 'supabase/migrations/20260817012310_normalize_keyboard_damage_map.sql';
assert.ok(existsSync(join(root, migrationPath)), 'The authoritative Keyboard Repair migration must exist.');
assert.ok(existsSync(join(root, workflowMigrationPath)), 'The Keyboard Repair CRM workflow migration must exist.');
assert.ok(existsSync(join(root, fulfillmentMigrationPath)), 'The atomic Keyboard Repair parts fulfillment migration must exist.');
assert.ok(existsSync(join(root, hardeningMigrationPath)), 'The Keyboard Repair workflow hardening migration must exist.');
assert.ok(existsSync(join(root, normalizedMigrationPath)), 'The normalized Keyboard Repair damage-map migration must exist.');

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
const workflowMigration = read(workflowMigrationPath);
const fulfillmentMigration = read(fulfillmentMigrationPath);
const hardeningMigration = read(hardeningMigrationPath);
const normalizedMigration = read(normalizedMigrationPath);
const workflowPanel = read('src/modules/keyboards/KeyboardWorkflowPanel.jsx');
const workflowService = read('src/modules/keyboards/keyboardWorkflowService.js');
const keybedSvg = read('src/modules/keyboards/KeyboardKeybedSvg.jsx');
const checklistPanel = read('src/modules/keyboards/KeyboardDiagnosticChecklist.jsx');
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
assert.equal(normalizeKeyboardDetails({}).sensorTechnology, 'Unknown', 'Keyboard profiles must receive a stable sensor default.');
assert.equal(midiNoteLabel(21), 'A0', 'MIDI 21 must map to the lowest key of a standard 88-key piano.');
assert.equal(midiNoteLabel(108), 'C8', 'MIDI 108 must map to the highest key of a standard 88-key piano.');
assert.deepEqual([keyboardMidiRange('88')[0], keyboardMidiRange('88').at(-1)], [21, 108], 'An 88-key map must cover A0 through C8.');
assert.equal(normalizeKeyboardChecklist({}, 'Digital Piano').templateKey, 'piano', 'Digital pianos must receive the piano diagnostic path.');
assert.equal(findKeyboardInventoryMatches([{ id: 'contact', name: 'Rubber Contact Strip', quantityOnHand: 2 }], 'dead_rubber_contact')[0].id, 'contact', 'Contact faults must cross-reference matching inventory.');
assert.deepEqual(parseMidiDiagnosticLog('NOTE_ON ch=1 note=60 velocity=100\nNOTE_OFF ch=1 note=60 velocity=0'), [], 'A complete note-on/off pair must not create a MIDI finding.');
assert.deepEqual(parseMidiDiagnosticLog('NOTE_ON ch=1 note=60 velocity=100\nNOTE_ON ch=1 note=60 velocity=0'), [], 'A velocity-zero note-on must close an active note normally.');
assert.equal(parseMidiDiagnosticLog('NOTE_ON ch=1 note=61 velocity=0')[0].faultCode, 'zero_velocity', 'An unmatched zero-velocity trigger must be surfaced for review.');
assert.equal(parseMidiDiagnosticLog('NOTE_ON ch=1 note=62 velocity=80')[0].faultCode, 'missing_note_off', 'An unclosed note-on must be surfaced for review.');
assert.equal(parseMidiDiagnosticLog('NOTE_ON note=60 velocity=0\nNOTE_ON note=60 velocity=80').length, 1, 'Multiple anomalies on one physical key must collapse into one authoritative preview.');
const analytics = buildKeyboardRepairAnalytics([{ ...keyboardJob, id: 'analytics', status: 'On Bench' }], [{ conditionStatus: 'fault', faultCode: 'velocity_spike' }]);
assert.equal(analytics.openJobs, 1, 'Keyboard analytics must count open keyboard work.');
assert.equal(analytics.topFault[0], 'Velocity Spike', 'Keyboard analytics must summarize standardized fault labels.');
assert.match(buildKeyboardCustomerReport(keyboardJob, [{ conditionStatus: 'fault', keyLabel: 'C3', faultCode: 'dead_key', notes: '' }]).body, /C3: Dead Key/, 'Customer reports must include visual key findings.');
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
for (const label of ['Sensor Technology', 'Visual Keybed Diagnostics', 'Raw MIDI Diagnostic Log', 'Guided Diagnostic Checklist']) {
  assert.ok(detail.includes(label) || workflowPanel.includes(label) || checklistPanel.includes(label), `Keyboard workflow must include ${label}.`);
}
assert.match(workflowPanel, /findKeyboardInventoryMatches[\s\S]*?fulfillKeyboardPartRequest/, 'Fault matches must connect to atomic inventory request fulfillment.');
assert.match(workflowPanel, /parseMidiDiagnosticLog[\s\S]*?Apply MIDI Findings/, 'The bench log parser must preview and deliberately apply detected MIDI anomalies.');
assert.match(keybedSvg, /<svg[\s\S]*?role="button"/, 'The visual damage map must expose keyboard-accessible SVG keys.');
assert.match(keybedSvg, /tone-\$\{keyTone/, 'The visual damage map must apply a color-coded health tone to every key.');
assert.match(workflowPanel, /sendCustomerMessage\(savedJob,[\s\S]*?templateKey: 'keyboard_diagnostic_report'/, 'Customer diagnostic reports must use established message persistence.');
assert.match(workflowService, /\.eq\('updated_at', expectedUpdatedAt\)/, 'Per-key writes must reject stale technician sessions.');
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
assert.match(workflowMigration, /create table public\.keyboard_key_states[\s\S]*?unique \(job_id, midi_note\)/, 'The workflow must store one authoritative finding per job key.');
assert.match(workflowMigration, /create table public\.keyboard_part_requests[\s\S]*?inventory_part_id uuid references public\.parts/, 'Parts requests must link existing shop inventory when available.');
assert.match(workflowMigration, /alter table public\.keyboard_key_states enable row level security[\s\S]*?alter table public\.keyboard_part_requests enable row level security/, 'Keyboard workflow tables must enable RLS.');
assert.match(workflowMigration, /private\.can_write_job\(job_id\)[\s\S]*?private\.shop_has_entitlement\(jobs\.shop_id, 'keyboard_repair'\)/, 'Keyboard workflow mutations must require job writes and current entitlement.');
assert.match(workflowMigration, /grant select, insert, update, delete on public\.keyboard_key_states, public\.keyboard_part_requests to authenticated, service_role/, 'New workflow tables must explicitly opt in to Data API roles.');
assert.match(fulfillmentMigration, /for update[\s\S]*?public\.add_inventory_part_to_job[\s\S]*?request_status = 'installed'/, 'Parts fulfillment must lock the request and update inventory plus request state in one transaction.');
assert.match(fulfillmentMigration, /if target_request\.job_part_id is not null[\s\S]*?return fulfilled_part/, 'Parts fulfillment retries must return the original job part without consuming stock twice.');
assert.match(hardeningMigration, /revoke update on public\.keyboard_part_requests from authenticated[\s\S]*?grant update \(requested_part, quantity, request_status, notes\)/, 'Clients must not be able to forge the fulfillment linkage column.');
assert.match(hardeningMigration, /alter function public\.fulfill_keyboard_part_request\(uuid\) security definer/, 'Atomic fulfillment must own the protected linkage update after client column access is revoked.');
for (const code of ['velocity_spike', 'no_trigger', 'stuck_note', 'broken_stem']) {
  assert.ok(normalizedMigration.includes(`('${code}'`), `The normalized fault catalog must seed ${code}.`);
}
assert.match(normalizedMigration, /create table public\.keyboard_profiles[\s\S]*?key_count[\s\S]*?action_type[\s\S]*?sensor_type/, 'Keyboard profiles must normalize the physical keybed definition.');
assert.match(normalizedMigration, /create table public\.key_damage_map[\s\S]*?unique \(job_id, key_index\)/, 'The normalized damage map must store one authoritative row per physical key.');
assert.match(normalizedMigration, /create table public\.keyboard_part_compatibility[\s\S]*?part_scope[\s\S]*?group_size/, 'Inventory compatibility must support individual keys and grouped contact strips.');
assert.match(normalizedMigration, /alter table public\.fault_codes enable row level security[\s\S]*?grant select on public\.fault_codes, public\.keyboard_profiles to authenticated/, 'Normalized keyboard tables must enable RLS and explicitly opt into the Data API.');
assert.match(packageJson, /"check:keyboard-repair-module": "node scripts\/check-keyboard-repair-module\.mjs"/, 'The focused Keyboard Repair checker must be exposed.');

console.log('Keyboard repair module checks passed.');
