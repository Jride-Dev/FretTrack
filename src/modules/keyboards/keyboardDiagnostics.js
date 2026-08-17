import { money } from '../../shared/utils/money.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const KEYBOARD_SENSOR_TECHNOLOGIES = [
  'Rubber contact strip',
  'Dual contact',
  'Triple sensor',
  'Optical',
  'Hall effect',
  'Capacitive',
  'Mechanical switch',
  'Unknown',
  'Other'
];

export const KEYBOARD_FAULTS = [
  { code: 'stuck_key', label: 'Stuck Key', category: 'Mechanical', damageStatus: 'structural', overlayTone: 'mechanical', partKeywords: ['key', 'spring', 'bushing'] },
  { code: 'stuck_note', label: 'Stuck Note', category: 'Electrical', damageStatus: 'electrical', overlayTone: 'dead', partKeywords: ['rubber contact', 'contact strip', 'sensor'], defaultGroupSize: 12 },
  { code: 'slow_return', label: 'Slow Key Return', category: 'Mechanical', partKeywords: ['spring', 'felt', 'bushing'] },
  { code: 'uneven_key_height', label: 'Uneven Key Height', category: 'Mechanical', partKeywords: ['felt', 'balance rail', 'key'] },
  { code: 'broken_keytop', label: 'Broken Keytop', category: 'Physical', damageStatus: 'structural', overlayTone: 'dead', partKeywords: ['keytop', 'replacement key', 'key'], defaultGroupSize: 1 },
  { code: 'broken_stem', label: 'Broken Key Stem', category: 'Physical', damageStatus: 'structural', overlayTone: 'dead', partKeywords: ['replacement key', 'key stem', 'key'], defaultGroupSize: 1 },
  { code: 'cracked_key_hinge', label: 'Cracked Key Hinge', category: 'Physical', partKeywords: ['key', 'hinge'] },
  { code: 'noisy_key', label: 'Noisy Key', category: 'Mechanical', partKeywords: ['felt', 'grease', 'bushing'] },
  { code: 'dead_key', label: 'Dead Key', category: 'Electrical', damageStatus: 'electrical', overlayTone: 'dead', partKeywords: ['rubber contact', 'contact strip', 'sensor'], defaultGroupSize: 12 },
  { code: 'no_trigger', label: 'No Trigger', category: 'Electrical', damageStatus: 'electrical', overlayTone: 'dead', partKeywords: ['rubber contact', 'contact strip', 'sensor'], defaultGroupSize: 12 },
  { code: 'zero_velocity', label: 'Zero Velocity Trigger', category: 'Sensor', damageStatus: 'electrical', overlayTone: 'dead', partKeywords: ['rubber contact', 'contact strip', 'sensor'], defaultGroupSize: 12 },
  { code: 'missing_note_off', label: 'Missing Note Off', category: 'Electrical', damageStatus: 'electrical', overlayTone: 'dead', partKeywords: ['rubber contact', 'contact strip', 'sensor'], defaultGroupSize: 12 },
  { code: 'intermittent_key', label: 'Intermittent Key', category: 'Electrical', partKeywords: ['rubber contact', 'contact strip', 'ribbon'] },
  { code: 'velocity_spike', label: 'Velocity Spike', category: 'Sensor', partKeywords: ['rubber contact', 'contact strip', 'sensor'] },
  { code: 'velocity_dropout', label: 'Velocity Dropout', category: 'Sensor', partKeywords: ['rubber contact', 'contact strip', 'sensor'] },
  { code: 'dead_rubber_contact', label: 'Dead Rubber Contact', category: 'Sensor', partKeywords: ['rubber contact', 'contact strip'] },
  { code: 'double_trigger', label: 'Double Trigger', category: 'Sensor', partKeywords: ['rubber contact', 'contact strip', 'sensor'] },
  { code: 'aftertouch_fault', label: 'Aftertouch Fault', category: 'Sensor', partKeywords: ['aftertouch', 'pressure strip', 'sensor'] },
  { code: 'contact_contamination', label: 'Contact Contamination', category: 'Electrical', partKeywords: ['contact cleaner', 'contact strip'] },
  { code: 'spring_failure', label: 'Spring Failure', category: 'Mechanical', partKeywords: ['spring'] },
  { code: 'keybed_frame_damage', label: 'Keybed Frame Damage', category: 'Physical', partKeywords: ['keybed', 'frame'] },
  { code: 'diode_matrix_fault', label: 'Diode Matrix Fault', category: 'Electrical', partKeywords: ['diode', 'key scan board'] },
  { code: 'ribbon_cable_fault', label: 'Ribbon Cable Fault', category: 'Electrical', partKeywords: ['ribbon cable', 'ffc', 'connector'] },
  { code: 'connector_fault', label: 'Connector Fault', category: 'Electrical', partKeywords: ['connector', 'header', 'ribbon'] },
  { code: 'other', label: 'Other', category: 'Other', partKeywords: [] }
];

