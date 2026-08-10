import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shouldOfferPvmhPickupEmail } from './SubcontractorPickupEmailDialog.jsx';
import JobDetailTabs from './components/JobDetailTabs.jsx';
import { calculateJobTotals } from '../billing/accounting';
import { getShopDefaultTaxRate, resolveJobTaxSettings, withResolvedJobTaxSettings } from '../billing/jobTaxSettings';
import { toIsoDateInputValue } from '../../shared/utils/dateFormat';
import { formatMeasurementChange } from '../../shared/utils/measurements';
import { getShopDateOptions, getShopMeasurementOptions, getShopMoneyOptions, getShopSettings } from '../shops/shopConfig';
import {
  formatInstrumentLabel,
  getInstrumentStringCount,
  getOuterStringLabels,
  normalizeInstrumentType
} from '../instruments/instrumentService';
import { getJobEvents, logJobEventSafe } from './jobEventsService';
import { sendCustomerMessage } from '../../data/messagesRepository';
import { SHOP_EMAIL_CONTEXT_ERROR, buildDocumentEmailHtml, buildInvoiceEmailDraft, buildSelectedDocumentEmailContent, buildWorkOrderEmailDraft, resolveScopedShopEmailSettings } from './emailDocuments';
import { addPartToJob, listParts as listInventoryParts, removeJobPart, updateInventoryJobPartQuantity } from '../inventory/inventoryService';
import { overwriteJobImage, saveEditedJobImageCopy } from '../photos/photoService';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import JobInspectionSections from './JobInspectionSections.jsx';
import JobWorkSections from './JobWorkSections.jsx';
import JobBillingSections from './JobBillingSections.jsx';
import buildJobAuxiliarySections from './JobAuxiliarySections.jsx';
import JobIntakeSections from './JobIntakeSections.jsx';
import JobPhotoSections from './JobPhotoSections.jsx';
import buildJobPrintSections from './JobPrintSections.jsx';
import JobDetailShell from './JobDetailShell.jsx';
import { JOB_SOURCE_OPTIONS } from './jobSources';
import {
  buildAddPaymentJob,
  buildAddManualPartPatch,
  buildAddServicePatch,
  buildContactPreferencePatch,
  buildDiscountFieldPatch,
  buildInstrumentTypePatch,
  buildJobFieldPatch,
  buildMeasurementDisplay,
  buildMessageTemplatePatch,
  buildNeckInspectionPatch,
  buildRemoveManualPartPatch,
  buildRemovePaymentJob,
  buildRemoveServicePatch,
  buildShopTaxRatePatch,
  buildStringCountPatch,
  buildStringGaugePatch,
  buildStringGaugesPatch,
  buildTaxFieldPatch,
  buildTechFieldPatch,
  buildUpdateManualPartPatch,
  buildUpdatePaymentJob,
  buildUpdateServicePatch,
  buildWorkOrderImageIdsPatch
} from './jobDetailFormatting.js';
import { PENDING_WORK_LOG_MESSAGE, appendWorkLogDraft, hasPendingWorkLogDraft } from './workLogDraft.js';

