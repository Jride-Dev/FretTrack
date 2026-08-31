import { useEffect, useMemo, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat.js';
import JobStatusSelect from '../jobs/JobStatusSelect.jsx';
import { JOB_PRIORITY_OPTIONS } from '../jobs/jobPriority.js';
import KeyboardFunctionalTests from './KeyboardFunctionalTests.jsx';
import KeyboardDiagnosticChecklist from './KeyboardDiagnosticChecklist.jsx';
import KeyboardMakeModelFields from './KeyboardMakeModelFields.jsx';
import KeyboardWorkflowPanel from './KeyboardWorkflowPanel.jsx';
import { KEYBOARD_SENSOR_TECHNOLOGIES } from './keyboardDiagnostics.js';
import {
  KEYBOARD_ACTIONS,
  KEYBOARD_FINAL_TEST_STATUSES,
  KEYBOARD_KEY_COUNTS,
  KEYBOARD_TYPES,
  normalizeKeyboardDetails
} from './keyboardRepair.js';

function buildDraft(job) {
  return {
    ...job,
    techDetails: {
      ...(job.techDetails || {}),
      instrumentType: 'Keyboard',
      stringCount: 0,
      stringGauges: [],
      keyboard: normalizeKeyboardDetails(job.techDetails?.keyboard)
    }
  };
}

function mergeJobPart(job, jobPart) {
  return {
    ...job,
    parts: [...(job.parts || []).filter((part) => part.id !== jobPart.id), jobPart]
  };
}

export default function KeyboardJobDetail({
  job,
  canWrite = true,
  canManageJobCharges = canWrite,
  dateOptions = {},
  onUpdate,
  onClose,
  onRefresh,
  onDirtyChange,
  onNotice,
  canSendEmail = false,
  entitlementMessage = '',
  shopProfile = null,
  onOpenInventory
}) {
  const [draft, setDraft] = useState(() => buildDraft(job));
  const [baseline, setBaseline] = useState(() => JSON.stringify(buildDraft(job)));
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = useMemo(() => JSON.stringify(draft) !== baseline, [baseline, draft]);

  useEffect(() => {
    const nextDraft = buildDraft(job);
    setDraft(nextDraft);
    setBaseline(JSON.stringify(nextDraft));
  }, [job.id, job.updatedAt]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  async function save() {
    if (!canWrite) {
      throw new Error('Your shop role is read-only.');
    }
    if (!draft.updatedAt) {
      throw new Error('This keyboard job has no save version. Reload it before saving.');
    }
    setIsSaving(true);
    try {
      const saved = await onUpdate?.(draft, { expectedUpdatedAt: draft.updatedAt });
      const nextDraft = buildDraft(saved || draft);
      setDraft(nextDraft);
      setBaseline(JSON.stringify(nextDraft));
      onDirtyChange?.(false);
      return saved || nextDraft;
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    function handleSave(event) {
      save().then(event.detail?.resolve).catch(event.detail?.reject);
    }
    window.addEventListener('guitar-app-save-current-job', handleSave);
    return () => window.removeEventListener('guitar-app-save-current-job', handleSave);
  });

  function updateField(event) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function updateKeyboardField(event) {
    const { name, value } = event.target;
    setDraft((current) => ({
      ...current,
      techDetails: {
        ...current.techDetails,
        keyboard: { ...current.techDetails.keyboard, [name]: value }
      }
    }));
  }

  function updateTechField(event) {
    const { name, value } = event.target;
    setDraft((current) => ({
      ...current,
      techDetails: { ...current.techDetails, [name]: value }
    }));
  }

  function updateFunctionalTest(stage, name, value) {
    setDraft((current) => ({
      ...current,
      techDetails: {
        ...current.techDetails,
        keyboard: {
          ...current.techDetails.keyboard,
          functionalTests: {
            ...current.techDetails.keyboard.functionalTests,
            [stage]: {
              ...current.techDetails.keyboard.functionalTests[stage],
              [name]: value
            }
          }
        }
      }
    }));
  }

  function updateDiagnosticChecklist(diagnosticChecklist) {
    setDraft((current) => ({
      ...current,
      techDetails: {
        ...current.techDetails,
        keyboard: { ...current.techDetails.keyboard, diagnosticChecklist }
      }
    }));
  }

  async function addInventoryPartToDraft(jobPart) {
    setDraft((current) => mergeJobPart(current, jobPart));
    setBaseline((current) => JSON.stringify(mergeJobPart(JSON.parse(current), jobPart)));
    await onRefresh?.();
  }

  function closeDetail() {
    if (isDirty && !window.confirm('You have unsaved keyboard repair changes. Leave without saving?')) {
      return;
    }
    onDirtyChange?.(false);
    onClose?.();
  }

  async function saveFromPage() {
    try {
      const saved = await save();
      onNotice?.({ type: 'success', message: `Saved keyboard job ${saved?.jobNumber || job.jobNumber || ''}.` });
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || 'Keyboard work order could not be saved.' });
    }
  }

  const keyboard = draft.techDetails.keyboard;

  return (
    <article className="keyboard-detail amplifier-detail">
      <section className="panel keyboard-detail-header amplifier-detail-header">
        <div>
          <p className="eyebrow">Keyboard work order</p>
          <h2>#{draft.jobNumber || 'Pending number'} · {draft.guitarBrand || 'Unknown manufacturer'} {draft.model || ''}</h2>
          <p>{draft.customerName || 'Unnamed customer'} · Received {formatShopDate(draft.dateReceived, dateOptions) || 'date not recorded'}</p>
        </div>
        <div className="mode-actions keyboard-detail-actions amplifier-detail-actions no-print">
          <button type="button" className="button-tertiary" onClick={closeDetail}>Close Detail</button>
          <button type="button" onClick={saveFromPage} disabled={!canWrite || !isDirty || isSaving}>{isSaving ? 'Saving…' : 'Save Keyboard Job'}</button>
        </div>
      </section>

      {!canWrite && <section className="panel muted-text">Read-only access: keyboard details are visible, but editing is disabled.</section>}

      <section className="panel">
        <h3>Work Order</h3>
        <div className="form-grid keyboard-bench-grid amplifier-bench-grid">
          <JobStatusSelect canWrite={canWrite} value={draft.status || 'Checked In'} onChange={updateField} />
          <label>
            Priority
            <select name="priority" value={draft.priority || 'regular'} onChange={updateField} disabled={!canWrite}>
              {JOB_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Customer
            <input name="customerName" value={draft.customerName || ''} onChange={updateField} disabled={!canWrite} />
          </label>
          <label>
            Phone
            <input name="phone" value={draft.phone || ''} onChange={updateField} disabled={!canWrite} />
          </label>
          <label>
            Email
            <input type="email" name="email" value={draft.email || ''} onChange={updateField} disabled={!canWrite} />
          </label>
          <label>
            Promise Date
            <input type="date" name="promiseDate" value={draft.promiseDate || ''} onChange={updateField} disabled={!canWrite} />
          </label>
          <label className="wide">
            Reported Symptoms / Customer Request
            <textarea name="reasonForVisit" value={draft.reasonForVisit || ''} onChange={updateField} rows="4" disabled={!canWrite} />
          </label>
        </div>
      </section>

      <section className="panel">
        <h3>Keyboard Identity</h3>
        <div className="form-grid keyboard-bench-grid amplifier-bench-grid">
          <KeyboardMakeModelFields
            brand={draft.guitarBrand}
            model={draft.model}
            disabled={!canWrite}
            listIdPrefix="keyboard-detail"
            onChange={updateField}
          />
          <label>
            Serial Number
            <input name="serial" value={draft.serial || ''} onChange={updateField} disabled={!canWrite} />
          </label>
          <label>
            Year
            <input name="instrumentYear" value={draft.techDetails.instrumentYear || ''} onChange={updateTechField} disabled={!canWrite} />
          </label>
          <label>
            Keyboard Type
            <select name="keyboardType" value={keyboard.keyboardType} onChange={updateKeyboardField} disabled={!canWrite}>
              {KEYBOARD_TYPES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Key Count
            <select name="keyCount" value={keyboard.keyCount} onChange={updateKeyboardField} disabled={!canWrite}>
              {KEYBOARD_KEY_COUNTS.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Key Action
            <select name="keyAction" value={keyboard.keyAction} onChange={updateKeyboardField} disabled={!canWrite}>
              {KEYBOARD_ACTIONS.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Sensor Technology
            <select name="sensorTechnology" value={keyboard.sensorTechnology} onChange={updateKeyboardField} disabled={!canWrite}>
              {KEYBOARD_SENSOR_TECHNOLOGIES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Lowest MIDI Note
            <input type="number" min="0" max="127" name="lowestMidiNote" value={keyboard.lowestMidiNote} onChange={updateKeyboardField} disabled={!canWrite} placeholder="Auto from key count" />
          </label>
          <label>
            Sound Engine / Architecture
            <input name="soundEngine" value={keyboard.soundEngine} onChange={updateKeyboardField} disabled={!canWrite} placeholder="Analog, FM, sample-based…" />
          </label>
          <label>
            Power Requirements
            <input name="powerRequirements" value={keyboard.powerRequirements} onChange={updateKeyboardField} disabled={!canWrite} placeholder="12 V DC center positive, IEC…" />
          </label>
          <label>
            Firmware Version
            <input name="firmwareVersion" value={keyboard.firmwareVersion} onChange={updateKeyboardField} disabled={!canWrite} />
          </label>
          <label>
            OS / Software Version
            <input name="osVersion" value={keyboard.osVersion} onChange={updateKeyboardField} disabled={!canWrite} />
          </label>
          <label className="wide">
            Included Accessories
            <input name="includedAccessories" value={keyboard.includedAccessories} onChange={updateKeyboardField} disabled={!canWrite} />
          </label>
        </div>
      </section>

      <section className="panel">
        <h3>Keybed and Power Inspection</h3>
        <p className="amplifier-safety-warning"><strong>Qualified technicians only:</strong> mains-powered keyboards can contain hazardous voltage. These fields document observations and measurements; they are not repair instructions.</p>
        <div className="form-grid keyboard-bench-grid amplifier-bench-grid">
          <label className="wide">
            Affected Keys
            <input name="affectedKeys" value={keyboard.affectedKeys} onChange={updateKeyboardField} disabled={!canWrite} placeholder="C3 intermittent, F#4 stuck, upper octave low velocity…" />
          </label>
          <label className="wide">
            Keybed / Contact Notes
            <textarea name="keybedNotes" value={keyboard.keybedNotes} onChange={updateKeyboardField} rows="4" disabled={!canWrite} />
          </label>
          <label className="wide">
            Power Supply Readings
            <textarea name="powerSupplyReadings" value={keyboard.powerSupplyReadings} onChange={updateKeyboardField} rows="3" disabled={!canWrite} placeholder="Record measured rails, adapter output, battery behavior, and load conditions." />
          </label>
        </div>
      </section>

      <KeyboardFunctionalTests keyboard={keyboard} canWrite={canWrite} onChange={updateFunctionalTest} />

      <KeyboardWorkflowPanel
        job={draft}
        keyboard={keyboard}
        canWrite={canWrite}
        canManageJobCharges={canManageJobCharges && !draft.invoiceFinalizedAt}
        canSendEmail={canSendEmail}
        entitlementMessage={entitlementMessage}
        shopProfile={shopProfile}
        onRefresh={onRefresh}
        onSaveJob={save}
        onInventoryPartAdded={addInventoryPartToDraft}
        onOpenInventory={onOpenInventory}
        onNotice={onNotice}
      />

      <KeyboardDiagnosticChecklist keyboard={keyboard} canWrite={canWrite} onChange={updateDiagnosticChecklist} />

      <section className="panel">
        <h3>Bench Worksheet</h3>
        <div className="form-grid keyboard-bench-grid amplifier-bench-grid">
          <label className="wide">
            Initial Test Notes
            <textarea name="initialTestNotes" value={keyboard.initialTestNotes} onChange={updateKeyboardField} rows="4" disabled={!canWrite} />
          </label>
          <label className="wide">
            MIDI Diagnostic Summary
            <textarea name="midiDiagnosticSummary" value={keyboard.midiDiagnosticSummary} onChange={updateKeyboardField} rows="3" disabled={!canWrite} placeholder="Summarize note, velocity, aftertouch, and controller findings." />
          </label>
          <label className="wide">
            Raw MIDI Diagnostic Log
            <textarea name="midiDiagnosticLog" value={keyboard.midiDiagnosticLog} onChange={updateKeyboardField} rows="8" disabled={!canWrite} className="keyboard-midi-log" placeholder="Paste timestamped MIDI monitor output here." />
          </label>
          <label className="wide">
            Diagnosis
            <textarea name="diagnosis" value={keyboard.diagnosis} onChange={updateKeyboardField} rows="5" disabled={!canWrite} />
          </label>
          <label className="wide">
            Repair Performed
            <textarea name="repairPerformed" value={keyboard.repairPerformed} onChange={updateKeyboardField} rows="5" disabled={!canWrite} />
          </label>
          <label className="wide">
            Parts Replaced
            <textarea name="partsReplaced" value={keyboard.partsReplaced} onChange={updateKeyboardField} rows="3" disabled={!canWrite} />
          </label>
          <label className="wide">
            Cleaning Performed
            <textarea name="cleaningPerformed" value={keyboard.cleaningPerformed} onChange={updateKeyboardField} rows="3" disabled={!canWrite} />
          </label>
          <label className="wide">
            Calibration / Adjustment Notes
            <textarea name="calibrationNotes" value={keyboard.calibrationNotes} onChange={updateKeyboardField} rows="3" disabled={!canWrite} />
          </label>
          <label className="wide">
            Final Test Notes
            <textarea name="finalTestNotes" value={keyboard.finalTestNotes} onChange={updateKeyboardField} rows="4" disabled={!canWrite} />
          </label>
          <label>
            Final Test
            <select name="finalTestStatus" value={keyboard.finalTestStatus} onChange={updateKeyboardField} disabled={!canWrite}>
              {KEYBOARD_FINAL_TEST_STATUSES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </section>
    </article>
  );
}
