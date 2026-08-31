import { ensureCustomerForJob } from '../customers';
import { normalizeInstrumentType } from '../instruments/instrumentService';
import { supabase, hasSupabaseConfig } from '../../shared/lib/supabaseClient';
import { logJobEventSafe } from './jobEventsService';
import { validateJobForSave } from './jobValidation';
import {
  fromDbJob as fromDbJobRecord,
  getActiveShopId as getActiveShopIdFromModule,
  normalizeJob as normalizeJobFromModule,
  toDbJob as toDbJobFromModule,
  toLegacyDbJob as toLegacyDbJobFromModule
} from './jobServiceNormalization.js';
import {
  shouldRetryWithLegacyJobPayload as shouldRetryWithLegacyJobPayloadFromModule,
  syncJobChildren as syncJobChildrenFromModule
} from './jobServiceChildren.js';
import { getLocalJobs, saveLocalJobs } from './jobServiceQueries.js';

const duplicateWorkOrderPrefix = 'MULTIPLE WORK ORDERS CANNOT BE CREATED';
export const JOB_SAVE_CONFLICT_CODE = 'FRETTRACK_JOB_SAVE_CONFLICT';

export async function addJob(job) {
  const now = new Date().toISOString();
  const activeShopId = getActiveShopIdFromModule(job.shopId);
  const localJobs = getLocalJobs();
  const newJob = normalizeJobFromModule({
    ...job,
    shopId: activeShopId,
    id: job.id || crypto.randomUUID(),
    createdAt: job.createdAt || now,
    updatedAt: now
  }, localJobs);
  validateJobForSave(newJob);

  assertNoDuplicateLocalWorkOrder(newJob, localJobs);

  const savedCustomer = await ensureCustomerForJob(newJob);
  if (savedCustomer?.id) {
    newJob.customerId = savedCustomer.id;
  }

  if (!hasSupabaseConfig || !supabase) {
    saveLocalJobs([newJob, ...localJobs]);
    logJobCreated(newJob);
    return newJob;
  }

  const remotePayload = toDbJobFromModule(newJob, { includeAssignment: true });
  remotePayload.job_number = '';
  const { data, error } = await supabase.rpc('create_job_with_number', {
    job_payload: remotePayload
  });

  if (error) {
    console.warn('Supabase numbered job function failed. Retrying with legacy jobs insert.', error);
    const { error: legacyInsertError } = await supabase.from('jobs').insert(toLegacyDbJobFromModule(newJob));

    if (legacyInsertError) {
      console.error('Supabase addJob failed. Local copy saved only.', legacyInsertError);
      throw new Error(`Remote job save failed: ${legacyInsertError.message}. Local copy was saved only on this browser.`);
    }

    logJobCreated(newJob);
    return newJob;
  }

  const savedJob = fromDbJobRecord(Array.isArray(data) ? data[0] : data);
  saveLocalJobs([savedJob, ...localJobs.filter((item) => item.id !== savedJob.id)]);
  logJobCreated(savedJob);
  return savedJob;
}

export function isDuplicateWorkOrderError(error) {
  const message = String(error?.message || error || '');
  return message.includes(duplicateWorkOrderPrefix);
}

