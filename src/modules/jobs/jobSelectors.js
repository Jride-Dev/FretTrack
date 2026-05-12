import { calculateJobAccounting } from '../billing/accounting';

export function sortNewestFirst(jobs) {
  return [...jobs].sort((a, b) => {
    return new Date(b.createdAt || b.dateReceived) - new Date(a.createdAt || a.dateReceived);
  });
}

export function calculateTillSummary(jobs) {
  return jobs.reduce((summary, job) => {
    const accounting = calculateJobAccounting(job);
    summary.paidTotal += accounting.paidTotal;
    summary.salesTaxAccrued += accounting.salesTaxAmount;
    summary.openBalance += accounting.balanceDue;
    (job.techDetails?.payments || []).forEach((payment) => {
      const method = payment.method || 'Other';
      summary.byMethod[method] = (summary.byMethod[method] || 0) + (Number(payment.amount) || 0);
    });
    return summary;
  }, { paidTotal: 0, salesTaxAccrued: 0, openBalance: 0, byMethod: {} });
}
