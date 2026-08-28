const CLOSED_JOB_STATUSES = new Set(['completed', 'picked up', 'cancelled', 'archived']);

function cleanStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export function isCurrentJob(job = {}) {
  return !job.accountingVoidedAt
    && !job.accounting_voided_at
    && !CLOSED_JOB_STATUSES.has(cleanStatus(job.status));
}
