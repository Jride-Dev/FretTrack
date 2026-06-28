import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import {
  buildCustomerCsvIssueCsv,
  buildCustomerCsvIssueRows,
  buildCustomerCsvPreview,
  buildCustomerCsvPreviewRows,
  detectCustomerCsvMapping,
  parseCustomerCsvText,
  summarizeCustomerCsvPreview
} from '../src/modules/customers/customerCsvPreview.js';

const root = process.cwd();
const templatePath = join(root, 'public/templates/frettrack-customer-import-template.csv');
const previewHelperPath = join(root, 'src/modules/customers/customerCsvPreview.js');
const appPath = join(root, 'src/app/App.jsx');
const customerServicePath = join(root, 'src/modules/customers/customerService.js');
const stylesPath = join(root, 'src/styles.css');

assert.equal(typeof Papa.parse, 'function', 'PapaParse import must resolve.');
assert.equal(existsSync(templatePath), true, 'Customer import CSV template must exist.');

const template = readFileSync(templatePath, 'utf8');
assert.match(template, /^name,email,phone,address,notes/m, 'Template must include the expected customer import columns.');

const previewHelper = readFileSync(previewHelperPath, 'utf8');
assert.doesNotMatch(previewHelper, /customerService/i, 'Preview helper must not import customerService.');
assert.doesNotMatch(previewHelper, /supabase/i, 'Preview helper must not import or call Supabase.');
assert.doesNotMatch(previewHelper, /\.from\s*\(\s*['"`]/, 'Preview helper must not contain database calls.');

const untouchedDiff = execFileSync('git', [
  'diff',
  '--name-only',
  '--',
  appPath,
  customerServicePath,
  stylesPath
], { encoding: 'utf8' }).trim();
assert.equal(untouchedDiff, '', 'App.jsx, customerService.js, and styles.css must stay untouched in this foundation pass.');

const mapping = detectCustomerCsvMapping([
  'Customer Name',
  'Email Address',
  'Phone Number',
  'Street Address',
  'Notes'
]);
assert.equal(mapping.name, 'Customer Name', 'customer_name alias should map to name.');
assert.equal(mapping.email, 'Email Address', 'email_address alias should map to email.');
assert.equal(mapping.phone, 'Phone Number', 'phone_number alias should map to phone.');
assert.equal(mapping.address, 'Street Address', 'street_address alias should map to address.');
assert.equal(mapping.notes, 'Notes', 'notes alias should map to notes.');

const firstLastMapping = detectCustomerCsvMapping(['first_name', 'last_name', 'email_address']);
const firstLastPreview = buildCustomerCsvPreviewRows({
  headers: ['first_name', 'last_name', 'email_address'],
  mapping: firstLastMapping,
  rows: [{ first_name: 'Ada', last_name: 'Bench', email_address: 'ada@example.com' }]
});
assert.equal(firstLastPreview.length, 1, 'First/last name row should be included.');
assert.equal(firstLastPreview[0].normalized.name, 'Ada Bench', 'First and last names should combine into name.');
assert.equal(firstLastPreview[0].status, 'valid', 'First/last name should satisfy required name.');

const csvText = [
  'customer_name,email_address,phone_number,street_address,notes',
  '"Ada, Bench",ada@example.com,555-111-2222,"123 Test, Suite 1","quoted ""note"""',
  'Ada Bench,ada@example.com,555-111-2222,Duplicate row,duplicate',
  ',nameless@example.com,555-000-0000,Missing name,missing',
  'Bad Email,not-an-email,555-333-4444,Bad email,bad',
  'Contact Warning,,,No contact,warning',
  ',,,,',
  '"Multiline Customer",multi@example.com,555-999-0000,"Line 1',
  'Line 2","notes with',
  'newline"'
].join('\n');

const parsed = parseCustomerCsvText(csvText);
assert.equal(parsed.rows.length, 7, 'PapaParse should parse quoted commas and multiline rows.');

const preview = buildCustomerCsvPreview({ csvText });
assert.equal(preview.previewRows.length, 6, 'Completely blank rows should be ignored.');
assert.equal(preview.previewRows[0].status, 'valid', 'First row should be valid.');
assert.equal(preview.previewRows[0].normalized.name, 'Ada, Bench', 'Quoted comma name should parse correctly.');
assert.match(preview.previewRows[0].normalized.notes, /quoted "note"/, 'Quoted values should unescape double quotes.');
assert.equal(preview.previewRows[1].status, 'duplicate', 'Duplicate rows within the file should be skipped.');
assert.match(preview.previewRows[1].warnings.join(' '), /duplicate within this CSV/i, 'Duplicate row warning should be clear.');
assert.equal(preview.previewRows[2].status, 'error', 'Missing name should be an error.');
assert.match(preview.previewRows[2].errors.join(' '), /missing required customer name/i, 'Missing name error should be clear.');
assert.equal(preview.previewRows[3].status, 'error', 'Invalid email should be an error.');
assert.match(preview.previewRows[3].errors.join(' '), /invalid email/i, 'Invalid email error should be clear.');
assert.equal(preview.previewRows[4].status, 'warning', 'Rows without email/phone should remain previewable with a warning.');
assert.match(preview.previewRows[5].normalized.addressLine1, /Line 1\nLine 2/, 'Multiline quoted CSV cells should parse correctly.');

const existingDuplicatePreview = buildCustomerCsvPreviewRows({
  headers: ['name', 'email'],
  mapping: detectCustomerCsvMapping(['name', 'email']),
  existingCustomers: [{ id: 'existing-1', displayName: 'Existing Customer', email: 'existing@example.com' }],
  rows: [{ name: 'Existing Customer', email: 'existing@example.com' }]
});
assert.equal(existingDuplicatePreview[0].status, 'duplicate', 'Existing customer duplicates should be detected.');
assert.match(existingDuplicatePreview[0].warnings.join(' '), /existing customer/i, 'Existing duplicate warning should be clear.');

const summary = summarizeCustomerCsvPreview(preview.previewRows);
assert.equal(summary.total, 6, 'Preview summary should count nonblank rows.');
assert.equal(summary.valid, 2, 'Preview summary should count valid rows.');
assert.equal(summary.warning, 1, 'Preview summary should count warning rows.');
assert.equal(summary.duplicate, 1, 'Preview summary should count duplicate rows.');
assert.equal(summary.error, 2, 'Preview summary should count error rows.');
assert.equal(summary.importable, 3, 'Valid and warning rows are preview importable later.');
assert.equal(summary.skipped, 3, 'Duplicate and error rows should be skipped later.');

const issueRows = buildCustomerCsvIssueRows(preview.previewRows);
assert.equal(issueRows.length, 3, 'Issue CSV should include duplicate and error rows.');

const issueCsv = buildCustomerCsvIssueCsv(preview.previewRows);
assert.match(issueCsv, /row_number,status,name,email,phone,address,notes,errors,warnings,original_values/, 'Issue CSV should include stable headers.');
assert.match(issueCsv, /"Ada Bench"/, 'Issue CSV should include duplicate row data.');
assert.match(issueCsv, /"""/, 'Issue CSV should escape quotes.');
assert.match(issueCsv, /"[^"]*,[^"]*"/, 'Issue CSV should quote comma-containing values.');

console.log('Customer import parser checks passed.');
