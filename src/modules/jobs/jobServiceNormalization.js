import { combineCustomerName, splitCustomerName } from '../customers';
import { getInstrumentStringCount, normalizeInstrumentType, resizeStringGauges } from '../instruments/instrumentService';
import { toIsoDateInputValue } from '../../shared/utils/dateFormat';
import { getDefaultMeasurementPreferences, normalizeLengthUnit, normalizeMeasurementSystem } from '../../shared/utils/measurements';
import { formatJobNumber, generateJobNumber, getJobDayCode } from './jobNumber';
import { normalizeServiceQuantity } from './serviceQuantity.js';
import { getCurrentShopId } from '../shops/shopConfig';
import { normalizeJobPriority } from './jobPriority';
import { normalizeJobSource } from './jobSources';
import {
  fromDbCorrespondenceMessage as fromDbCustomerMessage,
  normalizeCorrespondenceMessage as normalizeCustomerMessage
} from '../messaging/customerCorrespondence';
import {
  getJobImageStoragePath,
  getPersistableJobImageUrl,
  resolveJobImageUrl,
  resolveJobImageUrls
} from '../photos/photoUrls';

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
    calculationMode: 'disabled',
    profileId: '',
    profileRevision: 0,
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

export function getActiveShopId(shopId = '') {
  return shopId || getCurrentShopId();
}

