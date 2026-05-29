import { calculateJobTotals } from '../billing/accounting';
import { normalizeCustomer, normalizePhone, normalizeText } from './customerNormalize';

const CLOSED_JOB_STATUSES = new Set(['completed', 'picked up', 'closed']);

export function buildCustomerDirectory(customers = [], jobs = []) {
  return customers
    .map((customer) => buildCustomerProfile(customer, jobs))
    .sort((left, right) => new Date(right.lastActivityAt || right.updatedAt || right.createdAt || 0) - new Date(left.lastActivityAt || left.updatedAt || left.createdAt || 0));
}

export function buildCustomerProfile(customer = {}, jobs = []) {
  const normalizedCustomer = normalizeCustomer(customer);
  const relatedJobs = getRelatedJobs(normalizedCustomer, jobs);
  const jobSnapshots = relatedJobs.map((job) => ({
    job,
    totals: calculateJobTotals(job)
  }));
  const paymentRows = collectPaymentRows(relatedJobs);
  const summary = summarizeBalance(jobSnapshots);
  const lastJob = relatedJobs[0] || null;
  const lastPayment = paymentRows[0] || null;
  const lastActivityAt = latestIsoDate(
    normalizedCustomer.updatedAt,
    normalizedCustomer.createdAt,
    lastJob?.updatedAt,
    lastJob?.createdAt,
    lastJob?.dateReceived,
    lastPayment?.date
  );

  return {
    ...normalizedCustomer,
    jobs: relatedJobs,
    jobHistory: jobSnapshots.map(({ job, totals }) => ({
      ...job,
      ...totals
    })),
    jobSnapshots,
    payments: paymentRows,
    lastJobDate: lastJob?.dateReceived || lastJob?.createdAt || '',
    lastActivityAt,
    totalBilled: summary.totalBilled,
    totalPaid: summary.totalPaid,
    totalBalanceDue: summary.totalBalanceDue,
    openJobBalance: summary.openJobBalance,
    completedUnpaidBalance: summary.completedUnpaidBalance,
    openJobCount: relatedJobs.filter((job) => !isClosedJob(job)).length,
    completedJobCount: relatedJobs.filter((job) => isClosedJob(job)).length,
    notesIndicator: Boolean(normalizedCustomer.notes),
    hasPayments: paymentRows.length > 0
  };
}

export function getRelatedJobs(customer = {}, jobs = []) {
  const normalizedCustomer = normalizeCustomer(customer);
  const customerIds = [normalizedCustomer.id].filter(Boolean);
  const customerName = normalizeText(normalizedCustomer.displayName);
  const companyName = normalizeText(normalizedCustomer.companyName);
  const firstName = normalizeText(normalizedCustomer.firstName);
  const lastName = normalizeText(normalizedCustomer.lastName);
  const email = normalizeText(normalizedCustomer.email);
  const phone = normalizePhone(normalizedCustomer.phone);
  const lookups = new Set();

  return jobs
    .filter((job) => {
      const jobId = job.id || job.jobId;
      if (lookups.has(jobId)) {
        return false;
      }

      if (customerIds.includes(job.customerId) || customerIds.includes(job.customer_id)) {
        lookups.add(jobId);
        return true;
      }

      const hasDirectCustomerLink = Boolean(job.customerId || job.customer_id);
      if (hasDirectCustomerLink) {
        return false;
      }

      const jobName = normalizeText(job.customerName || job.customer_name);
      const jobFirstName = normalizeText(job.customerFirstName || job.customer_first_name);
      const jobLastName = normalizeText(job.customerLastName || job.customer_last_name);
      const jobEmail = normalizeText(job.email);
      const jobPhone = normalizePhone(job.phone);
      const jobCompany = normalizeText(job.companyName || job.company_name);
      const subcontractorName = normalizeText(job.techDetails?.subcontractorName || job.techDetails?.subcontractor_name || job.subcontractorName || '');
      const nameMatch = jobName && (jobName === customerName || jobName === companyName);
      const splitMatch = (jobFirstName && jobFirstName === firstName) || (jobLastName && jobLastName === lastName);
      const contactMatch = (email && jobEmail && email === jobEmail) || (phone && jobPhone && phone === jobPhone);
      const companyMatch = companyName && jobCompany && companyName === jobCompany;
      const subcontractorMatch = normalizedCustomer.customerType === 'subcontractor'
        && subcontractorName
        && (subcontractorName === customerName || subcontractorName === companyName);

      if (nameMatch || splitMatch || contactMatch || companyMatch || subcontractorMatch) {
        lookups.add(jobId);
        return true;
      }

      return false;
    })
    .sort((left, right) => new Date(right.dateReceived || right.createdAt || right.updatedAt || 0) - new Date(left.dateReceived || left.createdAt || left.updatedAt || 0));
}

export function collectPaymentRows(jobs = []) {
  return jobs.flatMap((job) => {
    const payments = job.techDetails?.payments || [];
    return payments.map((payment, index) => ({
      id: payment.id || `${job.id || job.jobNumber || 'job'}:${index}`,
      jobId: job.id || '',
      jobNumber: job.jobNumber || '',
      method: payment.method || 'Other',
      amount: Number(payment.amount) || 0,
      note: payment.note || payment.memo || '',
      date: payment.date || payment.createdAt || job.updatedAt || job.createdAt || '',
      status: payment.status || 'posted'
    }));
  }).sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0));
}

function summarizeBalance(jobSnapshots = []) {
  return jobSnapshots.reduce((summary, snapshot) => {
    const { totals, job } = snapshot;
    const balanceDue = totals.balanceDue || 0;
    summary.totalBilled += totals.totalDue || 0;
    summary.totalPaid += totals.paidTotal || 0;
    summary.totalBalanceDue += balanceDue;
    if (isClosedJob(job)) {
      summary.completedUnpaidBalance += balanceDue;
    } else {
      summary.openJobBalance += balanceDue;
    }
    return summary;
  }, {
    totalBilled: 0,
    totalPaid: 0,
    totalBalanceDue: 0,
    openJobBalance: 0,
    completedUnpaidBalance: 0
  });
}

function isClosedJob(job = {}) {
  const status = normalizeText(job.status);
  return CLOSED_JOB_STATUSES.has(status);
}

function latestIsoDate(...values) {
  return values
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || '';
}
