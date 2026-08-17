import { normalizeInstrumentType } from '../instruments/instrumentService.js';
import { normalizeJobPriority } from '../jobs/jobPriority.js';
import { normalizeKeyboardChecklist } from './keyboardDiagnostics.js';

export const KEYBOARD_TYPES = [
  'Synthesizer',
  'Digital Piano',
  'Stage Piano',
  'Workstation',
  'Arranger',
  'MIDI Controller',
  'Electric Piano',
  'Organ',
  'Other'
];

export const KEYBOARD_KEY_COUNTS = ['25', '32', '37', '44', '49', '61', '73', '76', '88', 'Other'];
export const KEYBOARD_ACTIONS = ['Synth action', 'Semi-weighted', 'Hammer action', 'Graded hammer', 'Waterfall', 'Unknown', 'Other'];
export const KEYBOARD_FINAL_TEST_STATUSES = ['Not tested', 'Passed', 'Failed', 'Needs follow-up'];
export const KEYBOARD_FUNCTION_TEST_STATUSES = ['Not tested', 'Passed', 'Failed', 'Not applicable'];

export const KEYBOARD_FUNCTION_TESTS = [
  ['keys', 'Keys and key return'],
  ['velocity', 'Velocity response'],
  ['aftertouch', 'Aftertouch'],
  ['pitchMod', 'Pitch / modulation controls'],
  ['panelControls', 'Buttons, knobs, and faders'],
  ['display', 'Display and indicators'],
  ['audioOutputs', 'Main audio outputs'],
  ['headphones', 'Headphone output'],
  ['internalSpeakers', 'Internal speakers'],
  ['midiDin', 'MIDI DIN'],
  ['usb', 'USB data / host'],
  ['pedalInputs', 'Pedal inputs'],
  ['memory', 'Patch memory / storage'],
  ['power', 'Power and startup']
];

export const DEFAULT_KEYBOARD_FUNCTION_STAGE = Object.fromEntries(
  KEYBOARD_FUNCTION_TESTS.map(([key]) => [key, 'Not tested'])
);

export const DEFAULT_KEYBOARD_DETAILS = {
  keyboardType: 'Synthesizer',
  keyCount: '61',
  keyAction: 'Unknown',
  sensorTechnology: 'Unknown',
  lowestMidiNote: '',
  soundEngine: '',
  powerRequirements: '',
  includedAccessories: '',
  firmwareVersion: '',
  osVersion: '',
  affectedKeys: '',
  keybedNotes: '',
  powerSupplyReadings: '',
  midiDiagnosticSummary: '',
  midiDiagnosticLog: '',
  diagnosis: '',
  repairPerformed: '',
  partsReplaced: '',
  cleaningPerformed: '',
  calibrationNotes: '',
  initialTestNotes: '',
  finalTestNotes: '',
  finalTestStatus: 'Not tested',
  functionalTests: {
    initial: DEFAULT_KEYBOARD_FUNCTION_STAGE,
    final: DEFAULT_KEYBOARD_FUNCTION_STAGE
  },
  diagnosticChecklist: normalizeKeyboardChecklist({}, 'Synthesizer')
};

export function isKeyboardJob(job = {}) {
  return normalizeInstrumentType(job.instrumentType || job.techDetails?.instrumentType) === 'Keyboard';
}

export function normalizeKeyboardDetails(details = {}) {
  const source = details && typeof details === 'object' ? details : {};
  return {
    ...DEFAULT_KEYBOARD_DETAILS,
    ...source,
    diagnosticChecklist: normalizeKeyboardChecklist(source.diagnosticChecklist, source.keyboardType || DEFAULT_KEYBOARD_DETAILS.keyboardType),
    functionalTests: {
      initial: {
        ...DEFAULT_KEYBOARD_FUNCTION_STAGE,
        ...(source.functionalTests?.initial || {})
      },
      final: {
        ...DEFAULT_KEYBOARD_FUNCTION_STAGE,
        ...(source.functionalTests?.final || {})
      }
    }
  };
}

export function buildKeyboardJobDraft(values = {}, customer = null) {
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
    instrumentType: 'Keyboard',
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
      instrumentType: 'Keyboard',
      stringCount: 0,
      stringGauges: [],
      priority: normalizeJobPriority(values.priority),
      instrumentYear: String(values.instrumentYear || '').trim(),
      keyboard: normalizeKeyboardDetails({
        keyboardType: values.keyboardType,
        keyCount: values.keyCount,
        keyAction: values.keyAction,
        sensorTechnology: values.sensorTechnology,
        includedAccessories: values.includedAccessories
      })
    },
    workLog: [],
    parts: [],
    services: [],
    labor: [],
    images: []
  };
}

export function filterKeyboardJobs(jobs = [], search = '', includeClosed = false) {
  const query = String(search || '').trim().toLowerCase();
  return jobs
    .filter(isKeyboardJob)
    .filter((job) => includeClosed || !['completed', 'picked up', 'cancelled', 'archived'].includes(String(job.status || '').trim().toLowerCase()))
    .filter((job) => !query || [
      job.jobNumber,
      job.customerName,
      job.guitarBrand,
      job.model,
      job.serial,
      job.reasonForVisit,
      job.status,
      job.techDetails?.keyboard?.affectedKeys
    ].some((value) => String(value || '').toLowerCase().includes(query)))
    .sort((left, right) => new Date(right.dateReceived || right.createdAt || 0) - new Date(left.dateReceived || left.createdAt || 0));
}
