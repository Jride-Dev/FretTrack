import { useCallback, useEffect, useRef, useState } from 'react';
import JobDetailTabs from './components/JobDetailTabs.jsx';
import { getShopDefaultTaxRate } from '../billing/jobTaxSettings';
import { formatMeasurementChange } from '../../shared/utils/measurements';
import {
  formatInstrumentLabel,
  normalizeInstrumentType
} from '../instruments/instrumentService';
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
  buildDamageMapJob,
  buildDiscountFieldPatch,
  buildInstrumentTypePatch,
  buildJobFieldPatch,
  buildMeasurementDisplay,
  buildNeckInspectionPatch,
  buildShopTaxRatePatch,
  buildStringCountPatch,
  buildStringGaugePatch,
  buildStringGaugesPatch,
  buildTaxFieldPatch,
  buildTechFieldPatch,
  buildUnlinkCustomerPatch
} from './jobDetailFormatting.js';
import useJobDetailBillingActions from './useJobDetailBillingActions.js';
import useJobDetailDerivedState from './useJobDetailDerivedState.js';
import useJobInventoryParts from './useJobInventoryParts.js';
import useJobCommunicationController from './useJobCommunicationController.js';
import useJobPhotoController from './useJobPhotoController.js';
import useJobWorkLogController from './useJobWorkLogController.js';

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
  canManageJobCharges = canWrite,
  canRecordJobPayments = canWrite,
  canIssuePaymentAdjustments = canWrite,
  canFinalizeJobInvoices = canWrite,
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
  const activeJobIdRef = useRef(job.id);
  const hydratedJobIdRef = useRef(job.id);
  const printRequestSequenceRef = useRef(0);
  activeJobIdRef.current = job.id;
  // Estimates are informational snapshots. Only a finalized invoice locks charges.
  const chargesLocked = Boolean(draftJob.invoiceFinalizedAt);

  const setIsDirty = useCallback((value) => {
    setDirty(value);
    setSaveStatus(value ? 'unsaved' : 'saved');
  }, [setDirty]);

  const {
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
  } = useJobWorkLogController({
    activeJobIdRef,
    canWrite,
    draftJob,
    onNotice,
    patchJob,
    saveDraftNow,
    setDraftJob
  });
  const hasUnsavedChanges = isDirty || hasUnsettledWorkLog;
  const displayedSaveStatus = hasPendingWorkLog && saveStatus === 'saved' ? 'unsaved' : saveStatus;

  useEffect(() => {
    const didSwitchJobs = hydratedJobIdRef.current !== job.id;
    hydratedJobIdRef.current = job.id;
    setDraftJob(job);
    if (didSwitchJobs) {
      cancelPrintRequests(printRequestSequenceRef, document.body);
    }
    setIsDirty(false);
  }, [job, setIsDirty]);

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);
    return () => onDirtyChange?.(false);
  }, [hasUnsavedChanges, onDirtyChange]);
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
  const {
    closeDetail,
    documentEmailDraft,
    finishJob,
    handleAssignmentChanged,
    handleSendCustomerMessage,
    handleSendDocumentEmail,
    isSendingSubcontractorEmail,
    openInvoiceEmail, openEstimateEmail,
    openWorkOrderEmail,
    printCustomerReport,
    printJobSheet,
    refreshTimelineEvents,
    sendSubcontractorPickupEmail,
    setDocumentEmailDraft,
    setSubcontractorPickupJob,
    subcontractorPickupJob,
    timelineEvents,
    updateContactPreference,
    updateMessageTemplate
  } = useJobCommunicationController({
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
  });
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
  function updateDocumentType(documentType) {
    if (!canWrite || !['work_order', 'estimate'].includes(documentType)) {
      return;
    }
    patchJob({
      documentType,
      techDetails: {
        ...(draftJob.techDetails || {}),
        documentType
      }
    });
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
    if (!canManageJobCharges || chargesLocked) {
      return;
    }
    const { name, value } = event.target;
    patchJob(buildDiscountFieldPatch(draftJob, name, value));
  }
  function updateTaxField(event) {
    if (!canManageJobCharges || chargesLocked) {
      return;
    }
    const { name, value, checked, type } = event.target;
    patchJob(buildTaxFieldPatch(draftJob, name, value, type, checked));
  }
  function useShopTaxRate() {
    if (!canManageJobCharges || chargesLocked) {
      return;
    }
    patchJob(buildShopTaxRatePatch(draftJob, shopSettings));
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
    createEstimateLink, changeInvoiceFinalization,
    finalizationReason,
    isChangingInvoiceState,
    isRecordingPayment, isCreatingPublicEstimateLink, payment, paymentTargets, publicEstimateLink,
    removeService,
    service,
    setFinalizationReason,
    setPayment,
    setService,
    updateService
  } = useJobDetailBillingActions({
    canFinalizeJobInvoices,
    canIssuePaymentAdjustments,
    canManageJobCharges,
    canRecordJobPayments,
    canWrite,
    draftJob,
    isDirty,
    onNotice,
    onRefresh,
    patchJob,
    saveDraftNow,
    services,
    setDraftJob,
    setIsDirty, taxSettings
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
    canWrite: canWrite && canManageJobCharges && !chargesLocked,
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
  const {
    handleDamageViewImageUpload,
    handleImageChange,
    handleImageDelete,
    handleImageEdit,
    imageImportErrors,
    imageImportInputRef,
    imageOptimizationNotices,
    isImportingImages,
    isSavingEditedPhoto,
    overwriteEditedPhoto,
    photoEditorImage,
    saveEditedPhotoCopy,
    setPhotoEditorImage,
    updateWorkOrderImage
  } = useJobPhotoController({
    canDeletePhotos,
    canEditPhotos,
    canOverwritePhotos,
    canUploadPhotos,
    canWrite,
    draftJob,
    onImageDelete,
    onImageUpload,
    onNotice,
    onRefresh,
    patchJob,
    setDraftJob,
    setIsDirty,
    workOrderImageIds
  });

  function formatMeasurementDelta(initialValue, finalValue, unit = measurementOptions.lengthUnit) {
    return formatMeasurementChange(initialValue, finalValue, unit);
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
    onEmailWorkOrder: draftJob.documentType === 'estimate' ? openEstimateEmail : openWorkOrderEmail,
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
      canManageJobCharges={canManageJobCharges && !chargesLocked}
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
      canManageJobCharges={canManageJobCharges && !chargesLocked}
      canRecordJobPayments={canRecordJobPayments}
      canIssuePaymentAdjustments={canIssuePaymentAdjustments}
      canFinalizeJobInvoices={canFinalizeJobInvoices}
      createEstimateLink={createEstimateLink}
      changeInvoiceFinalization={changeInvoiceFinalization}
      draftJob={draftJob}
      finalizationReason={finalizationReason}
      inventoryParts={inventoryParts}
      inventorySearch={inventorySearch}
      isInventoryLoading={isInventoryLoading}
      isCreatingPublicEstimateLink={isCreatingPublicEstimateLink}
      isChangingInvoiceState={isChangingInvoiceState}
      isRecordingPayment={isRecordingPayment}
      onAddInventoryPart={addInventoryPart}
      onAddPart={addPart}
      onAddPayment={addPayment}
      onAddService={addService}
      onEmailInvoice={openInvoiceEmail} onEmailEstimate={openEstimateEmail}
      publicEstimateLink={publicEstimateLink}
      onRemovePart={removePart}
      onRemoveService={removeService}
      onSearchInventoryParts={searchInventoryParts}
      onUpdateDiscountField={updateDiscountField}
      onUpdatePart={updatePart}
      onUpdateService={updateService}
      onUpdateTaxField={updateTaxField}
      onUseShopTaxRate={useShopTaxRate}
      part={part}
      parts={parts}
      payment={payment}
      paymentTargets={paymentTargets}
      payments={payments}
      service={service}
      services={services}
      setInventorySearch={setInventorySearch}
      setFinalizationReason={setFinalizationReason}
      setPart={setPart}
      setPayment={setPayment}
      setService={setService}
      shopTaxCalculationMode={shopSettings.taxCalculationMode || 'disabled'}
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
      onDocumentTypeChange={updateDocumentType}
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
