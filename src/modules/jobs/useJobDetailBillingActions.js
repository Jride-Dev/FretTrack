import { useEffect, useRef, useState } from 'react';
import { toIsoDateInputValue } from '../../shared/utils/dateFormat.js';
import {
  buildAddPaymentJob,
  buildAddServicePatch,
  buildRemovePaymentJob,
  buildRemoveServicePatch,
  buildUpdatePaymentJob,
  buildUpdateServicePatch
} from './jobDetailFormatting.js';

const EMPTY_SERVICE = { description: '', quantity: '1', cost: '', retail: '' };

function createEmptyPayment() {
  return { amount: '', type: 'payment', method: 'Cash', note: '', date: toIsoDateInputValue() };
}

export default function useJobDetailBillingActions({
  canWrite,
  draftJob,
  onNotice,
  patchJob,
  saveDraftNow,
  services,
  setDraftJob,
  setIsDirty
}) {
  const [service, setService] = useState(EMPTY_SERVICE);
  const [payment, setPayment] = useState(createEmptyPayment);
  const paymentAutosaveTimeoutRef = useRef(null);

  useEffect(() => () => window.clearTimeout(paymentAutosaveTimeoutRef.current), []);

  function reportPaymentSaveError(error) {
    onNotice?.({
      type: 'error',
      message: error?.message || 'The payment change could not be saved.'
    });
  }

  async function savePaymentChange(nextJob, { immediate = false } = {}) {
    if (!canWrite) {
      return;
    }
    window.clearTimeout(paymentAutosaveTimeoutRef.current);
    setDraftJob(nextJob);
    setIsDirty(true);

    if (immediate) {
      await saveDraftNow(nextJob).catch(reportPaymentSaveError);
      return;
    }

    paymentAutosaveTimeoutRef.current = window.setTimeout(() => {
      saveDraftNow(nextJob).catch(reportPaymentSaveError);
    }, 700);
  }

  function addPayment(event) {
    event.preventDefault();
    if (!canWrite || !Number(payment.amount)) {
      return;
    }

    savePaymentChange(buildAddPaymentJob(draftJob, payment, crypto.randomUUID()), { immediate: true });
    setPayment(createEmptyPayment());
  }

  function updatePayment(paymentId, field, value) {
    if (canWrite) {
      savePaymentChange(buildUpdatePaymentJob(draftJob, paymentId, field, value));
    }
  }

  function removePayment(paymentId) {
    if (canWrite) {
      savePaymentChange(buildRemovePaymentJob(draftJob, paymentId), { immediate: true });
    }
  }

  function addService(event) {
    event.preventDefault();
    if (!canWrite || !service.description.trim()) {
      return;
    }
    patchJob(buildAddServicePatch(draftJob, services, service, crypto.randomUUID()));
    setService(EMPTY_SERVICE);
  }

  function updateService(serviceId, field, value) {
    if (canWrite) {
      patchJob(buildUpdateServicePatch(services, serviceId, field, value));
    }
  }

  function removeService(serviceId) {
    if (canWrite) {
      patchJob(buildRemoveServicePatch(services, serviceId));
    }
  }

  return {
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
  };
}
