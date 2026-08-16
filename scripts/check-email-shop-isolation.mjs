import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  buildInvoiceEmailDraft,
  buildSelectedDocumentEmailContent,
  buildWorkOrderEmailDraft,
  resolveScopedShopEmailSettings,
  SHOP_EMAIL_CONTEXT_ERROR
} from '../src/modules/jobs/emailDocuments.js';
import {
  buildShopSignature,
  messageTemplates,
  renderTemplate
} from '../src/modules/messaging/messageTemplates.js';

const root = new URL('../', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

function changedFiles() {
  return execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replaceAll('\\', '/'));
}

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message);
}

function assertExcludes(haystack, needle, message) {
  assert.ok(!haystack.includes(needle), message);
}

function assertThrowsShopContext(fn, message) {
  assert.throws(fn, (error) => error?.message === SHOP_EMAIL_CONTEXT_ERROR, message);
}

const sendEmailFunction = read('supabase/functions/send-email/index.ts');
assert.ok(
  sendEmailFunction.indexOf('prepareEmailRecipientQuota(') < sendEmailFunction.indexOf("fetch('https://api.resend.com/emails'"),
  'Email recipient quota must be reserved after shop resolution and before provider send.'
);
assertIncludes(sendEmailFunction, 'releaseEmailRecipientQuota(access.shopId, quotaRequestId)', 'Failed sends must release the same shop reservation.');
assertIncludes(sendEmailFunction, 'recipientCount = toRecipients.length + ccRecipients.length + bccRecipients.length', 'Recipient count must include To, CC, and BCC.');

const northShop = {
  shopId: 'north-shop',
  shopName: 'North Bench Guitars',
  address: '10 North Street, Seattle, WA',
  phone: '206-555-0101',
  email: 'hello@northbench.example',
  website: 'https://northbench.example',
  taxLabel: 'Sales Tax'
};

const southShop = {
  shopId: 'south-shop',
  shopName: 'South String Repair',
  address: '20 South Avenue, Austin, TX',
  phone: '512-555-0202',
  email: 'hello@southstring.example',
  website: 'https://southstring.example',
  taxLabel: 'Sales Tax'
};

function fixtureJob(shopId, suffix) {
  return {
    id: `job-${suffix}`,
    shopId,
    customerName: `Customer ${suffix}`,
    email: `customer-${suffix}@example.com`,
    phone: '555-0100',
    jobNumber: `FT-${suffix}`,
    status: 'In Progress',
    dateReceived: '2026-07-20T12:00:00.000Z',
    instrumentType: 'guitar',
    guitarBrand: 'Fender',
    model: `Telecaster ${suffix}`,
    reasonForVisit: 'Setup and inspection',
    services: [{ description: 'Setup', quantity: 1, retail: 125 }],
    parts: [{ sku: `STR-${suffix}`, name: 'Strings', quantity: 1, retail: 12 }],
    techDetails: {
      notes: 'Customer prefers light action.',
      damageMap: {
        liabilityText: 'Customer acknowledged intake condition.',
        liabilityAcknowledged: true,
        views: {
          front: {
            imageUrl: `https://example.com/${suffix}-front.jpg`,
            marks: [{ area: 'Top', severity: 'Light', note: 'Small ding', recommendedRepair: 'Monitor' }]
          }
        }
      },
      payments: [{ date: '2026-07-21', method: 'Card', amount: 25, note: 'Deposit' }]
    },
    workLog: [{ timestamp: '2026-07-22T15:30:00.000Z', text: 'Initial setup started.' }]
  };
}

const totals = {
  servicesTotal: 125,
  partsTotal: 12,
  subtotal: 137,
  discountAmount: 0,
  salesTaxAmount: 11.3,
  totalDue: 148.3,
  paidTotal: 25,
  balanceDue: 123.3
};

