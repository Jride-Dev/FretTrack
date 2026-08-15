export const PENDING_WORK_LOG_MESSAGE = 'Save or discard the pending Work Note before printing or sending customer documents.';

export function getPendingWorkLogText(value) {
  return String(value || '').trim();
}

export function hasPendingWorkLogDraft(value) {
  return Boolean(getPendingWorkLogText(value));
}

export function getWorkLogSubmission(previousSubmission, { jobId, text, id, timestamp }) {
  const normalizedText = getPendingWorkLogText(text);
  if (
    previousSubmission?.jobId === jobId
    && previousSubmission?.id
    && previousSubmission?.timestamp
  ) {
    return previousSubmission.text === normalizedText
      ? previousSubmission
      : { ...previousSubmission, text: normalizedText };
  }

  return {
    jobId,
    text: normalizedText,
    id,
    timestamp
  };
}

export function appendWorkLogDraft(job, value, { id, timestamp }) {
  const text = getPendingWorkLogText(value);
  if (!text) {
    return job;
  }

  const entry = {
    id,
    jobId: job.id,
    text,
    entry: text,
    createdAt: timestamp,
    timestamp
  };
  const existingEntries = job.workLog || [];
  const alreadyAppended = existingEntries.some((item) => item.id === id);

  return {
    ...job,
    workLog: alreadyAppended
      ? existingEntries.map((item) => item.id === id ? { ...item, ...entry } : item)
      : [...existingEntries, entry]
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
