import { useEffect, useState } from 'react';
import { addJob } from './jobService';
import { generateJobNumber } from './jobNumber';
import { combineCustomerName, findCustomerMatches } from '../customers';
import {
  getDefaultStringCount,
  getBrandsForInstrumentType,
  getInstrumentTypeOptions,
  getModelsForBrand,
  getOrientationOptions,
  getStringCountOptions,
  normalizeInstrumentType,
  normalizeStringCount,
  resizeStringGauges,
  shouldResetBrandForInstrumentType,
  shouldResetModelForBrand,
} from '../instruments/instrumentService';
import { formatShopDate, toIsoDateInputValue } from '../../shared/utils/dateFormat';
import { getDefaultMeasurementPreferences } from '../../shared/utils/measurements';
import { getShopDateOptions } from '../shops/shopConfig';
import { smsEnabled } from '../../data/messagesRepository';
import { stateOptionsWithCurrent } from '../../data/usStates';
import { JOB_PRIORITY_OPTIONS, normalizeJobPriority } from './jobPriority';
import { JOB_SOURCE_OPTIONS } from './jobSources';

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
    addressLine1: '',
    city: '',
    region: '',
    postalCode: '',
    emailOptIn: false,
    smsOptIn: false,
    preferredContactMethod: 'email',
    instrumentType: 'Electric',
    stringCount: getDefaultStringCount('Electric'),
    customStringCount: getDefaultStringCount('Electric'),
    stringCountMode: 'preset',
    phone: '',
    email: '',
    guitarBrand: '',
    model: '',
    instrumentYear: '',
    serial: '',
    color: '',
    finish: '',
    orientation: 'Unknown',
    reasonForVisit: '',
    dateReceived,
    promiseDate: '',
    priority: 'regular',
    jobNumber: generateJobNumber(dateReceived, jobs)
  };
}

