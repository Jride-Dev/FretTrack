import { useRef, useState } from 'react';
import { toIsoDateInputValue } from '../../shared/utils/dateFormat.js';
import { createPublicEstimateLink, recordJobPayment, setJobEstimateState, setJobInvoiceFinalization } from './jobService.js';
import {
  buildAddPaymentJob,
  buildAddServicePatch,
  buildRemoveServicePatch,
  buildUpdateServicePatch
} from './jobDetailFormatting.js';

const EMPTY_SERVICE = { description: '', quantity: '1', cost: '', retail: '' };

function createEmptyPayment() {
  return { amount: '', type: 'payment', method: 'Cash', note: '', date: toIsoDateInputValue() };
}

export default function useJobDetailBillingActions({
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
  setIsDirty,
  taxSettings
}) {
  const [service, setService] = useState(EMPTY_SERVICE);
  const [payment, setPayment] = useState(createEmptyPayment);
  const [finalizationReason, setFinalizationReason] = useState('');
  const [estimateNote, setEstimateNote] = useState('');
  const [isChangingEstimateState, setIsChangingEstimateState] = useState(false);
  const [isChangingInvoiceState, setIsChangingInvoiceState] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [isCreatingPublicEstimateLink, setIsCreatingPublicEstimateLink] = useState(false);
  const [publicEstimateLink, setPublicEstimateLink] = useState('');
  const estimateOperationRef = useRef(new Map());

  function reportCommerceError(error, fallbackMessage) {
    onNotice?.({ type: 'error', message: error?.message || fallbackMessage });
  }

  async function addPayment(event) {
    event.preventDefault();
    if (!canRecordJobPayments || isRecordingPayment || !Number(payment.amount)) {
      return;
    }
    const paymentType = String(payment.type || 'payment').toLowerCase();
    if (paymentType !== 'payment' && !canIssuePaymentAdjustments) {
      reportCommerceError(null, 'Only a shop owner or admin can record refunds or payment voids.');
      return;
    }
    if (paymentType !== 'payment') {
      const target = getPaymentTarget(draftJob.techDetails?.payments || [], payment.appliesToPaymentId);
      if (!target) {
        reportCommerceError(null, 'Select the original payment before recording an adjustment.');
        return;
      }
      const amountMinor = Math.round(Number(payment.amount || 0) * 100);
      if (amountMinor > target.remainingMinor) {
        reportCommerceError(null, `The adjustment cannot exceed the remaining refundable balance of ${(target.remainingMinor / 100).toFixed(2)}.`);
        return;
      }
      if (paymentType === 'void' && amountMinor !== target.remainingMinor) {
        reportCommerceError(null, 'A payment void must close the full remaining payment balance.');
        return;
      }
      if (String(payment.note || '').trim().length < 3) {
        reportCommerceError(null, 'Enter a reason for the refund or payment void.');
        return;
      }
    }
    if (isDirty) {
      reportCommerceError(null, 'Save the work order changes before recording a payment or adjustment.');
      return;
    }

    setIsRecordingPayment(true);
    const paymentToRecord = { ...payment, id: crypto.randomUUID() };
    try {
      const result = await recordJobPayment(draftJob.id, paymentToRecord, draftJob.updatedAt);
      if (!result) {
        const localJob = buildAddPaymentJob(draftJob, paymentToRecord, paymentToRecord.id);
        await saveDraftNow(localJob);
      } else {
        setDraftJob((current) => ({
          ...current,
          updatedAt: result.updatedAt || current.updatedAt,
          techDetails: {
            ...(current.techDetails || {}),
            payments: [
              ...(current.techDetails?.payments || []).filter((row) => row.id !== result.payment.id),
              result.payment
            ]
          }
        }));
        setIsDirty(false);
      }
      setPayment(createEmptyPayment());
      onNotice?.({ type: 'success', message: paymentToRecord.type === 'payment' ? 'Payment recorded.' : `${paymentToRecord.type === 'void' ? 'Payment void' : 'Refund'} recorded.` });
      try {
        await onRefresh?.();
      } catch (refreshError) {
        console.warn('Payment was recorded, but the work-order refresh failed.', refreshError);
        onNotice?.({ type: 'warning', message: 'Payment recorded. Refresh the work order to reconcile the latest balance.' });
      }
    } catch (error) {
      reportCommerceError(error, 'The payment could not be recorded.');
    } finally {
      setIsRecordingPayment(false);
    }
  }

  async function changeInvoiceFinalization(finalized) {
    if (!canFinalizeJobInvoices || isChangingInvoiceState) {
      return;
    }
    const reason = finalizationReason.trim();
    if (reason.length < 8) {
      reportCommerceError(null, 'Enter an audit reason of at least 8 characters.');
      return;
    }

    setIsChangingInvoiceState(true);
    try {
      const savedJob = finalized ? await saveDraftNow(withTaxSnapshot(draftJob, taxSettings)) : draftJob;
      const result = await setJobInvoiceFinalization(savedJob.id, finalized, reason);
      setDraftJob((current) => ({ ...current, ...result }));
      setIsDirty(false);
      setPublicEstimateLink('');
      setFinalizationReason('');
      await onRefresh?.();
      onNotice?.({ type: 'success', message: finalized ? 'Invoice finalized and totals locked.' : 'Invoice reopened for charge changes.' });
    } catch (error) {
      reportCommerceError(error, 'The invoice state could not be changed.');
    } finally {
      setIsChangingInvoiceState(false);
    }
  }

  async function createEstimateLink() {
    if (!canFinalizeJobInvoices || isCreatingPublicEstimateLink) {
      return;
    }
    if (!['sent', 'approved'].includes(draftJob.estimateStatus || 'draft')) {
      reportCommerceError(null, 'Mark the estimate sent before creating a customer link.');
      return;
    }
    if (isDirty) {
      reportCommerceError(null, 'Save the work order changes before creating a customer estimate link.');
      return;
    }

    setIsCreatingPublicEstimateLink(true);
    try {
      const result = await createPublicEstimateLink(draftJob.id, draftJob.estimateRevision);
      setPublicEstimateLink(result.url);
      try {
        await navigator.clipboard?.writeText(result.url);
        onNotice?.({ type: 'success', message: 'Customer estimate link copied.' });
      } catch {
        onNotice?.({ type: 'success', message: 'Customer estimate link created. Copy it from the estimate controls.' });
      }
    } catch (error) {
      reportCommerceError(error, 'The customer estimate link could not be created.');
    } finally {
      setIsCreatingPublicEstimateLink(false);
    }
  }

  async function changeEstimateState(status, noteOverride = null) {
    if (!canWrite || !canManageJobCharges || isChangingEstimateState) {
      return;
    }
    const note = noteOverride === null ? estimateNote.trim() : String(noteOverride).trim();
    const estimateNoteForSave = note || 'Estimate prepared for customer review.';
    if (isDirty && status !== 'sent') {
      reportCommerceError(null, 'Save the work order changes before changing estimate state.');
      return;
    }

    setIsChangingEstimateState(true);
    const operationKey = JSON.stringify([draftJob.id, status, estimateNoteForSave]);
    const requestId = estimateOperationRef.current.get(operationKey) || crypto.randomUUID();
    estimateOperationRef.current.set(operationKey, requestId);
    try {
      const savedJob = status === 'sent' ? await saveDraftNow(withTaxSnapshot(draftJob, taxSettings)) : draftJob;
      const result = await setJobEstimateState(savedJob.id, status, estimateNoteForSave, requestId, savedJob.updatedAt);
      setDraftJob((current) => ({ ...current, ...result }));
      setIsDirty(false);
      setEstimateNote('');
      setPublicEstimateLink('');
      estimateOperationRef.current.delete(operationKey);
      onNotice?.({ type: 'success', message: getEstimateSuccessMessage(status) });
      try {
        await onRefresh?.();
      } catch (refreshError) {
        console.warn('Estimate state changed, but the work-order refresh failed.', refreshError);
        onNotice?.({ type: 'warning', message: `${getEstimateSuccessMessage(status)} Refresh the work order to reconcile its history.` });
      }
      return result;
    } catch (error) {
      reportCommerceError(error, 'The estimate state could not be changed.');
    } finally {
      setIsChangingEstimateState(false);
    }
  }

  function addService(event) {
    event.preventDefault();
    if (!canWrite || !canManageJobCharges || chargesAreLocked(draftJob) || !service.description.trim()) {
      return;
    }
    patchJob(buildAddServicePatch(draftJob, services, service, crypto.randomUUID()));
    setService(EMPTY_SERVICE);
  }

  function updateService(serviceId, field, value) {
    if (canWrite && canManageJobCharges && !chargesAreLocked(draftJob)) {
      patchJob(buildUpdateServicePatch(services, serviceId, field, value));
    }
  }

  function removeService(serviceId) {
    if (canWrite && canManageJobCharges && !chargesAreLocked(draftJob)) {
      patchJob(buildRemoveServicePatch(services, serviceId));
    }
  }

  return {
    addPayment,
    addService,
    changeEstimateState,
    createEstimateLink,
    changeInvoiceFinalization,
    estimateNote,
    finalizationReason,
    isChangingInvoiceState,
    isChangingEstimateState,
    isRecordingPayment,
    isCreatingPublicEstimateLink,
    payment,
    paymentTargets: buildPaymentTargets(draftJob.techDetails?.payments || []),
    publicEstimateLink,
    removeService,
    service,
    setFinalizationReason,
    setEstimateNote,
    setPayment,
    setService,
    updateService
  };
}

