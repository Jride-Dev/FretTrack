import { STRING_COUNT_OPTIONS, instrumentCatalog } from '../instruments/instrumentService';
import { smsEnabled } from '../../data/messagesRepository';

export default function JobInfoSection({
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

  return (
    <section>
      <datalist id="detail-brand-options">
        {(instrumentCatalog[instrumentType]?.brands || []).map((brand) => (
          <option key={brand} value={brand} />
        ))}
      </datalist>
      <datalist id="detail-model-options">
        {(instrumentCatalog[instrumentType]?.models || []).map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
      <datalist id="detail-string-count-options">
        {STRING_COUNT_OPTIONS.map((count) => (
          <option key={count} value={count} />
        ))}
      </datalist>
      <h3>Job Info</h3>
      <div className="form-grid">
        <label>
          First Name
          <input name="customerFirstName" value={draftJob.customerFirstName || ''} onChange={updateField} />
        </label>
        <label>
          Last Name
          <input name="customerLastName" value={draftJob.customerLastName || ''} onChange={updateField} />
        </label>
        <label>
          Job Source
          <select name="intakeType" value={draftJob.techDetails.intakeType || 'Walk-In'} onChange={updateTechField}>
            {intakeTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
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
            disabled={(draftJob.techDetails.intakeType || 'Walk-In') !== 'Sub-Contract'}
          />
        </label>
        <div className="instrument-selector" role="group" aria-label="Instrument Type">
          <span>Instrument Type</span>
          <div className="segmented-control">
            <button
              type="button"
              className={instrumentType === 'Acoustic' ? 'active' : ''}
              onClick={() => setInstrumentType('Acoustic')}
            >
              Acoustic
            </button>
            <button
              type="button"
              className={instrumentType === 'Electric' ? 'active' : ''}
              onClick={() => setInstrumentType('Electric')}
            >
              Electric
            </button>
            <button
              type="button"
              className={instrumentType === 'Bass' ? 'active' : ''}
              onClick={() => setInstrumentType('Bass')}
            >
              Bass
            </button>
          </div>
        </div>
        <label>
          String Count
          <input
            type="number"
            min="1"
            max="24"
            list="detail-string-count-options"
            value={draftJob.techDetails.stringCount || draftJob.techDetails.stringGauges?.length || 6}
            onChange={(event) => updateStringCount(event.target.value)}
          />
        </label>
        <label>
          Phone
          <input name="phone" value={draftJob.phone} onChange={updateField} />
        </label>
        <label>
          Email
          <input name="email" value={draftJob.email} onChange={updateField} />
        </label>
        <label className="checkline">
          <input type="checkbox" checked={Boolean(draftJob.emailOptIn)} onChange={(event) => updateContactPreference('emailOptIn', event.target.checked)} />
          Email opt-in
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            checked={Boolean(draftJob.smsOptIn)}
            disabled={!smsEnabled}
            title={!smsEnabled ? 'SMS is disabled for this trial build. Email is active.' : undefined}
            onChange={(event) => updateContactPreference('smsOptIn', event.target.checked)}
          />
          SMS opt-in
        </label>
        <label>
          Preferred Contact
          <select value={draftJob.preferredContactMethod || 'email'} onChange={(event) => updateContactPreference('preferredContactMethod', event.target.value)}>
            <option value="email">Email</option>
            <option value="sms" disabled={!smsEnabled}>SMS</option>
            <option value="none">None</option>
          </select>
        </label>
        <label>
          Brand
          <input name="guitarBrand" list="detail-brand-options" value={draftJob.guitarBrand} onChange={updateField} />
        </label>
        <label>
          Model
          <input name="model" list="detail-model-options" value={draftJob.model} onChange={updateField} />
        </label>
        <label>
          Serial
          <input name="serial" value={draftJob.serial} onChange={updateField} />
        </label>
        <label>
          Color
          <input name="color" value={draftJob.color} onChange={updateField} />
        </label>
        <label>
          Date Received
          <input type="date" name="dateReceived" value={draftJob.dateReceived} onChange={updateField} />
        </label>
        <label>
          Job Number
          <input value={draftJob.jobNumber} readOnly />
        </label>
        <label className="wide">
          Reason For Visit
          <textarea name="reasonForVisit" value={draftJob.reasonForVisit} onChange={updateField} rows="3" />
        </label>
      </div>
    </section>
  );
}