export default function JobForm({
  jobs = [],
  customers = [],
  canWrite = true,
  shopProfile = null,
  initialCustomer = null,
  onCreate,
  onJobSaved,
  onNotice,
  onOfflineDraftSaved
}) {
  const [form, setForm] = useState(() => getInitialFormState(jobs));
  const [isSaving, setIsSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerMatches, setCustomerMatches] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const dateOptions = getShopDateOptions(shopProfile || undefined);
  const initialCustomerId = initialCustomer?.id || '';

  useEffect(() => {
    setForm((current) => ({
      ...current,
      jobNumber: generateJobNumber(current.dateReceived || todayValue(), jobs)
    }));
  }, [jobs]);

  useEffect(() => {
    setCustomerMatches(findCustomerMatches(customers.length ? customers : jobs, customerSearch));
  }, [customers, jobs, customerSearch]);

  useEffect(() => {
    if (initialCustomer) {
      setForm(buildCustomerSeededForm(initialCustomer, jobs));
      setSelectedCustomer(initialCustomer);
      setCustomerSearch(initialCustomer.displayName || initialCustomer.customerName || initialCustomer.phone || initialCustomer.email);
      return;
    }

    setForm(getInitialFormState(jobs));
    setCustomerSearch('');
    setCustomerMatches([]);
    setSelectedCustomer(null);
  }, [initialCustomerId]);

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
      if (name === 'guitarBrand' && shouldResetModelForBrand(current.instrumentType, value, current.model)) {
        nextForm.model = '';
      }
      if (name === 'stringCountMode') {
        if (value === 'custom') {
          nextForm.stringCount = normalizeStringCount(current.customStringCount || current.stringCount, current.instrumentType);
        } else {
          nextForm.stringCount = normalizeStringCount(value, current.instrumentType);
          nextForm.customStringCount = nextForm.stringCount;
        }
      }
      if (name === 'stringCount') {
        nextForm.stringCount = normalizeStringCount(value, current.instrumentType);
      }
      if (name === 'customStringCount') {
        nextForm.customStringCount = normalizeStringCount(value, current.instrumentType);
        nextForm.stringCount = nextForm.customStringCount;
      }
      return nextForm;
    });
  }

  function handleCheckboxChange(event) {
    const { name, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: checked
    }));
  }

  function setInstrumentType(instrumentType) {
    const normalizedInstrumentType = normalizeInstrumentType(instrumentType);
    setForm((current) => {
      const shouldResetBrand = shouldResetBrandForInstrumentType(normalizedInstrumentType, current.guitarBrand);
      const nextBrand = shouldResetBrand ? '' : current.guitarBrand;
      const shouldResetModel = shouldResetBrand || shouldResetModelForBrand(normalizedInstrumentType, nextBrand, current.model);
      const defaultStringCount = getDefaultStringCount(normalizedInstrumentType);
      return {
        ...current,
        instrumentType: normalizedInstrumentType,
        guitarBrand: nextBrand,
        model: shouldResetModel ? '' : current.model,
        stringCount: defaultStringCount,
        customStringCount: defaultStringCount,
        stringCountMode: 'preset'
      };
    });
  }

  function useCustomer(customer) {
    setForm((current) => {
      const nextForm = {
        ...current,
        customerId: customer.id || '',
        customerFirstName: customer.customerFirstName || customer.firstName || '',
        customerLastName: customer.customerLastName || customer.lastName || '',
        customerName: customer.customerName || customer.displayName,
        phone: customer.phone,
        email: customer.email,
        addressLine1: customer.addressLine1 || '',
        city: customer.city || '',
        region: customer.region || '',
        postalCode: customer.postalCode || ''
      };

      if (customer.customerType === 'subcontractor') {
        nextForm.intakeType = 'Sub-Contract';
        nextForm.subcontractorName = customer.companyName || customer.displayName || '';
      }

      return nextForm;
    });
    setSelectedCustomer(customer);
    setCustomerSearch(customer.displayName || customer.customerName || customer.phone || customer.email);
  }

  function buildCustomerSeededForm(customer, sourceJobs = []) {
    const baseForm = getInitialFormState(sourceJobs);
    const customerName = customer.customerName || customer.displayName || '';
    const nextForm = {
      ...baseForm,
      customerId: customer.id || '',
      customerFirstName: customer.customerFirstName || customer.firstName || '',
      customerLastName: customer.customerLastName || customer.lastName || '',
      customerName,
      phone: customer.phone || '',
      email: customer.email || '',
      addressLine1: customer.addressLine1 || '',
      city: customer.city || '',
      region: customer.region || '',
      postalCode: customer.postalCode || ''
    };

    if (customer.customerType === 'subcontractor') {
      nextForm.intakeType = 'Sub-Contract';
      nextForm.subcontractorName = customer.companyName || customer.displayName || '';
    }

    return nextForm;
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
      promiseDate: form.promiseDate || '',
      priority: normalizeJobPriority(form.priority),
      jobNumber: generateJobNumber(dateReceived, jobs),
      status: 'Checked In',
      discountType: 'none',
      discountValue: '',
      techDetails: {
        instrumentType: form.instrumentType,
        instrumentYear: form.instrumentYear,
        finish: form.finish,
        orientation: form.orientation || 'Unknown',
        stringCount: form.stringCount,
        intakeType: form.intakeType,
        subcontractorName: form.subcontractorName,
        priority: normalizeJobPriority(form.priority),
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
            back: { marks: [] },
            headstock: { marks: [] },
            serial_number: { marks: [] }
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
      const handledOfflineDraft = await onOfflineDraftSaved?.(newJob, error);
      if (handledOfflineDraft) {
        setForm(getInitialFormState(jobs));
        setCustomerSearch('');
        setCustomerMatches([]);
        setSelectedCustomer(null);
        return;
      }

      onNotice?.({
        type: 'error',
        message: getErrorMessage(error, 'Job save failed.')
      });
    } finally {
      setIsSaving(false);
    }
  }

  const brandOptions = getBrandsForInstrumentType(form.instrumentType);
  const modelOptions = getModelsForBrand(form.instrumentType, form.guitarBrand);
  const hasBrand = Boolean(form.guitarBrand.trim());
  const brandHelperText = 'Choose from suggestions or type a custom brand/model.';
  const modelHelperText = !hasBrand
    ? 'Choose a brand to see matching model suggestions, or type a custom model.'
    : modelOptions.length
      ? 'Choose from matching suggestions or type a custom model.'
      : 'No saved model suggestions for this brand yet. Type the model manually.';

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>New Job</h2>
      {!canWrite && <p className="muted-text">Your shop role can view work orders but cannot create new ones.</p>}
      <datalist id="new-job-brand-options">
        {brandOptions.map((brand) => (
          <option key={brand} value={brand} />
        ))}
      </datalist>
      <datalist id="new-job-model-options">
        {modelOptions.map((model) => (
          <option key={model} value={model} />
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
          Address
          <input name="addressLine1" value={form.addressLine1} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          City
          <input name="city" value={form.city} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          State
          <select name="region" value={form.region} onChange={handleChange} disabled={!canWrite}>
            <option value="">Select state</option>
            {stateOptionsWithCurrent(form.region).map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </label>
        <label>
          Zip Code
          <input name="postalCode" value={form.postalCode} onChange={handleChange} disabled={!canWrite} inputMode="numeric" />
        </label>
        <label>
          Phone
          <input name="phone" value={form.phone} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            name="smsOptIn"
            checked={Boolean(form.smsOptIn)}
            disabled={!canWrite || !smsEnabled}
            title={!smsEnabled ? 'SMS is disabled for this trial build. Email is active.' : undefined}
            onChange={handleCheckboxChange}
          />
          SMS opt-in
        </label>
        <label>
          Email
          <input type="email" name="email" value={form.email} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            name="emailOptIn"
            checked={Boolean(form.emailOptIn)}
            disabled={!canWrite}
            onChange={handleCheckboxChange}
          />
          Email opt-in
        </label>
        <label>
          Job Source
          <select name="intakeType" value={form.intakeType} onChange={handleChange} disabled={!canWrite}>
            {JOB_SOURCE_OPTIONS.map((source) => (
              <option key={source.value} value={source.value}>{source.label}</option>
            ))}
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
          <div className="segmented-control instrument-type-control">
            {getInstrumentTypeOptions().map((option) => (
              <button
                type="button"
                key={option.value}
                className={form.instrumentType === option.value ? 'active' : ''}
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
                list="new-job-brand-options"
                value={form.guitarBrand}
                onChange={handleChange}
                disabled={!canWrite}
                placeholder="Fender"
                aria-describedby="new-job-brand-helper"
                required
              />
              <span id="new-job-brand-helper" className="muted-text">{brandHelperText}</span>
            </label>
            <label>
              Model
              <input
                name="model"
                list="new-job-model-options"
                value={form.model}
                onChange={handleChange}
                disabled={!canWrite}
                placeholder="Stratocaster"
                aria-describedby="new-job-model-helper"
              />
              <span id="new-job-model-helper" className="muted-text">{modelHelperText}</span>
            </label>
            <label>
              Year
              <input
                name="instrumentYear"
                value={form.instrumentYear}
                onChange={handleChange}
                disabled={!canWrite}
                placeholder="1972"
              />
            </label>
            <label>
              Serial Number
              <input
                name="serial"
                value={form.serial}
                onChange={handleChange}
                disabled={!canWrite}
                placeholder="Z8239242, Unknown, or Not provided"
              />
            </label>
            <label>
              Color
              <input
                name="color"
                value={form.color}
                onChange={handleChange}
                disabled={!canWrite}
                placeholder="3-Color Sunburst"
              />
            </label>
            <label>
              Finish
              <input
                name="finish"
                value={form.finish}
                onChange={handleChange}
                disabled={!canWrite}
                placeholder="Gloss, Nitro, Poly, Satin"
              />
            </label>
            <label>
              Orientation
              <select name="orientation" value={form.orientation || 'Unknown'} onChange={handleChange} disabled={!canWrite}>
                {getOrientationOptions(form.orientation).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              String Count
              <select
                name="stringCountMode"
                value={getStringCountSelectValue(form)}
                onChange={handleChange}
                disabled={!canWrite}
              >
                {getStringCountOptions(form.instrumentType).map((count) => (
                  <option key={count} value={count}>{count}-string</option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </label>
            {getStringCountSelectValue(form) === 'custom' && (
              <label>
                Custom String Count
                <input
                  type="number"
                  min="1"
                  max="24"
                  name="customStringCount"
                  value={form.customStringCount || form.stringCount}
                  onChange={handleChange}
                  disabled={!canWrite}
                />
              </label>
            )}
          </div>
        </fieldset>
        <label>
          Date Received
          <input type="date" name="dateReceived" value={form.dateReceived} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Promise Date
          <input type="date" name="promiseDate" value={form.promiseDate} onChange={handleChange} disabled={!canWrite} />
        </label>
        <label>
          Priority
          <select name="priority" value={form.priority} onChange={handleChange} disabled={!canWrite}>
            {JOB_PRIORITY_OPTIONS.map((priority) => (
              <option key={priority.value} value={priority.value}>{priority.label}</option>
            ))}
          </select>
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

function getStringCountSelectValue(form) {
  const count = normalizeStringCount(form.stringCount, form.instrumentType);
  return getStringCountOptions(form.instrumentType).includes(count) ? String(count) : 'custom';
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
