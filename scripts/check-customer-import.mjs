import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildCustomerImportIssueRows,
  buildCustomerImportPreview,
  CUSTOMER_IMPORT_SOURCE,
  detectCustomerCsvMapping,
  generateCustomerImportBatchId,
  serializeImportRowsToCsv,
  summarizeCustomerImportPreview
} from '../src/modules/customers/customerCsvImport.js';

const shopId = 'test-shop';
const importBatchId = generateCustomerImportBatchId();
const root = process.cwd();
const permissionService = readFileSync(join(root, 'src/modules/auth/permissionService.js'), 'utf8');
const customerService = readFileSync(join(root, 'src/modules/customers/customerService.js'), 'utf8');
const customerImportModal = readFileSync(join(root, 'src/modules/customers/CustomerImportModal.jsx'), 'utf8');

assert.match(importBatchId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'Import batch IDs must be UUIDs.');

const mapping = detectCustomerCsvMapping([
  'Customer Name',
  'Email Address',
  'Phone Number',
  'Street Address',
  'Notes'
]);

assert.equal(mapping.displayName, 'Customer Name', 'Customer Name should map to Name.');
assert.equal(mapping.email, 'Email Address', 'Email Address should map to Email.');
assert.equal(mapping.phone, 'Phone Number', 'Phone Number should map to Phone.');
assert.equal(mapping.addressLine1, 'Street Address', 'Street Address should map to Address.');
assert.equal(mapping.notes, 'Notes', 'Notes should map to Notes.');

const firstLastMapping = detectCustomerCsvMapping(['first_name', 'last_name', 'email']);
const firstLastPreview = buildCustomerImportPreview({
  rows: [{ first_name: 'Ada', last_name: 'Bench', email: 'ada@example.com' }],
  mapping: firstLastMapping,
  shopId,
  importBatchId
});

assert.equal(firstLastPreview.length, 1, 'First/last name row should be included.');
assert.equal(firstLastPreview[0].status, 'valid', 'First/last name should satisfy required name.');
assert.equal(firstLastPreview[0].customer.displayName, 'Ada Bench', 'First/last name should combine into display name.');

const preview = buildCustomerImportPreview({
  rows: [
    {
      'Customer Name': 'Jane Player',
      'Email Address': 'jane@example.com',
      'Phone Number': '555-010-1200',
      'Street Address': '123 Maple Street',
      Notes: 'Setup customer'
    },
    {
      'Customer Name': 'Jane Player',
      'Email Address': 'jane@example.com',
      'Phone Number': '555-010-1200',
      'Street Address': '123 Maple Street',
      Notes: 'Duplicate row'
    },
    {
      'Customer Name': '',
      'Email Address': 'noname@example.com',
      'Phone Number': '',
      'Street Address': '',
      Notes: ''
    },
    {
      'Customer Name': 'Bad Email',
      'Email Address': 'not-an-email',
      'Phone Number': '',
      'Street Address': '',
      Notes: ''
    },
    {
      'Customer Name': '',
      'Email Address': '',
      'Phone Number': '',
      'Street Address': '',
      Notes: ''
    }
  ],
  mapping,
  existingCustomers: [
    {
      id: 'existing-customer',
      shopId,
      displayName: 'Existing Customer',
      email: 'existing@example.com',
      phone: '555-010-9999'
    }
  ],
  shopId,
  importBatchId
});

assert.equal(preview.length, 4, 'Completely blank rows should be ignored.');
assert.equal(preview[0].status, 'valid', 'First row should be valid.');
assert.equal(preview[0].customer.importSource, CUSTOMER_IMPORT_SOURCE, 'Import source should be csv.');
assert.equal(preview[0].customer.importBatchId, importBatchId, 'Import batch metadata should be prepared.');
assert.equal(preview[1].status, 'duplicate', 'Duplicate rows within the CSV should be skipped.');
assert.match(preview[1].warnings.join(' '), /duplicate within this CSV/i, 'File duplicate should have a warning.');
assert.equal(preview[2].status, 'error', 'Missing name should be an error even if email exists.');
assert.match(preview[2].errors.join(' '), /missing required customer name/i, 'Missing name error should be clear.');
assert.equal(preview[3].status, 'error', 'Invalid email should be an error.');
assert.match(preview[3].errors.join(' '), /invalid email/i, 'Invalid email error should be clear.');

const existingDuplicatePreview = buildCustomerImportPreview({
  rows: [{ 'Customer Name': 'Existing Customer', 'Email Address': 'existing@example.com' }],
  mapping,
  existingCustomers: [
    {
      id: 'existing-customer',
      shopId,
      displayName: 'Existing Customer',
      email: 'existing@example.com',
      phone: '555-010-9999'
    }
  ],
  shopId,
  importBatchId
});

assert.equal(existingDuplicatePreview[0].status, 'duplicate', 'Possible existing customer duplicates should be skipped.');
assert.match(existingDuplicatePreview[0].warnings.join(' '), /existing customer/i, 'Existing duplicate warning should be clear.');

const summary = summarizeCustomerImportPreview(preview);
assert.equal(summary.total, 4, 'Preview summary should count nonblank rows.');
assert.equal(summary.importable, 1, 'Only valid/warning rows should be importable.');
assert.equal(summary.skipped, 3, 'Duplicate/error rows should be skipped.');

const issueRows = buildCustomerImportIssueRows(preview);
assert.equal(issueRows.length, 3, 'Issue CSV should include skipped duplicate/error rows.');
assert.match(serializeImportRowsToCsv(issueRows), /row_number,name,email,phone,address,notes,error,warnings,original_values/, 'Issue export should include expected headers.');

assert.ok(permissionService.includes('export function canImportData'), 'Permission service must export canImportData.');
assert.ok(permissionService.includes('SHOP_MANAGE_ROLES.has(normalizeRole(role))'), 'Customer import must be owner/admin scoped.');
assert.ok(permissionService.includes('!isReadOnlyStatus(entitlementSnapshot)'), 'Customer import must respect read-only lifecycle state.');
assert.ok(customerService.includes('const saveLocalBeforeRemote = options.saveLocalBeforeRemote !== false;'), 'Customer service must keep normal local fallback behavior configurable.');
assert.ok(customerImportModal.includes('saveLocalBeforeRemote: false'), 'Customer import must avoid local-only rows when remote save fails.');

const importRoles = new Set(['owner', 'admin']);
assert.equal(importRoles.has('owner'), true, 'Owner can import.');
assert.equal(importRoles.has('admin'), true, 'Admin can import.');
assert.equal(importRoles.has('tech'), false, 'Tech cannot import.');
assert.equal(importRoles.has('viewer'), false, 'Viewer cannot import.');

console.log('Customer CSV import checks passed.');