function documentOutputs(job, shop) {
  const context = {
    shopSettings: shop,
    totals,
    taxLabel: shop.taxLabel,
    dateOptions: { locale: 'en-US' },
    moneyOptions: { currencyCode: 'USD', locale: 'en-US' }
  };
  const workOrder = buildWorkOrderEmailDraft(job, context);
  const invoice = buildInvoiceEmailDraft(job, context);
  const docs = buildSelectedDocumentEmailContent(job, context, {
    includeJobSheet: true,
    includeCustomerReport: true
  });

  return [
    workOrder.subject,
    workOrder.body,
    JSON.stringify(workOrder.summaryLines),
    invoice.subject,
    invoice.body,
    JSON.stringify(invoice.summaryLines),
    docs.text,
    docs.html
  ].join('\n');
}

function messageOutputs(job, shop) {
  const variables = {
    customer_name: job.customerName,
    job_number: job.jobNumber,
    instrument: `${job.guitarBrand} ${job.model}`,
    shop_name: shop.shopName,
    shop_signature: buildShopSignature(shop)
  };

  return Object.values(messageTemplates)
    .flatMap((template) => [
      renderTemplate(template.subject, variables),
      renderTemplate(template.body, variables)
    ])
    .join('\n');
}

const northJob = fixtureJob(northShop.shopId, 'NORTH');
const southJob = fixtureJob(southShop.shopId, 'SOUTH');
const northOutput = `${documentOutputs(northJob, northShop)}\n${messageOutputs(northJob, northShop)}`;
const southOutput = `${documentOutputs(southJob, southShop)}\n${messageOutputs(southJob, southShop)}`;

for (const expected of [northShop.shopName, northShop.address, northShop.phone, northShop.email, northShop.website]) {
  assertIncludes(northOutput, expected, `North shop output must include its own ${expected}.`);
  assertExcludes(southOutput, expected, `South shop output must not leak North shop value ${expected}.`);
}

for (const expected of [southShop.shopName, southShop.address, southShop.phone, southShop.email, southShop.website]) {
  assertIncludes(southOutput, expected, `South shop output must include its own ${expected}.`);
  assertExcludes(northOutput, expected, `North shop output must not leak South shop value ${expected}.`);
}

for (const forbidden of [
  "JR's Custom Shop",
  'JRs Custom Shop',
  'Torrance Guitar Repair',
  'torranceguitarrepair.com',
  'Jeffrey',
  'Jeff Russell',
  'Stillwater Systems',
  'FretTrack Trial Shop',
  '310-926-1267'
]) {
  assertExcludes(northOutput, forbidden, `North output must not include stale/default shop value ${forbidden}.`);
  assertExcludes(southOutput, forbidden, `South output must not include stale/default shop value ${forbidden}.`);
}

assert.equal(resolveScopedShopEmailSettings(northJob, northShop).shopId, northShop.shopId);
assertThrowsShopContext(
  () => resolveScopedShopEmailSettings(northJob, southShop),
  'Mismatched job/shop settings must be blocked.'
);
assertThrowsShopContext(
  () => buildWorkOrderEmailDraft(northJob, { shopSettings: southShop }),
  'Work order drafts must reject mismatched shop settings.'
);
assertThrowsShopContext(
  () => buildInvoiceEmailDraft(northJob, { shopSettings: {} }),
  'Invoice drafts must reject missing shop settings.'
);

const emailDocuments = read('src/modules/jobs/emailDocuments.js');
assertIncludes(emailDocuments, 'SHOP_EMAIL_CONTEXT_ERROR', 'Document email helper must expose the shop-context error.');
assertIncludes(emailDocuments, 'resolveScopedShopEmailSettings(job, context.shopSettings)', 'Document email helper must resolve scoped shop settings from the job.');
assertExcludes(emailDocuments, "|| 'FretTrack'", 'Document email shop name must not fall back to a generic/global shop name.');

