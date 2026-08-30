import { useCallback, useEffect, useRef, useState } from 'react';
import JobDetailTabs from './components/JobDetailTabs.jsx';
import { getShopDefaultTaxRate } from '../billing/jobTaxSettings';
import { formatMeasurementChange } from '../../shared/utils/measurements';
import {
  formatInstrumentLabel,
  normalizeInstrumentType
} from '../instruments/instrumentService';
import { getJobEvents } from './jobEventsService';
import { overwriteJobImage, saveEditedJobImageCopy } from '../photos/photoService';
import { mergeUploadedJobImages } from '../photos/photoState.js';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import JobInspectionSections from './JobInspectionSections.jsx';
import JobWorkSections from './JobWorkSections.jsx';
import JobBillingSections from './JobBillingSections.jsx';
import buildJobAuxiliarySections from './JobAuxiliarySections.jsx';
import JobIntakeSections from './JobIntakeSections.jsx';
import JobPhotoSections from './JobPhotoSections.jsx';
import buildJobPrintSections from './JobPrintSections.jsx';
import JobDetailShell from './JobDetailShell.jsx';
import { cancelPrintRequests } from '../print/printRequestCoordinator.js';
import { JOB_SOURCE_OPTIONS } from './jobSources';
import {
  buildAppendImagePreviewsJob,
  buildAssignmentJob,
  buildDamageMapJob,
  buildDiscountFieldPatch,
  buildInstrumentTypePatch,
  buildJobFieldPatch,
  buildMeasurementDisplay,
  buildNeckInspectionPatch,
  buildRemoveImageJob,
  buildShopTaxRatePatch,
  buildStringCountPatch,
  buildStringGaugePatch,
  buildStringGaugesPatch,
  buildTaxFieldPatch,
  buildTechFieldPatch,
  buildUnlinkCustomerPatch,
  buildWorkOrderImageIdsPatch,
  findNewDamageViewImage
} from './jobDetailFormatting.js';
import { createJobDetailCommunicationActions } from './jobDetailCommunicationActions.js';
import useJobDetailBillingActions from './useJobDetailBillingActions.js';
import useJobDetailDerivedState from './useJobDetailDerivedState.js';
import useJobInventoryParts from './useJobInventoryParts.js';
import {
  appendWorkLogDraft,
  buildRemoveWorkLogEntryJob,
  buildUpdateWorkLogEntryPatch,
  getWorkLogSubmission,
  hasPendingWorkLogDraft
} from './workLogDraft.js';

const intakeTypes = JOB_SOURCE_OPTIONS;
export default function JobDetail(props) {
  const canWrite = (props.canWrite ?? true) && !props.job?.accountingVoidedAt;
  return <JobDetailWorkspace {...props} canWrite={canWrite} />;
}