export const KEYBOARD_CHECKLIST_STATUSES = ['Not checked', 'Passed', 'Attention', 'Not applicable'];

const COMMON_CHECKLIST = [
  ['intake_visual', 'Document exterior, key height, accessories, and existing damage'],
  ['power_supply', 'Verify adapter, inlet, protection, and power rails under load'],
  ['key_sweep', 'Run a slow and fast full-key sweep for trigger and velocity consistency'],
  ['midi_capture', 'Capture MIDI note, velocity, and aftertouch evidence where supported'],
  ['ribbon_connectors', 'Inspect keybed ribbon cables, locking tabs, and connectors'],
  ['diode_matrix', 'Check the key-scan diode matrix or scan board around grouped failures'],
  ['outputs_controls', 'Verify audio outputs, controls, pedals, MIDI, and USB'],
  ['final_burn_in', 'Complete final functional test and burn-in before release']
];

export const KEYBOARD_DIAGNOSTIC_CHECKLISTS = {
  piano: {
    label: 'Digital / Stage Piano',
    types: ['Digital Piano', 'Stage Piano', 'Electric Piano'],
    items: [
      ...COMMON_CHECKLIST,
      ['hammer_action', 'Inspect hammer action, key bushings, felts, and return mechanism'],
      ['speaker_system', 'Check internal amplifiers, speakers, and cabinet vibration']
    ]
  },
  synth: {
    label: 'Synth / Workstation / Arranger',
    types: ['Synthesizer', 'Workstation', 'Arranger'],
    items: [
      ...COMMON_CHECKLIST,
      ['panel_scan', 'Exercise encoders, pots, sliders, switches, display, and patch memory'],
      ['firmware_storage', 'Record firmware and verify removable/internal storage behavior']
    ]
  },
  controller: {
    label: 'MIDI Controller',
    types: ['MIDI Controller'],
    items: [
      ...COMMON_CHECKLIST,
      ['host_matrix', 'Test supported USB hosts, MIDI DIN paths, zones, and controller mapping'],
      ['bus_power', 'Verify bus-powered startup and current-related disconnect behavior']
    ]
  },
  organ: {
    label: 'Organ / Waterfall Keybed',
    types: ['Organ'],
    items: [
      ...COMMON_CHECKLIST,
      ['waterfall_action', 'Inspect waterfall action, key combs, contacts, and multi-contact triggering'],
      ['expression_rotary', 'Verify expression, rotary controls, drawbars, and pedal inputs']
    ]
  },
  general: {
    label: 'General Keyboard',
    types: ['Other'],
    items: COMMON_CHECKLIST
  }
};