export function normalizeJob(job, jobs = []) {
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
    documentType: job.documentType || job.document_type || techDetails.documentType || 'work_order',
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
    dropOffAt: job.dropOffAt || job.drop_off_at || '',
    promiseDate: job.promiseDate || job.promise_date || job.promisedDate || '',
    priority: normalizeJobPriority(job.priority || techDetails.priority),
    jobDate,
    jobDayCode,
    dailySequence,
    shopId,
    assignedMemberId: job.assignedMemberId || job.assigned_member_id || '',
    assignedMemberDisplayName: job.assignedMemberDisplayName || job.assigned_member_display_name || '',
    assignmentUpdatedAt: job.assignmentUpdatedAt || job.assignment_updated_at || null,
    jobNumber: job.jobNumber || job.job_number || (dailySequence ? formatJobNumber(jobDayCode, dailySequence) : generateJobNumber(jobDate, jobs, job.id, shopId)),
    status: job.status || 'Checked In',
    accountingVoidedAt: job.accountingVoidedAt || job.accounting_voided_at || null,
    accountingVoidedBy: job.accountingVoidedBy || job.accounting_voided_by || '',
    accountingVoidReason: job.accountingVoidReason || job.accounting_void_reason || '',
    estimateStatus: job.estimateStatus || job.estimate_status || 'draft',
    estimateSnapshot: job.estimateSnapshot || job.estimate_snapshot || null,
    estimateRevision: Number(job.estimateRevision ?? job.estimate_revision ?? 0),
    estimateSentAt: job.estimateSentAt || job.estimate_sent_at || null,
    estimateSentBy: job.estimateSentBy || job.estimate_sent_by || '',
    estimateDecidedAt: job.estimateDecidedAt || job.estimate_decided_at || null,
    estimateDecidedBy: job.estimateDecidedBy || job.estimate_decided_by || '',
    estimateDecisionSource: job.estimateDecisionSource || job.estimate_decision_source || 'staff',
    estimateDecisionLinkId: job.estimateDecisionLinkId || job.estimate_decision_link_id || '',
    estimateStatusNote: job.estimateStatusNote || job.estimate_status_note || '',
    estimateLastRequestId: job.estimateLastRequestId || job.estimate_last_request_id || '',
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

export function normalizeWorkLog(log) {
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

export function normalizeTechDetails(techDetails = {}, instrumentType = 'Guitar') {
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
    tax: techDetails.tax && typeof techDetails.tax === 'object' && Object.keys(techDetails.tax).length > 0
      ? { ...defaultTechDetails.tax, ...techDetails.tax }
      : {},
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

export function normalizeContactDetails(contact = {}, source = {}) {
  const sourcePhone = firstPresentValue(source, ['phone']);
  const sourceEmail = firstPresentValue(source, ['email']);
  const sourceEmailOptIn = firstPresentValue(source, ['emailOptIn', 'email_opt_in']);
  const sourceSmsOptIn = firstPresentValue(source, ['smsOptIn', 'sms_opt_in']);
  const sourcePreferredContactMethod = firstPresentValue(source, ['preferredContactMethod', 'preferred_contact_method']);
  const sourceAddressLine1 = firstPresentValue(source, ['addressLine1', 'address_line1', 'address']);
  const sourceCity = firstPresentValue(source, ['city']);
  const sourceRegion = firstPresentValue(source, ['region', 'state']);
  const sourcePostalCode = firstPresentValue(source, ['postalCode', 'postal_code', 'zipCode', 'zip_code']);
  const postalCode = sourcePostalCode ?? contact.postalCode ?? contact.postal_code ?? contact.zipCode ?? contact.zip_code ?? '';

  return {
    phone: sourcePhone ?? contact.phone ?? '',
    email: sourceEmail ?? contact.email ?? '',
    emailOptIn: Boolean(sourceEmailOptIn ?? contact.emailOptIn ?? contact.email_opt_in),
    smsOptIn: Boolean(sourceSmsOptIn ?? contact.smsOptIn ?? contact.sms_opt_in),
    preferredContactMethod: sourcePreferredContactMethod ?? contact.preferredContactMethod ?? contact.preferred_contact_method ?? 'email',
    addressLine1: sourceAddressLine1 ?? contact.addressLine1 ?? contact.address_line1 ?? contact.address ?? '',
    city: sourceCity ?? contact.city ?? '',
    region: sourceRegion ?? contact.region ?? contact.state ?? '',
    postalCode: String(postalCode || '').trim()
  };
}

export function firstPresentValue(source = {}, keys = []) {
  const matchingKey = keys.find((key) => Object.prototype.hasOwnProperty.call(source, key));
  return matchingKey === undefined ? undefined : source[matchingKey];
}

const damageMapStoragePathKeys = [
  'storagePath',
  'storage_path',
  'imagePath',
  'image_path',
  'photoPath',
  'photo_path'
];
const damageMapViewUrlKeys = ['imageUrl', 'image_url', 'url', 'public_url', 'publicUrl', 'photoUrl', 'photo_url'];
const damageMapMarkUrlKeys = ['photoUrl', 'photo_url', 'url', 'public_url', 'publicUrl', 'imageUrl', 'image_url'];

export function getFirstDamageMapString(source = {}, keys = []) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return '';
}

export function getDamageMapPhotoSource(source = {}, urlKeys = []) {
  const url = getFirstDamageMapString(source, urlKeys);
  const explicitStoragePath = getFirstDamageMapString(source, damageMapStoragePathKeys);

  return {
    url,
    storagePath: getJobImageStoragePath({ storagePath: explicitStoragePath, url })
  };
}

export function getDamageMapViewPhotoSource(view = {}) {
  return getDamageMapPhotoSource(view, damageMapViewUrlKeys);
}

export function getDamageMapMarkPhotoSource(mark = {}) {
  return getDamageMapPhotoSource(mark, damageMapMarkUrlKeys);
}

export function normalizeDamageMap(damageMap = {}) {
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

export function normalizeDamageView(view = {}, marks = []) {
  const { storagePath, url } = getDamageMapViewPhotoSource(view);

  return {
    imageUrl: url,
    imageName: view.imageName || view.image_name || view.photoName || view.photo_name || '',
    imageId: view.imageId || view.image_id || view.photoId || view.photo_id || '',
    storagePath,
    marks: marks.map(normalizeDamageMark)
  };
}

export function normalizeDamageMark(mark) {
  const { storagePath, url } = getDamageMapMarkPhotoSource(mark);

  return {
    id: mark.id || crypto.randomUUID(),
    area: mark.area || 'Body',
    severity: normalizeSeverity(mark.severity),
    note: mark.note || '',
    recommendedRepair: mark.recommendedRepair || '',
    photoUrl: url,
    photoName: mark.photoName || mark.photo_name || mark.imageName || mark.image_name || '',
    photoId: mark.photoId || mark.photo_id || mark.imageId || mark.image_id || '',
    storagePath,
    x: Number(mark.x) || 0,
    y: Number(mark.y) || 0
  };
}

export function normalizeSeverity(severity) {
  if (severity === 'Critical' || severity === 'Structural' || severity === 'Cosmetic') {
    return severity;
  }
  if (severity === 'Severe') return 'Critical';
  if (severity === 'Moderate') return 'Structural';
  return 'Cosmetic';
}

export function normalizeNeckInspection(neckInspection = {}) {
  return {
    initial: normalizeNeckStage(neckInspection.initial),
    final: normalizeNeckStage(neckInspection.final)
  };
}

export function normalizeNeckStage(stage = {}) {
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

export function normalizePayment(payment) {
  return {
    id: payment.id || crypto.randomUUID(),
    date: payment.date || toIsoDateInputValue(),
    amount: payment.amount ?? '',
    type: ['refund', 'void'].includes(String(payment.type || payment.eventType || '').toLowerCase())
      ? String(payment.type || payment.eventType).toLowerCase()
      : 'payment',
    method: payment.method || 'Cash',
    note: payment.note || '',
    appliesToPaymentId: payment.appliesToPaymentId || payment.applies_to_payment_id || '',
    originalAmount: payment.originalAmount ?? payment.original_amount ?? null,
    remainingAfter: payment.remainingAfter ?? payment.remaining_after ?? null,
    recordedAt: payment.recordedAt || payment.recorded_at || '',
    recordedBy: payment.recordedBy || payment.recorded_by || ''
  };
}

export function normalizeIntakeType(intakeType) {
  return normalizeJobSource(intakeType);
}

export function normalizePart(part) {
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

export function normalizeService(service) {
  return {
    id: service.id || crypto.randomUUID(),
    jobId: service.jobId || service.job_id || '',
    description: service.description || '',
    quantity: normalizeServiceQuantity(service.quantity),
    cost: Number(service.cost || 0),
    retail: Number(service.retail || 0),
    createdAt: service.createdAt || service.created_at || new Date().toISOString()
  };
}

export function normalizeImage(image) {
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

export function sanitizeJobForPersistence(job) {
  return {
    ...job,
    images: (job.images || []).map(sanitizeJobImageForPersistence),
    techDetails: sanitizeTechDetailsForPersistence(job.techDetails)
  };
}

export function sanitizeJobImageForPersistence(image = {}) {
  const storagePath = getJobImageStoragePath(image);

  return {
    ...image,
    url: getPersistableJobImageUrl({ ...image, storagePath }),
    storagePath
  };
}

export function sanitizeTechDetailsForPersistence(techDetails = {}) {
  return {
    ...techDetails,
    damageMap: sanitizeDamageMapForPersistence(techDetails.damageMap)
  };
}

export function sanitizeDamageMapForPersistence(damageMap) {
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

export function sanitizeDamageViewForPersistence(view = {}) {
  const { storagePath, url } = getDamageMapViewPhotoSource(view);

  return {
    ...view,
    imageUrl: getPersistableJobImageUrl({ url, storagePath }),
    storagePath,
    marks: (view.marks || []).map(sanitizeDamageMarkForPersistence)
  };
}

export function sanitizeDamageMarkForPersistence(mark = {}) {
  const { storagePath, url } = getDamageMapMarkPhotoSource(mark);

  return {
    ...mark,
    photoUrl: getPersistableJobImageUrl({ url, storagePath }),
    storagePath
  };
}

export function parseDailySequence(sequenceValue, jobNumber = '') {
  const explicitSequence = Number(sequenceValue || 0);
  if (explicitSequence > 0) {
    return explicitSequence;
  }

  const match = String(jobNumber || '').match(/-(\d{3})$/);
  return match ? Number(match[1]) : null;
}

export function toDbJob(job, { includeAssignment = false } = {}) {
  const shopId = getActiveShopId(job.shopId);
  const payload = {
    ...toLegacyDbJob(job),
    customer_id: job.customerId || null,
    job_date: job.jobDate || job.dateReceived || null,
    drop_off_at: job.dropOffAt ? new Date(job.dropOffAt).toISOString() : null,
    promise_date: job.promiseDate || null,
    priority: normalizeJobPriority(job.priority),
    job_day_code: job.jobDayCode || getJobDayCode(job.jobDate || job.dateReceived),
    daily_sequence: job.dailySequence || null,
    shop_id: shopId,
    status: job.status || 'Checked In'
  };
  if (includeAssignment) {
    payload.assigned_member_id = job.assignedMemberId || null;
  }
  return payload;
}

export function toLegacyDbJob(job) {
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
    drop_off_at: job.dropOffAt ? new Date(job.dropOffAt).toISOString() : null,
    job_number: job.jobNumber || '',
    status: toLegacyJobStatus(job.status),
    tech_details: {
      ...techDetails,
      contact,
      instrumentType,
      dropOffAt: job.dropOffAt ? new Date(job.dropOffAt).toISOString() : '',
      includedPartIds: (job.parts || []).filter((part) => part.includedInService).map((part) => part.id),
      discountType: job.discountType || 'none',
      discountValue: job.discountValue ?? ''
    },
    created_at: job.createdAt,
    updated_at: job.updatedAt
  };
}

export function toLegacyJobStatus(status) {
  const legacyStatuses = {
    'Checked In': 'Intake',
    'Drop Off': 'Intake',
    'On Bench': 'In Progress',
    'Waiting Parts': 'Waiting Parts',
    Completed: 'Completed',
    'Picked Up': 'Picked up',
    Cancelled: 'Intake'
  };

  return legacyStatuses[status] || status || 'Intake';
}

export function fromDbJob(job) {
  return normalizeJob({
    id: job.id,
    documentType: job.tech_details?.documentType || job.tech_details?.document_type || 'work_order',
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
    dropOffAt: job.drop_off_at || '',
    promiseDate: job.promise_date || '',
    priority: normalizeJobPriority(job.priority || job.tech_details?.priority),
    jobDate: job.job_date || job.date_received || '',
    jobDayCode: job.job_day_code || '',
    dailySequence: job.daily_sequence || null,
    shopId: getActiveShopId(job.shop_id),
    assignedMemberId: job.assigned_member_id || '',
    assignedMemberDisplayName: job.assigned_member_display_name || '',
    assignmentUpdatedAt: job.assignment_updated_at || null,
    jobNumber: job.job_number || '',
    status: job.status || 'Checked In',
    accountingVoidedAt: job.accounting_voided_at || null,
    accountingVoidedBy: job.accounting_voided_by || '',
    accountingVoidReason: job.accounting_void_reason || '',
    estimateStatus: job.estimate_status || 'draft',
    estimateSnapshot: job.estimate_snapshot || null,
    estimateRevision: Number(job.estimate_revision || 0),
    estimateSentAt: job.estimate_sent_at || null,
    estimateSentBy: job.estimate_sent_by || '',
    estimateDecidedAt: job.estimate_decided_at || null,
    estimateDecidedBy: job.estimate_decided_by || '',
    estimateDecisionSource: job.estimate_decision_source || 'staff',
    estimateDecisionLinkId: job.estimate_decision_link_id || '',
    estimateStatusNote: job.estimate_status_note || '',
    estimateLastRequestId: job.estimate_last_request_id || '',
    invoiceFinalizedAt: job.invoice_finalized_at || null,
    invoiceFinalizedBy: job.invoice_finalized_by || '',
    invoiceNumber: Number(job.invoice_number || 0) || null,
    invoiceSnapshot: job.invoice_snapshot || null,
    invoiceRevision: Number(job.invoice_revision || 0),
    invoiceFinalizationReason: job.invoice_finalization_reason || '',
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
      quantity: normalizeServiceQuantity(service.quantity),
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

export async function hydrateJobImageUrls(job) {
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

export async function hydrateDamageMapImageUrls(damageMap) {
  if (!damageMap?.views) {
    return damageMap;
  }

  const hydratedViews = {};
  for (const [viewName, view] of Object.entries(damageMap.views)) {
    const { storagePath: viewStoragePath, url: viewUrl } = getDamageMapViewPhotoSource(view);
    const viewImageUrl = await resolveJobImageUrl({
      storagePath: viewStoragePath,
      url: viewUrl,
      imageId: view.imageId
    });

    const marks = await Promise.all((view.marks || []).map(async (mark) => {
      const { storagePath: markStoragePath, url: markUrl } = getDamageMapMarkPhotoSource(mark);

      return {
        ...mark,
        storagePath: markStoragePath,
        photoUrl: await resolveJobImageUrl({
          storagePath: markStoragePath,
          url: markUrl,
          imageId: mark.photoId
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

export function upsertById(items, item) {
  const exists = items.some((current) => current.id === item.id);
  if (exists) {
    return items.map((current) => (current.id === item.id ? item : current));
  }
  return [item, ...items];
}

export function instrumentLabel(job) {
  return [job.guitarBrand, job.model].filter(Boolean).join(' ') || normalizeInstrumentType(job.instrumentType);
}

export function fromDbJobEvent(event) {
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
