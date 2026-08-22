import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

const app = read('src/app/App.jsx');
const router = read('src/app/WorkspaceRouter.jsx');
const navigation = read('src/app/SpecialistJobWorkspaceNav.jsx');
const detail = read('src/modules/jobs/JobDetail.jsx');
const shell = read('src/modules/jobs/JobDetailShell.jsx');
const tabs = read('src/modules/jobs/components/JobDetailTabs.jsx');
const inspection = read('src/modules/jobs/JobInspectionSections.jsx');
const billing = read('src/modules/jobs/JobBillingSections.jsx');
const workspaceState = read('src/app/workspaceState.js');
const styles = read('src/styles.css');

assert.match(navigation, /isAmplifierJob\(job\)[\s\S]*?'amplifier-detail'/, 'Amplifier jobs must map to the amplifier repair bench.');
assert.match(navigation, /isKeyboardJob\(job\)[\s\S]*?'keyboard-detail'/, 'Keyboard jobs must map to the keyboard repair bench.');
assert.match(navigation, /Work Order, Parts &amp; Payments/, 'Specialist jobs must expose a plainly named commercial workspace.');
assert.match(navigation, /nextMode !== activeMode[\s\S]*?onSelectMode\?\.\(job\.id, nextMode\)/, 'Selecting the active workspace must be a no-op instead of triggering the dirty-state guard.');
assert.match(navigation, /onClick=\{\(\) => selectMode\(repairMode\)\}/, 'The commercial workspace must provide a return path to the correct repair bench.');
assert.match(navigation, /onClick=\{\(\) => selectMode\('detail'\)\}/, 'The repair bench must open the standard job workspace.');

assert.match(router, /mode === 'detail'[\s\S]*?<SpecialistJobWorkspaceNav[\s\S]*?<JobDetail/, 'The standard job view must retain specialist workspace navigation.');
assert.match(router, /initialTab=\{getSpecialistRepairMode\(selectedJob\) \? 'billing' : 'overview'\}/, 'Specialist jobs must open the standard job view directly on Parts & Billing.');
assert.match(router, /mode === 'amplifier-detail'[\s\S]*?<SpecialistJobWorkspaceNav[\s\S]*?<AmplifierJobDetail/, 'Amplifier detail must expose the shared work-order navigation.');
assert.match(router, /mode === 'keyboard-detail'[\s\S]*?<SpecialistJobWorkspaceNav[\s\S]*?<KeyboardJobDetail/, 'Keyboard detail must expose the shared work-order navigation.');
assert.match(app, /onSelectJobMode: selectWorkspaceJob/, 'Workspace mode switching must use the established dirty-state navigation guard.');
assert.match(workspaceState, /workspaceState\.mode === 'detail' \? 'detail' : specialistMode/, 'An explicitly selected specialist commercial workspace must survive refresh.');

assert.match(detail, /initialTab = 'overview'[\s\S]*?initialTab=\{initialTab\}/, 'Job Detail must accept a safe initial tab without changing normal jobs.');
assert.match(shell, /initialTab=\{initialTab\}/, 'Job Detail shell must forward the initial tab.');
assert.match(tabs, /useState\(initialTab\)/, 'Job Detail tabs must honor the requested specialist billing entry point.');
assert.match(tabs, /amplifier[\s\S]*?Amplifier Inspection[\s\S]*?keyboard[\s\S]*?Keyboard Inspection/, 'Specialist work orders must use instrument-specific inspection tab labels.');
assert.match(inspection, /instrumentType === 'Amplifier'[\s\S]*?<AmplifierElectricalMeasurements/, 'Amplifier inspection must render amplifier electrical and digital fields instead of guitar controls.');
assert.match(inspection, /instrumentType === 'Keyboard'[\s\S]*?<KeyboardFunctionalTests[\s\S]*?<KeyboardDiagnosticChecklist/, 'Keyboard inspection must render keyboard functional and diagnostic fields instead of guitar controls.');
assert.match(inspection, /if \(instrumentType === 'Keyboard'\)[\s\S]*?return \([\s\S]*?Keyboard Inspection/, 'Keyboard inspection must have its own terminology.');
assert.match(inspection, /return \([\s\S]*?<TechDetailsSection[\s\S]*?<DamageMapSection/, 'Guitar work orders must retain the established neck and Damage Map inspection.');
assert.match(billing, /<PartsList[\s\S]*?<ServicesList[\s\S]*?<TotalsSection/, 'Specialist commerce must reuse the complete parts, services, totals, and payments workflow.');
assert.match(styles, /\.specialist-workspace-nav[\s\S]*?@media \(max-width: 768px\)[\s\S]*?\.specialist-workspace-actions button/, 'Specialist workspace navigation must remain usable on mobile.');

console.log('Specialist work-order commerce checks passed.');
