import { useEffect, useMemo, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat.js';
import JobStatusSelect from '../jobs/JobStatusSelect.jsx';
import { JOB_PRIORITY_OPTIONS } from '../jobs/jobPriority.js';
import AmplifierElectricalMeasurements from './AmplifierElectricalMeasurements.jsx';
import AmplifierEvidenceSection from './AmplifierEvidenceSection.jsx';
import AmplifierMakeModelFields from './AmplifierMakeModelFields.jsx';
import {
  AMPLIFIER_FINAL_TEST_STATUSES,
  AMPLIFIER_TECHNOLOGIES,
  AMPLIFIER_TYPES,
  normalizeAmplifierDetails
} from './amplifierRepair.js';

function buildDraft(job) {
  return {
    ...job,
    techDetails: {
      ...(job.techDetails || {}),
      instrumentType: 'Amplifier',
      stringCount: 0,
      stringGauges: [],
      amplifier: normalizeAmplifierDetails(job.techDetails?.amplifier)
    }
  };
}

export default function AmplifierJobDetail({
  job,
  canWrite = true,
  dateOptions = {},
  onUpdate,
  onClose,
  onDirtyChange,
  onNotice
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
    setIsSaving(true);
    try {
      const saved = await onUpdate?.({ ...draft, updatedAt: new Date().toISOString() });
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

  function updateAmplifierField(event) {
    const { name, value } = event.target;
    setDraft((current) => ({
      ...current,
      techDetails: {
        ...current.techDetails,
        amplifier: { ...current.techDetails.amplifier, [name]: value }
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

  function updateMeasurementField(stage, name, value) {
    setDraft((current) => ({
      ...current,
      techDetails: {
        ...current.techDetails,
        amplifier: {
          ...current.techDetails.amplifier,
          electricalMeasurements: {
            ...current.techDetails.amplifier.electricalMeasurements,
            [stage]: {
              ...current.techDetails.amplifier.electricalMeasurements[stage],
              [name]: value
            }
          }
        }
      }
    }));
  }

  function updateDigitalField(name, value) {
    setDraft((current) => ({
      ...current,
      techDetails: {
        ...current.techDetails,
        amplifier: {
          ...current.techDetails.amplifier,
          digitalDiagnostics: {
            ...current.techDetails.amplifier.digitalDiagnostics,
            [name]: value
          }
        }
      }
    }));
  }

  function closeDetail() {
    if (isDirty && !window.confirm('You have unsaved amplifier repair changes. Leave without saving?')) {
      return;
    }
    onDirtyChange?.(false);
    onClose?.();
  }

  async function saveFromPage() {
    try {
      const saved = await save();
      onNotice?.({ type: 'success', message: `Saved amplifier job ${saved?.jobNumber || job.jobNumber || ''}.` });
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || 'Amplifier work order could not be saved.' });
    }
  }

  const amplifier = draft.techDetails.amplifier;

  return (
    <article className="amplifier-detail">
      <section className="panel amplifier-detail-header">
        <div>
          <p className="eyebrow">Amplifier work order</p>
          <h2>#{draft.jobNumber || 'Pending number'} · {draft.guitarBrand || 'Unknown brand'} {draft.model || ''}</h2>
          <p>{draft.customerName || 'Unnamed customer'} · Received {formatShopDate(draft.dateReceived, dateOptions) || 'date not recorded'}</p>
        </div>
        <div className="mode-actions amplifier-detail-actions no-print">
          <button type="button" className="button-tertiary" onClick={closeDetail}>Close Detail</button>
          <button type="button" onClick={saveFromPage} disabled={!canWrite || !isDirty || isSaving}>{isSaving ? 'Saving…' : 'Save Amplifier Job'}</button>
        </div>
      </section>

      {!canWrite && <section className="panel muted-text">Read-only access: amplifier details are visible, but editing is disabled.</section>}

      <section className="panel">
        <h3>Work Order</h3>
        <div className="form-grid amplifier-bench-grid">
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
        <h3>Amplifier Identity</h3>
        <div className="form-grid amplifier-bench-grid">
          <AmplifierMakeModelFields
            brand={draft.guitarBrand}
            model={draft.model}
            disabled={!canWrite}
            listIdPrefix="amplifier-detail"
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
            Amplifier Type
            <select name="amplifierType" value={amplifier.amplifierType} onChange={updateAmplifierField} disabled={!canWrite}>
              {AMPLIFIER_TYPES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Technology
            <select name="technology" value={amplifier.technology} onChange={updateAmplifierField} disabled={!canWrite}>
              {AMPLIFIER_TECHNOLOGIES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Rated Power (watts)
            <input name="powerWatts" inputMode="decimal" value={amplifier.powerWatts} onChange={updateAmplifierField} disabled={!canWrite} />
          </label>
          <label>
            Channels
            <input name="channels" value={amplifier.channels} onChange={updateAmplifierField} disabled={!canWrite} placeholder="2" />
          </label>
          <label>
            Speaker Configuration
            <input name="speakerConfiguration" value={amplifier.speakerConfiguration} onChange={updateAmplifierField} disabled={!canWrite} placeholder="1 × 12 in" />
          </label>
          <label>
            Speaker Impedance (Ω)
            <input name="speakerImpedanceOhms" inputMode="decimal" value={amplifier.speakerImpedanceOhms} onChange={updateAmplifierField} disabled={!canWrite} />
          </label>
          <label>
            Rated Mains Voltage
            <input name="mainsVoltage" value={amplifier.mainsVoltage} onChange={updateAmplifierField} disabled={!canWrite} placeholder="120 V" />
          </label>
          <label className="wide">
            Tube Complement
            <input name="tubeComplement" value={amplifier.tubeComplement} onChange={updateAmplifierField} disabled={!canWrite} placeholder="2 × 6V6, 4 × 12AX7" />
          </label>
        </div>
      </section>

      <AmplifierElectricalMeasurements
        amplifier={amplifier}
        canWrite={canWrite}
        onMeasurementChange={updateMeasurementField}
        onDigitalChange={updateDigitalField}
      />

      <section className="panel">
        <h3>Bench Worksheet</h3>
        <div className="form-grid amplifier-bench-grid">
          <label className="wide">
            Safety Notes
            <textarea name="safetyNotes" value={amplifier.safetyNotes} onChange={updateAmplifierField} rows="3" disabled={!canWrite} />
          </label>
          <label className="wide">
            Diagnosis
            <textarea name="diagnosis" value={amplifier.diagnosis} onChange={updateAmplifierField} rows="5" disabled={!canWrite} />
          </label>
          <label className="wide">
            Repair Performed
            <textarea name="repairPerformed" value={amplifier.repairPerformed} onChange={updateAmplifierField} rows="5" disabled={!canWrite} />
          </label>
          <label className="wide">
            Parts Replaced
            <textarea name="partsReplaced" value={amplifier.partsReplaced} onChange={updateAmplifierField} rows="3" disabled={!canWrite} />
          </label>
          <label className="wide">
            Bench Test Notes
            <textarea name="benchTestNotes" value={amplifier.benchTestNotes} onChange={updateAmplifierField} rows="4" disabled={!canWrite} />
          </label>
          <label>
            Final Test
            <select name="finalTestStatus" value={amplifier.finalTestStatus} onChange={updateAmplifierField} disabled={!canWrite}>
              {AMPLIFIER_FINAL_TEST_STATUSES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </section>

      <AmplifierEvidenceSection job={draft} canWrite={canWrite} onNotice={onNotice} />
    </article>
  );
}
