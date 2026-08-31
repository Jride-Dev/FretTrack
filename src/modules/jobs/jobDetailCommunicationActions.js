import { calculateJobTotals } from '../billing/accounting.js';
import { withResolvedJobTaxSettings } from '../billing/jobTaxSettings.js';
import { sendCustomerMessage } from '../../data/messagesRepository.js';
import { shouldOfferPvmhPickupEmail } from './SubcontractorPickupEmailDialog.jsx';
import {
  SHOP_EMAIL_CONTEXT_ERROR,
  buildDocumentEmailHtml,
  buildInvoiceEmailDraft,
  buildSelectedDocumentEmailContent,
  buildWorkOrderEmailDraft,
  resolveScopedShopEmailSettings
} from './emailDocuments.js';
import {
  buildContactPreferencePatch,
  buildPickedUpJob,
  buildMergeJobMessageJob,
  buildMessageTemplatePatch
} from './jobDetailFormatting.js';
import { logJobEventSafe } from './jobEventsService.js';
import { PENDING_WORK_LOG_MESSAGE } from './workLogDraft.js';
import {
  CUSTOMER_REPORT_PRINT_MODE,
  beginPrintRequest,
  isCurrentPrintRequest
} from '../print/printRequestCoordinator.js';
import {
  waitForCustomerReportPrintReady,
  waitForJobSheetPrintReady
} from '../print/printDocumentReady.js';

