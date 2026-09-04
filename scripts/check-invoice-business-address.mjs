import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildInvoiceEmailDraft,
  buildSelectedDocumentEmailContent
} from '../src/modules/jobs/emailDocuments.js';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const detail = read('src/modules/jobs/JobDetail.jsx');
const printSections = read('src/modules/jobs/JobPrintSections.jsx');
const printDocuments = read('src/modules/jobs/JobPrintDocuments.jsx');
const printSheet = read('src/modules/print/PrintJobSheet.jsx');
const documentStyles = read('src/modules/print/PrintStyles.css');
const packageJson = JSON.parse(read('package.json'));

const shopSettings = {
  shopId: 'shop-address-check',
  shopName: 'Aleks Guitar Workshop',
  address: '10 Workshop Lane\nSheffield S1 2AB',
  phone: '0114 555 0199',
  email: 'repairs@example.test',
  currencyCode: 'GBP',
  locale: 'en-GB',
  dateFormat: 'DD/MM/YYYY',
  lengthUnit: 'mm'
};
const job = {
  id: 'job-address-check',
  shopId: shopSettings.shopId,
  jobNumber: 'FT-ADDRESS-1',
  invoiceNumber: 42,
  customerName: 'Test Customer',
  email: 'customer@example.test',
  guitarBrand: 'Fender',
  model: 'Stratocaster',
  services: [],
  parts: [],
  techDetails: { payments: [] }
};
const context = {
  shopSettings,
  totals: {},
  moneyOptions: { currencyCode: 'GBP', locale: 'en-GB' },
  dateOptions: { dateFormat: 'DD/MM/YYYY', locale: 'en-GB' }
};

const invoice = buildInvoiceEmailDraft(job, context);
assert.match(invoice.body, /10 Workshop Lane\nSheffield S1 2AB/, 'Generated invoice email text must include the active shop address.');
assert.match(invoice.subject, /invoice #42/i, 'Generated invoice email subject must include the durable invoice number.');
assert.match(invoice.body, /Invoice: Invoice #42/, 'Generated invoice email body must include the durable invoice number.');
assert.ok(
  invoice.summaryLines.some(([label, value]) => label === 'Shop' && value.includes(shopSettings.address)),
  'Generated invoice summary must include the active shop address.'
);

const attachedJobSheet = buildSelectedDocumentEmailContent(job, context, { includeJobSheet: true });
assert.match(attachedJobSheet.text, /Shop Address: 10 Workshop Lane\nSheffield S1 2AB/, 'Attached Job Sheet email text must include the active shop address.');
assert.match(attachedJobSheet.html, /10 Workshop Lane\nSheffield S1 2AB/, 'Attached Job Sheet email HTML must include the active shop address.');

assert.match(detail, /buildJobPrintSections\(\{[\s\S]*?shopSettings,[\s\S]*?workOrderImages/, 'Job Detail must pass the active shop settings into print composition.');
assert.match(printSections, /<JobPrintDocuments[\s\S]*?shopSettings=\{shopSettings\}/, 'Print composition must pass the active shop settings into print documents.');
assert.match(printDocuments, /<PrintJobSheet[\s\S]*?shopSettings=\{shopSettings\}/, 'Print documents must pass the active shop settings into the Job Sheet.');
assert.match(printSheet, /providedShopSettings \|\| getShopSettings\(\)/, 'The printable Job Sheet must prefer explicitly scoped shop settings.');
assert.match(printSheet, /className="print-shop-address"/, 'The printable Job Sheet must render the shop address in its header.');
assert.match(documentStyles, /\.print-shop-address\s*\{[\s\S]*?white-space:\s*pre-line;/, 'Multiline shop addresses must render cleanly in isolated print output.');
assert.equal(packageJson.scripts['check:invoice-business-address'], 'node scripts/check-invoice-business-address.mjs');

console.log('Invoice business address checks passed.');
