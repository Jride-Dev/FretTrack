import assert from 'node:assert/strict';
import { buildAccountingReport } from '../src/modules/accounting/accountingSelectors.js';
import { buildAccountingCsv } from '../src/modules/accounting/accountingExport.js';

const shopProfile = {
  shopId: 'shop-1',
  currencyCode: 'USD',
  locale: 'en-US',
  dateFormat: 'MM/DD/YYYY',
  taxCalculationMode: 'manual',
  taxLabel: 'Sales Tax',
  taxState: 'CA',
  defaultTaxRate: '8.25',
  taxRegistrationNumber: 'CA-123',
  defaultTaxProfileId: 'profile-1',
  taxProfileRevision: 4,
  taxablePartsDefault: true,
  taxableServicesDefault: true
};

const report = buildAccountingReport([
  {
    id: 'job-1',
    shopId: 'shop-1',
    jobNumber: '260901-001',
    customerName: 'Paid Customer',
    status: 'Completed',
    dateReceived: '2026-09-01',
    services: [{ id: 'service-1', description: 'Setup', quantity: 1, retail: 100 }],
    parts: [],
    techDetails: { payments: [{ id: 'payment-1', amount: 108.25, method: 'Card', date: '2026-09-01' }] }
  },
  {
    id: 'job-2',
    shopId: 'shop-1',
    jobNumber: '260902-002',
    customerName: 'Open Customer',
    status: 'In Progress',
    dateReceived: '2026-09-02',
    services: [{ id: 'service-2', description: 'Repair', quantity: 1, retail: 50 }],
    parts: [],
    techDetails: { tax: { rateSource: 'job', salesTaxRate: '7.5', state: 'CA' }, payments: [] }
  }
], { shopId: 'shop-1', shopProfile, startDate: '2026-09-01', endDate: '2026-09-30' });

assert.equal(report.taxProfile.profileId, 'profile-1', 'Accounting reports must identify the active tax profile.');
assert.equal(report.taxProfile.profileRevision, 4, 'Accounting reports must expose the active tax profile revision.');
assert.equal(report.taxProfile.defaultRatePercent, 8.25, 'Tax profile rates must remain numeric and preserve decimal precision.');
assert.equal(report.taxProfile.jobOverrideCount, 1, 'Reports must count explicit job-level tax overrides.');
assert.equal(report.taxProfile.hasMixedSnapshots, true, 'Reports must warn when a range mixes tax snapshots.');
assert.deepEqual(report.salesHistory.map((row) => row.jobNumber), ['260902-002', '260901-001'], 'Sales history must be newest first.');
assert.equal(report.salesHistory[0].balanceDue, 53.75, 'Sales history must use the same rounded totals as accounting.');
assert.equal(report.salesHistory[1].balanceDue, 0, 'Paid sales must show a zero balance.');

const csv = buildAccountingCsv(report);
assert.match(csv, /Tax Profile Revision,4/, 'CSV export must include the active tax-profile revision.');
assert.match(csv, /Sales History/, 'CSV export must include a sales-history section.');
assert.match(csv, /260902-002,Open Customer/, 'CSV export must include sales-history rows.');

console.log('Tax-profile and sales-history checks passed.');