function JobDetailWorkspace({
  job,
  jobs = [],
  initialTab = 'overview',
  onUpdate,
  onImageUpload,
  onImageDelete,
  onRefresh,
  onClose,
  onNotice,
  canWrite = true,
  amplifierRepairEnabled = true,
  keyboardRepairEnabled = true,
  canUploadPhotos = canWrite,
  canEditPhotos = canWrite,
  canOverwritePhotos = canWrite,
  canDeletePhotos = canWrite,
  canSendEmail = true,
  canScheduleEmail = false,
  canSendSms = true,
  entitlementMessage = '',
  shopProfile = null,
  membership = null,
  entitlementSnapshot = null,
  betaApproved = false,
  assignableMembers = [],
  assignableMembersLoading = false,
  assignableMembersError = '',
  onAssignmentChanged,
  onDirtyChange,
  canManageAccountingVoid = false,
  onAccountingVoidChange
}) {
  const [draftJob, setDraftJob] = useState(job);
  const { isDirty, setDirty, confirmIfDirty } = useUnsavedChanges();
  const [saveStatus, setSaveStatus] = useState('saved');
  const [workLogText, setWorkLogText] = useState('');
  const [isSavingWorkLog, setIsSavingWorkLog] = useState(false);
  const [imageImportErrors, setImageImportErrors] = useState([]);
  const [imageOptimizationNotices, setImageOptimizationNotices] = useState([]);
  const [isImportingImages, setIsImportingImages] = useState(false);
  const [subcontractorPickupJob, setSubcontractorPickupJob] = useState(null);
  const [isSendingSubcontractorEmail, setIsSendingSubcontractorEmail] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState(job.events || []);
  const [documentEmailDraft, setDocumentEmailDraft] = useState(null);
  const [photoEditorImage, setPhotoEditorImage] = useState(null);
  const [isSavingEditedPhoto, setIsSavingEditedPhoto] = useState(false);
  const imageImportInputRef = useRef(null);
  const activeJobIdRef = useRef(job.id);
  const hydratedJobIdRef = useRef(job.id);
  const workLogSavePromiseRef = useRef(null);
  const workLogRetrySubmissionRef = useRef(null);
  const printRequestSequenceRef = useRef(0);
  activeJobIdRef.current = job.id;
  const hasPendingWorkLog = hasPendingWorkLogDraft(workLogText);
  const hasUnsettledWorkLog = hasPendingWorkLog || isSavingWorkLog;
  const hasUnsavedChanges = isDirty || hasUnsettledWorkLog;
  const displayedSaveStatus = hasPendingWorkLog && saveStatus === 'saved' ? 'unsaved' : saveStatus;

  const setIsDirty = useCallback((value) => {
    setDirty(value);
    setSaveStatus(value ? 'unsaved' : 'saved');
  }, [setDirty]);

  useEffect(() => {
    const didSwitchJobs = hydratedJobIdRef.current !== job.id;
    hydratedJobIdRef.current = job.id;
    setDraftJob(job);
    setTimelineEvents(job.events || []);
    setDocumentEmailDraft(null);
    if (workLogRetrySubmissionRef.current?.jobId !== job.id) {
      workLogRetrySubmissionRef.current = null;
    }
    if (didSwitchJobs) {
      cancelPrintRequests(printRequestSequenceRef, document.body);
      workLogSavePromiseRef.current = null;
      setWorkLogText('');
      setIsSavingWorkLog(false);
    }
    setIsDirty(false);
  }, [job, setIsDirty]);

  useEffect(() => {
    setDocumentEmailDraft(null);
  }, [draftJob.id, draftJob.shopId, shopProfile?.shopId, shopProfile?.updatedAt]);

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);
    return () => onDirtyChange?.(false);
  }, [hasUnsavedChanges, onDirtyChange]);

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

  useEffect(() => {
    refreshTimelineEvents();
  }, [job.id]);

  useEffect(() => {
    return () => {
      cancelPrintRequests(printRequestSequenceRef, document.body);
    };
  }, []);

  useEffect(() => {
    function cleanupPrintMode() {
      document.body.classList.remove('customer-report-printing');
    }
    window.addEventListener('afterprint', cleanupPrintMode);
    return () => window.removeEventListener('afterprint', cleanupPrintMode);
  }, []);

  const {
    dateOptions,
    images,
    instrumentStringCount,
    measurementOptions,
    moneyOptions,
    outerStringLabels,
    parts,
    payments,
    services,
    shopSettings,
    taxSettings,
    totals,
    workOrderImageIds,
    workOrderImages
  } = useJobDetailDerivedState(draftJob, shopProfile);
  const communicationActions = createJobDetailCommunicationActions({
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
  const {
    closeDetail,
    finishJob,
    handleSendCustomerMessage,
    handleSendDocumentEmail,
    openInvoiceEmail,
    openWorkOrderEmail,
    printCustomerReport,
    printJobSheet,
    sendSubcontractorPickupEmail,
    updateContactPreference,
    updateMessageTemplate
  } = communicationActions;

  function patchJob(patch, saveImmediately = false) {
    if (!canWrite) {
      return;
    }
    setDraftJob((current) => {
      const nextJob = { ...current, ...patch };
      setIsDirty(true);
      if (saveImmediately) {
        onUpdate(nextJob);
      }
      return nextJob;
    });
  }

  function updateField(event) {
    const { name, value } = event.target;
    patchJob(buildJobFieldPatch(draftJob, name, value, jobs));
  }

  function unlinkCustomer() {
    if (!canWrite || !draftJob.customerId) {
      return;
    }
    const confirmed = window.confirm(
      'Unlink this customer from the work order? The copied name, contact details, and messaging consent will be cleared when you save.'
    );
    if (!confirmed) {
      return;
    }
    patchJob(buildUnlinkCustomerPatch(draftJob));
  }

  function updateDiscountField(event) {
    const { name, value } = event.target;
    patchJob(buildDiscountFieldPatch(draftJob, name, value));
  }

  function updateTaxField(event) {
    const { name, value, checked, type } = event.target;
    patchJob(buildTaxFieldPatch(draftJob, name, value, type, checked));
  }

  function useShopTaxRate() {
    patchJob(buildShopTaxRatePatch(draftJob, getShopDefaultTaxRate(shopSettings)));
  }

  function setInstrumentType(instrumentType) {
    patchJob(buildInstrumentTypePatch(draftJob, instrumentType));
  }

  function updateStringCount(value) {
    patchJob(buildStringCountPatch(draftJob, value));
  }

  function updateTechField(event) {
    if (!canWrite) {
      return;
    }
    const { name, value } = event.target;
    setIsDirty(true);
    setDraftJob((current) => buildTechFieldPatch(current, name, value));
  }

  function updateSpecialistInspection(path, value) {
    if (!canWrite) {
      return;
    }
    setIsDirty(true);
    setDraftJob((current) => {
      const techDetails = { ...(current.techDetails || {}) };
      let cursor = techDetails;
      path.forEach((segment, index) => {
        if (index === path.length - 1) {
          cursor[segment] = value;
          return;
        }
        cursor[segment] = { ...(cursor[segment] || {}) };
        cursor = cursor[segment];
      });
      return { ...current, techDetails };
    });
  }

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

  async function saveDraftNow(jobToSave = draftJob) {
    if (!canWrite) {
      throw new Error('Your shop role is read-only.');
    }
    const savingJobId = jobToSave.id;
    if (activeJobIdRef.current === savingJobId) {
      setSaveStatus('saving');
    }
    try {
      if (!jobToSave.updatedAt) {
        throw new Error('This work order has no save version. Reload it before saving.');
      }
      const savedJob = await onUpdate(jobToSave, { expectedUpdatedAt: jobToSave.updatedAt });
      if (activeJobIdRef.current === savingJobId) {
        setDraftJob(savedJob || jobToSave);
        setIsDirty(false);
        refreshTimelineEvents();
      }
      return savedJob;
    } catch (error) {
      if (activeJobIdRef.current === savingJobId) {
        setDirty(true);
        setSaveStatus('error');
      }
      throw error;
    }
  }

  function updateNeckInspection(stage, fieldOrPatch, value) {
    if (!canWrite) {
      return;
    }
    setIsDirty(true);
    setDraftJob((current) => buildNeckInspectionPatch(current, stage, fieldOrPatch, value));
  }

  const {
    addPayment,
    addService,
    payment,
    removePayment,
    removeService,
    service,
    setPayment,
    setService,
    updatePayment,
    updateService
  } = useJobDetailBillingActions({
    canWrite,
    draftJob,
    onNotice,
    patchJob,
    saveDraftNow,
    services,
    setDraftJob,
    setIsDirty
  });

  function exportJobJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      job: draftJob,
      measurementDisplay: buildMeasurementDisplay(draftJob, measurementOptions.lengthUnit),
      timelineEvents
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `frettrack-job-${draftJob.jobNumber || draftJob.id || 'export'}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function updateDamageMap(damageMap) {
    if (!canWrite) {
      return;
    }
    setIsDirty(true);
    setDraftJob((current) => buildDamageMapJob(current, damageMap));
  }

  function updateStringGauge(index, value) {
    if (!canWrite) {
      return;
    }
    setIsDirty(true);
    setDraftJob((current) => buildStringGaugePatch(current, index, value));
  }

  function updateStringGauges(gauges) {
    if (!canWrite) {
      return;
    }
    setIsDirty(true);
    setDraftJob((current) => buildStringGaugesPatch(current, gauges));
  }

  function handleSaveRequest(event) {
    if (!canWrite) {
      event.detail?.reject?.(new Error('Your shop role is read-only.'));
      return;
    }
    const saveRequest = hasPendingWorkLog ? savePendingWorkLog : saveDraftNow;
    saveRequest()
      .then((savedJob) => event.detail?.resolve?.(savedJob))
      .catch((error) => event.detail?.reject?.(error));
  }

  useEffect(() => {
    window.addEventListener('guitar-app-save-current-job', handleSaveRequest);
    return () => {
      window.removeEventListener('guitar-app-save-current-job', handleSaveRequest);
    };
  });

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

  const {
    addInventoryPart,
    addPart,
    inventoryParts,
    inventorySearch,
    isInventoryLoading,
    part,
    removePart,
    searchInventoryParts,
    setInventorySearch,
    setPart,
    updatePart
  } = useJobInventoryParts({
    canWrite,
    draftJob,
    isDirty,
    onRefresh,
    parts,
    patchJob,
    refreshTimelineEvents,
    saveDraftNow,
    setDraftJob,
    setIsDirty
  });

  async function handleImageChange(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!canUploadPhotos) {
      onNotice?.({ type: 'error', message: 'Your shop role cannot upload photos.' });
      return;
    }

    if (!files.length) {
      return;
    }

    const previews = files
      .filter((file) => file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name))
      .map((file) => ({
        id: `preview-${crypto.randomUUID()}`,
        jobId: draftJob.id,
        url: URL.createObjectURL(file),
        fileName: file.name,
        name: file.name,
        originalFileName: file.name,
        category: 'job',
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }));

    if (previews.length) {
      setIsDirty(true);
      setDraftJob((current) => buildAppendImagePreviewsJob(current, previews));
    }

    setImageImportErrors([]);
    setImageOptimizationNotices([]);
    setIsImportingImages(true);
    const result = await onImageUpload(draftJob, files);
    if (result?.job) {
      setDraftJob(result.job);
      setIsDirty(false);
    }
    setImageImportErrors(result?.errors || []);
    setImageOptimizationNotices(result?.optimizationNotices || []);
    setIsImportingImages(false);
  }

  async function handleDamageViewImageUpload(viewName, file, uploadOptions = {}) {
    if (!canUploadPhotos) {
      onNotice?.({ type: 'error', message: 'Your shop role cannot upload photos.' });
      return null;
    }

    const category = uploadOptions.category || `damage-map-${viewName}`;
    const existingImageIds = new Set((draftJob.images || []).map((image) => image.id));
    const result = await onImageUpload(draftJob, [file], { category, skipRefresh: true });
    if (result?.errors?.length) {
      const uploadError = new Error(result.errors[0].message || 'Damage photo upload failed.');
      uploadError.code = result.errors[0].code || '';
      throw uploadError;
    }
    if (result?.job) {
      const uploadedImages = result.job.images || [];
      setDraftJob((current) => mergeUploadedJobImages(current, result.job));
      return findNewDamageViewImage(uploadedImages, existingImageIds, category, file.name);
    }
    return null;
  }

  function handleImageDelete(image) {
    if (!canDeletePhotos) {
      onNotice?.({ type: 'error', message: 'Your shop role cannot delete photos.' });
      return;
    }

    const confirmed = window.confirm('Delete this image from the job?');
    if (!confirmed) {
      return;
    }

    setDraftJob((current) => buildRemoveImageJob(current, image.id));
    setIsDirty(true);
    onImageDelete(draftJob, image);
  }

  function handleImageEdit(image) {
    if (!canEditPhotos) {
      onNotice?.({ type: 'error', message: 'Photo Editor is available in Pro.' });
      return;
    }

    setPhotoEditorImage(image);
  }

  async function saveEditedPhotoCopy(file, editMetadata) {
    if (!canEditPhotos) {
      onNotice?.({ type: 'error', message: 'Your shop role cannot edit photos.' });
      return;
    }

    setIsSavingEditedPhoto(true);
    try {
      const result = await saveEditedJobImageCopy(draftJob, photoEditorImage, file, editMetadata);
      if (result?.job) {
        setDraftJob(result.job);
        setIsDirty(false);
      }
      setPhotoEditorImage(null);
      onNotice?.({ type: 'success', message: 'Edited photo saved as a copy.' });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Edited photo save failed.', error);
      onNotice?.({ type: 'error', message: error instanceof Error ? error.message : 'Edited photo save failed.' });
    } finally {
      setIsSavingEditedPhoto(false);
    }
  }

  async function overwriteEditedPhoto(file, editMetadata) {
    if (!canOverwritePhotos) {
      onNotice?.({ type: 'error', message: 'Your shop role cannot overwrite photos.' });
      return;
    }

    setIsSavingEditedPhoto(true);
    try {
      const result = await overwriteJobImage(draftJob, photoEditorImage, file, editMetadata);
      if (result?.job) {
        setDraftJob(result.job);
        setIsDirty(false);
      }
      setPhotoEditorImage(null);
      onNotice?.({ type: 'success', message: 'Original photo was overwritten with the edited PNG.' });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Edited photo overwrite failed.', error);
      onNotice?.({ type: 'error', message: error instanceof Error ? error.message : 'Edited photo overwrite failed.' });
    } finally {
      setIsSavingEditedPhoto(false);
    }
  }

  function updateWorkOrderImage(imageId, checked) {
    if (!canWrite) {
      return;
    }
    patchJob(buildWorkOrderImageIdsPatch(draftJob, workOrderImageIds, imageId, checked));
  }

  function formatMeasurementDelta(initialValue, finalValue, unit = measurementOptions.lengthUnit) {
    return formatMeasurementChange(initialValue, finalValue, unit);
  }

  async function refreshTimelineEvents() {
    const events = await getJobEvents(job.id);
    setTimelineEvents(events);
  }

  function handleAssignmentChanged(assignment) {
    setDraftJob((current) => buildAssignmentJob(current, assignment));
    onAssignmentChanged?.(draftJob.id, assignment);
    refreshTimelineEvents().catch((error) => {
      console.warn('Assignment timeline refresh failed.', error);
    });
  }

  const { printActions, printSections } = buildJobPrintSections({
    canSendEmail,
    canWrite,
    draftJob,
    formatInstrumentLabel,
    formatMeasurementDelta,
    lengthUnit: measurementOptions.lengthUnit,
    normalizeInstrumentType,
    onCloseDetail: closeDetail,
    onEmailWorkOrder: openWorkOrderEmail,
    onExportJobJson: exportJobJson,
    onFinishJob: finishJob,
    onPrintCustomerReport: printCustomerReport,
    onPrintJobSheet: printJobSheet,
    outerStringLabels,
    parts,
    services,
    shopSettings,
    totals,
    workOrderImages
  });

  const intakeSection = (
    <JobIntakeSections
      canWrite={canWrite}
      amplifierRepairEnabled={amplifierRepairEnabled}
      keyboardRepairEnabled={keyboardRepairEnabled}
      draftJob={draftJob}
      intakeTypes={intakeTypes}
      normalizeInstrumentType={normalizeInstrumentType}
      onContactPreferenceChange={updateContactPreference}
      onFieldChange={updateField}
      onInstrumentTypeChange={setInstrumentType}
      onStringCountChange={updateStringCount}
      onTechFieldChange={updateTechField}
      onUnlinkCustomer={unlinkCustomer}
    />
  );

  const inspectionSections = (
    <JobInspectionSections
      canWrite={canWrite}
      draftJob={draftJob}
      formatMeasurementDelta={formatMeasurementDelta}
      lengthUnit={measurementOptions.lengthUnit}
      outerStringLabels={outerStringLabels}
      onDamageMapChange={updateDamageMap}
      onDamageViewImageUpload={handleDamageViewImageUpload}
      onNeckInspectionChange={updateNeckInspection}
      onStringGaugeChange={updateStringGauge}
      onStringGaugesChange={updateStringGauges}
      onSpecialistFieldChange={updateSpecialistInspection}
      onTechFieldChange={updateTechField}
    />
  );

  const workSections = (
    <JobWorkSections
      canWrite={canWrite}
      draftJob={draftJob}
      hasPendingWorkLog={hasPendingWorkLog}
      isSavingWorkLog={isSavingWorkLog}
      onAddService={addService}
      onAppendWorkLog={appendWorkLog}
      onDiscardWorkLogDraft={discardWorkLogDraft}
      onRemoveService={removeService}
      onRemoveWorkLogEntry={removeWorkLogEntry}
      onSaveWorkLogChanges={saveWorkLogChanges}
      onUpdateService={updateService}
      onUpdateWorkLogEntry={updateWorkLogEntry}
      service={service}
      services={services}
      setService={setService}
      setWorkLogText={setWorkLogText}
      workLogText={workLogText}
    />
  );

  const billingSections = (
    <JobBillingSections
      canSendEmail={canSendEmail}
      canWrite={canWrite}
      draftJob={draftJob}
      inventoryParts={inventoryParts}
      inventorySearch={inventorySearch}
      isInventoryLoading={isInventoryLoading}
      onAddInventoryPart={addInventoryPart}
      onAddPart={addPart}
      onAddPayment={addPayment}
      onAddService={addService}
      onEmailInvoice={openInvoiceEmail}
      onRemovePart={removePart}
      onRemovePayment={removePayment}
      onRemoveService={removeService}
      onSearchInventoryParts={searchInventoryParts}
      onUpdateDiscountField={updateDiscountField}
      onUpdatePart={updatePart}
      onUpdatePayment={updatePayment}
      onUpdateService={updateService}
      onUpdateTaxField={updateTaxField}
      onUseShopTaxRate={useShopTaxRate}
      part={part}
      parts={parts}
      payment={payment}
      payments={payments}
      service={service}
      services={services}
      setInventorySearch={setInventorySearch}
      setPart={setPart}
      setPayment={setPayment}
      setService={setService}
      shopTaxRate={getShopDefaultTaxRate(shopSettings)}
      taxSettings={taxSettings}
      totals={totals}
    />
  );

  const imagesSection = (
    <JobPhotoSections
      canDeletePhotos={canDeletePhotos}
      canEditPhotos={canEditPhotos}
      canUploadPhotos={canUploadPhotos}
      canWrite={canWrite}
      imageImportErrors={imageImportErrors}
      imageImportInputRef={imageImportInputRef}
      imageOptimizationNotices={imageOptimizationNotices}
      images={images}
      isImportingImages={isImportingImages}
      onImageChange={handleImageChange}
      onImageDelete={handleImageDelete}
      onImageEdit={handleImageEdit}
      onWorkOrderImageToggle={updateWorkOrderImage}
      workOrderImageIds={workOrderImageIds}
    />
  );

  const { activityTimeline, messagesPanel, schedulingSection } = buildJobAuxiliarySections({
    canSendEmail,
    canScheduleEmail,
    canSendSms,
    canWrite,
    draftJob,
    entitlementMessage,
    onContactPreferenceChange: updateContactPreference,
    onMessageTemplateChange: updateMessageTemplate,
    onNotice,
    onSendCustomerMessage: handleSendCustomerMessage,
    shopProfile,
    timelineEvents
  });

  return (
    <JobDetailShell
      activityTimeline={activityTimeline}
      assignableMembers={assignableMembers}
      assignableMembersError={assignableMembersError}
      assignableMembersLoading={assignableMembersLoading}
      betaApproved={betaApproved}
      billingSections={billingSections}
      canOverwritePhotos={canOverwritePhotos}
      canWrite={canWrite}
      canManageAccountingVoid={canManageAccountingVoid}
      onAccountingVoidChange={onAccountingVoidChange}
      documentEmailDraft={documentEmailDraft}
      draftJob={draftJob}
      entitlementSnapshot={entitlementSnapshot}
      imagesSection={imagesSection}
      initialTab={initialTab}
      inspectionSections={inspectionSections}
      intakeSection={intakeSection}
      isDirty={hasUnsavedChanges}
      isSavingEditedPhoto={isSavingEditedPhoto}
      isSendingSubcontractorEmail={isSendingSubcontractorEmail}
      membership={membership}
      messagesPanel={messagesPanel}
      onAssignmentChanged={handleAssignmentChanged}
      onCancelSubcontractorPickup={() => setSubcontractorPickupJob(null)}
      onCloseDocumentEmail={() => setDocumentEmailDraft(null)}
      onClosePhotoEditor={() => setPhotoEditorImage(null)}
      onNotice={onNotice}
      onOverwritePhoto={overwriteEditedPhoto}
      onSavePhotoCopy={saveEditedPhotoCopy}
      onSendDocumentEmail={handleSendDocumentEmail}
      onSendSubcontractorPickup={sendSubcontractorPickupEmail}
      onStatusChange={updateField}
      photoEditorImage={photoEditorImage}
      printActions={printActions}
      printSections={printSections}
      saveStatus={displayedSaveStatus}
      schedulingSection={schedulingSection}
      subcontractorPickupJob={subcontractorPickupJob}
      updateField={updateField}
      workSections={workSections}
    />
  );
}
