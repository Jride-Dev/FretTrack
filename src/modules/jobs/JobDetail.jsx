import { useEffect, useMemo, useRef, useState } from 'react';
import PartsList from '../../components/PartsList';
import ServicesList from '../../components/ServicesList';
import DamageMapSection from './DamageMapSection';
import ImagesSection from '../images/ImagesSection';
import JobInfoSection from './JobInfoSection';
import JobPrintSheet from './JobPrintSheet';
import JobStatusSelect from './JobStatusSelect';
import PrintActions from './PrintActions';
import SubcontractorPickupEmailDialog, { shouldOfferPvmhPickupEmail } from './SubcontractorPickupEmailDialog.jsx';
import JobDocumentEmailDialog from './JobDocumentEmailDialog.jsx';
import JobDetailTabs from './components/JobDetailTabs.jsx';
import TechDetailsSection from './TechDetailsSection';
import TotalsSection from './TotalsSection';
import WorkLogSection from './WorkLogSection';
import CustomerDamageReport from './CustomerDamageReport';
import ActivityTimeline from './ActivityTimeline.jsx';
import { calculateJobTotals } from '../billing/accounting';
import MessagesPanel from '../messaging/MessagesPanel';
import { toIsoDateInputValue } from '../../shared/utils/dateFormat';
import { formatLength } from '../../shared/utils/measurements';
import { getShopDateOptions, getShopMeasurementOptions, getShopMoneyOptions, getShopSettings } from '../shops/shopConfig';
import { combineCustomerName } from '../customers';
import {
  formatInstrumentLabel,
  getInstrumentStringCount,
  getOuterStringLabels,
  normalizeInstrumentType,
  normalizeStringCount,
  resizeStringGauges,
  stringCountForInstrument
} from '../instruments/instrumentService';
import { generateJobNumber } from './jobNumber';
import { getJobEvents } from './jobEventsService';
import { getSmsMode, sendCustomerMessage } from '../../data/messagesRepository';
import { buildInvoiceEmailDraft, buildWorkOrderEmailDraft } from './emailDocuments';

const intakeTypes = ['Walk-In', 'Telephone Appt.', 'Referral', 'Sub-Contract'];

function markerColorForReport(severity) {
  if (severity === 'Critical') return '#b3261e';
  if (severity === 'Structural') return '#a15c00';
  return '#255f85';
}

function buildMeasurementDisplay(job, lengthUnit) {
  const neckInspection = job.techDetails?.neckInspection || {};
  return {
    lengthUnit,
    initial: formatMeasurementStageForExport(neckInspection.initial, lengthUnit),
    final: formatMeasurementStageForExport(neckInspection.final, lengthUnit)
  };
}

function formatMeasurementStageForExport(stage = {}, fallbackUnit = 'in') {
  const unit = stage.lengthUnit || stage.reliefUnit || fallbackUnit;
  return {
    relief: formatLength(stage.relief, stage.reliefUnit || unit),
    nutHighE: formatLength(stage.nutHighE, stage.nutHighEUnit || unit),
    nutLowE: formatLength(stage.nutLowE, stage.nutLowEUnit || unit),
    actionHighE12th: formatLength(stage.actionHighE12th, stage.actionHighE12thUnit || unit),
    actionLowE12th: formatLength(stage.actionLowE12th, stage.actionLowE12thUnit || unit)
  };
}