const jobDetail = read('src/modules/jobs/JobDetail.jsx');
assertIncludes(jobDetail, 'resolveScopedShopEmailSettings(draftJob, shopProfile)', 'Job detail document email drafts must use the active job/shop profile.');
assertIncludes(jobDetail, 'resolveScopedShopEmailSettings(jobToSend, shopProfile)', 'Job detail document email send path must re-resolve the active job/shop profile.');
assertIncludes(jobDetail, 'setDocumentEmailDraft(null);', 'Document email draft must reset when job/shop context changes.');
assertIncludes(jobDetail, 'jobId: draftJob.id', 'Document email drafts must carry jobId.');
assertIncludes(jobDetail, 'shopId: draftJob.shopId', 'Document email drafts must carry shopId.');

const emailDialog = read('src/modules/jobs/JobDocumentEmailDialog.jsx');
assertIncludes(emailDialog, 'draft?.jobId', 'Document email dialog must reset edited fields when jobId changes.');
assertIncludes(emailDialog, 'draft?.shopId', 'Document email dialog must reset edited fields when shopId changes.');

const messagesPanel = read('src/modules/messaging/MessagesPanel.js');
assertIncludes(messagesPanel, 'shopProfile = null', 'Messages panel must receive the current shop profile.');
assertIncludes(messagesPanel, 'shop_signature: buildShopSignature(shopProfile || {})', 'Messages panel must render templates with the active shop signature.');
assertIncludes(messagesPanel, 'job.shopId', 'Messages panel template reset must include the job shop id.');
assertIncludes(messagesPanel, 'shopProfile?.shopId', 'Messages panel template reset must include the selected shop id.');
assertIncludes(messagesPanel, 'variables.shop_signature', 'Messages panel template refresh must include shop signature changes.');

const messageTemplatesSource = read('src/modules/messaging/messageTemplates.js');
for (const forbidden of ["JR's Custom Shop", 'Torrance Guitar Repair', 'torranceguitarrepair.com', 'Jeffrey', 'Jeff Russell', 'Stillwater Systems', 'FretTrack Trial Shop']) {
  assertExcludes(messageTemplatesSource, forbidden, `Message templates must not contain stale/default shop value ${forbidden}.`);
}
assertIncludes(messageTemplatesSource, '{{shop_signature}}', 'Generated message templates must use the active shop signature placeholder.');

const app = read('src/app/App.jsx');
assertIncludes(app, 'shopProfile={shopProfile}', 'App must pass the active shop profile into job detail.');

const edgeFunction = read('supabase/functions/send-email/index.ts');
assertIncludes(edgeFunction, ".from('jobs')", 'Email Edge Function must load the target job.');
assertIncludes(edgeFunction, ".select('id, shop_id, email_opt_in')", 'Email Edge Function must load job shop_id and email opt-in state.');
assertIncludes(edgeFunction, ".eq('id', jobId)", 'Email Edge Function must scope access to the requested job id.');
assertIncludes(edgeFunction, ".from('shop_members')", 'Email Edge Function must verify shop membership.');
assertIncludes(edgeFunction, ".eq('shop_id', job.shop_id)", 'Email Edge Function must authorize against the job shop.');
assertIncludes(edgeFunction, "['owner', 'admin', 'tech']", 'Email Edge Function must require a send-capable role.');

const changed = changedFiles();
const unrelatedMigrations = changed.filter((file) => (
  file.startsWith('supabase/migrations/')
  && !file.endsWith('_add_shop_country_localization.sql')
  && !file.endsWith('_pro_team_assignment_foundation.sql')
  && !file.endsWith('_harden_email_provider_consistency.sql')
));
assert.equal(unrelatedMigrations.length, 0, 'Email isolation changes must not add unrelated Supabase migrations.');
assert.ok(!changed.some((file) => file.startsWith('cloudflare/frettrack-coming-soon/')), 'Landing Worker files must not change.');
assert.ok(
  !changed.some((file) => /stripe/i.test(file) || (/\/billing\//i.test(file) && !file.endsWith('entitlementService.js'))),
  'Stripe and unrelated billing files must not change.'
);

console.log('Email shop isolation checks passed.');
