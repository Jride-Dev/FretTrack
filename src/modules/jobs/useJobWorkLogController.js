import { useEffect, useRef, useState } from 'react';
import {
  appendWorkLogDraft,
  buildRemoveWorkLogEntryJob,
  buildUpdateWorkLogEntryPatch,
  getWorkLogSubmission,
  hasPendingWorkLogDraft
} from './workLogDraft.js';

export default function useJobWorkLogController({
  activeJobIdRef,
  canWrite,
  draftJob,
  onNotice,
  patchJob,
  saveDraftNow,
  setDraftJob
}) {
  const [workLogText, setWorkLogText] = useState('');
  const [isSavingWorkLog, setIsSavingWorkLog] = useState(false);
  const workLogSavePromiseRef = useRef(null);
  const workLogRetrySubmissionRef = useRef(null);
  const hydratedJobIdRef = useRef(draftJob.id);
  const hasPendingWorkLog = hasPendingWorkLogDraft(workLogText);
  const hasUnsettledWorkLog = hasPendingWorkLog || isSavingWorkLog;

  useEffect(() => {
    const didSwitchJobs = hydratedJobIdRef.current !== draftJob.id;
    hydratedJobIdRef.current = draftJob.id;
    if (workLogRetrySubmissionRef.current?.jobId !== draftJob.id) {
      workLogRetrySubmissionRef.current = null;
    }
    if (didSwitchJobs) {
      workLogSavePromiseRef.current = null;
      setWorkLogText('');
      setIsSavingWorkLog(false);
    }
  }, [draftJob.id]);

  useEffect(() => {
    if (!hasUnsettledWorkLog) {
      return undefined;
    }

    function handlePendingWorkLogBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = 'You have an unsaved Work Note.';
      return event.returnValue;
    }

    window.addEventListener('beforeunload', handlePendingWorkLogBeforeUnload);
    return () => window.removeEventListener('beforeunload', handlePendingWorkLogBeforeUnload);
  }, [hasUnsettledWorkLog]);

  function updateWorkLogEntry(entryId, text) {
    patchJob(buildUpdateWorkLogEntryPatch(draftJob.workLog, entryId, text));
  }

  async function saveWorkLogChanges() {
    if (!canWrite) {
      return;
    }
    try {
      await saveDraftNow();
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || 'Work Note changes could not be saved.' });
    }
  }

  async function removeWorkLogEntry(entryId) {
    if (!canWrite) {
      return;
    }
    const confirmed = window.confirm('Delete this work log entry?');
    if (!confirmed) {
      return;
    }
    const nextJob = buildRemoveWorkLogEntryJob(draftJob, entryId);
    setDraftJob(nextJob);
    await saveDraftNow(nextJob).catch(() => {});
  }

  async function appendWorkLog(event) {
    event.preventDefault();
    await savePendingWorkLog().catch(() => {});
  }

  async function savePendingWorkLog() {
    if (!canWrite) {
      throw new Error('Your shop role is read-only.');
    }
    if (workLogSavePromiseRef.current?.jobId === draftJob.id) {
      return workLogSavePromiseRef.current.promise;
    }
    if (!hasPendingWorkLog) {
      return saveDraftNow();
    }
    const submittedWorkLogText = workLogText;
    const submission = getWorkLogSubmission(workLogRetrySubmissionRef.current, {
      jobId: draftJob.id,
      text: submittedWorkLogText,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    });
    workLogRetrySubmissionRef.current = submission;
    const nextJob = appendWorkLogDraft(draftJob, submission.text, submission);

    const savePromise = saveDraftNow(nextJob)
      .then((savedJob) => {
        if (activeJobIdRef.current === submission.jobId && workLogRetrySubmissionRef.current?.id === submission.id) {
          workLogRetrySubmissionRef.current = null;
        }
        if (activeJobIdRef.current === submission.jobId) {
          setWorkLogText((current) => current === submittedWorkLogText ? '' : current);
        }
        return savedJob;
      })
      .catch((error) => {
        onNotice?.({ type: 'error', message: error?.message || 'Work Note could not be saved.' });
        throw error;
      })
      .finally(() => {
        if (workLogSavePromiseRef.current?.promise === savePromise) {
          workLogSavePromiseRef.current = null;
          if (activeJobIdRef.current === submission.jobId) {
            setIsSavingWorkLog(false);
          }
        }
      });

    workLogSavePromiseRef.current = { jobId: submission.jobId, promise: savePromise };
    setIsSavingWorkLog(true);
    return savePromise;
  }

  function discardWorkLogDraft() {
    if (!hasPendingWorkLog || window.confirm('Discard this unsaved Work Note?')) {
      workLogRetrySubmissionRef.current = null;
      setWorkLogText('');
    }
  }

  return {
    appendWorkLog,
    discardWorkLogDraft,
    hasPendingWorkLog,
    hasUnsettledWorkLog,
    isSavingWorkLog,
    removeWorkLogEntry,
    savePendingWorkLog,
    saveWorkLogChanges,
    setWorkLogText,
    updateWorkLogEntry,
    workLogText
  };
}
