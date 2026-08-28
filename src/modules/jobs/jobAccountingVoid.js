export function isJobAccountingVoided(job = {}) {
  return Boolean(job.accountingVoidedAt || job.accounting_voided_at);
}