export async function updateJob(updatedJob, { expectedUpdatedAt = null } = {}) {
  const previousJob = getLocalJobs().find((item) => item.id === updatedJob.id);
  const job = normalizeJobFromModule({
    ...updatedJob,
    updatedAt: new Date().toISOString()
  });
  validateJobForSave(job);

  const localJobs = getLocalJobs();
  if (!hasSupabaseConfig || !supabase) {
    const savedCustomer = await ensureCustomerForJob(job);
    if (savedCustomer?.id) {
      job.customerId = savedCustomer.id;
    }
    saveLocalJobs(localJobs.map((item) => (item.id === job.id ? job : item)));
    logJobUpdated(job, previousJob);
    return job;
  }

  if (expectedUpdatedAt) {
    const { error } = await updateSupabaseJob(job, { expectedUpdatedAt });
    if (error) {
      throwVersionedJobUpdateError(error);
    }

    let savedCustomer;
    try {
      savedCustomer = await ensureCustomerForJob(job, { throwOnError: true });
    } catch (error) {
      throwVersionedCustomerSyncError(error);
    }
    if (savedCustomer?.id && savedCustomer.id !== job.customerId) {
      const { error: customerLinkError } = await linkCustomerToVersionedJob(job, savedCustomer.id);
      if (customerLinkError) {
        throwVersionedCustomerLinkError(customerLinkError);
      }
      job.customerId = savedCustomer.id;
    }
    saveLocalJobs(localJobs.map((item) => (item.id === job.id ? job : item)));
  } else {
    const savedCustomer = await ensureCustomerForJob(job);
    if (savedCustomer?.id) {
      job.customerId = savedCustomer.id;
    }
    saveLocalJobs(localJobs.map((item) => (item.id === job.id ? job : item)));

    const { error } = await updateSupabaseJob(job);
    if (error) {
      console.error('Supabase updateJob failed. Local copy saved only.', error);
      throw new Error(`Remote job save failed: ${error.message}. Local copy was saved only on this browser.`);
    }
  }
  await syncJobChildrenFromModule(job);
  logJobUpdated(job, previousJob);
  return job;
}

function throwVersionedJobUpdateError(error) {
  if (error.code === JOB_SAVE_CONFLICT_CODE) {
    throw error;
  }
  console.error('Supabase version-guarded updateJob failed.', error);
  throw new Error(`Remote job save failed: ${error.message}. No local or remote job changes were saved.`);
}

function throwVersionedCustomerLinkError(error) {
  if (error.code === JOB_SAVE_CONFLICT_CODE) {
    throw error;
  }
  console.error('Supabase version-guarded customer link failed.', error);
  throw new Error(`The work order was saved, but its customer link could not be finalized: ${error.message}. Reload before saving again.`);
}

function throwVersionedCustomerSyncError(error) {
  console.error('The work order saved, but customer synchronization failed.', error);
  throw new Error(`The work order was saved, but its customer details could not be synchronized: ${error.message}. Reload before saving again.`);
}

export async function setJobAccountingVoid(jobId, voided, reason) {
  if (!jobId) {
    throw new Error('A work order is required.');
  }
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Accounting exclusion requires the secured FretTrack database.');
  }

  const { data, error } = await supabase.rpc('set_job_accounting_void', {
    p_job_id: jobId,
    p_void: Boolean(voided),
    p_reason: String(reason || '').trim()
  });

  if (error) {
    throw new Error(error.message || 'Unable to change accounting exclusion.');
  }

  const saved = Array.isArray(data) ? data[0] : data;
  return {
    id: saved?.id || jobId,
    accountingVoidedAt: saved?.accounting_voided_at || null,
    accountingVoidedBy: saved?.accounting_voided_by || '',
    accountingVoidReason: saved?.accounting_void_reason || ''
  };
}

export async function recordJobPayment(jobId, payment, expectedUpdatedAt = null) {
  if (!jobId || !payment?.id) {
    throw new Error('A saved work order and payment request are required.');
  }
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const amountMinor = Math.round(Number(payment.amount || 0) * 100);
  const { data, error } = await supabase.rpc('record_job_payment', {
    p_job_id: jobId,
    p_payment_id: payment.id,
    p_amount_minor: amountMinor,
    p_payment_type: payment.type || 'payment',
    p_method: payment.method || 'Other',
    p_note: payment.note || '',
    p_payment_date: payment.date || null,
    p_expected_updated_at: expectedUpdatedAt || null
  });

  if (error) {
    if (error.code === '40001') {
      throw createJobSaveConflictError();
    }
    throw new Error(error.message || 'The payment could not be recorded.');
  }

  return {
    payment: data?.payment || payment,
    updatedAt: data?.updatedAt || expectedUpdatedAt,
    replayed: Boolean(data?.replayed)
  };
}

