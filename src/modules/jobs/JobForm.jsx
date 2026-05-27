import { useEffect, useState } from 'react';
import { addJob } from './jobService';
import { generateJobNumber } from './jobNumber';
import { combineCustomerName, findCustomerMatches } from '../customers';
import {
  STRING_COUNT_OPTIONS,
  instrumentCatalog,
  normalizeStringCount,
  resizeStringGauges,
  stringCountForInstrument
} from '../instruments/instrumentService';
import { formatShopDate, toIsoDateInputValue } from '../../shared/utils/dateFormat';
import { getDefaultMeasurementPreferences } from '../../shared/utils/measurements';
import { getShopDateOptions } from '../shops/shopConfig';

function todayValue() {
  return toIsoDateInputValue();
}

function getInitialFormState(jobs = []) {
  const dateReceived = todayValue();
  return {
    customerFirstName: '',
    customerLastName: '',
    customerId: '',
    customerName: '',
    intakeType: 'Walk-In',
    subcontractorName: '',
    instrumentType: 'Electric',
    stringCount: 6,
    phone: '',
    email: '',
    guitarBrand: '',
    model: '',
    serial: '',
    color: '',
    reasonForVisit: '',
    dateReceived,
    jobNumber: generateJobNumber(dateReceived, jobs)
  };
}

