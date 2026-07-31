import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');

const printActions = read('src/modules/jobs/PrintActions.js');
const customerManager = read('src/modules/customers/CustomerManager.jsx');
const customerImportPreview = read('src/modules/customers/CustomerImportPreviewPanel.jsx');
const inventoryPage = read('src/modules/inventory/InventoryPage.jsx');
const inventoryVendorsTab = read('src/modules/inventory/InventoryVendorsTab.jsx');
const schedulingPage = read('src/modules/scheduling/SchedulingPage.jsx');
const scheduleEventDetails = read('src/modules/scheduling/ScheduleEventDetailsDialog.jsx');
const auditedNavigationSource = [
  printActions,
  customerManager,
  customerImportPreview,
  inventoryPage,
  inventoryVendorsTab,
  schedulingPage,
  scheduleEventDetails
].join('\n');

assert.doesNotMatch(auditedNavigationSource, /Close Job Detail/, 'A detail-only action must not imply that it closes a job.');
assert.match(printActions, />Close Detail<\/button>/, 'Job Detail must keep its explicit Close Detail action.');
assert.match(printActions, />Finish \/ Picked Up<\/button>/, 'Job completion must remain labeled Finish / Picked Up.');

assert.match(customerManager, /aria-label="Cancel customer form">Cancel<\/button>/, 'Customer forms must expose a clear Cancel action.');
assert.match(customerImportPreview, />Close Preview<\/button>/, 'Customer import preview must name the view being closed.');

assert.match(inventoryPage, /selectedPart \? 'Save Changes' : 'Save Part'/, 'Part editing must distinguish Save Changes from creating a part.');
assert.ok(inventoryPage.includes("selectedPart && <button type=\"button\" onClick={() => resetForm()} disabled={isSaving}>Cancel</button>"), 'Part editing must expose a Cancel action.');
assert.ok(inventoryVendorsTab.includes('selectedVendor && <button type="button" onClick={onResetVendor}>Cancel</button>'), 'Vendor editing must expose a Cancel action.');
assert.match(inventoryVendorsTab, /selectedVendor \? 'Save Changes' : 'Save Vendor'/, 'Vendor editing must distinguish Save Changes from creating a vendor.');
assert.match(inventoryPage, /onClick={closePurchaseOrderDetail}>Close Detail<\/button>/, 'Purchase Order detail must expose Close Detail.');

assert.match(schedulingPage, /editingEventId \? 'Save Changes' : 'Save Event'/, 'Schedule editing must distinguish Save Changes from creating an event.');
assert.match(schedulingPage, /editingEventId \? 'Cancel' : 'Clear Form'/, 'Schedule editing must expose Cancel without labeling form reset ambiguously.');
assert.equal((scheduleEventDetails.match(/>Close Detail<\/button>/g) || []).length, 1, 'Schedule Event details must include the standard footer Close Detail action.');
assert.match(scheduleEventDetails, /className="modal-close"[\s\S]*Close Detail/, 'Schedule Event details must include the standard heading Close Detail action.');

console.log('Navigation clarity checks passed.');