export function createJobDetailCommunicationActions({
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
  documentBody,
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
}) {
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

  async function printJobSheet() {
    if (!guardPendingWorkLogDocumentAction()) {
      return;
    }
    const requestSequence = beginPrintRequest(printRequestSequenceRef, 'job-sheet', documentBody);
    await waitForJobSheetPrintReady();
    if (!isCurrentPrintRequest(printRequestSequenceRef, requestSequence, 'job-sheet', documentBody)) {
      return;
    }
    window.print();
  }

  async function printCustomerReport() {
    if (!guardPendingWorkLogDocumentAction()) {
      return;
    }
    const requestSequence = beginPrintRequest(printRequestSequenceRef, CUSTOMER_REPORT_PRINT_MODE, documentBody);
    await waitForCustomerReportPrintReady();
    if (!isCurrentPrintRequest(printRequestSequenceRef, requestSequence, CUSTOMER_REPORT_PRINT_MODE, documentBody)) {
      return;
    }
    window.print();
  }

  function resolveDocumentEmailContext(jobToUse) {
    const scopedShopSettings = resolveScopedShopEmailSettings(jobToUse, shopProfile);
    const jobWithCurrentTax = withResolvedJobTaxSettings(jobToUse, scopedShopSettings);
    const resolvedTaxSettings = jobWithCurrentTax.techDetails.tax;
    const jobTotals = calculateJobTotals(jobWithCurrentTax, resolvedTaxSettings);

    return {
      scopedShopSettings,
      jobWithCurrentTax,
      resolvedTaxSettings,
      totals: jobTotals,
      taxLabel: resolvedTaxSettings.taxLabel || scopedShopSettings.taxLabel || 'Sales Tax',
      instrumentLabel: formatInstrumentLabel(jobWithCurrentTax),
      measurementUnit: measurementOptions.lengthUnit,
      dateOptions,
      moneyOptions
    };
  }

  function openWorkOrderEmail() {
    if (!canWrite || !canSendEmail) {
      return;
    }
    if (!guardPendingWorkLogDocumentAction()) {
      return;
    }
    try {
      const documentContext = resolveDocumentEmailContext(draftJob);
      setDocumentEmailDraft({
        kind: 'work_order',
        jobId: draftJob.id,
        shopId: draftJob.shopId,
        ...buildWorkOrderEmailDraft(draftJob, {
          shopSettings: documentContext.scopedShopSettings,
          lengthUnit: documentContext.measurementUnit,
          dateOptions: documentContext.dateOptions,
          moneyOptions: documentContext.moneyOptions,
          totals: documentContext.totals,
          instrumentLabel: documentContext.instrumentLabel
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
      const documentContext = resolveDocumentEmailContext(draftJob);
      setDocumentEmailDraft({
        kind: 'invoice',
        jobId: draftJob.id,
        shopId: draftJob.shopId,
        ...buildInvoiceEmailDraft(draftJob, {
          shopSettings: documentContext.scopedShopSettings,
          dateOptions: documentContext.dateOptions,
          moneyOptions: documentContext.moneyOptions,
          totals: documentContext.totals,
          taxLabel: documentContext.taxLabel,
          instrumentLabel: documentContext.instrumentLabel
        })
      });
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || SHOP_EMAIL_CONTEXT_ERROR });
    }
  }

  function updateContactPreference(field, value) {
    patchJob(buildContactPreferencePatch(field, value));
  }

  function updateMessageTemplate(templateKey) {
    patchJob(buildMessageTemplatePatch(draftJob, templateKey));
  }

  async function finishJob() {
    if (!canWrite) {
      return;
    }
    const nextJob = buildPickedUpJob(draftJob, new Date().toISOString());

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
      setDraftJob((current) => buildMergeJobMessageJob(current, result.message));
    }
    if (onRefresh) {
      await onRefresh();
    }
  }

  async function handleSendCustomerMessage(message) {
    if (!canWrite) {
      return { ok: false, error: 'Your shop role is read-only.' };
    }
    if ((message.channel === 'email' || message.channel === 'both') && !canSendEmail) {
      return { ok: false, error: entitlementMessage || 'Email sending is unavailable for this shop plan or billing state.' };
    }
    if (message.scheduledAt && !canScheduleEmail) {
      return { ok: false, error: 'Scheduled Email is available on Pro.' };
    }
    if ((message.channel === 'sms' || message.channel === 'both') && !canSendSms) {
      return { ok: false, error: entitlementMessage || 'SMS sending is unavailable for this shop plan or billing state.' };
    }

    const result = await sendCustomerMessage(draftJob, message);
    if (result.message) {
      setDraftJob((current) => buildMergeJobMessageJob(current, result.message));
    }
    if (result.ok && onRefresh) {
      try {
        await onRefresh();
      } catch (refreshError) {
        console.warn('Customer message was accepted, but the work-order refresh failed.', refreshError);
        return {
          ...result,
          refreshWarning: 'Message sent and logged. Refresh the work order to reconcile message history.'
        };
      }
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
    let documentContext;
    try {
      documentContext = resolveDocumentEmailContext(jobToSend);
      documentContent = buildSelectedDocumentEmailContent(documentContext.jobWithCurrentTax, {
        shopSettings: documentContext.scopedShopSettings,
        lengthUnit: documentContext.measurementUnit,
        dateOptions: documentContext.dateOptions,
        moneyOptions: documentContext.moneyOptions,
        totals: documentContext.totals,
        taxLabel: documentContext.taxLabel,
        instrumentLabel: documentContext.instrumentLabel
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
      setDraftJob((current) => buildMergeJobMessageJob(current, result.message));
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

    if (refreshTimelineEvents) {
      refreshTimelineEvents().catch((error) => {
        console.warn('Document email timeline refresh failed.', error);
      });
    }
    if (onRefresh) {
      Promise.resolve(onRefresh()).catch((error) => {
        console.warn('Document email job refresh failed.', error);
      });
    }

    return { ok: true };
  }

  return {
    closeDetail,
    finishJob,
    guardPendingWorkLogDocumentAction,
    handleSendCustomerMessage,
    handleSendDocumentEmail,
    openInvoiceEmail,
    openWorkOrderEmail,
    printCustomerReport,
    printJobSheet,
    sendSubcontractorPickupEmail,
    updateContactPreference,
    updateMessageTemplate
  };
}