export async function setJobInvoiceFinalization(jobId, finalized, reason) {
  if (!jobId) {
    throw new Error('A work order is required.');
  }
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Invoice finalization requires the secured FretTrack database.');
  }

  const { data, error } = await supabase.rpc('set_job_invoice_finalization', {
    p_job_id: jobId,
    p_finalize: Boolean(finalized),
    p_reason: String(reason || '').trim()
  });
  if (error) {
    throw new Error(error.message || 'The invoice finalization state could not be changed.');
  }

  const saved = Array.isArray(data) ? data[0] : data;
  return {
    invoiceFinalizedAt: saved?.invoice_finalized_at || null,
    invoiceFinalizedBy: saved?.invoice_finalized_by || '',
    invoiceSnapshot: saved?.invoice_snapshot || null,
    invoiceRevision: Number(saved?.invoice_revision || 0),
    invoiceFinalizationReason: saved?.invoice_finalization_reason || '',
    updatedAt: saved?.updated_at || null
  };
}

export async function ensureRemoteJob(job) {
  const activeShopId = getActiveShopIdFromModule(job.shopId);
  const normalizedJob = normalizeJobFromModule({
    ...job,
    shopId: activeShopId,
    updatedAt: job.updatedAt || new Date().toISOString()
  });

  if (!hasSupabaseConfig || !supabase) {
    return normalizedJob;
  }

  const { data: existingJob, error: existingJobError } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', normalizedJob.id)
    .eq('shop_id', getActiveShopIdFromModule(normalizedJob.shopId))
    .maybeSingle();

  if (existingJobError) {
    throw existingJobError;
  }

  if (existingJob?.id) {
    return normalizedJob;
  }

  const duplicateRemoteJob = await findRemoteDuplicateWorkOrder(normalizedJob);
  if (duplicateRemoteJob && duplicateRemoteJob.id !== normalizedJob.id) {
    throw new Error(getDuplicateWorkOrderMessage(duplicateRemoteJob.id, duplicateRemoteJob.job_number || normalizedJob.jobNumber));
  }

  const { data, error } = await supabase.rpc('create_job_with_number', {
    job_payload: toDbJobFromModule(normalizedJob, { includeAssignment: true })
  });

  if (error) {
    throw error;
  }

  const savedJob = Array.isArray(data) ? data[0] : data;
  if (savedJob?.id && savedJob.id !== normalizedJob.id) {
    throw new Error(getDuplicateWorkOrderMessage(savedJob.id, savedJob.job_number || normalizedJob.jobNumber));
  }

  return normalizedJob;
}

async function updateSupabaseJob(job, { expectedUpdatedAt = null } = {}) {
  const activeShopId = getActiveShopIdFromModule(job.shopId);
  let updateQuery = supabase
    .from('jobs')
    .update(toDbJobFromModule(job))
    .eq('id', job.id)
    .eq('shop_id', activeShopId);
  if (expectedUpdatedAt) {
    updateQuery = updateQuery.eq('updated_at', expectedUpdatedAt);
  }
  let { data, error } = await updateQuery
    .select('id')
    .maybeSingle();

  if (!error && data?.id) {
    return { error: null };
  }

  if (!error && !data) {
    if (expectedUpdatedAt) {
      return { error: createJobSaveConflictError() };
    }
    return createMissingRemoteJob(job);
  }

  if (!shouldRetryWithLegacyJobPayloadFromModule(error)) {
    return { error };
  }

  console.warn('Retrying job update with legacy Supabase payload.', error);
  let legacyUpdateQuery = supabase
    .from('jobs')
    .update(toLegacyDbJobFromModule(job))
    .eq('id', job.id)
    .eq('shop_id', activeShopId);
  if (expectedUpdatedAt) {
    legacyUpdateQuery = legacyUpdateQuery.eq('updated_at', expectedUpdatedAt);
  }
  ({ data, error } = await legacyUpdateQuery
    .select('id')
    .maybeSingle());

  if (!error && !data) {
    if (expectedUpdatedAt) {
      return { error: createJobSaveConflictError() };
    }
    return createMissingRemoteJob(job);
  }

  return { error };
}

