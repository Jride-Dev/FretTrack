import { useEffect, useMemo, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat.js';
import { formatMeasurementChange } from '../../shared/utils/measurements.js';
import JobStatusSelect from '../jobs/JobStatusSelect.jsx';
import { JOB_PRIORITY_OPTIONS } from '../jobs/jobPriority.js';
import TechDetailsSection from '../jobs/TechDetailsSection.js';
import DamageMapSection from '../jobs/DamageMapSection.js';
import {
  buildDamageMapJob,
  buildInstrumentTypePatch,
  buildJobFieldPatch,
  buildNeckInspectionPatch,
  buildStringCountPatch,
  buildStringGaugePatch,
  buildStringGaugesPatch,
  buildTechFieldPatch,
  findNewDamageViewImage
} from '../jobs/jobDetailFormatting.js';
import {
  getBrandsForInstrumentType,
  getInstrumentStringCount,
  getInstrumentTypeOptions,
  getModelsForBrand,
  getOrientationOptions,
  getOuterStringLabels,
  getStringCountOptions,
  isStringedInstrumentType,
  normalizeInstrumentType,
  normalizeStringCount,
  resizeStringGauges
} from '../instruments/instrumentService.js';
import { getShopMeasurementOptions } from '../shops/shopConfig.js';

function buildDraft(job) {
  const instrumentType = normalizeInstrumentType(job.instrumentType || job.techDetails?.instrumentType);
  const techDetails = job.techDetails || {};
  const stringCount = normalizeStringCount(
    techDetails.stringCount || techDetails.stringGauges?.length,
    instrumentType
  );

  return {
    ...job,
    instrumentType,
    techDetails: {
      ...techDetails,
      instrumentType,
      stringCount,
      stringGauges: resizeStringGauges(techDetails.stringGauges, stringCount),
      neckInspection: {
        ...(techDetails.neckInspection || {}),
        initial: { ...(techDetails.neckInspection?.initial || {}) },
        final: { ...(techDetails.neckInspection?.final || {}) }
      }
    }
  };
}

export default function GuitarJobDetail({
  job,
  jobs = [],
  canWrite = true,
  canUploadPhotos = false,
  dateOptions = {},
  onUpdate,
  onImageUpload,
  onClose,
  onDirtyChange,
  onNotice,
  shopProfile = null
}) {
  const [draft, setDraft] = useState(() => buildDraft(job));
  const [baseline, setBaseline] = useState(() => JSON.stringify(buildDraft(job)));
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = useMemo(() => JSON.stringify(draft) !== baseline, [baseline, draft]);
  const measurementOptions = getShopMeasurementOptions(shopProfile || undefined);
  const instrumentType = normalizeInstrumentType(draft.instrumentType);
  const stringCount = getInstrumentStringCount(draft);
  const outerStringLabels = getOuterStringLabels(instrumentType, stringCount);
  const brandOptions = getBrandsForInstrumentType(instrumentType);
  const modelOptions = getModelsForBrand(instrumentType, draft.guitarBrand);
  const stringCountOptions = getStringCountOptions(instrumentType);

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
      throw new Error('This guitar job has no save version. Reload it before saving.');
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
    setDraft((current) => ({ ...current, ...buildJobFieldPatch(current, name, value, jobs) }));
  }

  function updateTechField(event) {
    const { name, value } = event.target;
    setDraft((current) => buildTechFieldPatch(current, name, value));
  }

  function updateInstrumentType(value) {
    setDraft((current) => ({ ...current, ...buildInstrumentTypePatch(current, value) }));
  }

  function updateStringCount(value) {
    setDraft((current) => ({ ...current, ...buildStringCountPatch(current, value) }));
  }

  function updateNeckInspection(stage, fieldOrPatch, value) {
    setDraft((current) => buildNeckInspectionPatch(current, stage, fieldOrPatch, value));
  }

  function updateStringGauge(index, value) {
    setDraft((current) => buildStringGaugePatch(current, index, value));
  }

  function updateStringGauges(gauges) {
    setDraft((current) => buildStringGaugesPatch(current, gauges));
  }

  function updateDamageMap(damageMap) {
    setDraft((current) => buildDamageMapJob(current, damageMap));
  }

  async function uploadDamageViewImage(viewName, file, uploadOptions = {}) {
    if (!canUploadPhotos) {
      onNotice?.({ type: 'error', message: 'Your shop role or plan cannot upload photos.' });
      return null;
    }

    const category = uploadOptions.category || `damage-map-${viewName}`;
    const existingImageIds = new Set((draft.images || []).map((image) => image.id));
    const result = await onImageUpload?.(draft, [file], { category, skipRefresh: true });
    if (result?.errors?.length) {
      throw new Error(result.errors[0].message || 'Damage photo upload failed.');
    }
    if (!result?.job) {
      return null;
    }

    const nextDraft = buildDraft(result.job);
    setDraft(nextDraft);
    setBaseline(JSON.stringify(nextDraft));
    return findNewDamageViewImage(result.job.images || [], existingImageIds, category, file.name);
  }

  function closeDetail() {
    if (isDirty && !window.confirm('You have unsaved guitar repair changes. Leave without saving?')) {
      return;
    }
    onDirtyChange?.(false);
    onClose?.();
  }

  async function saveFromPage() {
    try {
      const saved = await save();
      onNotice?.({ type: 'success', message: `Saved guitar job ${saved?.jobNumber || job.jobNumber || ''}.` });
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || 'Guitar work order could not be saved.' });
    }
  }

  return (
    <article className="guitar-detail amplifier-detail">
      <section className="panel guitar-detail-header amplifier-detail-header">
        <div>
          <p className="eyebrow">Guitar work order</p>
          <h2>#{draft.jobNumber || 'Pending number'} · {draft.guitarBrand || 'Unknown brand'} {draft.model || ''}</h2>
          <p>{draft.customerName || 'Unnamed customer'} · Received {formatShopDate(draft.dateReceived, dateOptions) || 'date not recorded'}</p>
        </div>
        <div className="mode-actions guitar-detail-actions amplifier-detail-actions no-print">
          <button type="button" className="button-tertiary" onClick={closeDetail}>Close Detail</button>
          <button type="button" onClick={saveFromPage} disabled={!canWrite || !isDirty || isSaving}>{isSaving ? 'Saving…' : 'Save Guitar Job'}</button>
        </div>
      </section>

      {!canWrite && <section className="panel muted-text">Read-only access: guitar details are visible, but editing is disabled.</section>}

      <section className="panel">
        <h3>Work Order</h3>
        <div className="form-grid guitar-bench-grid amplifier-bench-grid">
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
            Reason for Visit / Customer Request
            <textarea name="reasonForVisit" value={draft.reasonForVisit || ''} onChange={updateField} rows="4" disabled={!canWrite} />
          </label>
        </div>
      </section>

      <section className="panel">
        <datalist id="guitar-bench-brand-options">
          {brandOptions.map((brand) => <option key={brand} value={brand} />)}
        </datalist>
        <datalist id="guitar-bench-model-options">
          {modelOptions.map((model) => <option key={model} value={model} />)}
        </datalist>
        <h3>Guitar Identity</h3>
        <div className="form-grid guitar-bench-grid amplifier-bench-grid">
          <label>
            Instrument Type
            <select value={instrumentType} onChange={(event) => updateInstrumentType(event.target.value)} disabled={!canWrite}>
              {getInstrumentTypeOptions().filter((option) => isStringedInstrumentType(option.value)).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Brand
            <input name="guitarBrand" list="guitar-bench-brand-options" value={draft.guitarBrand || ''} onChange={updateField} disabled={!canWrite} />
          </label>
          <label>
            Model
            <input name="model" list="guitar-bench-model-options" value={draft.model || ''} onChange={updateField} disabled={!canWrite} />
          </label>
          <label>
            Serial Number
            <input name="serial" value={draft.serial || ''} onChange={updateField} disabled={!canWrite} />
          </label>
          <label>
            Year
            <input name="instrumentYear" value={draft.techDetails.instrumentYear || ''} onChange={updateTechField} disabled={!canWrite} />
          </label>
          <label>
            Color
            <input name="color" value={draft.color || ''} onChange={updateField} disabled={!canWrite} />
          </label>
          <label>
            Finish
            <input name="finish" value={draft.techDetails.finish || ''} onChange={updateTechField} disabled={!canWrite} />
          </label>
          <label>
            Orientation
            <select name="orientation" value={draft.techDetails.orientation || 'Unknown'} onChange={updateTechField} disabled={!canWrite}>
              {getOrientationOptions(draft.techDetails.orientation).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            String Count
            <select value={String(stringCount)} onChange={(event) => updateStringCount(event.target.value)} disabled={!canWrite}>
              {!stringCountOptions.includes(stringCount) && <option value={stringCount}>{stringCount}-string</option>}
              {stringCountOptions.map((count) => <option key={count} value={count}>{count}-string</option>)}
            </select>
          </label>
        </div>
      </section>

      <TechDetailsSection
        className="panel guitar-setup-panel"
        canWrite={canWrite}
        draftJob={draft}
        formatMeasurementDelta={formatMeasurementChange}
        lengthUnit={measurementOptions.lengthUnit}
        outerStringLabels={outerStringLabels}
        updateNeckInspection={updateNeckInspection}
        updateStringGauge={updateStringGauge}
        updateStringGauges={updateStringGauges}
        updateTechField={updateTechField}
      />

      <DamageMapSection
        className="panel guitar-damage-map-panel"
        canWrite={canWrite}
        instrumentType={instrumentType}
        damageMap={draft.techDetails.damageMap}
        onChange={updateDamageMap}
        onViewImageUpload={uploadDamageViewImage}
      />
    </article>
  );
}
