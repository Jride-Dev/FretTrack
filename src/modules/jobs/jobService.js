import { combineCustomerName, ensureCustomerForJob, splitCustomerName } from '../customers';
import { getInstrumentStringCount, normalizeInstrumentType, resizeStringGauges } from '../instruments/instrumentService';
import { supabase, hasSupabaseConfig } from '../../shared/lib/supabaseClient';
import { toIsoDateInputValue } from '../../shared/utils/dateFormat';
import { getDefaultMeasurementPreferences, normalizeLengthUnit, normalizeMeasurementSystem } from '../../shared/utils/measurements';
import { formatJobNumber, generateJobNumber, getJobDayCode } from './jobNumber';
import { logJobEventSafe } from './jobEventsService';
import { getCurrentShopId } from '../shops/shopConfig';
import { validateJobForSave } from './jobValidation';
import {
  getJobImageStoragePath,
  getPersistableJobImageUrl,
  resolveJobImageUrl,
  resolveJobImageUrls
} from '../photos/photoUrls';
import { normalizeJobPriority } from './jobPriority';
import { normalizeJobSource } from './jobSources';

const STORAGE_KEY = 'guitar_checkin_jobs';
const OLD_STORAGE_KEY = 'guitar-checkin-jobs';
const fretTrackFunctionKey = import.meta.env.VITE_FRETTRACK_FUNCTION_KEY || '';
const duplicateWorkOrderPrefix = 'MULTIPLE WORK ORDERS CANNOT BE CREATED';
export const smsEnabled = import.meta.env.VITE_SMS_ENABLED === 'true';
const defaultTechDetails = {
  intakeType: 'Walk-In',
  subcontractorName: '',
  lastMessageTemplate: 'check_in',
  instrumentYear: '',
  finish: '',
  orientation: 'Unknown',
  stringGauges: ['', '', '', '', '', ''],
  stringCount: 6,
  newStringBrand: '',
  newStringGauge: '',
  neckInspectionBefore: '',
  neckInspectionAfter: '',
  neckInspection: {
    initial: {
      relief: '',
      reliefUnit: 'in',
      lengthUnit: 'in',
      reliefMethod: 'Capo 1st + fret last, measure at 7th/8th',
      actionLowE12th: '',
      actionHighE12th: '',
      nutLowE: '',
      nutHighE: '',
      nutStatus: 'OK',
      fretCondition: 'Good',
      fretNotes: '',
      neckCondition: 'Straight',
      twist: false,
      trussRodStatus: 'Unknown',
      buzzPresent: false,
      deadSpots: false,
      highFrets: false,
      notes: ''
    },
    final: {
      relief: '',
      reliefUnit: 'in',
      lengthUnit: 'in',
      reliefMethod: 'Capo 1st + fret last, measure at 7th/8th',
      actionLowE12th: '',
      actionHighE12th: '',
      nutLowE: '',
      nutHighE: '',
      nutStatus: 'OK',
      fretCondition: 'Good',
      fretNotes: '',
      neckCondition: 'Straight',
      twist: false,
      trussRodStatus: 'Unknown',
      buzzPresent: false,
      deadSpots: false,
      highFrets: false,
      notes: ''
    }
  },
  damageMap: {
    selectedArea: 'Body',
    selectedSeverity: 'Cosmetic',
    selectedView: 'front',
    liabilityAcknowledged: false,
    liabilityText: '',
    views: {
      front: { marks: [] },
      back: { marks: [] },
      headstock: { marks: [] },
      serial_number: { marks: [] }
    }
  },
  tax: {
    state: '',
    salesTaxRate: '',
    taxLabel: 'Sales Tax',
    taxRegistrationNumber: '',
    currencyCode: 'USD',
    locale: 'en-US',
    dateFormat: 'MM/DD/YYYY',
    taxableParts: true,
    taxableServices: false
  },
  payments: [],
  action3rdHighE: '',
  action3rdLowE: '',
  action12thHighE: '',
  action12thLowE: '',
  neckRelief: '',
  measurementSystem: 'imperial',
  lengthUnit: 'in',
  notes: '',
  contact: {
    phone: '',
    email: '',
    emailOptIn: false,
    smsOptIn: false,
    preferredContactMethod: 'email',
    addressLine1: '',
    city: '',
    region: '',
    postalCode: ''
  },
  includedPartIds: [],
  workOrderImageIds: [],
  discountType: 'none',
  discountValue: ''
};

export { combineCustomerName, generateJobNumber, splitCustomerName };

function getActiveShopId(shopId = '') {
  return shopId || getCurrentShopId();
}

export function getLocalJobs() {
  try {
    const activeShopId = getActiveShopId();
    const storedJobs = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (storedJobs) {
      return storedJobs.map(normalizeJob).filter((job) => job.shopId === activeShopId);
    }

    const oldStoredJobs = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
    if (oldStoredJobs) {
      const migratedJobs = oldStoredJobs.map(normalizeJob).filter((job) => job.shopId === activeShopId);
      saveLocalJobs(migratedJobs);
      return migratedJobs;
    }

    return [];
  } catch {
    return [];
  }
}

export function saveLocalJobs(jobs) {
  try {
    const persistedJobs = jobs.map((job) => sanitizeJobForPersistence(normalizeJob(job)));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedJobs));
  } catch (error) {
    console.error('Local job save failed. Supabase save will still be attempted when configured.', error);
  }
}

export const saveJobs = saveLocalJobs;