export function midiNoteLabel(midiNote) {
  const note = Number(midiNote);
  if (!Number.isInteger(note) || note < 0 || note > 127) return '';
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

export function isBlackMidiNote(midiNote) {
  return [1, 3, 6, 8, 10].includes(Number(midiNote) % 12);
}

export function keyboardMidiRange(keyCount = '61', lowestMidiNote = '') {
  const count = Number.parseInt(keyCount, 10);
  const defaultStarts = { 25: 48, 32: 41, 37: 36, 44: 29, 49: 36, 61: 36, 73: 28, 76: 28, 88: 21 };
  const safeCount = Number.isInteger(count) && count > 0 && count <= 128 ? count : 61;
  const requestedStart = Number.parseInt(lowestMidiNote, 10);
  const start = Number.isInteger(requestedStart) && requestedStart >= 0 && requestedStart + safeCount <= 128
    ? requestedStart
    : (defaultStarts[safeCount] ?? Math.max(0, 60 - Math.floor(safeCount / 2)));
  return Array.from({ length: safeCount }, (_, index) => start + index);
}

export function getKeyboardFault(code = '', faultCodes = KEYBOARD_FAULTS) {
  return faultCodes.find((fault) => fault.code === code) || KEYBOARD_FAULTS.find((fault) => fault.code === code) || KEYBOARD_FAULTS.at(-1);
}

export function getKeyboardChecklist(keyboardType = '') {
  return Object.entries(KEYBOARD_DIAGNOSTIC_CHECKLISTS)
    .find(([, checklist]) => checklist.types.includes(keyboardType))
    || ['general', KEYBOARD_DIAGNOSTIC_CHECKLISTS.general];
}

export function normalizeKeyboardChecklist(checklist = {}, keyboardType = '') {
  const [recommendedKey, definition] = getKeyboardChecklist(keyboardType);
  const templateKey = KEYBOARD_DIAGNOSTIC_CHECKLISTS[checklist.templateKey] ? checklist.templateKey : recommendedKey;
  const selected = KEYBOARD_DIAGNOSTIC_CHECKLISTS[templateKey];
  const sourceItems = checklist.items && typeof checklist.items === 'object' ? checklist.items : {};
  return {
    templateKey,
    items: Object.fromEntries(selected.items.map(([id]) => [id, {
      status: KEYBOARD_CHECKLIST_STATUSES.includes(sourceItems[id]?.status) ? sourceItems[id].status : 'Not checked',
      notes: String(sourceItems[id]?.notes || '')
    }]))
  };
}

export function findKeyboardInventoryMatches(parts = [], faultCode = '', context = {}) {
  const fault = getKeyboardFault(faultCode, context.faultCodes);
  const keywords = fault.partKeywords || [];
  const compatibilityRows = (context.compatibilities || []).filter((row) => row.faultCode === faultCode);
  return parts
    .map((part) => {
      const haystack = [part.name, part.sku, part.category, part.description, part.manufacturer, part.partNumber]
        .join(' ')
        .toLowerCase();
      const compatibility = compatibilityRows.find((row) => {
        if (row.partId !== part.id) return false;
        if (row.noteName && row.noteName.toLowerCase() !== String(context.noteName || '').toLowerCase()) return false;
        if (row.keyColor && row.keyColor !== 'any' && row.keyColor !== context.keyColor) return false;
        if (row.manufacturer && !String(context.manufacturer || '').toLowerCase().includes(row.manufacturer.toLowerCase())) return false;
        if (row.modelPattern && !String(context.model || '').toLowerCase().includes(row.modelPattern.toLowerCase())) return false;
        if (row.startKeyIndex != null && Number(context.keyIndex) < row.startKeyIndex) return false;
        if (row.endKeyIndex != null && Number(context.keyIndex) > row.endKeyIndex) return false;
        return true;
      });
      const keywordScore = keywords.reduce((total, keyword) => total + (haystack.includes(keyword) ? 1 : 0), 0);
      const pitchClass = String(context.noteName || '').replace(/-?\d+$/, '').toLowerCase();
      const exactKeyHeuristic = /replacement\s+key|keytop/.test(haystack)
        && pitchClass
        && [`white ${pitchClass}`, `black ${pitchClass}`, `key ${pitchClass}`, `keytop ${pitchClass}`].some((label) => haystack.includes(label));
      const inferredCompatibility = compatibility || (exactKeyHeuristic ? {
        partScope: 'single_key', groupSize: 1, noteName: context.noteName, inferred: true
      } : fault.defaultGroupSize > 1 && keywordScore ? {
        partScope: 'key_group', groupSize: fault.defaultGroupSize, inferred: true
      } : null);
      return { part: { ...part, keyboardCompatibility: inferredCompatibility }, score: (compatibility ? 100 : exactKeyHeuristic ? 50 : 0) + keywordScore };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || right.part.quantityOnHand - left.part.quantityOnHand)
    .slice(0, 8)
    .map(({ part }) => part);
}

function noteNameToMidi(noteName = '') {
  const match = String(noteName).trim().match(/^([A-Ga-g])([#b]?)(-?\d)$/);
  if (!match) return null;
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase()];
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const midiNote = (Number(match[3]) + 1) * 12 + natural + accidental;
  return midiNote >= 0 && midiNote <= 127 ? midiNote : null;
}

function parseMidiNoteFromLine(line = '') {
  const numeric = line.match(/\b(?:note|key)\s*[:=]?\s*(\d{1,3})\b/i);
  if (numeric) {
    const note = Number(numeric[1]);
    return note >= 0 && note <= 127 ? note : null;
  }
  const named = line.match(/\b([A-Ga-g][#b]?-?\d)\b/);
  return named ? noteNameToMidi(named[1]) : null;
}

export function parseMidiDiagnosticLog(rawLog = '') {
  const activeNotes = new Map();
  const findings = new Map();
  const addFinding = (midiNote, faultCode, notes) => {
    const existing = findings.get(midiNote);
    const priority = { zero_velocity: 1, missing_note_off: 2 };
    if (existing && priority[existing.faultCode] > priority[faultCode]) return;
    findings.set(midiNote, {
      midiNote,
      noteName: midiNoteLabel(midiNote),
      faultCode,
      damageStatus: 'electrical',
      notes: existing ? `${existing.notes} ${notes}` : notes
    });
  };

  String(rawLog || '').split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const isNoteOn = /\bnote[_\s-]?on\b/i.test(line);
    const isNoteOff = /\bnote[_\s-]?off\b/i.test(line);
    if (!isNoteOn && !isNoteOff) return;
    const midiNote = parseMidiNoteFromLine(line);
    if (midiNote == null) return;
    const velocityMatch = line.match(/\b(?:velocity|vel)\s*[:=]?\s*(\d{1,3})\b/i);
    const velocity = velocityMatch ? Number(velocityMatch[1]) : null;

    if (isNoteOff || (isNoteOn && velocity === 0)) {
      if (activeNotes.has(midiNote)) activeNotes.delete(midiNote);
      else if (isNoteOn && velocity === 0) addFinding(midiNote, 'zero_velocity', `Line ${index + 1}: note-on arrived with zero velocity and no matching active note.`);
      return;
    }
    if (isNoteOn) activeNotes.set(midiNote, index + 1);
  });

  activeNotes.forEach((lineNumber, midiNote) => {
    addFinding(midiNote, 'missing_note_off', `Line ${lineNumber}: note-on has no matching note-off in the pasted capture.`);
  });
  return [...findings.values()].sort((left, right) => left.midiNote - right.midiNote);
}

export function buildKeyboardRepairAnalytics(jobs = [], keyStates = []) {
  const keyboardJobs = jobs.filter((job) => String(job.techDetails?.instrumentType || job.instrumentType || '').toLowerCase() === 'keyboard');
  const completedStatuses = new Set(['completed', 'complete', 'picked up', 'picked-up', 'closed']);
  const closedStatuses = new Set([...completedStatuses, 'cancelled', 'canceled', 'archived']);
  const completedDurations = keyboardJobs
    .filter((job) => completedStatuses.has(String(job.status || '').trim().toLowerCase()))
    .map((job) => {
      const start = new Date(job.dateReceived || job.createdAt || '');
      const end = new Date(job.completedAt || job.pickedUpAt || job.updatedAt || '');
      return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end >= start
        ? (end.getTime() - start.getTime()) / 86400000
        : null;
    })
    .filter(Number.isFinite);
  const modelCounts = new Map();
  keyboardJobs.forEach((job) => {
    const model = [job.guitarBrand, job.model].filter(Boolean).join(' ') || 'Unknown model';
    modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
  });
  const faultCounts = new Map();
  keyStates.filter((state) => state.conditionStatus === 'fault' && state.faultCode).forEach((state) => {
    const label = getKeyboardFault(state.faultCode).label;
    faultCounts.set(label, (faultCounts.get(label) || 0) + 1);
  });
  return {
    totalJobs: keyboardJobs.length,
    openJobs: keyboardJobs.filter((job) => !closedStatuses.has(String(job.status || '').trim().toLowerCase())).length,
    averageRepairDays: completedDurations.length
      ? completedDurations.reduce((total, value) => total + value, 0) / completedDurations.length
      : null,
    topModel: [...modelCounts.entries()].sort((left, right) => right[1] - left[1])[0] || null,
    topFault: [...faultCounts.entries()].sort((left, right) => right[1] - left[1])[0] || null
  };
}

export function buildKeyboardCustomerReport(job = {}, keyStates = [], partRequests = [], options = {}) {
  const keyboard = job.techDetails?.keyboard || {};
  const faults = keyStates.filter((state) => state.conditionStatus === 'fault');
  const partsTotal = (job.parts || []).reduce((total, part) => total + Number(part.retail || part.retailPrice || 0) * Number(part.quantity || 1), 0);
  const servicesTotal = (job.services || []).reduce((total, service) => total + Number(service.price || service.amount || 0), 0);
  const lines = [
    `Keyboard diagnostic report for Job #${job.jobNumber || ''}`,
    `${[job.guitarBrand, job.model].filter(Boolean).join(' ')}${job.serial ? ` · Serial ${job.serial}` : ''}`,
    '',
    `Keybed: ${keyboard.keyCount || 'Unknown'} keys · ${keyboard.keyAction || 'Unknown action'} · ${keyboard.sensorTechnology || 'Unknown sensor technology'}`,
    `Keys logged with faults: ${faults.length}`,
    ...faults.map((state) => `- ${state.keyLabel}: ${getKeyboardFault(state.faultCode).label}${state.notes ? ` — ${state.notes}` : ''}`),
    '',
    `Diagnosis: ${keyboard.diagnosis || 'Diagnosis is still in progress.'}`,
    `Recommended / completed work: ${keyboard.repairPerformed || 'Work recommendation is still in progress.'}`,
    partRequests.length ? `Parts requests: ${partRequests.map((request) => `${request.requestedPart} (${request.requestStatus})`).join(', ')}` : null,
    `Current parts and service subtotal: ${money(partsTotal + servicesTotal, options.moneyOptions)}`,
    '',
    'Please reply if you have questions or would like to approve the recommended work.',
    options.shopSignature || null
  ].filter((line) => line !== null);
  return {
    subject: `Keyboard diagnostic report - Job #${job.jobNumber || ''}`,
    body: `Hi ${job.customerName || 'there'},\n\n${lines.join('\n')}\n`
  };
}
