import { calculateJobAccounting, signedPaymentAmount } from '../billing/accounting.js';
import { resolveJobTaxSettings } from '../billing/jobTaxSettings.js';
import { isJobAccountingVoided } from './jobAccountingVoid.js';

export function sortNewestFirst(jobs) {
  return [...jobs].sort((a, b) => {
    return new Date(b.createdAt || b.dateReceived) - new Date(a.createdAt || a.dateReceived);
  });
}

export function calculateTillSummary(jobs, options = {}) {
  return jobs.filter((job) => !isJobAccountingVoided(job)).reduce((summary, job) => {
    const accounting = calculateJobAccounting(
      job,
      resolveJobTaxSettings(job, options.shopProfile || options)
    );
    summary.paidTotal += accounting.paidTotal;
    summary.salesTaxAccrued += accounting.salesTaxAmount;
    summary.openBalance += accounting.balanceDue;
    (job.techDetails?.payments || []).forEach((payment) => {
      const method = payment.method || 'Other';
      summary.byMethod[method] = (summary.byMethod[method] || 0) + signedPaymentAmount(payment);
    });
    return summary;
  }, { paidTotal: 0, salesTaxAccrued: 0, openBalance: 0, byMethod: {} });
}
