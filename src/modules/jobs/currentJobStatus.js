const CLOSED_JOB_STATUSES = new Set(['completed', 'picked up', 'cancelled', 'archived']);

function cleanStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export function isCurrentJob(job = {}) {
  return !CLOSED_JOB_STATUSES.has(cleanStatus(job.status));
}
