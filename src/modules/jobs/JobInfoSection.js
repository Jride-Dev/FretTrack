import { useEffect, useState } from 'react';
import {
  getBrandsForInstrumentType,
  getInstrumentTypeOptions,
  getModelsForBrand,
  getOrientationOptions,
  getStringCountOptions,
  normalizeStringCount
} from '../instruments/instrumentService';
import { smsEnabled } from '../../data/messagesRepository';
import { stateOptionsWithCurrent } from '../../data/usStates';
import { JOB_PRIORITY_OPTIONS } from './jobPriority';

export default function JobInfoSection({
  canWrite = true,
  draftJob,
  intakeTypes,
  normalizeInstrumentType,
  setInstrumentType,
  updateStringCount,
  updateContactPreference,
  updateField,
  updateTechField
}) {
  const instrumentType = normalizeInstrumentType(draftJob.instrumentType);
  const stringCount = normalizeStringCount(draftJob.techDetails.stringCount || draftJob.techDetails.stringGauges?.length, instrumentType);
  const isPresetStringCount = getStringCountOptions(instrumentType).includes(stringCount);
  const [showCustomStringCount, setShowCustomStringCount] = useState(!isPresetStringCount);
  const stringCountSelectValue = showCustomStringCount || !isPresetStringCount ? 'custom' : String(stringCount);
  const brandOptions = getBrandsForInstrumentType(instrumentType);
  const modelOptions = getModelsForBrand(instrumentType, draftJob.guitarBrand);

  useEffect(() => {
    setShowCustomStringCount(!getStringCountOptions(instrumentType).includes(stringCount));
  }, [instrumentType, stringCount]);

  return (
    <section>
      <datalist id="detail-brand-options">
        {brandOptions.map((brand) => (
          <option key={brand} value={brand} />
        ))}
      </datalist>
      <datalist id="detail-model-options">
        {modelOptions.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
      <h3>Job Info</h3>
      <div className="form-grid">
        <label>
          First Name
          <input name="customerFirstName" value={draftJob.customerFirstName || ''} onChange={updateField} disabled={!canWrite} />
        </label>
        <label>
          Last Name
          <input name="customerLastName" value={draftJob.customerLastName || ''} onChange={updateField} disabled={!canWrite} />
        </label>
        <label>
          Address
          <input name="addressLine1" value={draftJob.addressLine1 || ''} onChange={updateField} disabled={!canWrite} />
        </label>
        <label>
          City
          <input name="city" value={draftJob.city || ''} onChange={updateField} disabled={!canWrite} />
        </label>
        <label>
          State
          <select name="region" value={draftJob.region || ''} onChange={updateField} disabled={!canWrite}>
            <option value="">Select state</option>
            {stateOptionsWithCurrent(draftJob.region).map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </label>
        <label>
          Zip Code
          <input name="postalCode" value={draftJob.postalCode || ''} onChange={updateField} inputMode="numeric" disabled={!canWrite} />
        </label>
        <label>
          Phone
          <input name="phone" value={draftJob.phone} onChange={updateField} disabled={!canWrite} />
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            checked={Boolean(draftJob.smsOptIn)}
            disabled={!canWrite || !smsEnabled}
            title={!smsEnabled ? 'SMS is disabled for this trial build. Email is active.' : undefined}
            onChange={(event) => updateContactPreference('smsOptIn', event.target.checked)}
          />
          SMS opt-in
        </label>
        <label>
          Email
          <input name="email" type="email" value={draftJob.email} onChange={updateField} disabled={!canWrite} />
        </label>
        <label className="checkline">
          <input type="checkbox" checked={Boolean(draftJob.emailOptIn)} onChange={(event) => updateContactPreference('emailOptIn', event.target.checked)} disabled={!canWrite} />
          Email opt-in
        </label>
        <label>
          Preferred Contact
          <select value={draftJob.preferredContactMethod || 'email'} onChange={(event) => updateContactPreference('preferredContactMethod', event.target.value)} disabled={!canWrite}>
            <option value="email">Email</option>
            <option value="sms" disabled={!smsEnabled}>SMS</option>
            <option value="none">None</option>
          </select>
        </label>
        <label>
          Job Source
          <select name="intakeType" value={draftJob.techDetails.intakeType || 'Walk-In'} onChange={updateTechField} disabled={!canWrite}>
            {intakeTypes.map((source) => (
              <option key={source.value || source} value={source.value || source}>{source.label || source}</option>
            ))}
          </select>
        </label>
        <label>
          Sub-Contract Business
          <input
            name="subcontractorName"
            value={draftJob.techDetails.subcontractorName || ''}
            onChange={updateTechField}
            placeholder="Sub-contractor business name"
            disabled={!canWrite || (draftJob.techDetails.intakeType || 'Walk-In') !== 'Sub-Contract'}
          />
        </label>
        <div className="instrument-selector" role="group" aria-label="Instrument Type">
          <span>Instrument Type</span>
          <div className="segmented-control instrument-type-control">
            {getInstrumentTypeOptions().map((option) => (
              <button
                type="button"
                key={option.value}
                className={instrumentType === option.value ? 'active' : ''}
                onClick={() => setInstrumentType(option.value)}
                disabled={!canWrite}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <fieldset className="instrument-intake-section wide">
          <legend>Instrument Details</legend>
          <div className="form-grid instrument-detail-grid">
            <label>
              Brand
              <input
                name="guitarBrand"
                list="detail-brand-options"
                value={draftJob.guitarBrand}
                onChange={updateField}
                placeholder="Fender"
                disabled={!canWrite}
              />
            </label>
            <label>
              Model
              <input
                name="model"
                list="detail-model-options"
                value={draftJob.model}
                onChange={updateField}
                placeholder="Stratocaster"
                disabled={!canWrite}
              />
            </label>
            <label>
              Year
              <input
                className="compact-input"
                name="instrumentYear"
                value={draftJob.techDetails.instrumentYear || ''}
                onChange={updateTechField}
                placeholder="1972"
                disabled={!canWrite}
              />
            </label>
            <label>
              Serial Number
              <input
                name="serial"
                value={draftJob.serial}
                onChange={updateField}
                placeholder="Z8239242, Unknown, or Not provided"
                disabled={!canWrite}
              />
            </label>
            <label>
              Color
              <input
                name="color"
                value={draftJob.color}
                onChange={updateField}
                placeholder="3-Color Sunburst"
                disabled={!canWrite}
              />
            </label>
            <label>
              Finish
              <input
                name="finish"
                value={draftJob.techDetails.finish || ''}
                onChange={updateTechField}
                placeholder="Gloss, Nitro, Poly, Satin"
                disabled={!canWrite}
              />
            </label>
            <label>
              Orientation
              <select name="orientation" value={draftJob.techDetails.orientation || 'Unknown'} onChange={updateTechField} disabled={!canWrite}>
                {getOrientationOptions(draftJob.techDetails.orientation).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              String Count
              <select
                value={stringCountSelectValue}
                disabled={!canWrite}
                onChange={(event) => {
                  const value = event.target.value;
                  setShowCustomStringCount(value === 'custom');
                  updateStringCount(value === 'custom' ? stringCount : value);
                }}
              >
                {getStringCountOptions(instrumentType).map((count) => (
                  <option key={count} value={count}>{count}-string</option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </label>
            {showCustomStringCount && (
              <label>
                Custom String Count
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={stringCount}
                  onChange={(event) => updateStringCount(event.target.value)}
                  disabled={!canWrite}
                />
              </label>
            )}
          </div>
        </fieldset>
        <label>
          Date Received
          <input type="date" name="dateReceived" value={draftJob.dateReceived} onChange={updateField} disabled={!canWrite} />
        </label>
        <label>
          Promise Date
          <input type="date" name="promiseDate" value={draftJob.promiseDate || ''} onChange={updateField} disabled={!canWrite} />
        </label>
        <label>
          Priority
          <select name="priority" value={draftJob.priority || 'regular'} onChange={updateField} disabled={!canWrite}>
            {JOB_PRIORITY_OPTIONS.map((priority) => (
              <option key={priority.value} value={priority.value}>{priority.label}</option>
            ))}
          </select>
        </label>
        <label>
          Job Number
          <input value={draftJob.jobNumber} readOnly />
        </label>
        <label className="wide">
          Reason For Visit
          <textarea name="reasonForVisit" value={draftJob.reasonForVisit} onChange={updateField} rows="3" disabled={!canWrite} />
        </label>
      </div>
    </section>
  );
}
