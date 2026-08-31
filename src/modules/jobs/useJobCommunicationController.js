import { useEffect, useRef, useState } from 'react';
import { createJobDetailCommunicationActions } from './jobDetailCommunicationActions.js';
import { buildAssignmentJob } from './jobDetailFormatting.js';
import { getJobEvents } from './jobEventsService.js';

export default function useJobCommunicationController({
  canScheduleEmail,
  canSendEmail,
  canSendSms,
  canWrite,
  confirmIfDirty,
  dateOptions,
  draftJob,
  entitlementMessage,
  formatInstrumentLabel,
  hasPendingWorkLog,
  isDirty,
  job,
  measurementOptions,
  moneyOptions,
  onAssignmentChanged,
  onClose,
  onDirtyChange,
  onNotice,
  onRefresh,
  patchJob,
  printRequestSequenceRef,
  saveDraftNow,
  setDraftJob,
  setIsDirty,
  setWorkLogText,
  shopProfile
}) {
  const [subcontractorPickupJob, setSubcontractorPickupJob] = useState(null);
  const [isSendingSubcontractorEmail, setIsSendingSubcontractorEmail] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState(job.events || []);
  const [documentEmailDraft, setDocumentEmailDraft] = useState(null);
  const timelineRequestRef = useRef(0);
  const activeJobIdRef = useRef(job.id);
  activeJobIdRef.current = job.id;

  async function refreshTimelineEvents() {
    const requestedJobId = job.id;
    const requestId = ++timelineRequestRef.current;
    const events = await getJobEvents(requestedJobId);
    if (requestId !== timelineRequestRef.current || activeJobIdRef.current !== requestedJobId) {
      return null;
    }
    setTimelineEvents(events);
    return events;
  }

  useEffect(() => {
    timelineRequestRef.current += 1;
    setTimelineEvents(job.events || []);
    setDocumentEmailDraft(null);
    refreshTimelineEvents().catch((error) => {
      console.warn('Timeline refresh failed.', error);
    });
    // Timeline refresh is keyed to work-order identity; draft mutations do not require a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  useEffect(() => {
    setDocumentEmailDraft(null);
  }, [draftJob.id, draftJob.shopId, shopProfile?.shopId, shopProfile?.updatedAt]);

  const actions = createJobDetailCommunicationActions({
    canWrite,
    canSendEmail,
    canScheduleEmail,
    canSendSms,
    entitlementMessage,
    draftJob,
    shopProfile,
    measurementOptions,
    dateOptions,
    moneyOptions,
    formatInstrumentLabel,
    hasPendingWorkLog,
    isDirty,
    printRequestSequenceRef,
    documentBody: document.body,
    setDraftJob,
    setDocumentEmailDraft,
    setIsSendingSubcontractorEmail,
    setSubcontractorPickupJob,
    subcontractorPickupJob,
    setIsDirty,
    setWorkLogText,
    patchJob,
    onDirtyChange,
    onClose,
    confirmIfDirty,
    saveDraftNow,
    onNotice,
    onRefresh,
    refreshTimelineEvents
  });

  function handleAssignmentChanged(assignment) {
    setDraftJob((current) => buildAssignmentJob(current, assignment));
    onAssignmentChanged?.(draftJob.id, assignment);
    refreshTimelineEvents().catch((error) => {
      console.warn('Assignment timeline refresh failed.', error);
    });
  }

  return {
    ...actions,
    documentEmailDraft,
    handleAssignmentChanged,
    isSendingSubcontractorEmail,
    refreshTimelineEvents,
    setDocumentEmailDraft,
    setSubcontractorPickupJob,
    subcontractorPickupJob,
    timelineEvents
  };
}