function mergeJobsByUpdatedAt(remoteJobs, localJobs) {
  const merged = new Map();
  const remoteKeys = new Set();
  const activeShopId = getActiveShopId();

  remoteJobs.forEach((job) => {
    merged.set(job.id, job);
    const key = getJobIdentityKey(job);
    if (key) {
      remoteKeys.add(key);
    }
  });

  localJobs.forEach((localJob) => {
    if (getActiveShopId(localJob.shopId) !== activeShopId) {
      return;
    }

    if (!remoteJobs.length && looksLikeRemoteJob(localJob)) {
      return;
    }

    const localKey = getJobIdentityKey(localJob);
    if (localKey && remoteKeys.has(localKey) && !merged.has(localJob.id)) {
      return;
    }

    const remoteJob = merged.get(localJob.id);
    if (!remoteJob || isNewerJob(localJob, remoteJob)) {
      merged.set(localJob.id, localJob);
    }
  });

  return Array.from(merged.values())
    .map((job) => normalizeJob(job))
    .sort((a, b) => new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt));
}

function getJobIdentityKey(job) {
  const shopId = getActiveShopId(job.shopId || job.shop_id);
  const jobNumber = job.jobNumber || job.job_number || '';
  return shopId && jobNumber ? `${shopId}:${jobNumber}` : '';
}

function looksLikeRemoteJob(job) {
  return Boolean(job.jobNumber || job.job_number || job.dailySequence || job.daily_sequence);
}

function isNewerJob(candidate, baseline) {
  const candidateTime = new Date(candidate.updatedAt || candidate.updated_at || candidate.createdAt || 0).getTime();
  const baselineTime = new Date(baseline.updatedAt || baseline.updated_at || baseline.createdAt || 0).getTime();
  return candidateTime > baselineTime;
}

