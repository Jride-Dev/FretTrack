import { normalizeInstrumentType } from '../instruments/instrumentService.js';
import { normalizeJobPriority } from '../jobs/jobPriority.js';

export const AMPLIFIER_TYPES = ['Combo', 'Head', 'Cabinet', 'Rack', 'Other'];
export const AMPLIFIER_TECHNOLOGIES = ['Tube', 'Solid State', 'Hybrid', 'Modeling / Digital', 'Unknown', 'Other'];
export const AMPLIFIER_FINAL_TEST_STATUSES = ['Not tested', 'Passed', 'Failed', 'Needs follow-up'];

export const DEFAULT_AMPLIFIER_MEASUREMENT_STAGE = {
  acMainsVoltageV: '',
  mainsFrequencyHz: '',
  bPlusStandbyV: '',
  bPlusOperatingV: '',
  powerTubePlateVoltageV: '',
  biasCurrentMa: '',
  plateDissipationW: '',
  outputTransformerPrimaryOhms: '',
  outputTransformerSecondaryOhms: '',
  speakerVoiceCoilOhms: '',
  powerResistorReadings: '',
  preampStageVoltages: '',
  testLoadOhms: '',
  signalFrequencyHz: '',
  signalInputMv: '',
  cleanOutputWatts: '',
  clippingOutputWatts: '',
  measurementNotes: ''
};

export const DEFAULT_AMPLIFIER_DIGITAL_DIAGNOSTICS = {
  firmwareVersion: '',
  softwareVersion: '',
  factoryResetStatus: 'Not performed',
  customerTriggerConditions: '',
  digitalDiagnosticNotes: ''
};

export const DEFAULT_AMPLIFIER_DETAILS = {
  amplifierType: 'Combo',
  technology: 'Unknown',
  powerWatts: '',
  channels: '',
  speakerConfiguration: '',
  speakerImpedanceOhms: '',
  mainsVoltage: '',
  tubeComplement: '',
  safetyNotes: '',
  diagnosis: '',
  repairPerformed: '',
  partsReplaced: '',
  benchTestNotes: '',
  finalTestStatus: 'Not tested',
  electricalMeasurements: {
    initial: DEFAULT_AMPLIFIER_MEASUREMENT_STAGE,
    final: DEFAULT_AMPLIFIER_MEASUREMENT_STAGE
  },
  digitalDiagnostics: DEFAULT_AMPLIFIER_DIGITAL_DIAGNOSTICS
};

export function isAmplifierJob(job = {}) {
  return normalizeInstrumentType(job.instrumentType || job.techDetails?.instrumentType) === 'Amplifier';
}

export function normalizeAmplifierDetails(details = {}) {
  const source = details && typeof details === 'object' ? details : {};
  return {
    ...DEFAULT_AMPLIFIER_DETAILS,
    ...source,
    electricalMeasurements: {
      initial: {
        ...DEFAULT_AMPLIFIER_MEASUREMENT_STAGE,
        ...(source.electricalMeasurements?.initial || {})
      },
      final: {
        ...DEFAULT_AMPLIFIER_MEASUREMENT_STAGE,
        ...(source.electricalMeasurements?.final || {})
      }
    },
    digitalDiagnostics: {
      ...DEFAULT_AMPLIFIER_DIGITAL_DIAGNOSTICS,
      ...(source.digitalDiagnostics || {})
    }
  };
}

export function buildAmplifierJobDraft(values = {}, customer = null) {
  const customerName = String(
    values.customerName
      || customer?.displayName
      || customer?.customerName
      || [values.customerFirstName, values.customerLastName].filter(Boolean).join(' ')
  ).trim();
  const customerFirstName = values.customerFirstName || customer?.customerFirstName || customer?.firstName || customerName.split(/\s+/)[0] || '';
  const customerLastName = values.customerLastName || customer?.customerLastName || customer?.lastName || customerName.split(/\s+/).slice(1).join(' ');

  return {
    customerId: values.customerId || customer?.id || '',
    customerName,
    customerFirstName,
    customerLastName,
    phone: values.phone || customer?.phone || '',
    email: values.email || customer?.email || '',
    emailOptIn: Boolean(customer?.emailOptIn),
    smsOptIn: Boolean(customer?.smsOptIn),
    preferredContactMethod: customer?.preferredContactMethod || 'email',
    addressLine1: customer?.addressLine1 || '',
    city: customer?.city || '',
    region: customer?.region || '',
    postalCode: String(customer?.postalCode || '').trim(),
    instrumentType: 'Amplifier',
    guitarBrand: String(values.guitarBrand || '').trim(),
    model: String(values.model || '').trim(),
    serial: String(values.serial || '').trim(),
    color: '',
    reasonForVisit: String(values.reasonForVisit || '').trim(),
    dateReceived: values.dateReceived || '',
    promiseDate: values.promiseDate || '',
    priority: normalizeJobPriority(values.priority),
    status: 'Checked In',
    techDetails: {
      instrumentType: 'Amplifier',
      stringCount: 0,
      stringGauges: [],
      priority: normalizeJobPriority(values.priority),
      instrumentYear: String(values.instrumentYear || '').trim(),
      amplifier: normalizeAmplifierDetails({
        amplifierType: values.amplifierType,
        technology: values.technology
      })
    },
    workLog: [],
    parts: [],
    services: [],
    labor: [],
    images: []
  };
}

export function filterAmplifierJobs(jobs = [], search = '', includeClosed = false) {
  const query = String(search || '').trim().toLowerCase();
  return jobs
    .filter(isAmplifierJob)
    .filter((job) => includeClosed || !['completed', 'picked up', 'cancelled', 'archived'].includes(String(job.status || '').trim().toLowerCase()))
    .filter((job) => !query || [
      job.jobNumber,
      job.customerName,
      job.guitarBrand,
      job.model,
      job.serial,
      job.reasonForVisit,
      job.status
    ].some((value) => String(value || '').toLowerCase().includes(query)))
    .sort((left, right) => new Date(right.dateReceived || right.createdAt || 0) - new Date(left.dateReceived || left.createdAt || 0));
}
