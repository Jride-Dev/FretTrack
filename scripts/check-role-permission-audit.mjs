import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();

function source(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function assertIncludes(value, expected, message) {
  assert.ok(value.includes(expected), message || `Expected source to include ${expected}`);
}

function assertMatches(value, pattern, message) {
  assert.ok(pattern.test(value), message || `Expected source to match ${pattern}`);
}

const helpers = source('src/modules/auth/permissionService.js');
const app = source('src/app/App.jsx');
const inventory = source('src/modules/inventory/InventoryPage.jsx');
const shipping = source('src/modules/shipping/ShippingDashboard.jsx');
const scheduling = source('src/modules/scheduling/SchedulingPage.jsx');
const customerManager = source('src/modules/customers/CustomerManager.jsx');
const jobDetail = source('src/modules/jobs/JobDetail.jsx');
const currentAccessPanel = app.slice(app.indexOf('function InternalCurrentAccessPanel'));

for (const helperName of [
  'canAccessOperatorDashboard',
  'canManageBilling',
  'canManageShopSettings',
  'canManageTeamMembers',
  'canManageInventory',
  'canManageVendors',
  'canManagePurchaseOrders',
  'canWriteShipping',
  'canManageCustodyEvents',
  'canEditPhotos',
  'canOverwritePhotos',
  'canDeletePhotos',
  'canEditScheduling',
  'canEditCustomers',
  'canEditJobs',
  'canViewAdvancedReporting',
  'canUsePhotoEditor'
]) {
  assertIncludes(helpers, `export function ${helperName}`, `${helperName} must remain centralized.`);
}

assertIncludes(helpers, "const SHOP_WRITE_ROLES = new Set(['owner', 'admin', 'tech']);", 'Owner, admin, and tech must remain operational write roles.');
assertIncludes(helpers, "const SHOP_MANAGE_ROLES = new Set(['owner', 'admin']);", 'Only owner/admin may manage shop settings or view billing.');
assertIncludes(helpers, "const SHOP_OWNER_ROLES = new Set(['owner']);", 'Owner-only billing management must stay explicit.');
assertMatches(helpers, /export function canEditJobs[\s\S]*?return canWriteShop/, 'Job writes must use the centralized lifecycle-aware write check.');
assertMatches(helpers, /export function canEditCustomers[\s\S]*?return canWriteShop/, 'Customer writes must use the centralized lifecycle-aware write check.');
assertMatches(helpers, /export function canEditScheduling[\s\S]*?return canWriteShop/, 'Schedule writes must use the centralized lifecycle-aware write check.');
assertMatches(helpers, /export function canManageInventory[\s\S]*?return canWriteShop/, 'Inventory writes must use the centralized lifecycle-aware write check.');
assertMatches(helpers, /export function canManageShipments[\s\S]*?return canWriteShop/, 'Shipping writes must use the centralized lifecycle-aware write check.');
assertMatches(helpers, /export function canManageBilling[\s\S]*?SHOP_OWNER_ROLES[\s\S]*?!isReadOnlyStatus/, 'Billing management must stay owner-only and lifecycle-aware.');
assertMatches(helpers, /export function canManageTeamMembers[\s\S]*?SHOP_MANAGE_ROLES[\s\S]*?hasTeamMembersEntitlement/, 'Team management must remain owner/admin plus entitlement gated.');
assertMatches(helpers, /export function canAccessOperatorDashboard[\s\S]*?return Boolean\(isOperator\)/, 'Operator access must require verified operator state.');
assertMatches(helpers, /export function canViewAdvancedReporting[\s\S]*?canUseAdvancedReporting/, 'Advanced reports must remain entitlement gated.');

assertIncludes(app, "mode === 'operator' && canAccessOperatorDashboard({ isOperator })", 'Operator route must remain verified-operator gated.');
assertIncludes(app, "return canAccessOperatorDashboard({ isOperator });", 'Workspace restoration must not restore operator mode for a non-operator.');
assertIncludes(app, 'canEditCustomersForRole(permissionContext)', 'Customers must receive the centralized edit permission.');
assertIncludes(app, 'canManageInventoryForRole(permissionContext)', 'Inventory must receive the centralized inventory permission.');
assertIncludes(app, 'canManageShipmentsForRole(permissionContext)', 'Shipping must receive the centralized shipping permission.');
assertIncludes(app, 'canEditSchedulingForRole(permissionContext)', 'Scheduling must receive the centralized scheduling permission.');
assertIncludes(app, 'canEditJobsForRole(permissionContext)', 'Jobs must receive the centralized job permission.');
assertIncludes(inventory, 'if (!canWrite)', 'Inventory mutation handlers must enforce write access.');
assertIncludes(shipping, 'if (!canWrite)', 'Shipping mutation handlers must enforce write access.');
assertIncludes(scheduling, '{canWrite && <button type="button" onClick={() => editEvent(scheduleEvent)}>Edit</button>}', 'Read-only users must not receive schedule edit controls.');
assertIncludes(customerManager, 'canWrite && <button type="button" className="primary-action"', 'Customer creation must remain guarded.');
assertIncludes(jobDetail, "throw new Error('Your shop role is read-only.')", 'Job save path must reject read-only writes.');
assertIncludes(jobDetail, 'canWrite={canWrite}', 'Job Detail child sections must receive write state.');
assertIncludes(currentAccessPanel, 'if (!canAccessOperatorDashboard({ isOperator }))', 'Current Access panel must stay operator-only.');

console.log('Role permission audit checks passed.');
