import { useRef } from 'react';
import { addJob, setJobAccountingVoid, updateJob } from '../modules/jobs/jobService';
import { deleteJobImage, uploadJobImages } from '../modules/photos/photoService';
import { hasSupabaseConfig } from '../shared/lib/supabaseClient';

export default function useJobWorkspaceActions({
  access,
  isOnline,
  navigation,
  refreshCustomers,
  refreshJobs,
  selectedJobId,
  setJobs,
  setNotice
}) {
  const selectedJobIdRef = useRef(selectedJobId);
  selectedJobIdRef.current = selectedJobId;

  async function createSpecialistJob(jobDraft, specialist) {
    const isAmplifier = specialist === 'amplifier';
    const enabled = isAmplifier ? access.amplifierRepairEnabled : access.keyboardRepairEnabled;
    const canEdit = isAmplifier ? access.canEditAmplifierRepair : access.canEditKeyboardRepair;
    const label = isAmplifier ? 'Amplifier' : 'Keyboard';
    const detailMode = isAmplifier ? 'amplifier-detail' : 'keyboard-detail';

    if (!enabled) {
      throw new Error(`${label} Repair is available on Pro.`);
    }
    if (!canEdit) {
      throw new Error('Your shop role is read-only.');
    }
    if (hasSupabaseConfig && !isOnline) {
      throw new Error(`Creating ${label.toLowerCase()} work orders requires an active connection.`);
    }

    const savedJob = await addJob(jobDraft);
    const loadedJobs = await refreshJobs();
    await refreshCustomers(loadedJobs);
    navigation.setHasUnsavedPageChanges(false);
    navigation.selectWorkspaceJob(savedJob.id, detailMode, { skipDirtyGuard: true });
    setNotice({ type: 'success', message: `Created ${label.toLowerCase()} job ${savedJob.jobNumber || ''}.` });
    return savedJob;
  }

  function handleAmplifierJobCreate(jobDraft) {
    return createSpecialistJob(jobDraft, 'amplifier');
  }

  function handleKeyboardJobCreate(jobDraft) {
    return createSpecialistJob(jobDraft, 'keyboard');
  }

  function handleAssignmentChanged(jobId, assignment) {
    setJobs((current) => current.map((item) => (
      item.id === jobId
        ? {
            ...item,
            assignedMemberId: assignment.assignedMemberId || '',
            assignedMemberDisplayName: assignment.assignedMemberDisplayName || '',
            assignmentUpdatedAt: assignment.assignmentUpdatedAt || null
          }
        : item
    )));
  }

  async function handleUpdate(job, options = {}) {
    if (!access.canWrite) {
      setNotice({ type: 'error', message: 'Your shop role is read-only.' });
      return job;
    }

    if (hasSupabaseConfig && !isOnline) {
      throw new Error('Offline draft mode is for new job intake only. Existing job edits require an active connection.');
    }

    if (!options.expectedUpdatedAt) {
      setJobs((current) => current.map((item) => (item.id === job.id ? job : item)));
    }
    const savedJob = await updateJob(job, options);
    if (selectedJobIdRef.current !== job.id) {
      setJobs((current) => current.map((item) => (item.id === savedJob.id ? savedJob : item)));
      return savedJob;
    }
    const loadedJobs = await refreshJobs();
    await refreshCustomers(loadedJobs);
    return savedJob;
  }

  async function handleAccountingVoidChange(jobId, voided, reason) {
    if (!access.canEditShopSettings) {
      throw new Error('Only a writable shop owner or admin can change accounting exclusion.');
    }

    await setJobAccountingVoid(jobId, voided, reason);
    const loadedJobs = await refreshJobs();
    await refreshCustomers(loadedJobs);
    const savedJob = loadedJobs.find((item) => item.id === jobId) || null;
    setNotice({
      type: 'success',
      message: voided
        ? `Work order ${savedJob?.jobNumber || ''} excluded from accounting.`
        : `Work order ${savedJob?.jobNumber || ''} restored to accounting.`
    });
    return savedJob;
  }

  async function handleImageUpload(job, files, options = {}) {
    if (!access.canWrite) {
      setNotice({ type: 'error', message: 'Your shop role is read-only.' });
      return { job, errors: [{ fileName: 'Upload', message: 'Your shop role is read-only.' }] };
    }
    if (!access.canUploadPhotos) {
      const message = access.entitlementMessage || 'Photo uploads are unavailable for this shop plan or billing state.';
      setNotice({ type: 'error', message });
      return { job, errors: [{ fileName: 'Upload', message }] };
    }

    const { skipRefresh = false, ...uploadOptions } = options;
    const result = await uploadJobImages(job, files, { category: 'job', ...uploadOptions });
    if (result.job && !skipRefresh) {
      await refreshJobs();
      navigation.setSelectedJobId(result.job.id);
    }

    return result;
  }

  async function handleImageDelete(job, image) {
    if (!access.canWrite) {
      setNotice({ type: 'error', message: 'Your shop role is read-only.' });
      return;
    }

    const savedJob = await deleteJobImage(job, image);
    if (savedJob) {
      await refreshJobs();
      navigation.setSelectedJobId(savedJob.id);
    }
  }

  return {
    handleAccountingVoidChange,
    handleAmplifierJobCreate,
    handleAssignmentChanged,
    handleImageDelete,
    handleImageUpload,
    handleKeyboardJobCreate,
    handleUpdate
  };
}