export async function getJobs() {
  const activeShopId = getActiveShopId();

  if (!hasSupabaseConfig || !supabase) {
    return getLocalJobs();
  }

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      work_logs (*),
      job_parts (*),
      job_services (*),
      job_images (*),
      customer_messages (*)
    `)
    .eq('shop_id', activeShopId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase getJobs failed. Falling back to localStorage.', error);
    return getLocalJobs();
  }

  const remoteJobs = await Promise.all(data.map(async (job) => hydrateJobImageUrls(fromDbJob(job))));
  const jobs = mergeJobsByUpdatedAt(remoteJobs, getLocalJobs());
  saveLocalJobs(jobs);
  return jobs;
}

export async function addJob(job) {
  const now = new Date().toISOString();
  const activeShopId = getActiveShopId(job.shopId);
  const localJobs = getLocalJobs();
  const newJob = normalizeJob({
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

  const duplicateRemoteJob = await findRemoteDuplicateWorkOrder(newJob);
  if (duplicateRemoteJob) {
    throw new Error(getDuplicateWorkOrderMessage(duplicateRemoteJob.id, duplicateRemoteJob.job_number || newJob.jobNumber));
  }

  const { data, error } = await supabase.rpc('create_job_with_number', {
    job_payload: toDbJob(newJob)
  });

  if (error) {
    console.warn('Supabase numbered job function failed. Retrying with legacy jobs insert.', error);
    const { error: legacyInsertError } = await supabase.from('jobs').insert(toLegacyDbJob(newJob));

    if (legacyInsertError) {
      console.error('Supabase addJob failed. Local copy saved only.', legacyInsertError);
      throw new Error(`Remote job save failed: ${legacyInsertError.message}. Local copy was saved only on this browser.`);
    }

    logJobCreated(newJob);
    return newJob;
  }

  const savedJob = fromDbJob(Array.isArray(data) ? data[0] : data);
  saveLocalJobs([savedJob, ...localJobs.filter((item) => item.id !== savedJob.id)]);
  logJobCreated(savedJob);
  return savedJob;
}

export async function findRemoteJobByNumber(jobNumber, shopId = '') {
  if (!hasSupabaseConfig || !supabase || !jobNumber) {
    return null;
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('id, job_number, created_at')
    .eq('shop_id', getActiveShopId(shopId))
    .eq('job_number', jobNumber)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Remote job lookup by number failed.', error);
    return null;
  }

  return data || null;
}

export function isDuplicateWorkOrderError(error) {
  const message = String(error?.message || error || '');
  return message.includes(duplicateWorkOrderPrefix);
}

export async function sendCustomerMessage(job, message) {
  const normalizedJob = normalizeJob(job);
  const channel = message.channel;
  const recipient = message.to || message.recipient || (channel === 'sms' ? normalizedJob.phone : normalizedJob.email);

  if (channel === 'sms' && !smsEnabled) {
    return { ok: false, error: 'SMS is disabled for this trial build. Email is active.' };
  }

  if (!hasSupabaseConfig || !supabase) {
    return { ok: false, error: 'Supabase is not configured. Messaging requires Edge Functions.' };
  }

  try {
    await ensureRemoteJob(normalizedJob);
  } catch (error) {
    console.error('Remote job repair before customer message failed.', error);
    return {
      ok: false,
      error: `Remote job save failed: ${error.message || 'Unable to create remote work order before sending.'}`
    };
  }

  const functionName = channel === 'sms' ? 'send-sms' : 'send-email';
  const { data, error } = await supabase.functions.invoke(functionName, {
    headers: functionHeaders(),
    body: {
      job_id: normalizedJob.id,
      customer_id: message.customerId || null,
      to: recipient,
      subject: message.subject || '',
      body: message.body || '',
      html: message.html || '',
      template_key: message.templateKey || ''
    }
  });

  if (error || data?.success === false || data?.error) {
    const errorMessage = data?.error || error?.message || 'Provider send failed.';
    console.error('Customer message send failed.', { error, data });
    return {
      ok: false,
      message: data?.message ? normalizeCustomerMessage(fromDbCustomerMessage(data.message)) : null,
      mode: data?.mode || '',
      error: errorMessage
    };
  }

  return {
    ok: true,
    message: data?.message ? normalizeCustomerMessage(fromDbCustomerMessage(data.message)) : null,
    mode: data?.mode || '',
    providerMessageId: data?.id || data?.messageId || ''
  };
}

export async function getSmsMode() {
  if (!smsEnabled) {
    return 'disabled';
  }

  if (!hasSupabaseConfig || !supabase) {
    return 'not configured';
  }

  const { data, error } = await supabase.functions.invoke('send-sms', {
    headers: functionHeaders(),
    body: { action: 'status' }
  });

  if (error || data?.success === false) {
    console.error('SMS mode check failed.', { error, data });
    return 'error';
  }

  return data?.mode || 'test';
}

function functionHeaders() {
  // Temporary shop-level protection until proper user authentication is added.
  return {
    'x-frettrack-key': fretTrackFunctionKey
  };
}

export async function updateJob(updatedJob) {
  const previousJob = getLocalJobs().find((item) => item.id === updatedJob.id);
  const job = normalizeJob({
    ...updatedJob,
    updatedAt: new Date().toISOString()
  });
  validateJobForSave(job);

  const localJobs = getLocalJobs();
  const savedCustomer = await ensureCustomerForJob(job);
  if (savedCustomer?.id) {
    job.customerId = savedCustomer.id;
  }
  saveLocalJobs(localJobs.map((item) => (item.id === job.id ? job : item)));

  if (!hasSupabaseConfig || !supabase) {
    logJobUpdated(job, previousJob);
    return job;
  }

  const { error } = await updateSupabaseJob(job);

  if (error) {
    console.error('Supabase updateJob failed. Local copy saved only.', error);
    throw new Error(`Remote job save failed: ${error.message}. Local copy was saved only on this browser.`);
  }

  await syncJobChildren(job);
  logJobUpdated(job, previousJob);
  return job;
}

export async function ensureRemoteJob(job) {
  const activeShopId = getActiveShopId(job.shopId);
  const normalizedJob = normalizeJob({
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
    .eq('shop_id', getActiveShopId(normalizedJob.shopId))
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
    job_payload: toDbJob(normalizedJob)
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

async function updateSupabaseJob(job) {
  const activeShopId = getActiveShopId(job.shopId);
  let { data, error } = await supabase
    .from('jobs')
    .update(toDbJob(job))
    .eq('id', job.id)
    .eq('shop_id', activeShopId)
    .select('id')
    .maybeSingle();

  if (!error && data?.id) {
    return { error: null };
  }

  if (!error && !data) {
    return createMissingRemoteJob(job);
  }

  if (!shouldRetryWithLegacyJobPayload(error)) {
    return { error };
  }

  console.warn('Retrying job update with legacy Supabase payload.', error);
  ({ data, error } = await supabase
    .from('jobs')
    .update(toLegacyDbJob(job))
    .eq('id', job.id)
    .eq('shop_id', activeShopId)
    .select('id')
    .maybeSingle());

  if (!error && !data) {
    return createMissingRemoteJob(job);
  }

  return { error };
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
    .eq('shop_id', getActiveShopId(job.shopId))
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
  const jobShopId = getActiveShopId(job.shopId);
  const duplicateLocalJob = localJobs.find((item) => (
    getActiveShopId(item.shopId) === jobShopId
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
    shopId: getActiveShopId(part.shopId),
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

function normalizeJob(job, jobs = []) {
  const dateReceived = job.dateReceived || toIsoDateInputValue();
  const shopId = getActiveShopId(job.shopId || job.shop_id);
  const jobDate = job.jobDate || job.job_date || dateReceived;
  const jobDayCode = job.jobDayCode || job.job_day_code || getJobDayCode(jobDate);
  const parsedSequence = parseDailySequence(job.dailySequence ?? job.daily_sequence, job.jobNumber || job.job_number);
  const dailySequence = parsedSequence || null;
  const services = job.services || job.labor || [];
  const instrumentType = normalizeInstrumentType(job.instrumentType || job.techDetails?.instrumentType || 'Electric');
  const normalizedTechDetails = normalizeTechDetails(job.techDetails, instrumentType);
  const contactDetails = normalizeContactDetails(normalizedTechDetails.contact, job);
  const techDetails = {
    ...normalizedTechDetails,
    contact: contactDetails
  };
  const splitName = splitCustomerName(job.customerName || job.customer_name || '');
  const customerFirstName = job.customerFirstName || job.customer_first_name || splitName.customerFirstName;
  const customerLastName = job.customerLastName || job.customer_last_name || splitName.customerLastName;
  const customerName = combineCustomerName(customerFirstName, customerLastName) || job.customerName || job.customer_name || '';
  const includedPartIds = techDetails.includedPartIds || [];
  const parts = (job.parts || []).map(normalizePart).map((part) => ({
    ...part,
    includedInService: Boolean(part.includedInService || includedPartIds.includes(part.id))
  }));

  return {
    id: job.id || crypto.randomUUID(),
    customerId: job.customerId || job.customer_id || '',
    instrumentType,
    customerName,
    customerFirstName,
    customerLastName,
    phone: contactDetails.phone,
    email: contactDetails.email,
    emailOptIn: contactDetails.emailOptIn,
    smsOptIn: contactDetails.smsOptIn,
    preferredContactMethod: contactDetails.preferredContactMethod,
    addressLine1: contactDetails.addressLine1,
    city: contactDetails.city,
    region: contactDetails.region,
    postalCode: contactDetails.postalCode,
    guitarBrand: job.guitarBrand || '',
    model: job.model || '',
    serial: job.serial || '',
    color: job.color || '',
    reasonForVisit: job.reasonForVisit || '',
    dateReceived,
    promiseDate: job.promiseDate || job.promise_date || job.promisedDate || '',
    priority: normalizeJobPriority(job.priority || techDetails.priority),
    jobDate,
    jobDayCode,
    dailySequence,
    shopId,
    jobNumber: job.jobNumber || job.job_number || (dailySequence ? formatJobNumber(jobDayCode, dailySequence) : generateJobNumber(jobDate, jobs, job.id, shopId)),
    status: job.status || 'Checked In',
    discountType: job.discountType || techDetails.discountType || 'none',
    discountValue: job.discountValue ?? techDetails.discountValue ?? '',
    techDetails,
    workLog: (job.workLog || []).map(normalizeWorkLog),
    parts,
    services: services.map(normalizeService),
    labor: services.map(normalizeService),
    images: (job.images || []).map(normalizeImage).sort((a, b) => new Date(b.uploadedAt || b.createdAt) - new Date(a.uploadedAt || a.createdAt)),
    messages: (job.messages || []).map(normalizeCustomerMessage).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    createdAt: job.createdAt || new Date().toISOString(),
    updatedAt: job.updatedAt || new Date().toISOString()
  };
}

function normalizeWorkLog(log) {
  const createdAt = log.createdAt || log.timestamp || new Date().toISOString();
  const entry = log.entry || log.text || '';
  return {
    id: log.id || crypto.randomUUID(),
    jobId: log.jobId || log.job_id || '',
    entry,
    text: entry,
    createdAt,
    timestamp: createdAt
  };
}

function normalizeTechDetails(techDetails = {}, instrumentType = 'Guitar') {
  const normalizedInstrumentType = normalizeInstrumentType(instrumentType);
  const stringCount = getInstrumentStringCount({
    instrumentType: normalizedInstrumentType,
    techDetails
  });
  const stringGauges = resizeStringGauges(techDetails.stringGauges, stringCount);

  return {
    ...defaultTechDetails,
    ...techDetails,
    intakeType: normalizeIntakeType(techDetails.intakeType),
    subcontractorName: techDetails.subcontractorName || '',
    instrumentYear: techDetails.instrumentYear || '',
    finish: techDetails.finish || '',
    orientation: techDetails.orientation || 'Unknown',
    lastMessageTemplate: techDetails.lastMessageTemplate || defaultTechDetails.lastMessageTemplate,
    instrumentType: normalizedInstrumentType,
    stringCount,
    damageMap: normalizeDamageMap(techDetails.damageMap),
    neckInspection: normalizeNeckInspection(techDetails.neckInspection),
    tax: {
      ...defaultTechDetails.tax,
      ...(techDetails.tax || {})
    },
    measurementSystem: normalizeMeasurementSystem(techDetails.measurementSystem, getDefaultMeasurementPreferences(techDetails.tax || {}).measurementSystem),
    lengthUnit: normalizeLengthUnit(techDetails.lengthUnit, getDefaultMeasurementPreferences(techDetails.tax || {}).lengthUnit),
    payments: Array.isArray(techDetails.payments) ? techDetails.payments.map(normalizePayment) : [],
    contact: normalizeContactDetails(techDetails.contact),
    includedPartIds: techDetails.includedPartIds || [],
    workOrderImageIds: techDetails.workOrderImageIds || [],
    discountType: techDetails.discountType || 'none',
    discountValue: techDetails.discountValue ?? '',
    stringGauges
  };
}

function normalizeContactDetails(contact = {}, source = {}) {
  const sourcePhone = firstPresentValue(source, ['phone']);
  const sourceEmail = firstPresentValue(source, ['email']);
  const sourceEmailOptIn = firstPresentValue(source, ['emailOptIn', 'email_opt_in']);
  const sourceSmsOptIn = firstPresentValue(source, ['smsOptIn', 'sms_opt_in']);
  const sourcePreferredContactMethod = firstPresentValue(source, ['preferredContactMethod', 'preferred_contact_method']);
  const sourceAddressLine1 = firstPresentValue(source, ['addressLine1', 'address_line1', 'address']);
  const sourceCity = firstPresentValue(source, ['city']);
  const sourceRegion = firstPresentValue(source, ['region', 'state']);
  const sourcePostalCode = firstPresentValue(source, ['postalCode', 'postal_code', 'zipCode', 'zip_code']);

  return {
    phone: sourcePhone ?? contact.phone ?? '',
    email: sourceEmail ?? contact.email ?? '',
    emailOptIn: Boolean(sourceEmailOptIn ?? contact.emailOptIn ?? contact.email_opt_in),
    smsOptIn: Boolean(sourceSmsOptIn ?? contact.smsOptIn ?? contact.sms_opt_in),
    preferredContactMethod: sourcePreferredContactMethod ?? contact.preferredContactMethod ?? contact.preferred_contact_method ?? 'email',
    addressLine1: sourceAddressLine1 ?? contact.addressLine1 ?? contact.address_line1 ?? contact.address ?? '',
    city: sourceCity ?? contact.city ?? '',
    region: sourceRegion ?? contact.region ?? contact.state ?? '',
    postalCode: sourcePostalCode ?? contact.postalCode ?? contact.postal_code ?? contact.zipCode ?? contact.zip_code ?? ''
  };
}

function firstPresentValue(source = {}, keys = []) {
  const matchingKey = keys.find((key) => Object.prototype.hasOwnProperty.call(source, key));
  return matchingKey === undefined ? undefined : source[matchingKey];
}

function normalizeDamageMap(damageMap = {}) {
  const oldMarks = Array.isArray(damageMap.marks) ? damageMap.marks : [];
  const frontView = damageMap.views?.front || {};
  const backView = damageMap.views?.back || {};
  const headstockView = damageMap.views?.headstock || {};
  const serialNumberView = damageMap.views?.serial_number || {};
  const frontMarks = Array.isArray(frontView.marks) ? frontView.marks : oldMarks;
  const backMarks = Array.isArray(backView.marks) ? backView.marks : [];
  const headstockMarks = Array.isArray(headstockView.marks) ? headstockView.marks : [];
  const serialNumberMarks = Array.isArray(serialNumberView.marks) ? serialNumberView.marks : [];
  const selectedView = ['front', 'back', 'headstock', 'serial_number'].includes(damageMap.selectedView)
    ? damageMap.selectedView
    : 'front';

  return {
    selectedArea: damageMap.selectedArea || defaultTechDetails.damageMap.selectedArea,
    selectedSeverity: normalizeSeverity(damageMap.selectedSeverity),
    selectedView,
    liabilityAcknowledged: Boolean(damageMap.liabilityAcknowledged),
    liabilityText: damageMap.liabilityText || '',
    views: {
      front: normalizeDamageView(frontView, frontMarks),
      back: normalizeDamageView(backView, backMarks),
      headstock: normalizeDamageView(headstockView, headstockMarks),
      serial_number: normalizeDamageView(serialNumberView, serialNumberMarks)
    }
  };
}

function normalizeDamageView(view = {}, marks = []) {
  const storagePath = getJobImageStoragePath({
    storagePath: view.storagePath,
    url: view.imageUrl
  });

  return {
    imageUrl: view.imageUrl || '',
    imageName: view.imageName || '',
    imageId: view.imageId || '',
    storagePath,
    marks: marks.map(normalizeDamageMark)
  };
}

function normalizeDamageMark(mark) {
  const storagePath = getJobImageStoragePath({
    storagePath: mark.storagePath,
    url: mark.photoUrl
  });

  return {
    id: mark.id || crypto.randomUUID(),
    area: mark.area || 'Body',
    severity: normalizeSeverity(mark.severity),
    note: mark.note || '',
    recommendedRepair: mark.recommendedRepair || '',
    photoUrl: mark.photoUrl || '',
    photoName: mark.photoName || '',
    photoId: mark.photoId || '',
    storagePath,
    x: Number(mark.x) || 0,
    y: Number(mark.y) || 0
  };
}

function normalizeSeverity(severity) {
  if (severity === 'Critical' || severity === 'Structural' || severity === 'Cosmetic') {
    return severity;
  }
  if (severity === 'Severe') return 'Critical';
  if (severity === 'Moderate') return 'Structural';
  return 'Cosmetic';
}

function normalizeNeckInspection(neckInspection = {}) {
  return {
    initial: normalizeNeckStage(neckInspection.initial),
    final: normalizeNeckStage(neckInspection.final)
  };
}

function normalizeNeckStage(stage = {}) {
  const lengthUnit = normalizeLengthUnit(stage.lengthUnit || stage.reliefUnit, 'in');
  return {
    ...defaultTechDetails.neckInspection.initial,
    ...stage,
    lengthUnit,
    reliefUnit: normalizeLengthUnit(stage.reliefUnit, lengthUnit),
    twist: Boolean(stage.twist),
    buzzPresent: Boolean(stage.buzzPresent),
    deadSpots: Boolean(stage.deadSpots),
    highFrets: Boolean(stage.highFrets)
  };
}

function normalizePayment(payment) {
  return {
    id: payment.id || crypto.randomUUID(),
    date: payment.date || toIsoDateInputValue(),
    amount: payment.amount ?? '',
    method: payment.method || 'Cash',
    note: payment.note || ''
  };
}

function normalizeIntakeType(intakeType) {
  return normalizeJobSource(intakeType);
}

function normalizePart(part) {
  return {
    id: part.id || crypto.randomUUID(),
    shopId: getActiveShopId(part.shopId || part.shop_id),
    jobId: part.jobId || part.job_id || '',
    partId: part.partId || part.part_id || '',
    sku: part.sku || '',
    name: part.name || '',
    quantity: Number(part.quantity || 1),
    cost: Number(part.cost ?? part.unit_cost ?? 0),
    retail: Number(part.retail ?? part.retail_price ?? 0),
    includedInService: Boolean(part.includedInService),
    createdAt: part.createdAt || part.created_at || new Date().toISOString()
  };
}

function normalizeService(service) {
  return {
    id: service.id || crypto.randomUUID(),
    jobId: service.jobId || service.job_id || '',
    description: service.description || '',
    quantity: Number(service.quantity || 1),
    cost: Number(service.cost || 0),
    retail: Number(service.retail || 0),
    createdAt: service.createdAt || service.created_at || new Date().toISOString()
  };
}

function normalizeImage(image) {
  const storagePath = getJobImageStoragePath(image);

  return {
    id: image.id || crypto.randomUUID(),
    jobId: image.jobId || image.job_id || '',
    url: image.url || image.public_url || '',
    storagePath,
    fileName: image.fileName || image.file_name || image.name || '',
    originalFileName: image.originalFileName || image.original_filename || image.fileName || image.file_name || image.name || '',
    storedFileName: image.storedFileName || image.stored_filename || image.fileName || image.file_name || image.name || '',
    originalSizeBytes: Number(image.originalSizeBytes ?? image.original_size_bytes ?? 0),
    optimizedSizeBytes: Number(image.optimizedSizeBytes ?? image.optimized_size_bytes ?? 0),
    mimeType: image.mimeType || image.mime_type || '',
    width: Number(image.width || 0),
    height: Number(image.height || 0),
    optimizationVersion: image.optimizationVersion || image.optimization_version || '',
    name: image.name || image.fileName || image.file_name || '',
    uploadedAt: image.uploadedAt || image.uploaded_at || image.createdAt || image.created_at || new Date().toISOString(),
    category: image.category || 'job',
    createdAt: image.createdAt || image.created_at || new Date().toISOString()
  };
}

function sanitizeJobForPersistence(job) {
  return {
    ...job,
    images: (job.images || []).map(sanitizeJobImageForPersistence),
    techDetails: sanitizeTechDetailsForPersistence(job.techDetails)
  };
}

function sanitizeJobImageForPersistence(image = {}) {
  const storagePath = getJobImageStoragePath(image);

  return {
    ...image,
    url: getPersistableJobImageUrl({ ...image, storagePath }),
    storagePath
  };
}

function sanitizeTechDetailsForPersistence(techDetails = {}) {
  return {
    ...techDetails,
    damageMap: sanitizeDamageMapForPersistence(techDetails.damageMap)
  };
}

function sanitizeDamageMapForPersistence(damageMap) {
  if (!damageMap?.views) {
    return damageMap;
  }

  const views = Object.entries(damageMap.views).reduce((nextViews, [viewName, view]) => ({
    ...nextViews,
    [viewName]: sanitizeDamageViewForPersistence(view)
  }), {});

  return {
    ...damageMap,
    views
  };
}

function sanitizeDamageViewForPersistence(view = {}) {
  const storagePath = getJobImageStoragePath({
    storagePath: view.storagePath,
    url: view.imageUrl
  });

  return {
    ...view,
    imageUrl: getPersistableJobImageUrl({ url: view.imageUrl, storagePath }),
    storagePath,
    marks: (view.marks || []).map(sanitizeDamageMarkForPersistence)
  };
}

function sanitizeDamageMarkForPersistence(mark = {}) {
  const storagePath = getJobImageStoragePath({
    storagePath: mark.storagePath,
    url: mark.photoUrl
  });

  return {
    ...mark,
    photoUrl: getPersistableJobImageUrl({ url: mark.photoUrl, storagePath }),
    storagePath
  };
}

function parseDailySequence(sequenceValue, jobNumber = '') {
  const explicitSequence = Number(sequenceValue || 0);
  if (explicitSequence > 0) {
    return explicitSequence;
  }

  const match = String(jobNumber || '').match(/-(\d{3})$/);
  return match ? Number(match[1]) : null;
}

function toDbJob(job) {
  const shopId = getActiveShopId(job.shopId);
  return {
    ...toLegacyDbJob(job),
    customer_id: job.customerId || null,
    job_date: job.jobDate || job.dateReceived || null,
    promise_date: job.promiseDate || null,
    priority: normalizeJobPriority(job.priority),
    job_day_code: job.jobDayCode || getJobDayCode(job.jobDate || job.dateReceived),
    daily_sequence: job.dailySequence || null,
    shop_id: shopId,
    status: job.status || 'Checked In'
  };
}

function toLegacyDbJob(job) {
  const splitName = splitCustomerName(job.customerName || '');
  const customerFirstName = job.customerFirstName || splitName.customerFirstName;
  const customerLastName = job.customerLastName || splitName.customerLastName;
  const customerName = combineCustomerName(customerFirstName, customerLastName) || job.customerName || '';
  const instrumentType = normalizeInstrumentType(job.instrumentType || job.techDetails?.instrumentType || 'Electric');
  const contact = normalizeContactDetails(job.techDetails?.contact, job);
  const techDetails = sanitizeTechDetailsForPersistence(job.techDetails || {});

  return {
    id: job.id,
    customer_name: customerName,
    customer_first_name: customerFirstName,
    customer_last_name: customerLastName,
    phone: job.phone || '',
    email: job.email || '',
    email_opt_in: Boolean(job.emailOptIn),
    sms_opt_in: Boolean(job.smsOptIn),
    preferred_contact_method: job.preferredContactMethod || 'email',
    guitar_brand: job.guitarBrand || '',
    model: job.model || '',
    serial: job.serial || '',
    color: job.color || '',
    reason_for_visit: job.reasonForVisit || '',
    date_received: job.dateReceived || null,
    job_number: job.jobNumber || '',
    status: toLegacyJobStatus(job.status),
    tech_details: {
      ...techDetails,
      contact,
      instrumentType,
      includedPartIds: (job.parts || []).filter((part) => part.includedInService).map((part) => part.id),
      discountType: job.discountType || 'none',
      discountValue: job.discountValue ?? ''
    },
    created_at: job.createdAt,
    updated_at: job.updatedAt
  };
}

function toLegacyJobStatus(status) {
  const legacyStatuses = {
    'Checked In': 'Intake',
    'On Bench': 'In Progress',
    'Waiting Parts': 'Waiting Parts',
    Completed: 'Completed',
    'Picked Up': 'Picked up',
    Cancelled: 'Intake'
  };

  return legacyStatuses[status] || status || 'Intake';
}

function fromDbJob(job) {
  return normalizeJob({
    id: job.id,
    customerId: job.customer_id || '',
    customerName: job.customer_name || '',
    customerFirstName: job.customer_first_name || '',
    customerLastName: job.customer_last_name || '',
    phone: job.phone || '',
    email: job.email || '',
    emailOptIn: Boolean(job.email_opt_in),
    smsOptIn: Boolean(job.sms_opt_in),
    preferredContactMethod: job.preferred_contact_method || 'email',
    guitarBrand: job.guitar_brand || '',
    model: job.model || '',
    serial: job.serial || '',
    color: job.color || '',
    reasonForVisit: job.reason_for_visit || '',
    dateReceived: job.date_received || '',
    promiseDate: job.promise_date || '',
    priority: normalizeJobPriority(job.priority || job.tech_details?.priority),
    jobDate: job.job_date || job.date_received || '',
    jobDayCode: job.job_day_code || '',
    dailySequence: job.daily_sequence || null,
    shopId: getActiveShopId(job.shop_id),
    jobNumber: job.job_number || '',
    status: job.status || 'Checked In',
    discountType: job.tech_details?.discountType || 'none',
    discountValue: job.tech_details?.discountValue ?? '',
    instrumentType: normalizeInstrumentType(job.tech_details?.instrumentType || 'Electric'),
    techDetails: job.tech_details || {},
    workLog: (job.work_logs || []).map((log) => ({
      id: log.id,
      jobId: log.job_id,
      entry: log.entry || log.text,
      text: log.text || log.entry,
      createdAt: log.created_at,
      timestamp: log.created_at
    })),
    parts: (job.job_parts || []).map((part) => ({
      id: part.id,
      shopId: getActiveShopId(part.shop_id || job.shop_id),
      jobId: part.job_id,
      partId: part.part_id || '',
      sku: part.sku || '',
      name: part.name,
      quantity: Number(part.quantity || 1),
      cost: Number(part.cost ?? part.unit_cost ?? 0),
      retail: Number(part.retail ?? part.retail_price ?? 0),
      createdAt: part.created_at
    })),
    services: (job.job_services || []).map((service) => ({
      id: service.id,
      jobId: service.job_id,
      description: service.description,
      quantity: Number(service.quantity || 1),
      cost: Number(service.cost || 0),
      retail: Number(service.retail || 0),
      createdAt: service.created_at
    })),
    images: (job.job_images || []).map((image) => {
      const storagePath = getJobImageStoragePath({
        storagePath: image.storage_path,
        url: image.url,
        public_url: image.public_url
      });

      return {
        id: image.id,
        jobId: image.job_id,
        url: storagePath ? '' : image.url || image.public_url,
        storagePath,
        fileName: image.file_name,
        originalFileName: image.original_filename || image.file_name,
        storedFileName: image.stored_filename || image.file_name,
        originalSizeBytes: Number(image.original_size_bytes || 0),
        optimizedSizeBytes: Number(image.optimized_size_bytes || 0),
        mimeType: image.mime_type || '',
        width: Number(image.width || 0),
        height: Number(image.height || 0),
        optimizationVersion: image.optimization_version || '',
        name: image.file_name,
        uploadedAt: image.uploaded_at || image.created_at,
        category: image.category || 'job',
        createdAt: image.created_at
      };
    }),
    messages: (job.customer_messages || []).map(fromDbCustomerMessage),
    events: (job.job_events || []).map(fromDbJobEvent).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    createdAt: job.created_at,
    updatedAt: job.updated_at
  });
}

async function hydrateJobImageUrls(job) {
  const hydratedDamageMap = await hydrateDamageMapImageUrls(job.techDetails?.damageMap);

  const jobWithHydratedDamageMap = hydratedDamageMap
    ? {
        ...job,
        techDetails: {
          ...job.techDetails,
          damageMap: hydratedDamageMap
        }
      }
    : job;

  if (!job.images?.length) {
    return jobWithHydratedDamageMap;
  }

  return {
    ...jobWithHydratedDamageMap,
    images: await resolveJobImageUrls(job.images)
  };
}

async function hydrateDamageMapImageUrls(damageMap) {
  if (!damageMap?.views) {
    return damageMap;
  }

  const hydratedViews = {};
  for (const [viewName, view] of Object.entries(damageMap.views)) {
    const viewStoragePath = getJobImageStoragePath({
      storagePath: view.storagePath,
      url: view.imageUrl
    });
    const viewImageUrl = await resolveJobImageUrl({
      storagePath: viewStoragePath,
      url: view.imageUrl
    });

    const marks = await Promise.all((view.marks || []).map(async (mark) => {
      const markStoragePath = getJobImageStoragePath({
        storagePath: mark.storagePath,
        url: mark.photoUrl
      });

      return {
        ...mark,
        storagePath: markStoragePath,
        photoUrl: await resolveJobImageUrl({
          storagePath: markStoragePath,
          url: mark.photoUrl
        })
      };
    }));

    hydratedViews[viewName] = {
      ...view,
      storagePath: viewStoragePath,
      imageUrl: viewImageUrl,
      marks
    };
  }

  return {
    ...damageMap,
    views: hydratedViews
  };
}

function fromDbJobEvent(event) {
  return {
    id: event.id,
    shopId: event.shop_id,
    jobId: event.job_id,
    eventType: event.event_type,
    eventLabel: event.event_label,
    eventNote: event.event_note || '',
    eventData: event.event_data || {},
    createdAt: event.created_at,
    createdBy: event.created_by || ''
  };
}

function normalizeCustomerMessage(message) {
  return {
    id: message.id || crypto.randomUUID(),
    jobId: message.jobId || message.job_id || '',
    customerId: message.customerId || message.customer_id || '',
    channel: message.channel || 'email',
    recipient: message.recipient || '',
    subject: message.subject || '',
    body: message.body || '',
    templateKey: message.templateKey || message.template_key || '',
    status: message.status === 'sent' ? 'sent' : 'failed',
    provider: message.provider || '',
    providerMessageId: message.providerMessageId || message.provider_message_id || '',
    errorMessage: message.errorMessage || message.error_message || '',
    sentAt: message.sentAt || message.sent_at || '',
    createdAt: message.createdAt || message.created_at || new Date().toISOString()
  };
}

function toDbCustomerMessage(message) {
  return {
    id: message.id,
    job_id: message.jobId,
    customer_id: message.customerId || null,
    channel: message.channel,
    recipient: message.recipient,
    subject: message.subject || null,
    body: message.body,
    template_key: message.templateKey,
    status: message.status,
    provider: message.provider,
    provider_message_id: message.providerMessageId,
    error_message: message.errorMessage,
    sent_at: message.sentAt || null,
    created_at: message.createdAt
  };
}

function fromDbCustomerMessage(message) {
  return {
    id: message.id,
    jobId: message.job_id,
    customerId: message.customer_id,
    channel: message.channel,
    recipient: message.recipient,
    subject: message.subject,
    body: message.body,
    templateKey: message.template_key,
    status: message.status,
    provider: message.provider,
    providerMessageId: message.provider_message_id,
    errorMessage: message.error_message,
    sentAt: message.sent_at,
    createdAt: message.created_at
  };
}

function upsertById(items, item) {
  const exists = items.some((current) => current.id === item.id);
  if (exists) {
    return items.map((current) => (current.id === item.id ? item : current));
  }
  return [item, ...items];
}

function instrumentLabel(job) {
  return [job.guitarBrand, job.model].filter(Boolean).join(' ') || normalizeInstrumentType(job.instrumentType);
}

async function syncJobChildren(job) {
  await supabase.from('job_parts').delete().eq('job_id', job.id);
  if (job.parts.length) {
    const { error } = await supabase.from('job_parts').insert(
      job.parts.map((part) => ({
        id: part.id,
        shop_id: getActiveShopId(part.shopId || job.shopId),
        job_id: job.id,
        part_id: part.partId || null,
        name: part.name,
        sku: part.sku || null,
        quantity: Number(part.quantity || 1),
        cost: Number(part.cost || 0),
        retail: Number(part.retail || 0),
        unit_cost: Number(part.cost || 0),
        retail_price: Number(part.retail || 0),
        created_at: part.createdAt
      }))
    );
    if (error) {
      console.error('Supabase sync parts failed.', error);
    }
  }

  await supabase.from('job_services').delete().eq('job_id', job.id);
  if (job.services.length) {
    const { error } = await supabase.from('job_services').insert(
      job.services.map((service) => ({
        id: service.id,
        job_id: job.id,
        description: service.description,
        quantity: Number(service.quantity || 1),
        cost: Number(service.cost || 0),
        retail: Number(service.retail || 0),
        created_at: service.createdAt
      }))
    );
    if (error) {
      console.error('Supabase sync services failed.', error);
    }
  }

  const workLogs = job.workLog.map((log) => ({
    id: log.id,
    job_id: log.jobId || log.job_id || job.id,
    entry: log.entry || log.text,
    text: log.text || log.entry,
    created_at: log.createdAt || log.timestamp
  }));

  if (workLogs.length) {
    let { error } = await supabase.from('work_logs').upsert(workLogs);
    if (isMissingColumnError(error, 'text')) {
      const legacyWorkLogs = workLogs.map(({ text, ...log }) => log);
      ({ error } = await supabase.from('work_logs').upsert(legacyWorkLogs));
    }
    if (error) {
      console.error('Supabase sync work logs failed.', error);
      throw new Error(`Work log save failed: ${error.message}`);
    }
  }

  const savedWorkLogIds = workLogs.map((log) => log.id);
  let deleteQuery = supabase.from('work_logs').delete().eq('job_id', job.id);

  if (savedWorkLogIds.length) {
    deleteQuery = deleteQuery.not('id', 'in', `(${savedWorkLogIds.join(',')})`);
  }

  const { error: deleteWorkLogsError } = await deleteQuery;
  if (deleteWorkLogsError) {
    console.error('Supabase stale work log cleanup failed.', deleteWorkLogsError);
    throw new Error(`Work log cleanup failed: ${deleteWorkLogsError.message}`);
  }
}

function isMissingColumnError(error, columnName) {
  if (!error) {
    return false;
  }

  const message = String(error.message || error.details || '');
  return message.includes(`'${columnName}' column`) || message.includes(`column "${columnName}"`);
}

function shouldRetryWithLegacyJobPayload(error) {
  if (!error) {
    return false;
  }

  const message = String(error.message || error.details || '');
  return (
    ['customer_id', 'job_date', 'promise_date', 'priority', 'job_day_code', 'daily_sequence', 'shop_id'].some((columnName) => isMissingColumnError(error, columnName))
    || message.includes('violates check constraint')
    || message.includes('schema cache')
  );
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
      logJobEventSafe({
        shopId: job.shopId,
        jobId: job.id,
        eventType: 'payment_added',
        eventLabel: 'Payment added',
        eventNote: payment.method || '',
        eventData: {
          paymentId: payment.id,
          amount: payment.amount,
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