async function linkCustomerToVersionedJob(job, customerId) {
  const { data, error } = await supabase
    .from('jobs')
    .update({ customer_id: customerId })
    .eq('id', job.id)
    .eq('shop_id', getActiveShopIdFromModule(job.shopId))
    .eq('updated_at', job.updatedAt)
    .select('id')
    .maybeSingle();

  if (!error && !data) {
    return { error: createJobSaveConflictError() };
  }

  return { error };
}

function createJobSaveConflictError() {
  const error = new Error('This job changed in another session. Reload it before saving so another technician\'s work is not overwritten.');
  error.code = JOB_SAVE_CONFLICT_CODE;
  return error;
}

async function createMissingRemoteJob(job) {
  try {
    await ensureRemoteJob(job);
    return { error: null };
  } catch (error) {
    return { error };
  }
}

async function findRemoteDuplicateWorkOrder(job) {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, job_number')
    .eq('shop_id', getActiveShopIdFromModule(job.shopId))
    .eq('job_number', job.jobNumber)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Duplicate work order preflight failed.', error);
    return null;
  }

  return data || null;
}

function assertNoDuplicateLocalWorkOrder(job, localJobs) {
  const jobShopId = getActiveShopIdFromModule(job.shopId);
  const duplicateLocalJob = localJobs.find((item) => (
    getActiveShopIdFromModule(item.shopId) === jobShopId
    && item.jobNumber === job.jobNumber
    && item.id !== job.id
  ));

  if (duplicateLocalJob) {
    throw new Error(getDuplicateWorkOrderMessage(duplicateLocalJob.id, duplicateLocalJob.jobNumber || job.jobNumber));
  }
}

function getDuplicateWorkOrderMessage(jobId, jobNumber) {
  return `${duplicateWorkOrderPrefix} FOR [${jobId || 'UNKNOWN JOB ID'}, ${jobNumber || 'UNKNOWN WORK ORDER NUMBER'}]`;
}

export async function addWorkLog(jobId, entry) {
  const log = {
    id: crypto.randomUUID(),
    jobId,
    entry,
    text: entry,
    createdAt: new Date().toISOString(),
    timestamp: new Date().toISOString()
  };

  if (hasSupabaseConfig && supabase) {
    const row = {
      id: log.id,
      job_id: jobId,
      entry,
      text: entry,
      created_at: log.createdAt
    };
    let { error } = await supabase.from('work_logs').insert(row);

    if (isMissingColumnError(error, 'text')) {
      const { text, ...legacyRow } = row;
      ({ error } = await supabase.from('work_logs').insert(legacyRow));
    }

    if (error) {
      console.error('Supabase addWorkLog failed.', error);
    }
  }

  return log;
}

export async function addPart(jobId, part) {
  const cleanPart = {
    id: crypto.randomUUID(),
    jobId,
    shopId: getActiveShopIdFromModule(part.shopId),
    partId: part.partId || '',
    sku: part.sku || '',
    name: part.name,
    quantity: Number(part.quantity || 1),
    cost: Number(part.cost || 0),
    retail: Number(part.retail || 0),
    createdAt: new Date().toISOString()
  };

  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from('job_parts').insert({
      id: cleanPart.id,
      shop_id: cleanPart.shopId,
      job_id: jobId,
      part_id: cleanPart.partId || null,
      name: cleanPart.name,
      sku: cleanPart.sku || null,
      quantity: cleanPart.quantity,
      cost: cleanPart.cost,
      retail: cleanPart.retail,
      unit_cost: cleanPart.cost,
      retail_price: cleanPart.retail,
      created_at: cleanPart.createdAt
    });

    if (error) {
      console.error('Supabase addPart failed.', error);
    }
  }

  return cleanPart;
}

