import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateJobTotals } from '../src/modules/billing/accounting.js';
import {
  resolveJobTaxSettings,
  withResolvedJobTaxSettings
} from '../src/modules/billing/jobTaxSettings.js';
import {
  buildInvoiceEmailDraft,
  resolveScopedShopEmailSettings
} from '../src/modules/jobs/emailDocuments.js';
import { buildJobAccountingSnapshot } from '../src/modules/accounting/accountingSelectors.js';
import { calculateTillSummary } from '../src/modules/jobs/jobSelectors.js';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const shop = {
  shopId: 'uk-shop',
  shopName: 'UK Test Shop',
  defaultTaxRate: '20',
  taxLabel: 'VAT',
  currencyCode: 'GBP',
  locale: 'en-GB'
};
const legacyJob = {
  id: 'legacy-job',
  shopId: 'uk-shop',
  jobNumber: '260731-001',
  customerName: 'Beta Customer',
  email: 'customer@example.test',
  parts: [{ id: 'part-1', name: 'Part', quantity: 1, retail: 100 }],
  services: [],
  techDetails: {
    tax: {
      salesTaxRate: '0',
      taxLabel: 'VAT',
      taxableParts: true,
      taxableServices: false
    },
    payments: []
  }
};

const legacyTax = resolveJobTaxSettings(legacyJob, shop);
assert.equal(legacyTax.salesTaxRate, '20', 'An existing shop-linked job must follow the current Shop Settings VAT rate.');
assert.equal(legacyTax.rateSource, 'shop', 'Legacy tax snapshots must be treated as inherited shop defaults.');
assert.equal(legacyJob.techDetails.tax.salesTaxRate, '0', 'Resolving the current VAT rate must not mutate stored job data.');

const updatedShopTax = resolveJobTaxSettings(legacyJob, { ...shop, defaultTaxRate: '21' });
assert.equal(updatedShopTax.salesTaxRate, '21', 'A later Shop Settings VAT change must reach an existing inherited job.');

const explicitOverrideJob = {
  ...legacyJob,
  techDetails: {
    ...legacyJob.techDetails,
    tax: {
      ...legacyJob.techDetails.tax,
      salesTaxRate: '5',
      rateSource: 'job'
    }
  }
};
assert.equal(
  resolveJobTaxSettings(explicitOverrideJob, shop).salesTaxRate,
  '5',
  'An explicitly edited per-job tax rate must remain an override.'
);

const jobWithCurrentTax = withResolvedJobTaxSettings(legacyJob, shop);
const totals = calculateJobTotals(jobWithCurrentTax, jobWithCurrentTax.techDetails.tax);
assert.equal(totals.salesTaxAmount, 20, 'A £100 taxable job must calculate £20 VAT at the current 20% shop rate.');
assert.equal(totals.totalDue, 120, 'The current shop VAT must be included in the existing job total.');

const scopedEmailSettings = resolveScopedShopEmailSettings(legacyJob, shop);
assert.equal(scopedEmailSettings.defaultTaxRate, '20', 'Generated invoice context must carry the current shop VAT rate.');
const invoice = buildInvoiceEmailDraft(jobWithCurrentTax, {
  shopSettings: scopedEmailSettings,
  totals,
  taxLabel: 'VAT',
  moneyOptions: { currency: 'GBP', locale: 'en-GB' }
});
assert.match(invoice.body, /VAT: £20\.00/, 'A newly generated invoice for an existing job must show current VAT.');
assert.match(invoice.body, /Total: £120\.00/, 'A newly generated invoice must include current VAT in its total.');

const accountingSnapshot = buildJobAccountingSnapshot(legacyJob, { shopProfile: shop });
assert.equal(accountingSnapshot.taxSnapshot.tax_rate_percent, 20, 'Accounting reports must use the same current inherited shop VAT rate.');
assert.equal(accountingSnapshot.taxAmount, 20, 'Accounting VAT totals must match Job Detail and invoices.');
const tillSummary = calculateTillSummary([legacyJob], { shopProfile: shop });
assert.equal(tillSummary.salesTaxAccrued, 20, 'The till summary must use the same current inherited shop VAT rate.');
assert.equal(tillSummary.openBalance, 120, 'The till open balance must include the current inherited shop VAT rate.');

const jobDetail = read('src/modules/jobs/JobDetail.jsx');
const jobDetailFormatting = read('src/modules/jobs/jobDetailFormatting.js');
const jobForm = read('src/modules/jobs/JobForm.jsx');
const emailDocuments = read('src/modules/jobs/emailDocuments.js');
const accountingSelectors = read('src/modules/accounting/accountingSelectors.js');
const customerInsights = read('src/modules/customers/customerInsights.js');
const jobSelectors = read('src/modules/jobs/jobSelectors.js');
const packageJson = JSON.parse(read('package.json'));

assert.match(jobDetail, /resolveJobTaxSettings\(draftJob,\s*shopSettings\)/, 'Job Detail must resolve inherited VAT from Shop Settings.');
assert.match(jobDetail, /buildTaxFieldPatch\(draftJob, name, value, type, checked\)/, 'Job Detail must delegate VAT edits through the extracted tax patch helper.');
assert.match(jobDetailFormatting, /fieldName === 'salesTaxRate' \? \{ rateSource: 'job' \}/, 'Editing a job VAT rate must create an explicit override.');
assert.match(jobDetail, /withResolvedJobTaxSettings\(jobToSend,\s*scopedShopSettings\)/, 'Generated documents must resolve current VAT before calculation.');
assert.match(jobForm, /rateSource: 'shop'/, 'New jobs must identify their VAT rate as inherited from Shop Settings.');
assert.match(emailDocuments, /defaultTaxRate:[\s\S]*shopSettings\.sales_tax_rate/, 'Scoped email settings must carry the current shop tax rate.');
assert.match(accountingSelectors, /resolveJobTaxSettings\(job,\s*options\.shopProfile \|\| options\)/, 'Accounting reports must share VAT resolution.');
assert.match(customerInsights, /resolveJobTaxSettings\(job,\s*options\.shopProfile \|\| options\)/, 'Customer balances must share VAT resolution.');
assert.match(jobSelectors, /resolveJobTaxSettings\(job,\s*options\.shopProfile \|\| options\)/, 'Till summaries must share VAT resolution.');
assert.equal(
  packageJson.scripts['check:vat-default-existing-jobs'],
  'node scripts/check-vat-default-existing-jobs.mjs',
  'The focused VAT regression command must be registered.'
);

const changed = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.slice(3).replaceAll('\\', '/'));
assert.ok(!changed.some((file) => file.startsWith('supabase/migrations/')), 'The VAT inheritance fix must not add a migration.');
assert.ok(!changed.some((file) => file.startsWith('supabase/functions/')), 'The VAT inheritance fix must not change Edge Functions.');
assert.ok(!changed.some((file) => file.startsWith('cloudflare/frettrack-coming-soon/')), 'The VAT inheritance fix must not change the landing Worker.');

console.log('Existing-job VAT inheritance checks passed.');
