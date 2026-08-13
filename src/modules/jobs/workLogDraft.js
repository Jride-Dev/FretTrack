export const PENDING_WORK_LOG_MESSAGE = 'Save or discard the pending Work Note before printing or sending customer documents.';

export function getPendingWorkLogText(value) {
  return String(value || '').trim();
}

export function hasPendingWorkLogDraft(value) {
  return Boolean(getPendingWorkLogText(value));
}

export function appendWorkLogDraft(job, value, { id, timestamp }) {
  const text = getPendingWorkLogText(value);
  if (!text) {
    return job;
  }

  return {
    ...job,
    workLog: [
      ...(job.workLog || []),
      {
        id,
        jobId: job.id,
        text,
        entry: text,
        createdAt: timestamp,
        timestamp
      }
    ]
  };
}

export function buildUpdateWorkLogEntryPatch(workLog = [], entryId, text) {
  return {
    workLog: workLog.map((entry) => (
      entry.id === entryId ? { ...entry, text, entry: text } : entry
    ))
  };
}

export function buildRemoveWorkLogEntryJob(job, entryId) {
  return {
    ...job,
    workLog: (job.workLog || []).filter((entry) => entry.id !== entryId)
  };
}