export async function addService(jobId, service) {
  const cleanService = {
    id: crypto.randomUUID(),
    jobId,
    description: service.description,
    quantity: Number(service.quantity || 1),
    cost: Number(service.cost || 0),
    retail: Number(service.retail || 0),
    createdAt: new Date().toISOString()
  };

  if (hasSupabaseConfig && supabase) {
    const { error } = await supabase.from('job_services').insert({
      id: cleanService.id,
      job_id: jobId,
      description: cleanService.description,
      quantity: cleanService.quantity,
      cost: cleanService.cost,
      retail: cleanService.retail,
      created_at: cleanService.createdAt
    });

    if (error) {
      console.error('Supabase addService failed.', error);
    }
  }

  return cleanService;
}

function instrumentLabel(job) {
  return [job.guitarBrand, job.model].filter(Boolean).join(' ') || normalizeInstrumentType(job.instrumentType);
}

function isMissingColumnError(error, columnName) {
  if (!error) {
    return false;
  }

  const message = String(error.message || error.details || '');
  return message.includes(`'${columnName}' column`) || message.includes(`column "${columnName}"`);
}

function logJobCreated(job) {
  logJobEventSafe({
    shopId: job.shopId,
    jobId: job.id,
    eventType: 'job_created',
    eventLabel: 'Job created',
    eventNote: job.jobNumber ? `Job ${job.jobNumber}` : '',
    eventData: {
      jobNumber: job.jobNumber,
      status: job.status
    }
  });
}

function logJobUpdated(job, previousJob) {
  logJobEventSafe({
    shopId: job.shopId,
    jobId: job.id,
    eventType: 'job_updated',
    eventLabel: 'Job updated',
    eventData: {
      jobNumber: job.jobNumber,
      status: job.status
    }
  });

  if (previousJob?.status && previousJob.status !== job.status) {
    logJobEventSafe({
      shopId: job.shopId,
      jobId: job.id,
      eventType: 'status_changed',
      eventLabel: 'Status changed',
      eventNote: `${previousJob.status} -> ${job.status}`,
      eventData: {
        from: previousJob.status,
        to: job.status
      }
    });
  }

  const previousPayments = previousJob?.techDetails?.payments || [];
  const nextPayments = job.techDetails?.payments || [];
  nextPayments
    .filter((payment) => !previousPayments.some((previousPayment) => previousPayment.id === payment.id))
    .forEach((payment) => {
      const paymentType = String(payment.type || 'payment').toLowerCase();
      const isRefund = paymentType === 'refund';
      const isVoid = paymentType === 'void';
      logJobEventSafe({
        shopId: job.shopId,
        jobId: job.id,
        eventType: isRefund ? 'payment_refunded' : isVoid ? 'payment_voided' : 'payment_added',
        eventLabel: isRefund ? 'Payment refunded' : isVoid ? 'Payment voided' : 'Payment added',
        eventNote: payment.method || '',
        eventData: {
          paymentId: payment.id,
          amount: payment.amount,
          type: paymentType,
          method: payment.method,
          date: payment.date
        }
      });
    });

  const previousWorkLog = previousJob?.workLog || [];
  const nextWorkLog = job.workLog || [];
  nextWorkLog
    .filter((entry) => !previousWorkLog.some((previousEntry) => previousEntry.id === entry.id))
    .forEach((entry) => {
      logJobEventSafe({
        shopId: job.shopId,
        jobId: job.id,
        eventType: 'work_log_added',
        eventLabel: 'Work log added',
        eventNote: entry.entry || entry.text || '',
        eventData: {
          workLogId: entry.id
        }
      });
    });
}

