import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAccountingReport } from '../src/modules/accounting/accountingSelectors.js';
import { calculateTillSummary } from '../src/modules/jobs/jobSelectors.js';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const migration = read('supabase/migrations/20260828022147_accounting_safe_job_void.sql');
const jobService = read('src/modules/jobs/jobService.js');
const jobDetail = read('src/modules/jobs/JobDetail.jsx');
const control = read('src/modules/jobs/JobAccountingVoidControl.jsx');
const advancedReports = read('src/modules/reports/advancedReportsService.js');
const activityTimeline = read('src/modules/jobs/ActivityTimeline.jsx');
const workspaceRouter = read('src/app/WorkspaceRouter.jsx');
const paymentsSection = read('src/modules/jobs/PaymentsSection.js');
const customerInsights = read('src/modules/customers/customerInsights.js');

assert.match(migration, /accounting_voided_at timestamptz/i, 'Jobs must preserve an authoritative exclusion timestamp.');
assert.match(migration, /for update;/i, 'The RPC must lock the work order while validating and changing it.');
assert.match(migration, /Recorded payments must be explicitly refunded or voided/i, 'Recorded payments must block unsafe exclusion.');
assert.match(migration, /private\.has_shop_role\(target_job\.shop_id, array\['owner', 'admin'\]\)/i, 'The database must enforce owner/admin access.');
assert.match(migration, /private\.shop_lifecycle_allows_write\(target_job\.shop_id\)/i, 'The database must enforce writable shop lifecycle state.');
assert.match(migration, /security definer\s+set search_path = ''/i, 'Privileged functions must lock search_path.');
assert.match(migration, /revoke all on function public\.set_job_accounting_void\(uuid, boolean, text\) from public, anon/i, 'The RPC must revoke default public execution.');
assert.match(migration, /job_accounting_voided/i, 'Exclusion must create an audit event.');
assert.match(migration, /job_accounting_restored/i, 'Restoration must create an audit event.');
assert.match(migration, /Accounting-excluded work orders are read-only/i, 'Excluded work orders must reject ordinary edits.');
assert.match(jobService, /supabase\.rpc\('set_job_accounting_void'/, 'The client must use the guarded RPC.');
assert.match(jobService, /accountingVoidedAt: job\.accounting_voided_at/, 'Remote jobs must hydrate exclusion state.');
assert.match(jobDetail, /\(props\.canWrite \?\? true\) && !props\.job\?\.accountingVoidedAt/, 'Excluded jobs must render read-only.');
assert.match(control, /Exclude \/ Void Work Order/, 'The UI must expose an explicit accounting action.');
assert.match(control, /Audit reason/, 'The UI must require a visible audit reason.');
assert.match(advancedReports, /!isJobAccountingVoided\(job\)/, 'Advanced reports must exclude voided jobs.');
assert.match(activityTimeline, /job_accounting_voided/, 'The job timeline must show accounting exclusion.');
assert.match(workspaceRouter, /canWrite=\{access\.canEditAmplifierRepair && !selectedJob\.accountingVoidedAt\}/, 'Voided amplifier jobs must be read-only.');
assert.match(workspaceRouter, /canWrite=\{access\.canEditKeyboardRepair && !selectedJob\.accountingVoidedAt\}/, 'Voided keyboard jobs must be read-only.');
assert.match(paymentsSection, /<option value="refund">Refund<\/option>/, 'Billing must expose an explicit refund ledger entry.');
assert.match(paymentsSection, /<option value="void">Payment Void<\/option>/, 'Billing must expose an explicit payment-void ledger entry.');
assert.match(customerInsights, /accountingJobSnapshots = jobSnapshots\.filter/, 'Customer balance totals must exclude voided jobs without deleting history.');
assert.match(customerInsights, /signedPaymentAmount\(payment\)/, 'Customer payment history must show refunds and voids as adjustments.');

const baseJob = {
  id: 'job-active',
  shopId: 'shop-1',
  status: 'Completed',
  jobNumber: 'ACTIVE-1',
  dateReceived: '2026-08-27',
  services: [{ id: 'service-1', description: 'Setup', quantity: 1, retail: 100, cost: 0 }],
  parts: [],
  techDetails: { payments: [{ id: 'payment-1', amount: 100, method: 'Card', date: '2026-08-27' }] }
};
const voidedJob = {
  ...baseJob,
  id: 'job-voided',
  jobNumber: 'VOIDED-1',
  accountingVoidedAt: '2026-08-27T20:00:00.000Z'
};
const report = buildAccountingReport([baseJob, voidedJob], {
  shopId: 'shop-1',
  startDate: '2026-08-01',
  endDate: '2026-08-31'
});
assert.equal(report.summary.jobCount, 1, 'Accounting job counts must exclude voided jobs.');
assert.equal(report.summary.jobTotals, 100, 'Accounting totals must exclude voided jobs.');
assert.equal(report.summary.paidTotal, 100, 'Payment totals must exclude voided jobs.');
assert.equal(report.openBalances.length, 0, 'Voided jobs must not create open balances.');

const till = calculateTillSummary([baseJob, voidedJob]);
assert.equal(till.paidTotal, 100, 'Till totals must exclude voided jobs.');

const refundedJob = {
  ...baseJob,
  techDetails: {
    payments: [
      { id: 'payment-2', amount: 100, type: 'payment', method: 'Card', date: '2026-08-27' },
      { id: 'refund-2', amount: 100, type: 'refund', method: 'Card', date: '2026-08-27' }
    ]
  }
};
const refundedReport = buildAccountingReport([refundedJob], {
  shopId: 'shop-1',
  startDate: '2026-08-01',
  endDate: '2026-08-31'
});
assert.equal(refundedReport.summary.paidTotal, 0, 'A full refund must reverse paid-in totals.');
assert.equal(refundedReport.summary.refundsAndVoids, 100, 'Refund reporting must retain the adjustment amount.');

console.log('Accounting-safe work-order void checks passed.');
