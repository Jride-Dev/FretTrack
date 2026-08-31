import { useState } from 'react';
import { toIsoDateInputValue } from '../../shared/utils/dateFormat.js';
import { recordJobPayment, setJobInvoiceFinalization } from './jobService.js';
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
  setIsDirty
}) {
  const [service, setService] = useState(EMPTY_SERVICE);
  const [payment, setPayment] = useState(createEmptyPayment);
  const [finalizationReason, setFinalizationReason] = useState('');
  const [isChangingInvoiceState, setIsChangingInvoiceState] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  function reportCommerceError(error, fallbackMessage) {
    onNotice?.({ type: 'error', message: error?.message || fallbackMessage });
  }

  async function addPayment(event) {
    event.preventDefault();
    if (!canRecordJobPayments || isRecordingPayment || !Number(payment.amount)) {
      return;
    }
    if (payment.type !== 'payment' && !canIssuePaymentAdjustments) {
      reportCommerceError(null, 'Only a shop owner or admin can record refunds or payment voids.');
      return;
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
      onNotice?.({ type: 'success', message: paymentToRecord.type === 'payment' ? 'Payment recorded.' : 'Payment adjustment recorded.' });
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
      const savedJob = finalized ? await saveDraftNow(draftJob) : draftJob;
      const result = await setJobInvoiceFinalization(savedJob.id, finalized, reason);
      setDraftJob((current) => ({ ...current, ...result }));
      setIsDirty(false);
      setFinalizationReason('');
      await onRefresh?.();
      onNotice?.({ type: 'success', message: finalized ? 'Invoice finalized and totals locked.' : 'Invoice reopened for charge changes.' });
    } catch (error) {
      reportCommerceError(error, 'The invoice state could not be changed.');
    } finally {
      setIsChangingInvoiceState(false);
    }
  }

  function addService(event) {
    event.preventDefault();
    if (!canWrite || !canManageJobCharges || draftJob.invoiceFinalizedAt || !service.description.trim()) {
      return;
    }
    patchJob(buildAddServicePatch(draftJob, services, service, crypto.randomUUID()));
    setService(EMPTY_SERVICE);
  }

  function updateService(serviceId, field, value) {
    if (canWrite && canManageJobCharges && !draftJob.invoiceFinalizedAt) {
      patchJob(buildUpdateServicePatch(services, serviceId, field, value));
    }
  }

  function removeService(serviceId) {
    if (canWrite && canManageJobCharges && !draftJob.invoiceFinalizedAt) {
      patchJob(buildRemoveServicePatch(services, serviceId));
    }
  }

  return {
    addPayment,
    addService,
    changeInvoiceFinalization,
    finalizationReason,
    isChangingInvoiceState,
    isRecordingPayment,
    payment,
    removeService,
    service,
    setFinalizationReason,
    setPayment,
    setService,
    updateService
  };
}
