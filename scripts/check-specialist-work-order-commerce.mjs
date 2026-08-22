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
const amplifierDetail = read('src/modules/amplifiers/AmplifierJobDetail.jsx');
const keyboardWorkflow = read('src/modules/keyboards/KeyboardWorkflowPanel.jsx');
const keyboardDetail = read('src/modules/keyboards/KeyboardJobDetail.jsx');
const purchasingPanel = read('src/modules/inventory/SpecialistPurchasingPanel.jsx');
const inventoryService = read('src/modules/inventory/inventoryService.js');
const purchasingMigration = read('supabase/migrations/20260822033718_specialist_purchasing_bridge.sql');
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
assert.match(amplifierDetail, /<SpecialistPurchasingPanel[\s\S]*?onInventoryPartAdded=\{addInventoryPartToDraft\}/, 'Amplifier bench must expose job-linked purchasing and merge fulfilled parts into billing.');
assert.match(amplifierDetail, /async function addInventoryPartToDraft\(jobPart\)[\s\S]*?setDraft[\s\S]*?setBaseline[\s\S]*?await onRefresh\?\.\(\)/, 'Amplifier fulfillment must refresh the parent job collection after updating its local draft.');
assert.match(keyboardDetail, /async function addInventoryPartToDraft\(jobPart\)[\s\S]*?setDraft[\s\S]*?setBaseline[\s\S]*?await onRefresh\?\.\(\)/, 'Keyboard fulfillment must refresh the parent job collection after updating its local draft.');
assert.match(router, /<AmplifierJobDetail[\s\S]*?onRefresh=\{actions\.onRefreshJobs\}/, 'Amplifier fulfillment must receive the shared parent refresh action.');
assert.match(keyboardWorkflow, /<SpecialistPurchasingPanel[\s\S]*?keyboardPartRequests=\{workflow\.partRequests\}/, 'Keyboard fault requests must flow into job-linked purchasing.');
assert.match(keyboardWorkflow, /\['installed', 'ordered', 'received'\][\s\S]*?requestStatus/, 'Ordered and received keyboard states must be driven by purchasing instead of a manual status selector.');
assert.match(purchasingPanel, /submitLockRef\.current[\s\S]*?requestKeyRef\.current/, 'Specialist PO submission must have both a synchronous lock and a durable idempotency key.');
assert.match(purchasingPanel, /createSpecialistPurchaseOrder[\s\S]*?fulfillSpecialistPurchaseOrderItem/, 'Specialist purchasing must separate ordering from explicit billing fulfillment.');
assert.match(purchasingPanel, /fulfillSpecialistPurchaseOrderItem\(item\.id\)[\s\S]*?await onInventoryPartAdded\?\.\(jobPart\)/, 'Fulfillment must wait for parent billing state synchronization before reporting success.');
assert.match(purchasingPanel, /Open Inventory & Receiving/, 'Specialist benches must retain a clear route into normal receiving.');
assert.match(inventoryService, /rpc\('create_specialist_purchase_order'/, 'Specialist PO creation must use the atomic database operation.');
assert.match(inventoryService, /rpc\('fulfill_specialist_purchase_order_item'/, 'Specialist fulfillment must use the idempotent database operation.');
assert.match(purchasingMigration, /specialist_request_key[\s\S]*?create unique index purchase_order_items_specialist_request_key_uidx/, 'Database idempotency must be enforced by a unique request key.');
assert.match(purchasingMigration, /private\.can_write_job[\s\S]*?private\.shop_has_entitlement/, 'The database bridge must recheck job write access and the Pro specialist entitlement.');
assert.match(purchasingMigration, /sync_keyboard_request_from_purchase_item[\s\S]*?quantity_received > 0[\s\S]*?'received'/, 'Keyboard requests must become received only from a real PO receipt.');
assert.match(purchasingMigration, /fulfill_specialist_purchase_order_item[\s\S]*?job_part_id is not null[\s\S]*?return fulfilled_part/, 'Specialist billing fulfillment must be retry-safe.');
assert.match(styles, /\.specialist-workspace-nav[\s\S]*?@media \(max-width: 768px\)[\s\S]*?\.specialist-workspace-actions button/, 'Specialist workspace navigation must remain usable on mobile.');
assert.match(styles, /\.specialist-purchasing-grid[\s\S]*?@media \(max-width: 768px\)[\s\S]*?\.specialist-purchasing-grid/, 'Specialist purchasing controls must collapse for mobile.');

console.log('Specialist work-order commerce checks passed.');