const intakeTypes = JOB_SOURCE_OPTIONS;
export default function JobDetail({
  job,
  jobs = [],
  onUpdate,
  onImageUpload,
  onImageDelete,
  onRefresh,
  onClose,
  onNotice,
  canWrite = true,
  canUploadPhotos = canWrite,
  canEditPhotos = canWrite,
  canOverwritePhotos = canWrite,
  canDeletePhotos = canWrite,
  canSendEmail = true,
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
  onDirtyChange
}) {
  const [draftJob, setDraftJob] = useState(job);
  const { isDirty, setDirty, confirmIfDirty } = useUnsavedChanges();
  const [saveStatus, setSaveStatus] = useState('saved');
  const [workLogText, setWorkLogText] = useState('');
  const [part, setPart] = useState({ name: '', quantity: '1', cost: '', retail: '' });
  const [service, setService] = useState({ description: '', quantity: '1', cost: '', retail: '' });
  const [payment, setPayment] = useState({ amount: '', method: 'Cash', note: '', date: toIsoDateInputValue() });
  const [imageImportErrors, setImageImportErrors] = useState([]);
  const [imageOptimizationNotices, setImageOptimizationNotices] = useState([]);
  const [isImportingImages, setIsImportingImages] = useState(false);
  const [subcontractorPickupJob, setSubcontractorPickupJob] = useState(null);
  const [isSendingSubcontractorEmail, setIsSendingSubcontractorEmail] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState(job.events || []);
  const [documentEmailDraft, setDocumentEmailDraft] = useState(null);
  const [photoEditorImage, setPhotoEditorImage] = useState(null);
  const [isSavingEditedPhoto, setIsSavingEditedPhoto] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryParts, setInventoryParts] = useState([]);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const imageImportInputRef = useRef(null);
  const paymentAutosaveTimeoutRef = useRef(null);
  const hasPendingWorkLog = hasPendingWorkLogDraft(workLogText);
  const hasUnsavedChanges = isDirty || hasPendingWorkLog;
  const displayedSaveStatus = hasPendingWorkLog && saveStatus === 'saved' ? 'unsaved' : saveStatus;

  const setIsDirty = useCallback((value) => {
    setDirty(value);
    setSaveStatus(value ? 'unsaved' : 'saved');
  }, [setDirty]);

  useEffect(() => {
    setDraftJob(job);
    setTimelineEvents(job.events || []);
    setDocumentEmailDraft(null);
    setWorkLogText('');
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
    if (!hasPendingWorkLog) {
      return undefined;
    }

    function handlePendingWorkLogBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = 'You have an unsaved Work Note.';
      return event.returnValue;
    }

    window.addEventListener('beforeunload', handlePendingWorkLogBeforeUnload);
    return () => window.removeEventListener('beforeunload', handlePendingWorkLogBeforeUnload);
  }, [hasPendingWorkLog]);

  useEffect(() => {
    refreshTimelineEvents();
  }, [job.id]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('customer-report-printing');
      window.clearTimeout(paymentAutosaveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    function cleanupPrintMode() {
      document.body.classList.remove('customer-report-printing');
    }
    window.addEventListener('afterprint', cleanupPrintMode);
    return () => window.removeEventListener('afterprint', cleanupPrintMode);
  }, []);

  const parts = draftJob.parts || [];
  const services = draftJob.services || draftJob.labor || [];
  const images = draftJob.images || [];
  const workOrderImageIds = draftJob.techDetails.workOrderImageIds || [];
  const workOrderImages = images.filter((image) => workOrderImageIds.includes(image.id));
  const shopSettings = shopProfile || getShopSettings();
  const taxSettings = resolveJobTaxSettings(draftJob, shopSettings);
  const payments = draftJob.techDetails.payments || [];
  const instrumentStringCount = getInstrumentStringCount(draftJob);
  const outerStringLabels = getOuterStringLabels(draftJob.instrumentType, instrumentStringCount);
  const measurementOptions = getShopMeasurementOptions(shopSettings);

  const totals = useMemo(
    () => calculateJobTotals(draftJob, taxSettings),
    [draftJob, taxSettings.salesTaxRate, taxSettings.taxableParts, taxSettings.taxableServices]
  );
  const dateOptions = getShopDateOptions({
    dateFormat: taxSettings.dateFormat || shopSettings.dateFormat,
    locale: taxSettings.locale || shopSettings.locale
  });
  const moneyOptions = getShopMoneyOptions({
    currencyCode: taxSettings.currencyCode || shopSettings.currencyCode,
    locale: taxSettings.locale || shopSettings.locale
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

  function updateWorkLogEntry(entryId, text) {
    patchJob({
      workLog: draftJob.workLog.map((entry) => (
        entry.id === entryId ? { ...entry, text, entry: text } : entry
      ))
    });
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

    const nextJob = {
      ...draftJob,
      workLog: draftJob.workLog.filter((entry) => entry.id !== entryId)
    };

    setDraftJob(nextJob);
    await saveDraftNow(nextJob).catch(() => {});
  }

  async function saveDraftNow(jobToSave = draftJob) {
    if (!canWrite) {
      throw new Error('Your shop role is read-only.');
    }
    setSaveStatus('saving');
    try {
      const savedJob = await onUpdate(jobToSave);
      setDraftJob(savedJob || jobToSave);
      setIsDirty(false);
      refreshTimelineEvents();
      return savedJob;
    } catch (error) {
      setDirty(true);
      setSaveStatus('error');
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

  async function savePaymentChange(nextJob, { immediate = false } = {}) {
    if (!canWrite) {
      return;
    }
    window.clearTimeout(paymentAutosaveTimeoutRef.current);
    setDraftJob(nextJob);
    setIsDirty(true);

    if (immediate) {
      await saveDraftNow(nextJob).catch(() => {});
      return;
    }

    paymentAutosaveTimeoutRef.current = window.setTimeout(() => {
      saveDraftNow(nextJob).catch(() => {});
    }, 700);
  }

  function addPayment(event) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }
    if (!Number(payment.amount)) {
      return;
    }

    const nextJob = buildAddPaymentJob(draftJob, payment, crypto.randomUUID());

    savePaymentChange(nextJob, { immediate: true });
    setPayment({ amount: '', method: 'Cash', note: '', date: toIsoDateInputValue() });
  }

  function updatePayment(paymentId, field, value) {
    if (!canWrite) {
      return;
    }
    const nextJob = buildUpdatePaymentJob(draftJob, paymentId, field, value);

    savePaymentChange(nextJob);
  }

  function removePayment(paymentId) {
    if (!canWrite) {
      return;
    }
    const nextJob = buildRemovePaymentJob(draftJob, paymentId);

    savePaymentChange(nextJob, { immediate: true });
  }

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
    setDraftJob((current) => {
      return {
        ...current,
        techDetails: {
          ...current.techDetails,
          damageMap
        }
      };
    });
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
    if (!hasPendingWorkLog) {
      return saveDraftNow();
    }
    const timestamp = new Date().toISOString();
    const nextJob = appendWorkLogDraft(draftJob, workLogText, {
      id: crypto.randomUUID(),
      timestamp
    });

    try {
      const savedJob = await saveDraftNow(nextJob);
      setWorkLogText('');
      return savedJob;
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || 'Work Note could not be saved.' });
      throw error;
    }
  }

  function discardWorkLogDraft() {
    if (!hasPendingWorkLog || window.confirm('Discard this unsaved Work Note?')) {
      setWorkLogText('');
    }
  }

  function guardPendingWorkLogDocumentAction() {
    if (!hasPendingWorkLog) {
      if (!isDirty) {
        return true;
      }
      window.alert('Save the job changes before printing or sending customer documents.');
      return false;
    }
    window.alert(PENDING_WORK_LOG_MESSAGE);
    return false;
  }

  function addPart(event) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }
    if (!part.name.trim()) {
      return;
    }
    patchJob(buildAddManualPartPatch(draftJob, parts, part, crypto.randomUUID()));
    setPart({ name: '', quantity: '1', cost: '', retail: '' });
  }

  async function searchInventoryParts(event) {
    event.preventDefault();
    setIsInventoryLoading(true);
    try {
      const loadedParts = await listInventoryParts(draftJob.shopId, {
        search: inventorySearch,
        activeOnly: true
      });
      setInventoryParts(loadedParts);
    } catch (error) {
      console.error('Inventory search failed.', error);
      window.alert(error.message || 'Inventory search failed.');
    } finally {
      setIsInventoryLoading(false);
    }
  }

  async function addInventoryPart(inventoryPart, quantity = 1) {
    if (!canWrite) {
      return;
    }
    const requestedQuantity = Math.max(Number(quantity || 1), 1);
    if (inventoryPart.quantityOnHand < requestedQuantity) {
      const confirmed = window.confirm(`${inventoryPart.name} only has ${inventoryPart.quantityOnHand} on hand. Add ${requestedQuantity} anyway?`);
      if (!confirmed) {
        return;
      }
    }

    let jobForInventory = draftJob;
    if (isDirty) {
      try {
        jobForInventory = (await saveDraftNow()) || draftJob;
      } catch (error) {
        window.alert(error.message || 'Save the job before adding inventory.');
        return;
      }
    }

    try {
      const jobPart = await addPartToJob(jobForInventory.id, inventoryPart.id, requestedQuantity);
      const nextJob = {
        ...jobForInventory,
        parts: [...(jobForInventory.parts || []), jobPart]
      };
      setDraftJob(nextJob);
      setIsDirty(false);
      refreshTimelineEvents();
      if (onRefresh) {
        await onRefresh();
      }
      setInventoryParts((current) => current.map((partRow) => (
        partRow.id === inventoryPart.id
          ? { ...partRow, quantityOnHand: partRow.quantityOnHand - requestedQuantity }
          : partRow
      )));
    } catch (error) {
      console.error('Add inventory part failed.', error);
      window.alert(error.message || 'Unable to add inventory part.');
    }
  }

  async function updatePart(partId, field, value) {
    if (!canWrite) {
      return;
    }
    const editedPart = parts.find((row) => row.id === partId);
    if (field === 'quantity' && editedPart?.partId) {
      const requestedQuantity = Math.max(Number(value || 1), 1);
      if (requestedQuantity > Number(editedPart.quantity || 1)) {
        const additionalQuantity = requestedQuantity - Number(editedPart.quantity || 1);
        const inventoryPart = inventoryParts.find((row) => row.id === editedPart.partId);
        if (inventoryPart && inventoryPart.quantityOnHand < additionalQuantity) {
          const confirmed = window.confirm(`${editedPart.name} only has ${inventoryPart.quantityOnHand} additional on hand. Save quantity ${requestedQuantity} anyway?`);
          if (!confirmed) {
            return;
          }
        }
      }

      if (isDirty) {
        try {
          await saveDraftNow();
        } catch (error) {
          window.alert(error.message || 'Save the job before changing inventory quantity.');
          return;
        }
      }

      try {
        const updatedJobPart = await updateInventoryJobPartQuantity(partId, requestedQuantity);
        const nextParts = parts.map((row) => (row.id === partId ? { ...row, ...updatedJobPart } : row));
        setDraftJob((current) => ({
          ...current,
          parts: nextParts
        }));
        setIsDirty(false);
        setInventoryParts((current) => current.map((row) => (
          row.id === editedPart.partId
            ? { ...row, quantityOnHand: row.quantityOnHand - (requestedQuantity - Number(editedPart.quantity || 1)) }
            : row
        )));
        refreshTimelineEvents();
        if (onRefresh) {
          await onRefresh();
        }
      } catch (error) {
        console.error('Inventory quantity update failed.', error);
        window.alert(error.message || 'Unable to update inventory quantity.');
      }
      return;
    }

    patchJob(buildUpdateManualPartPatch(draftJob, parts, partId, field, value));
  }

  async function removePart(partId) {
    if (!canWrite) {
      return;
    }
    const removedPart = parts.find((row) => row.id === partId);
    if (removedPart?.partId) {
      const confirmed = window.confirm(`Remove ${removedPart.name} from this job and return it to inventory?`);
      if (!confirmed) {
        return;
      }
      if (isDirty) {
        try {
          await saveDraftNow();
        } catch (error) {
          window.alert(error.message || 'Save the job before removing inventory.');
          return;
        }
      }
      try {
        await removeJobPart(partId);
        const nextJob = {
          ...draftJob,
          parts: parts.filter((row) => row.id !== partId)
        };
        setDraftJob(nextJob);
        setIsDirty(false);
        refreshTimelineEvents();
        if (onRefresh) {
          await onRefresh();
        }
      } catch (error) {
        console.error('Remove inventory part failed.', error);
        window.alert(error.message || 'Unable to remove inventory part.');
      }
      return;
    }

    patchJob(buildRemoveManualPartPatch(draftJob, parts, partId));
  }

  function addService(event) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }
    if (!service.description.trim()) {
      return;
    }
    patchJob(buildAddServicePatch(draftJob, services, service, crypto.randomUUID()));
    setService({ description: '', quantity: '1', cost: '', retail: '' });
  }

  function updateService(serviceId, field, value) {
    if (!canWrite) {
      return;
    }
    patchJob(buildUpdateServicePatch(services, serviceId, field, value));
  }

  function removeService(serviceId) {
    if (!canWrite) {
      return;
    }
    patchJob(buildRemoveServicePatch(services, serviceId));
  }

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
      setDraftJob((current) => ({
        ...current,
        images: [...(current.images || []), ...previews]
      }));
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
      setDraftJob(result.job);
      setIsDirty(false);
      const uploadedImages = result.job.images || [];
      return uploadedImages.find((image) => !existingImageIds.has(image.id) && image.category === category && image.originalFileName === file.name)
        || uploadedImages.find((image) => !existingImageIds.has(image.id) && image.category === category)
        || null;
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

    setDraftJob((current) => ({
      ...current,
      images: (current.images || []).filter((item) => item.id !== image.id)
    }));
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

  function closeDetail() {
    if (hasPendingWorkLog && !window.confirm('This Work Note has not been saved. Discard it and close the detail view?')) {
      return;
    }
    if (!confirmIfDirty()) {
      return;
    }

    setWorkLogText('');
    onDirtyChange?.(false);
    onClose();
  }

  function printJobSheet() {
    if (!guardPendingWorkLogDocumentAction()) {
      return;
    }
    document.body.classList.remove('customer-report-printing');
    window.print();
  }

  function printCustomerReport() {
    if (!guardPendingWorkLogDocumentAction()) {
      return;
    }
    document.body.classList.add('customer-report-printing');
    window.print();
  }

  function openWorkOrderEmail() {
    if (!canWrite || !canSendEmail) {
      return;
    }
    if (!guardPendingWorkLogDocumentAction()) {
      return;
    }
    try {
      const scopedShopSettings = resolveScopedShopEmailSettings(draftJob, shopProfile);
      setDocumentEmailDraft({
        kind: 'work_order',
        jobId: draftJob.id,
        shopId: draftJob.shopId,
        ...buildWorkOrderEmailDraft(draftJob, {
          shopSettings: scopedShopSettings,
          lengthUnit: measurementOptions.lengthUnit,
          dateOptions,
          moneyOptions,
          totals,
          instrumentLabel: formatInstrumentLabel(draftJob)
        })
      });
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || SHOP_EMAIL_CONTEXT_ERROR });
    }
  }

  function openInvoiceEmail() {
    if (!canWrite || !canSendEmail) {
      return;
    }
    try {
      const scopedShopSettings = resolveScopedShopEmailSettings(draftJob, shopProfile);
      setDocumentEmailDraft({
        kind: 'invoice',
        jobId: draftJob.id,
        shopId: draftJob.shopId,
        ...buildInvoiceEmailDraft(draftJob, {
          shopSettings: scopedShopSettings,
          dateOptions,
          moneyOptions,
          totals,
          taxLabel: taxSettings.taxLabel || scopedShopSettings.taxLabel || 'Sales Tax',
          instrumentLabel: formatInstrumentLabel(draftJob)
        })
      });
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || SHOP_EMAIL_CONTEXT_ERROR });
    }
  }

  function formatMeasurementDelta(initialValue, finalValue, unit = measurementOptions.lengthUnit) {
    return formatMeasurementChange(initialValue, finalValue, unit);
  }

  async function finishJob() {
    if (!canWrite) {
      return;
    }
    const nextJob = {
      ...draftJob,
      status: 'Picked Up',
      pickedUpAt: new Date().toISOString()
    };

    setDraftJob(nextJob);
    setIsDirty(true);
    try {
      const savedJob = await saveDraftNow(nextJob);
      if (shouldOfferPvmhPickupEmail(savedJob || nextJob)) {
        setSubcontractorPickupJob(savedJob || nextJob);
      }
    } catch {
      // saveDraftNow already surfaces save errors through the app notice path.
    }
  }

  async function sendSubcontractorPickupEmail(message) {
    if (!subcontractorPickupJob) {
      return;
    }
    if (!canSendEmail) {
      window.alert(entitlementMessage || 'Email sending is unavailable for this shop plan or billing state.');
      return;
    }

    setIsSendingSubcontractorEmail(true);
    const result = await sendCustomerMessage(subcontractorPickupJob, {
      channel: 'email',
      templateKey: 'subcontractor_pickup_ready',
      to: message.to,
      subject: message.subject,
      body: message.body
    });

    if (!result.ok) {
      setIsSendingSubcontractorEmail(false);
      window.alert(result.error || 'PVMH email failed to send.');
      return;
    }

    setSubcontractorPickupJob(null);
    setIsSendingSubcontractorEmail(false);
    if (result.message) {
      setDraftJob((current) => ({
        ...current,
        messages: [
          result.message,
          ...(current.messages || []).filter((item) => item.id !== result.message.id)
        ]
      }));
    }
    if (onRefresh) {
      await onRefresh();
    }
  }

  function updateContactPreference(field, value) {
    patchJob(buildContactPreferencePatch(field, value));
  }

  function updateMessageTemplate(templateKey) {
    patchJob(buildMessageTemplatePatch(draftJob, templateKey));
  }

  async function handleSendCustomerMessage(message) {
    if (!canWrite) {
      return { ok: false, error: 'Your shop role is read-only.' };
    }
    if ((message.channel === 'email' || message.channel === 'both') && !canSendEmail) {
      return { ok: false, error: entitlementMessage || 'Email sending is unavailable for this shop plan or billing state.' };
    }
    if ((message.channel === 'sms' || message.channel === 'both') && !canSendSms) {
      return { ok: false, error: entitlementMessage || 'SMS sending is unavailable for this shop plan or billing state.' };
    }

    const result = await sendCustomerMessage(draftJob, message);
    if (result.message) {
      setDraftJob((current) => ({
        ...current,
        messages: [
          result.message,
          ...(current.messages || []).filter((item) => item.id !== result.message.id)
        ]
        }));
      }
    if (result.ok && onRefresh) {
      await onRefresh();
    }
    return result;
  }

  async function handleSendDocumentEmail({ type, recipient, subject, body, includeJobSheet, includeCustomerReport }) {
    if (!canWrite) {
      return { ok: false, error: 'Your shop role is read-only.' };
    }
    if (!canSendEmail) {
      return { ok: false, error: entitlementMessage || 'Email sending is unavailable for this shop plan or billing state.' };
    }
    if (hasPendingWorkLog) {
      return { ok: false, error: PENDING_WORK_LOG_MESSAGE };
    }

    let jobToSend = draftJob;
    if (isDirty) {
      try {
        jobToSend = (await saveDraftNow()) || draftJob;
      } catch (error) {
        return { ok: false, error: error?.message || 'Save the job before sending email.' };
      }
    }

    let documentContent;
    let scopedShopSettings;
    try {
      scopedShopSettings = resolveScopedShopEmailSettings(jobToSend, shopProfile);
      const jobWithCurrentTax = withResolvedJobTaxSettings(jobToSend, scopedShopSettings);
      const resolvedTaxSettings = jobWithCurrentTax.techDetails.tax;
      documentContent = buildSelectedDocumentEmailContent(jobWithCurrentTax, {
        shopSettings: scopedShopSettings,
        lengthUnit: measurementOptions.lengthUnit,
        dateOptions,
        moneyOptions,
        totals: calculateJobTotals(jobWithCurrentTax, resolvedTaxSettings),
        taxLabel: resolvedTaxSettings.taxLabel || scopedShopSettings.taxLabel || 'Sales Tax',
        instrumentLabel: formatInstrumentLabel(jobWithCurrentTax)
      }, {
        includeJobSheet,
        includeCustomerReport
      });
    } catch (error) {
      return { ok: false, error: error?.message || SHOP_EMAIL_CONTEXT_ERROR };
    }
    const emailBody = [body.trim(), documentContent.text].filter(Boolean).join('\n\n');

    const result = await sendCustomerMessage(jobToSend, {
      channel: 'email',
      customerId: jobToSend.customerId || null,
      templateKey: type === 'invoice' ? 'invoice_email' : 'work_order_email',
      to: recipient,
      subject,
      body: emailBody,
      html: documentContent.html ? buildDocumentEmailHtml(body.trim(), documentContent.html) : ''
    });

    if (result.message) {
      setDraftJob((current) => ({
        ...current,
        messages: [
          result.message,
          ...(current.messages || []).filter((item) => item.id !== result.message.id)
        ]
      }));
    }

    if (!result.ok) {
      return result;
    }

    onNotice?.({
      type: 'success',
      message: type === 'invoice' ? 'Invoice email sent.' : 'Work order email sent.'
    });

    logJobEventSafe({
      shopId: jobToSend.shopId,
      jobId: jobToSend.id,
      eventType: type === 'invoice' ? 'invoice_emailed' : 'work_order_emailed',
      eventLabel: type === 'invoice' ? 'Invoice emailed' : 'Work order emailed',
      eventNote: recipient,
      eventData: {
        recipient,
        subject,
        channel: 'email'
      }
    });

    refreshTimelineEvents().catch((error) => {
      console.warn('Document email timeline refresh failed.', error);
    });
    if (onRefresh) {
      Promise.resolve(onRefresh()).catch((error) => {
        console.warn('Document email job refresh failed.', error);
      });
    }

    return { ok: true };
  }

  async function refreshTimelineEvents() {
    const events = await getJobEvents(job.id);
    setTimelineEvents(events);
  }

  function handleAssignmentChanged(assignment) {
    setDraftJob((current) => ({
      ...current,
      assignedMemberId: assignment.assignedMemberId || '',
      assignedMemberDisplayName: assignment.assignedMemberDisplayName || '',
      assignmentUpdatedAt: assignment.assignmentUpdatedAt || null
    }));
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
      draftJob={draftJob}
      intakeTypes={intakeTypes}
      normalizeInstrumentType={normalizeInstrumentType}
      onContactPreferenceChange={updateContactPreference}
      onFieldChange={updateField}
      onInstrumentTypeChange={setInstrumentType}
      onStringCountChange={updateStringCount}
      onTechFieldChange={updateTechField}
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
      onTechFieldChange={updateTechField}
    />
  );

  const workSections = (
    <JobWorkSections
      canWrite={canWrite}
      draftJob={draftJob}
      hasPendingWorkLog={hasPendingWorkLog}
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
      documentEmailDraft={documentEmailDraft}
      draftJob={draftJob}
      entitlementSnapshot={entitlementSnapshot}
      imagesSection={imagesSection}
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
