import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath) => readFileSync(join(process.cwd(), relativePath), 'utf8');
const permissions = read('src/modules/auth/permissionService.js');
const appAccess = read('src/app/appAccess.js');
const workspace = read('src/app/WorkspaceRouter.jsx');
const billing = read('src/modules/jobs/useJobDetailBillingActions.js');
const payments = read('src/modules/jobs/PaymentsSection.js');
const accounting = read('src/modules/billing/accounting.js');
const children = read('src/modules/jobs/jobServiceChildren.js');
const specialistPurchasing = read('src/modules/inventory/SpecialistPurchasingPanel.jsx');
const migration = read('supabase/migrations/20260831022005_job_commerce_finalization_and_payment_boundary.sql');

for (const helper of ['canManageJobCharges', 'canRecordJobPayments', 'canIssuePaymentAdjustments', 'canFinalizeJobInvoices']) {
  assert.ok(permissions.includes(`export function ${helper}`), `${helper} must remain a centralized permission.`);
  assert.ok(appAccess.includes(`${helper}:`), `${helper} must be exposed by app access.`);
}

assert.ok(workspace.includes('canManageJobCharges={access.canManageJobCharges}'), 'Job Detail must receive the charge-management permission.');
assert.ok(workspace.includes('canRecordJobPayments={access.canRecordJobPayments}'), 'Job Detail must receive the payment-recording permission.');
assert.ok(billing.includes("recordJobPayment(draftJob.id"), 'Payments must use the guarded append-only RPC client.');
assert.ok(billing.includes('setJobInvoiceFinalization'), 'Invoice finalization must use its guarded RPC client.');
assert.ok(!payments.includes('removePayment('), 'Saved payment history must not expose destructive removal controls.');
assert.ok(!payments.includes('updatePayment('), 'Saved payment history must not expose mutation controls.');
assert.ok(accounting.includes('job.invoiceSnapshot?.version'), 'Finalized invoices must render their stored server snapshot.');
assert.ok(children.includes('if (!job.invoiceFinalizedAt)'), 'Ordinary job saves must not rewrite locked charge rows after finalization.');
assert.ok(specialistPurchasing.includes('!canAddToBilling'), 'Specialist fulfillment must respect the charge-management permission.');
assert.match(migration, /create or replace function public\.record_job_payment[\s\S]*?private\.has_shop_role/, 'Payment RPC must enforce shop role server-side.');
assert.match(migration, /clean_type in \('refund', 'void'\)[\s\S]*?array\['owner', 'admin'\]/, 'Refunds and voids must require owner/admin server-side.');
assert.match(migration, /create or replace function public\.set_job_invoice_finalization[\s\S]*?private\.calculate_job_invoice_snapshot/, 'Finalization must calculate its snapshot in the database.');
assert.ok(migration.includes('job_parts_guard_finalized_invoice'), 'Finalized invoices must lock part rows.');
assert.ok(migration.includes('job_services_guard_finalized_invoice'), 'Finalized invoices must lock service rows.');
assert.match(migration, /guard_finalized_job_charge_mutation[\s\S]*?pg_advisory_xact_lock/, 'Charge mutation and finalization must share a transaction lock.');
assert.ok(migration.includes("revoke all on function public.record_job_payment"), 'Payment RPC must revoke public execution.');

console.log('Commerce hardening checks passed.');