export default function JobDetail({
  job,
  jobs = [],
  onUpdate,
  onImageUpload,
  onImageDelete,
  onRefresh,
  onClose,
  canWrite = true,
  canSendEmail = true,
  canSendSms = true,
  entitlementMessage = ''
}) {
  const [draftJob, setDraftJob] = useState(job);
  const [isDirty, setIsDirty] = useState(false);
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
  const imageImportInputRef = useRef(null);
  const paymentAutosaveTimeoutRef = useRef(null);

  useEffect(() => {
    setDraftJob(job);
    setTimelineEvents(job.events || []);
    setIsDirty(false);
  }, [job]);

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
  const taxSettings = draftJob.techDetails.tax || {};
  const payments = draftJob.techDetails.payments || [];
  const instrumentStringCount = getInstrumentStringCount(draftJob);
  const outerStringLabels = getOuterStringLabels(draftJob.instrumentType, instrumentStringCount);
  const measurementOptions = getShopMeasurementOptions({
    measurementSystem: draftJob.techDetails.measurementSystem,
    lengthUnit: draftJob.techDetails.lengthUnit,
    currencyCode: taxSettings.currencyCode,
    locale: taxSettings.locale
  });

  const totals = useMemo(() => calculateJobTotals(draftJob), [draftJob]);
  const shopSettings = getShopSettings();
  const dateOptions = getShopDateOptions({
    dateFormat: taxSettings.dateFormat || shopSettings.dateFormat,
    locale: taxSettings.locale || shopSettings.locale
  });
  const moneyOptions = getShopMoneyOptions({
    currencyCode: taxSettings.currencyCode || shopSettings.currencyCode,
    locale: taxSettings.locale || shopSettings.locale
  });

  function patchJob(patch, saveImmediately = false) {
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
    if (name === 'customerFirstName' || name === 'customerLastName') {
      patchJob({
        [name]: value,
        customerName: combineCustomerName(
          name === 'customerFirstName' ? value : draftJob.customerFirstName,
          name === 'customerLastName' ? value : draftJob.customerLastName
        )
      });
      return;
    }
    if (name === 'dateReceived') {
      patchJob({ dateReceived: value, jobNumber: generateJobNumber(value, jobs, draftJob.id, draftJob.shopId) });
      return;
    }
    if (name === 'instrumentType') {
      const normalizedInstrumentType = normalizeInstrumentType(value);
      const stringCount = stringCountForInstrument(normalizedInstrumentType);
      patchJob({
        instrumentType: normalizedInstrumentType,
        techDetails: {
          ...draftJob.techDetails,
          instrumentType: normalizedInstrumentType,
          stringCount,
          stringGauges: resizeStringGauges(draftJob.techDetails.stringGauges, stringCount)
        }
      });
      return;
    }
    patchJob({ [name]: value });
  }

  function updateDiscountField(event) {
    const { name, value } = event.target;
    patchJob({
      [name]: value,
      techDetails: {
        ...draftJob.techDetails,
        [name]: value
      }
    });
  }

  function updateTaxField(event) {
    const { name, value, checked, type } = event.target;
    patchJob({
      techDetails: {
        ...draftJob.techDetails,
        tax: {
          ...(draftJob.techDetails.tax || {}),
          [name]: type === 'checkbox' ? checked : value
        }
      }
    });
  }

  function setInstrumentType(instrumentType) {
    const normalizedInstrumentType = normalizeInstrumentType(instrumentType);
    const stringCount = stringCountForInstrument(normalizedInstrumentType);
    patchJob({
      instrumentType: normalizedInstrumentType,
      techDetails: {
        ...draftJob.techDetails,
        instrumentType: normalizedInstrumentType,
        stringCount,
        stringGauges: resizeStringGauges(draftJob.techDetails.stringGauges, stringCount)
      }
    });
  }

  function updateStringCount(value) {
    const stringCount = value === 'custom'
      ? normalizeStringCount(draftJob.techDetails.stringCount || draftJob.techDetails.stringGauges?.length, draftJob.instrumentType)
      : normalizeStringCount(value, draftJob.instrumentType);
    patchJob({
      stringCount,
      techDetails: {
        ...draftJob.techDetails,
        stringCount,
        stringGauges: resizeStringGauges(draftJob.techDetails.stringGauges, stringCount)
      }
    });
  }

  function updateTechField(event) {
    const { name, value } = event.target;
    setIsDirty(true);
    setDraftJob((current) => ({
      ...current,
      techDetails: {
        ...current.techDetails,
        [name]: value
      }
    }));
  }

  function updateWorkLogEntry(entryId, text) {
    patchJob({
      workLog: draftJob.workLog.map((entry) => (
        entry.id === entryId ? { ...entry, text, entry: text } : entry
      ))
    });
  }

  async function saveWorkLogChanges() {
    await saveDraftNow().catch(() => {});
  }

  async function removeWorkLogEntry(entryId) {
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
    try {
      const savedJob = await onUpdate(jobToSave);
      setDraftJob(savedJob || jobToSave);
      setIsDirty(false);
      refreshTimelineEvents();
      return savedJob;
    } catch (error) {
      throw error;
    }
  }

  function updateNeckInspection(stage, fieldOrPatch, value) {
    const fieldPatch = typeof fieldOrPatch === 'object'
      ? fieldOrPatch
      : { [fieldOrPatch]: value };

    setDraftJob((current) => ({
      ...current,
      techDetails: {
        ...current.techDetails,
        neckInspection: {
          ...(current.techDetails.neckInspection || {}),
          [stage]: {
            ...(current.techDetails.neckInspection?.[stage] || {}),
            ...fieldPatch
          }
        }
      }
    }));
    setIsDirty(true);
  }

  async function savePaymentChange(nextJob, { immediate = false } = {}) {
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
    if (!Number(payment.amount)) {
      return;
    }

    const nextJob = {
      ...draftJob,
      techDetails: {
        ...draftJob.techDetails,
        payments: [
          ...(draftJob.techDetails.payments || []),
          {
            id: crypto.randomUUID(),
            ...payment
          }
        ]
      }
    };

    savePaymentChange(nextJob, { immediate: true });
    setPayment({ amount: '', method: 'Cash', note: '', date: toIsoDateInputValue() });
  }

  function updatePayment(paymentId, field, value) {
    const nextJob = {
      ...draftJob,
      techDetails: {
        ...draftJob.techDetails,
        payments: (draftJob.techDetails.payments || []).map((row) => (
          row.id === paymentId ? { ...row, [field]: value } : row
        ))
      }
    };

    savePaymentChange(nextJob);
  }

  function removePayment(paymentId) {
    const nextJob = {
      ...draftJob,
      techDetails: {
        ...draftJob.techDetails,
        payments: (draftJob.techDetails.payments || []).filter((row) => row.id !== paymentId)
      }
    };

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
    setIsDirty(true);
    setDraftJob((current) => {
      const stringGauges = [...current.techDetails.stringGauges];
      stringGauges[index] = value;
      return {
        ...current,
        techDetails: {
          ...current.techDetails,
          stringGauges
        }
      };
    });
  }

  function handleSaveRequest(event) {
    saveDraftNow()
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
    const text = workLogText.trim();
    if (!text) {
      return;
    }
    const nextJob = {
      ...draftJob,
      workLog: [
        ...draftJob.workLog,
        {
          id: crypto.randomUUID(),
          jobId: draftJob.id,
          text,
          entry: text,
          createdAt: new Date().toISOString(),
          timestamp: new Date().toISOString()
        }
      ]
    };

    setDraftJob(nextJob);
    setIsDirty(true);
    setWorkLogText('');
    await saveDraftNow(nextJob).catch(() => {});
  }

  function addPart(event) {
    event.preventDefault();
    if (!part.name.trim()) {
      return;
    }
    const nextJob = {
      parts: [...parts, { id: crypto.randomUUID(), jobId: draftJob.id, name: part.name, quantity: part.quantity || '1', cost: part.cost, retail: part.retail }]
    };
    patchJob(nextJob);
    setPart({ name: '', quantity: '1', cost: '', retail: '' });
  }

  function updatePart(partId, field, value) {
    const nextParts = parts.map((row) => (row.id === partId ? { ...row, [field]: value } : row));
    patchJob({
      parts: nextParts,
      techDetails: {
        ...draftJob.techDetails,
        includedPartIds: nextParts.filter((row) => row.includedInService).map((row) => row.id)
      }
    });
  }

  function removePart(partId) {
    const nextParts = parts.filter((row) => row.id !== partId);
    patchJob({
      parts: nextParts,
      techDetails: {
        ...draftJob.techDetails,
        includedPartIds: nextParts.filter((row) => row.includedInService).map((row) => row.id)
      }
    });
  }

  function addService(event) {
    event.preventDefault();
    if (!service.description.trim()) {
      return;
    }
    patchJob({
      services: [...services, { id: crypto.randomUUID(), jobId: draftJob.id, description: service.description, quantity: service.quantity || '1', cost: service.cost, retail: service.retail }]
    });
    setService({ description: '', quantity: '1', cost: '', retail: '' });
  }

  function updateService(serviceId, field, value) {
    patchJob({
      services: services.map((row) => (row.id === serviceId ? { ...row, [field]: value } : row))
    });
  }

  function removeService(serviceId) {
    patchJob({
      services: services.filter((row) => row.id !== serviceId)
    });
  }

  async function handleImageChange(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

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
    const category = uploadOptions.category || `damage-map-${viewName}`;
    const existingImageIds = new Set((draftJob.images || []).map((image) => image.id));
    const result = await onImageUpload(draftJob, [file], { category, skipRefresh: true });
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

  function updateWorkOrderImage(imageId, checked) {
    const nextImageIds = checked
      ? [...new Set([...workOrderImageIds, imageId])]
      : workOrderImageIds.filter((id) => id !== imageId);

    patchJob({
      techDetails: {
        ...draftJob.techDetails,
        workOrderImageIds: nextImageIds
      }
    });
  }

  function closeDetail() {
    onClose();
  }

  function printJobSheet() {
    document.body.classList.remove('customer-report-printing');
    window.print();
  }

  function printCustomerReport() {
    document.body.classList.add('customer-report-printing');
    window.print();
  }

  function openWorkOrderEmail() {
    setDocumentEmailDraft({
      kind: 'work_order',
      ...buildWorkOrderEmailDraft(draftJob, {
        shopSettings,
        dateOptions,
        moneyOptions,
        totals,
        instrumentLabel: formatInstrumentLabel(draftJob)
      })
    });
  }

  function openInvoiceEmail() {
    setDocumentEmailDraft({
      kind: 'invoice',
      ...buildInvoiceEmailDraft(draftJob, {
        shopSettings,
        dateOptions,
        moneyOptions,
        totals,
        taxLabel: taxSettings.taxLabel || shopSettings.taxLabel || 'Sales Tax',
        instrumentLabel: formatInstrumentLabel(draftJob)
      })
    });
  }

  function formatMeasurementDelta(initialValue, finalValue, unit = measurementOptions.lengthUnit) {
    if (!initialValue && !finalValue) {
      return '';
    }
    const initialNumber = Number(initialValue);
    const finalNumber = Number(finalValue);
    if (initialValue !== '' && finalValue !== '' && Number.isFinite(initialNumber) && Number.isFinite(finalNumber)) {
      const delta = finalNumber - initialNumber;
      const sign = delta > 0 ? '+' : '';
      return `${formatLength(initialValue, unit)} -> ${formatLength(finalValue, unit)} (${sign}${formatLength(delta.toFixed(3), unit)})`;
    }
    return `${initialValue ? formatLength(initialValue, unit) : '-'} -> ${finalValue ? formatLength(finalValue, unit) : '-'}`;
  }

  async function finishJob() {
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

  function reportDamageView(viewName) {
    const damageMap = draftJob.techDetails.damageMap || {};
    const view = damageMap.views?.[viewName] || { marks: [] };
    const imageUrl = view.imageUrl || '';
    const marks = view.marks || [];
    const title = viewName === 'front' ? 'Front Damage Map' : 'Back Damage Map';

    if (!imageUrl && marks.length === 0) {
      return null;
    }

    return (
      <div className="report-damage-view">
        <h3>{title}</h3>
        {imageUrl ? (
          <div className="report-damage-canvas">
            <img src={imageUrl} alt={`${viewName} damage map`} />
            {marks.map((mark, index) => (
              <span
                key={mark.id}
                className="damage-marker"
                style={{ left: `${mark.x}%`, top: `${mark.y}%`, backgroundColor: markerColorForReport(mark.severity) }}
              >
                {index + 1}
              </span>
            ))}
          </div>
        ) : (
          <p className="report-damage-missing">No {title.toLowerCase()} image was available for this report.</p>
        )}
        {marks.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Area</th>
                <th>Severity</th>
                <th>Note</th>
                <th>Recommended Repair</th>
              </tr>
            </thead>
            <tbody>
              {marks.map((mark, index) => (
                <tr key={mark.id}>
                  <td>{index + 1}</td>
                  <td>{mark.area}</td>
                  <td>{mark.severity}</td>
                  <td>{mark.note}</td>
                  <td>{mark.recommendedRepair}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  function updateContactPreference(field, value) {
    patchJob({ [field]: value });
  }

  function updateMessageTemplate(templateKey) {
    patchJob({
      techDetails: {
        ...draftJob.techDetails,
        lastMessageTemplate: templateKey
      }
    });
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

  async function handleSendDocumentEmail({ type, recipient, subject, body }) {
    if (!canWrite) {
      return { ok: false, error: 'Your shop role is read-only.' };
    }
    if (!canSendEmail) {
      return { ok: false, error: entitlementMessage || 'Email sending is unavailable for this shop plan or billing state.' };
    }

    let jobToSend = draftJob;
    if (isDirty) {
      try {
        jobToSend = (await saveDraftNow()) || draftJob;
      } catch (error) {
        return { ok: false, error: error?.message || 'Save the job before sending email.' };
      }
    }

    const result = await sendCustomerMessage(jobToSend, {
      channel: 'email',
      customerId: jobToSend.customerId || null,
      templateKey: type === 'invoice' ? 'invoice_email' : 'work_order_email',
      to: recipient,
      subject,
      body
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

  const printActions = (
    <PrintActions
      closeDetail={closeDetail}
      emailWorkOrder={openWorkOrderEmail}
      exportJobJson={exportJobJson}
      finishJob={finishJob}
      printCustomerReport={printCustomerReport}
      printJobSheet={printJobSheet}
    />
  );

  const printSections = (
    <>
      <JobPrintSheet
        draftJob={draftJob}
        formatInstrumentLabel={formatInstrumentLabel}
        normalizeInstrumentType={normalizeInstrumentType}
        outerStringLabels={outerStringLabels}
        parts={parts}
        services={services}
        totals={totals}
      />
      <CustomerDamageReport
        draftJob={draftJob}
        formatInstrumentLabel={formatInstrumentLabel}
        formatMeasurementDelta={formatMeasurementDelta}
        lengthUnit={measurementOptions.lengthUnit}
        outerStringLabels={outerStringLabels}
        normalizeInstrumentType={normalizeInstrumentType}
        reportDamageView={reportDamageView}
        services={services}
        workOrderImages={workOrderImages}
      />
    </>
  );

  const intakeSection = (
    <JobInfoSection
      draftJob={draftJob}
      intakeTypes={intakeTypes}
      normalizeInstrumentType={normalizeInstrumentType}
      setInstrumentType={setInstrumentType}
      updateStringCount={updateStringCount}
      updateContactPreference={updateContactPreference}
      updateField={updateField}
      updateTechField={updateTechField}
    />
  );

  const inspectionSections = (
    <>
      <TechDetailsSection
        draftJob={draftJob}
        formatMeasurementDelta={formatMeasurementDelta}
        lengthUnit={measurementOptions.lengthUnit}
        outerStringLabels={outerStringLabels}
        updateNeckInspection={updateNeckInspection}
        updateStringGauge={updateStringGauge}
        updateTechField={updateTechField}
      />
      <DamageMapSection
        instrumentType={normalizeInstrumentType(draftJob.instrumentType)}
        damageMap={draftJob.techDetails.damageMap}
        onChange={updateDamageMap}
        onViewImageUpload={handleDamageViewImageUpload}
      />
    </>
  );

  const workSections = (
    <>
      <WorkLogSection
        appendWorkLog={appendWorkLog}
        draftJob={draftJob}
        removeWorkLogEntry={removeWorkLogEntry}
        saveWorkLogChanges={saveWorkLogChanges}
        setWorkLogText={setWorkLogText}
        updateWorkLogEntry={updateWorkLogEntry}
        workLogText={workLogText}
      />
      <ServicesList canWrite={canWrite} services={services} service={service} setService={setService} onAddService={addService} onUpdateService={updateService} onRemoveService={removeService} />
    </>
  );

  const billingSections = (
    <>
      <PartsList canWrite={canWrite} parts={parts} part={part} setPart={setPart} onAddPart={addPart} onUpdatePart={updatePart} onRemovePart={removePart} />
      <ServicesList canWrite={canWrite} services={services} service={service} setService={setService} onAddService={addService} onUpdateService={updateService} onRemoveService={removeService} />
      <TotalsSection
        addPayment={addPayment}
        draftJob={draftJob}
        emailInvoice={openInvoiceEmail}
        payment={payment}
        payments={payments}
        removePayment={removePayment}
        setPayment={setPayment}
        taxSettings={taxSettings}
        totals={totals}
        updateDiscountField={updateDiscountField}
        updatePayment={updatePayment}
        updateTaxField={updateTaxField}
      />
    </>
  );

  const imagesSection = (
    <ImagesSection
      handleImageChange={handleImageChange}
      handleImageDelete={handleImageDelete}
      imageImportErrors={imageImportErrors}
      imageOptimizationNotices={imageOptimizationNotices}
      imageImportInputRef={imageImportInputRef}
      images={images}
      isImportingImages={isImportingImages}
      updateWorkOrderImage={updateWorkOrderImage}
      workOrderImageIds={workOrderImageIds}
    />
  );

  const messagesPanel = (
    <MessagesPanel
      canSendEmailByPlan={canSendEmail}
      canSendSmsByPlan={canSendSms}
      entitlementMessage={entitlementMessage}
      job={draftJob}
      onPreferenceChange={updateContactPreference}
      onTemplateChange={updateMessageTemplate}
      onSendMessage={handleSendCustomerMessage}
      onGetSmsMode={getSmsMode}
    />
  );

  const activityTimeline = <ActivityTimeline events={timelineEvents} />;

  return (
    <section className="panel detail job-detail">
      <JobDocumentEmailDialog
        isOpen={Boolean(documentEmailDraft)}
        draft={documentEmailDraft}
        kind={documentEmailDraft?.kind || 'work_order'}
        onClose={() => setDocumentEmailDraft(null)}
        onSend={handleSendDocumentEmail}
      />
      <SubcontractorPickupEmailDialog
        job={subcontractorPickupJob}
        isSending={isSendingSubcontractorEmail}
        onCancel={() => setSubcontractorPickupJob(null)}
        onSend={sendSubcontractorPickupEmail}
      />
      <div className="detail-header">
        <div>
          <h2>{draftJob.customerName}</h2>
          <p>
            {draftJob.guitarBrand} {draftJob.model} {draftJob.jobNumber ? `- Job ${draftJob.jobNumber}` : ''}
          </p>
        </div>
        <JobStatusSelect value={draftJob.status} onChange={updateField} />
      </div>

      {isDirty && <p className="dirty-state no-print">Unsaved changes</p>}
      <JobDetailTabs
        activityTimeline={activityTimeline}
        billingSections={billingSections}
        draftJob={draftJob}
        imagesSection={imagesSection}
        intakeSection={intakeSection}
        inspectionSections={inspectionSections}
        isDirty={isDirty}
        messagesPanel={messagesPanel}
        printActions={printActions}
        printSections={printSections}
        updateField={updateField}
        workSections={workSections}
      />
    </section>
  );
}
