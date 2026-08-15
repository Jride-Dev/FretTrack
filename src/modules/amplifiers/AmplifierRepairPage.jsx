import { useEffect, useMemo, useState } from 'react';
import { formatShopDate, toIsoDateInputValue } from '../../shared/utils/dateFormat.js';
import { JOB_PRIORITY_OPTIONS } from '../jobs/jobPriority.js';
import AmplifierMakeModelFields from './AmplifierMakeModelFields.jsx';
import {
  AMPLIFIER_TECHNOLOGIES,
  AMPLIFIER_TYPES,
  buildAmplifierJobDraft,
  filterAmplifierJobs
} from './amplifierRepair.js';

function initialForm() {
  return {
    customerId: '',
    customerName: '',
    phone: '',
    email: '',
    guitarBrand: '',
    model: '',
    instrumentYear: '',
    serial: '',
    amplifierType: 'Combo',
    technology: 'Unknown',
    reasonForVisit: '',
    dateReceived: toIsoDateInputValue(),
    promiseDate: '',
    priority: 'regular'
  };
}

export default function AmplifierRepairPage({
  jobs = [],
  customers = [],
  canWrite = true,
  isEntitled = true,
  isOnline = true,
  dateOptions = {},
  onCreateJob,
  onSelectJob,
  onNotice,
  onDirtyChange
}) {
  const [initialValues] = useState(initialForm);
  const [form, setForm] = useState(initialValues);
  const [search, setSearch] = useState('');
  const [includeClosed, setIncludeClosed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const visibleJobs = useMemo(() => filterAmplifierJobs(jobs, search, includeClosed), [includeClosed, jobs, search]);
  const selectedCustomer = customers.find((customer) => customer.id === form.customerId) || null;
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialValues), [form, initialValues]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function selectCustomer(event) {
    const customerId = event.target.value;
    const customer = customers.find((item) => item.id === customerId);
    setForm((current) => ({
      ...current,
      customerId,
      customerName: customer?.displayName || customer?.customerName || '',
      phone: customer?.phone || '',
      email: customer?.email || ''
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!canWrite) {
      onNotice?.({ type: 'error', message: 'Your shop role is read-only.' });
      return;
    }
    if (!isOnline) {
      onNotice?.({ type: 'error', message: 'Creating amplifier work orders requires an active connection.' });
      return;
    }
    if (!String(form.customerName || '').trim() || !String(form.guitarBrand || '').trim()) {
      onNotice?.({ type: 'error', message: 'Customer and amplifier brand are required.' });
      return;
    }

    setIsSaving(true);
    try {
      await onCreateJob?.(buildAmplifierJobDraft(form, selectedCustomer));
      setForm(initialValues);
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || 'Amplifier work order could not be created.' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="amplifier-repair-page">
      <div className="panel-heading amplifier-module-heading">
        <div>
          <p className="eyebrow">Repair module</p>
          <h2>Amplifier Repair</h2>
          <p className="muted-text">Create amplifier work orders and keep diagnosis, repair, and bench-test records together.</p>
        </div>
        <span className="amplifier-job-count">{visibleJobs.length} shown</span>
      </div>

      <div className="amplifier-module-grid">
        <form className="panel amplifier-intake" onSubmit={submit} aria-disabled={!isEntitled}>
          <h3>New Amplifier Work Order</h3>
          {!isEntitled && <p className="feature-access-note">Amplifier Repair is available on Pro. Existing amplifier work orders remain available to view.</p>}
          {isEntitled && !canWrite && <p className="muted-text">Your shop role can view amplifier work orders but cannot create them.</p>}
          <div className="form-grid">
            <label className="wide">
              Existing Customer
              <select name="customerId" value={form.customerId} onChange={selectCustomer} disabled={!canWrite || !isEntitled}>
                <option value="">Enter a customer below</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.displayName || customer.customerName || 'Unnamed Customer'}</option>
                ))}
              </select>
            </label>
            <label>
              Customer
              <input name="customerName" value={form.customerName} onChange={updateField} disabled={!canWrite || !isEntitled} required />
            </label>
            <label>
              Phone
              <input name="phone" value={form.phone} onChange={updateField} disabled={!canWrite || !isEntitled} />
            </label>
            <label>
              Email
              <input type="email" name="email" value={form.email} onChange={updateField} disabled={!canWrite || !isEntitled} />
            </label>
            <AmplifierMakeModelFields
              brand={form.guitarBrand}
              model={form.model}
              disabled={!canWrite || !isEntitled}
              requiredBrand
              listIdPrefix="amplifier-intake"
              onChange={updateField}
            />
            <label>
              Year
              <input name="instrumentYear" value={form.instrumentYear} onChange={updateField} disabled={!canWrite || !isEntitled} />
            </label>
            <label>
              Serial Number
              <input name="serial" value={form.serial} onChange={updateField} disabled={!canWrite || !isEntitled} />
            </label>
            <label>
              Amplifier Type
              <select name="amplifierType" value={form.amplifierType} onChange={updateField} disabled={!canWrite || !isEntitled}>
                {AMPLIFIER_TYPES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Technology
              <select name="technology" value={form.technology} onChange={updateField} disabled={!canWrite || !isEntitled}>
                {AMPLIFIER_TECHNOLOGIES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Date Received
              <input type="date" name="dateReceived" value={form.dateReceived} onChange={updateField} disabled={!canWrite || !isEntitled} />
            </label>
            <label>
              Promise Date
              <input type="date" name="promiseDate" value={form.promiseDate} onChange={updateField} disabled={!canWrite || !isEntitled} />
            </label>
            <label>
              Priority
              <select name="priority" value={form.priority} onChange={updateField} disabled={!canWrite || !isEntitled}>
                {JOB_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="wide">
              Reported Symptoms / Customer Request
              <textarea name="reasonForVisit" value={form.reasonForVisit} onChange={updateField} rows="4" disabled={!canWrite || !isEntitled} />
            </label>
          </div>
          <button type="submit" disabled={!isEntitled || !canWrite || !isOnline || isSaving}>{isSaving ? 'Creating…' : 'Create Amplifier Work Order'}</button>
        </form>

        <section className="panel amplifier-queue">
          <div className="panel-heading">
            <div>
              <h3>Amplifier Work Queue</h3>
              <p className="muted-text">Open a work order to record bench findings and repair details.</p>
            </div>
          </div>
          <div className="amplifier-queue-filters">
            <label>
              Search
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Job, customer, brand, model…" />
            </label>
            <label className="checkline">
              <input type="checkbox" checked={includeClosed} onChange={(event) => setIncludeClosed(event.target.checked)} />
              Show closed jobs
            </label>
          </div>
          <div className="amplifier-job-list">
            {visibleJobs.map((job) => (
              <button type="button" className="amplifier-job-card" key={job.id} onClick={() => onSelectJob?.(job.id)}>
                <span className="amplifier-job-card-heading">
                  <strong>#{job.jobNumber || 'Pending number'}</strong>
                  <span>{job.status || 'Checked In'}</span>
                </span>
                <span>{job.guitarBrand || 'Unknown brand'} {job.model || ''}</span>
                <span>{job.customerName || 'Unnamed customer'}</span>
                <small>{formatShopDate(job.dateReceived, dateOptions) || 'No received date'}</small>
              </button>
            ))}
            {!visibleJobs.length && <p className="empty-state">No amplifier work orders match these filters.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}
