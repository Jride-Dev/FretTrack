import { useEffect, useState } from 'react';
import { addJob } from './jobService';
import { generateJobNumber } from './jobNumber';
import { combineCustomerName, findCustomerMatches } from '../customers/customerService';
import { instrumentCatalog } from '../instruments/instrumentService';

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function getInitialFormState(jobs = []) {
  const dateReceived = todayValue();
  return {
    customerFirstName: '',
    customerLastName: '',
    customerName: '',
    intakeType: 'Walk-In',
    subcontractorName: '',
    instrumentType: 'Electric',
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

export default function JobForm({ jobs = [], onCreate, onJobSaved, onNotice }) {
  const [form, setForm] = useState(() => getInitialFormState(jobs));
  const [isSaving, setIsSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerMatches, setCustomerMatches] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      jobNumber: generateJobNumber(current.dateReceived || todayValue(), jobs)
    }));
  }, [jobs]);

  useEffect(() => {
    setCustomerMatches(findCustomerMatches(jobs, customerSearch));
  }, [jobs, customerSearch]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => {
      const nextForm = { ...current, [name]: value };
      if (name === 'customerFirstName' || name === 'customerLastName') {
        nextForm.customerName = combineCustomerName(
          name === 'customerFirstName' ? value : current.customerFirstName,
          name === 'customerLastName' ? value : current.customerLastName
        );
      }
      if (name === 'dateReceived') {
        const dateReceived = value || todayValue();
        nextForm.jobNumber = generateJobNumber(dateReceived, jobs);
      }
      return nextForm;
    });
  }

  function setInstrumentType(instrumentType) {
    setForm((current) => ({ ...current, instrumentType }));
  }

  function useCustomer(customer) {
    setForm((current) => ({
      ...current,
      customerFirstName: customer.customerFirstName || '',
      customerLastName: customer.customerLastName || '',
      customerName: customer.customerName,
      phone: customer.phone,
      email: customer.email
    }));
    setSelectedCustomer(customer);
    setCustomerSearch(customer.customerName || customer.phone || customer.email);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const customerName = combineCustomerName(form.customerFirstName, form.customerLastName);
    if (!customerName || !form.guitarBrand.trim()) {
      return;
    }

    setIsSaving(true);

    const now = new Date().toISOString();
    const dateReceived = form.dateReceived || todayValue();

    const newJob = {
      id: crypto.randomUUID(),
      ...form,
      customerName,
      dateReceived,
      jobNumber: generateJobNumber(dateReceived, jobs),
      status: 'Checked In',
      discountType: 'none',
      discountValue: '',
      techDetails: {
        instrumentType: form.instrumentType,
        intakeType: form.intakeType,
        subcontractorName: form.subcontractorName,
        stringGauges: Array.from({ length: form.instrumentType === 'Bass' ? 4 : 6 }, () => ''),
        newStringBrand: '',
        newStringGauge: '',
        neckInspectionBefore: '',
        neckInspectionAfter: '',
        neckInspection: {
          initial: {},
          final: {}
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
          state: '',
          salesTaxRate: '',
          taxableParts: true,
          taxableServices: false
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
        message: error instanceof Error ? error.message : 'Job save failed.'
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>New Job</h2>
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
      <div className="form-grid">
        <section className="customer-lookup wide">
          <h3>Customer Lookup</h3>
          <input
            type="search"
            placeholder="Search previous customers by name, phone, or email..."
            value={customerSearch}
            onChange={(event) => {
              setCustomerSearch(event.target.value);
              setSelectedCustomer(null);
            }}
          />
          {customerMatches.length > 0 && (
            <div className="customer-results">
              {customerMatches.map((customer) => {
                const latestJob = customer.jobs[0] || {};
                const key = customer.phone || customer.email || customer.customerName;
                return (
                  <div className="customer-match" key={key}>
                    <div>
                      <strong>{customer.customerName || 'Unnamed Customer'}</strong>
                      <span>{customer.phone || 'No phone'} | {customer.email || 'No email'}</span>
                      <span>
                        {customer.jobs.length} previous job{customer.jobs.length === 1 ? '' : 's'}
                        {latestJob.jobNumber ? ` | Latest #${latestJob.jobNumber}` : ''}
                        {latestJob.dateReceived ? ` | ${latestJob.dateReceived}` : ''}
                      </span>
                    </div>
                    <button type="button" onClick={() => useCustomer(customer)}>Use Customer</button>
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
                  <strong>#{job.jobNumber || 'No number'} | {job.dateReceived || 'No date'}</strong>
                  <span>{job.guitarBrand} {job.model} | {job.status}</span>
                  <p>{job.reasonForVisit}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <label>
          First Name
          <input name="customerFirstName" value={form.customerFirstName} onChange={handleChange} required />
        </label>
        <label>
          Last Name
          <input name="customerLastName" value={form.customerLastName} onChange={handleChange} />
        </label>
        <label>
          Job Source
          <select name="intakeType" value={form.intakeType} onChange={handleChange}>
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
            placeholder="Palos Verdes Music House"
            disabled={form.intakeType !== 'Sub-Contract'}
          />
        </label>
        <div className="instrument-selector" role="group" aria-label="Instrument Type">
          <span>Instrument Type</span>
          <div className="segmented-control">
            <button
              type="button"
              className={form.instrumentType === 'Acoustic' ? 'active' : ''}
              onClick={() => setInstrumentType('Acoustic')}
            >
              Acoustic
            </button>
            <button
              type="button"
              className={form.instrumentType === 'Electric' ? 'active' : ''}
              onClick={() => setInstrumentType('Electric')}
            >
              Electric
            </button>
            <button
              type="button"
              className={form.instrumentType === 'Bass' ? 'active' : ''}
              onClick={() => setInstrumentType('Bass')}
            >
              Bass
            </button>
          </div>
        </div>
        <label>
          Phone
          <input name="phone" value={form.phone} onChange={handleChange} />
        </label>
        <label>
          Email
          <input type="email" name="email" value={form.email} onChange={handleChange} />
        </label>
        <label>
          Brand
          <input name="guitarBrand" list="new-job-brand-options" value={form.guitarBrand} onChange={handleChange} required />
        </label>
        <label>
          Model
          <input name="model" list="new-job-model-options" value={form.model} onChange={handleChange} />
        </label>
        <label>
          Serial
          <input name="serial" value={form.serial} onChange={handleChange} />
        </label>
        <label>
          Color
          <input name="color" value={form.color} onChange={handleChange} />
        </label>
        <label>
          Date Received
          <input type="date" name="dateReceived" value={form.dateReceived} onChange={handleChange} />
        </label>
        <label>
          Job Number
          <input name="jobNumber" value={form.jobNumber} readOnly />
        </label>
        <label className="wide">
          Reason For Visit
          <textarea name="reasonForVisit" value={form.reasonForVisit} onChange={handleChange} rows="3" />
        </label>
      </div>
      <button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Job'}</button>
    </form>
  );
}