export default function JobForm({ jobs = [], customers = [], canWrite = true, shopProfile = null, onCreate, onJobSaved, onNotice }) {
  const [form, setForm] = useState(() => getInitialFormState(jobs));
  const [isSaving, setIsSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerMatches, setCustomerMatches] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const dateOptions = getShopDateOptions(shopProfile || undefined);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      jobNumber: generateJobNumber(current.dateReceived || todayValue(), jobs)
    }));
  }, [jobs]);

  useEffect(() => {
    setCustomerMatches(findCustomerMatches(customers.length ? customers : jobs, customerSearch));
  }, [customers, jobs, customerSearch]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => {
      const nextForm = { ...current, [name]: value };
      if (name === 'customerFirstName' || name === 'customerLastName') {
        nextForm.customerId = '';
        setSelectedCustomer(null);
        nextForm.customerName = combineCustomerName(
          name === 'customerFirstName' ? value : current.customerFirstName,
          name === 'customerLastName' ? value : current.customerLastName
        );
      }
      if (name === 'phone' || name === 'email') {
        nextForm.customerId = '';
        setSelectedCustomer(null);
      }
      if (name === 'dateReceived') {
        const dateReceived = value || todayValue();
        nextForm.jobNumber = generateJobNumber(dateReceived, jobs);
      }
      if (name === 'stringCount') {
        nextForm.stringCount = normalizeStringCount(value, current.instrumentType);
      }
      return nextForm;
    });
  }

  function setInstrumentType(instrumentType) {
    setForm((current) => ({
      ...current,
      instrumentType,
      stringCount: stringCountForInstrument(instrumentType)
    }));
  }

  function useCustomer(customer) {
    setForm((current) => ({
      ...current,
      customerId: customer.id || '',
      customerFirstName: customer.customerFirstName || customer.firstName || '',
      customerLastName: customer.customerLastName || customer.lastName || '',
      customerName: customer.customerName || customer.displayName,
      phone: customer.phone,
      email: customer.email
    }));
    setSelectedCustomer(customer);
    setCustomerSearch(customer.displayName || customer.customerName || customer.phone || customer.email);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canWrite) {
      onNotice?.({ type: 'error', message: 'Your shop role is read-only.' });
      return;
    }

    if (isSaving) {
      return;
    }

    const customerName = combineCustomerName(form.customerFirstName, form.customerLastName);
    if (!customerName || !form.guitarBrand.trim()) {
      return;
    }

    setIsSaving(true);

    const now = new Date().toISOString();
    const dateReceived = form.dateReceived || todayValue();
    const measurementPreferences = getDefaultMeasurementPreferences(shopProfile || {});

    const newJob = {
      id: crypto.randomUUID(),
      ...form,
      customerId: form.customerId || selectedCustomer?.id || '',
      customerName,
      dateReceived,
      jobNumber: generateJobNumber(dateReceived, jobs),
      status: 'Checked In',
      discountType: 'none',
      discountValue: '',
      techDetails: {
        instrumentType: form.instrumentType,
        stringCount: form.stringCount,
        intakeType: form.intakeType,
        subcontractorName: form.subcontractorName,
        stringGauges: resizeStringGauges([], form.stringCount),
        newStringBrand: '',
        newStringGauge: '',
        neckInspectionBefore: '',
        neckInspectionAfter: '',
        neckInspection: {
          initial: {
            lengthUnit: measurementPreferences.lengthUnit,
            reliefUnit: measurementPreferences.lengthUnit
          },
          final: {
            lengthUnit: measurementPreferences.lengthUnit,
            reliefUnit: measurementPreferences.lengthUnit
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
            back: { marks: [] }
          }
        },
        tax: {
          ...getDefaultTaxSettings(shopProfile)
        },
        payments: [],
        actionHighE3rd: '',
        actionLowE3rd: '',
        actionHighE12th: '',
        actionLowE12th: '',
        action3rdHighE: '',
        action3rdLowE: '',
        action12thHighE: '',
        action12thLowE: '',
        neckRelief: '',
        measurementSystem: measurementPreferences.measurementSystem,
        lengthUnit: measurementPreferences.lengthUnit,
        notes: '',
        includedPartIds: [],
        discountType: 'none',
        discountValue: ''
      },
      workLog: [],
      parts: [],
      labor: [],
      services: [],
      images: [],
      createdAt: now,
      updatedAt: now
    };

    try {
      const savedJob = await addJob(newJob);

      setForm(getInitialFormState([...jobs, savedJob || newJob]));
      setCustomerSearch('');
      setCustomerMatches([]);
      setSelectedCustomer(null);

      if (onJobSaved) {
        await onJobSaved(savedJob || newJob);
      } else if (onCreate) {
        await onCreate(savedJob || newJob);
      }
    } catch (error) {
      onNotice?.({
        type: 'error',
        message: getErrorMessage(error, 'Job save failed.')
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>New Job</h2>
      {!canWrite && <p className="muted-text">Your shop role can view work orders but cannot create new ones.</p>}
      <datalist id="new-job-brand-options">
        {(instrumentCatalog[form.instrumentType]?.brands || []).map((brand) => (
          <option key={brand} value={brand} />
        ))}
      </datalist>
      <datalist id="new-job-model-options">
        {(instrumentCatalog[form.instrumentType]?.models || []).map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
      <datalist id="new-job-string-count-options">
        {STRING_COUNT_OPTIONS.map((count) => (
          <option key={count} value={count} />
        ))}
      </datalist>
      <div className="form-grid">
        <section className="customer-lookup wide">
          <h3>Customer Lookup</h3>
          <input
            type="search"
            placeholder="Search previous customers by name, phone, or email..."
            value={customerSearch}
            disabled={!canWrite}
            onChange={(event) => {
              setCustomerSearch(event.target.value);
              setSelectedCustomer(null);
            }}
          />
          {customerMatches.length > 0 && (
            <div className="customer-results">
              {customerMatches.map((customer) => {
                const latestJob = customer.jobs[0] || {};
                const key = customer.id || customer.phone || customer.email || customer.displayName || customer.customerName;
                return (
                  <div className="customer-match" key={key}>
                    <div>
                      <strong>{customer.displayName || customer.customerName || 'Unnamed Customer'}</strong>
                      <span>{customer.phone || 'No phone'} | {customer.email || 'No email'}</span>
                      <span>
                        {customer.jobs.length} previous job{customer.jobs.length === 1 ? '' : 's'}
                        {latestJob.jobNumber ? ` | Latest #${latestJob.jobNumber}` : ''}
                        {latestJob.dateReceived ? ` | ${formatShopDate(latestJob.dateReceived, dateOptions)}` : ''}
                      </span>
                    </div>
                    <button type="button" onClick={() => useCustomer(customer)} disabled={!canWrite}>Use Customer</button>
                  </div>
                );
              })}
            </div>
          )}
          {selectedCustomer && (
            <div className="previous-jobs">
              <h3>Previous Jobs</h3>
              {selectedCustomer.jobs.map((job) => (
                <div className="previous-job" key={job.id}>
                  <strong>#{job.jobNumber || 'No number'} | {formatShopDate(job.dateReceived, dateOptions) || 'No date'}</strong>
                  <span>{job.guitarBrand} {job.model} | {job.status}</span>
                  <p>{job.reasonForVisit}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <label>
          First Name
          <input name="customerFirstName" value={form.customerFirstName} onChange={handleChange} disabled={!canWrite} required />
        </label>
        <label>
          Last Name
          <input name="customerLastName" value={form.customerLastName} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Job Source
          <select name="intakeType" value={form.intakeType} onChange={handleChange} disabled={!canWrite}>
            <option value="Walk-In">Walk-In</option>
            <option value="Telephone Appt.">Telephone Appt.</option>
            <option value="Referral">Referral</option>
            <option value="Sub-Contract">Sub-Contract</option>
          </select>
        </label>
        <label>
          Sub-Contract Business
          <input
            name="subcontractorName"
            value={form.subcontractorName}
            onChange={handleChange}
            placeholder="Sub-contractor business name"
            disabled={!canWrite || form.intakeType !== 'Sub-Contract'}
          />
        </label>
        <div className="instrument-selector" role="group" aria-label="Instrument Type">
          <span>Instrument Type</span>
          <div className="segmented-control">
            <button
              type="button"
              className={form.instrumentType === 'Acoustic' ? 'active' : ''}
              onClick={() => setInstrumentType('Acoustic')}
              disabled={!canWrite}
            >
              Acoustic
            </button>
            <button
              type="button"
              className={form.instrumentType === 'Electric' ? 'active' : ''}
              onClick={() => setInstrumentType('Electric')}
              disabled={!canWrite}
            >
              Electric
            </button>
            <button
              type="button"
              className={form.instrumentType === 'Bass' ? 'active' : ''}
              onClick={() => setInstrumentType('Bass')}
              disabled={!canWrite}
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
            name="stringCount"
            list="new-job-string-count-options"
            value={form.stringCount}
            onChange={handleChange}
            disabled={!canWrite}
          />
        </label>
        <label>
          Phone
          <input name="phone" value={form.phone} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Email
          <input type="email" name="email" value={form.email} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Brand
          <input name="guitarBrand" list="new-job-brand-options" value={form.guitarBrand} onChange={handleChange} disabled={!canWrite} required />
        </label>
        <label>
          Model
          <input name="model" list="new-job-model-options" value={form.model} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Serial
          <input name="serial" value={form.serial} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Color
          <input name="color" value={form.color} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Date Received
          <input type="date" name="dateReceived" value={form.dateReceived} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Job Number
          <input name="jobNumber" value={form.jobNumber} readOnly />
        </label>
        <label className="wide">
          Reason For Visit
          <textarea name="reasonForVisit" value={form.reasonForVisit} onChange={handleChange} rows="3" disabled={!canWrite} />
        </label>
      </div>
      <button type="submit" disabled={isSaving || !canWrite}>{isSaving ? 'Saving...' : 'Save Job'}</button>
    </form>
  );
}

function getDefaultTaxSettings(shopProfile = {}) {
  return {
    state: shopProfile?.taxState || '',
    salesTaxRate: shopProfile?.salesTaxRate || '',
    taxLabel: shopProfile?.taxLabel || 'Sales Tax',
    taxRegistrationNumber: shopProfile?.taxRegistrationNumber || '',
    currencyCode: shopProfile?.currencyCode || 'USD',
    locale: shopProfile?.locale || 'en-US',
    dateFormat: shopProfile?.dateFormat || '',
    measurementSystem: shopProfile?.measurementSystem || getDefaultMeasurementPreferences(shopProfile || {}).measurementSystem,
    lengthUnit: shopProfile?.lengthUnit || getDefaultMeasurementPreferences(shopProfile || {}).lengthUnit,
    taxableParts: shopProfile?.taxablePartsDefault !== false,
    taxableServices: Boolean(shopProfile?.taxableServicesDefault)
  };
}

function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message || fallback);
  }

  return fallback;
}