function withTaxSnapshot(job, taxSettings = {}) {
  return {
    ...job,
    techDetails: {
      ...(job.techDetails || {}),
      tax: { ...taxSettings }
    }
  };
}

function chargesAreLocked(job) {
  return Boolean(job.invoiceFinalizedAt);
}

function buildPaymentTargets(payments = []) {
  return payments
    .filter((row) => String(row.type || 'payment').toLowerCase() === 'payment')
    .map((row) => {
      const originalMinor = Math.round(Number(row.amount || 0) * 100);
      const appliedMinor = payments
        .filter((adjustment) => adjustment.appliesToPaymentId === row.id && ['refund', 'void'].includes(String(adjustment.type || '').toLowerCase()))
        .reduce((total, adjustment) => total + Math.round(Number(adjustment.amount || 0) * 100), 0);
      return {
        ...row,
        originalMinor,
        appliedMinor,
        remainingMinor: Math.max(originalMinor - appliedMinor, 0)
      };
    })
    .filter((row) => row.remainingMinor > 0);
}

function getPaymentTarget(payments, paymentId) {
  return buildPaymentTargets(payments).find((row) => row.id === paymentId) || null;
}

function getEstimateSuccessMessage(status) {
  const messages = {
    sent: 'Estimate marked sent and totals locked.',
    approved: 'Estimate approval recorded.',
    declined: 'Estimate decline recorded.',
    draft: 'Estimate returned to draft for revision.'
  };
  return messages[status] || 'Estimate state updated.';
}
