import { useEffect, useMemo, useRef, useState } from 'react';
import { formatShopDate, toIsoDateInputValue } from '../../shared/utils/dateFormat.js';
import { JOB_PRIORITY_OPTIONS } from '../jobs/jobPriority.js';
import KeyboardMakeModelFields from './KeyboardMakeModelFields.jsx';
import { KEYBOARD_SENSOR_TECHNOLOGIES, buildKeyboardRepairAnalytics } from './keyboardDiagnostics.js';
import { listKeyboardKeyStates } from './keyboardWorkflowService.js';
import {
  KEYBOARD_ACTIONS,
  KEYBOARD_KEY_COUNTS,
  KEYBOARD_TYPES,
  buildKeyboardJobDraft,
  filterKeyboardJobs
} from './keyboardRepair.js';

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
    keyboardType: 'Synthesizer',
    keyCount: '61',
    keyAction: 'Unknown',
    sensorTechnology: 'Unknown',
    includedAccessories: '',
    reasonForVisit: '',
    dateReceived: toIsoDateInputValue(),
    promiseDate: '',
    priority: 'regular'
  };
}

export default function KeyboardRepairPage({
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
  const submitLockRef = useRef(false);
  const [keyStates, setKeyStates] = useState([]);
  const visibleJobs = useMemo(() => filterKeyboardJobs(jobs, search, includeClosed), [includeClosed, jobs, search]);
  const selectedCustomer = customers.find((customer) => customer.id === form.customerId) || null;
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialValues), [form, initialValues]);
  const keyboardJobIds = useMemo(() => jobs.filter((job) => String(job.techDetails?.instrumentType || job.instrumentType || '').toLowerCase() === 'keyboard').map((job) => job.id).filter(Boolean), [jobs]);
  const analytics = useMemo(() => buildKeyboardRepairAnalytics(jobs, keyStates), [jobs, keyStates]);

  useEffect(() => {
    let active = true;
    listKeyboardKeyStates(keyboardJobIds)
      .then((rows) => { if (active) setKeyStates(rows); })
      .catch((error) => console.warn('Keyboard repair analytics could not load key findings.', error));
    return () => { active = false; };
  }, [keyboardJobIds.join(',')]);

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
    if (submitLockRef.current) {
      return;
    }
    if (!canWrite) {
      onNotice?.({ type: 'error', message: 'Your shop role is read-only.' });
      return;
    }
    if (!isOnline) {
      onNotice?.({ type: 'error', message: 'Creating keyboard work orders requires an active connection.' });
      return;
    }
    if (!String(form.customerName || '').trim() || !String(form.guitarBrand || '').trim()) {
      onNotice?.({ type: 'error', message: 'Customer and keyboard manufacturer are required.' });
      return;
    }

    submitLockRef.current = true;
    setIsSaving(true);
    try {
      await onCreateJob?.(buildKeyboardJobDraft(form, selectedCustomer));
      setForm(initialValues);
    } catch (error) {
      onNotice?.({ type: 'error', message: error?.message || 'Keyboard work order could not be created.' });
    } finally {
      submitLockRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <section className="keyboard-repair-page amplifier-repair-page">
      <div className="panel-heading keyboard-module-heading amplifier-module-heading">
        <div>
          <p className="eyebrow">Repair module</p>
          <h2>Keyboard Repair</h2>
          <p className="muted-text">Create keyboard work orders and keep keybed, electronics, MIDI, and final-test records together.</p>
        </div>
        <span className="keyboard-job-count amplifier-job-count">{visibleJobs.length} shown</span>
      </div>

      <section className="keyboard-analytics-grid" aria-label="Keyboard repair analytics">
        <article><strong>{analytics.openJobs}</strong><span>Open keyboard jobs</span></article>
        <article><strong>{analytics.averageRepairDays == null ? '—' : analytics.averageRepairDays.toFixed(1)}</strong><span>Average repair days</span></article>
        <article><strong>{analytics.topModel?.[0] || '—'}</strong><span>{analytics.topModel ? `${analytics.topModel[1]} repair${analytics.topModel[1] === 1 ? '' : 's'}` : 'Most serviced model'}</span></article>
        <article><strong>{analytics.topFault?.[0] || '—'}</strong><span>{analytics.topFault ? `${analytics.topFault[1]} logged key fault${analytics.topFault[1] === 1 ? '' : 's'}` : 'Most common key fault'}</span></article>
      </section>

      <div className="keyboard-module-grid amplifier-module-grid">
        <form className="panel keyboard-intake amplifier-intake" onSubmit={submit} aria-disabled={!isEntitled}>
          <h3>New Keyboard Work Order</h3>
          {!isEntitled && <p className="feature-access-note">Keyboard Repair is available on Pro. Existing keyboard work orders remain available to view.</p>}
          {isEntitled && !canWrite && <p className="muted-text">Your shop role can view keyboard work orders but cannot create them.</p>}
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
            <KeyboardMakeModelFields
              brand={form.guitarBrand}
              model={form.model}
              disabled={!canWrite || !isEntitled}
              requiredBrand
              listIdPrefix="keyboard-intake"
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
              Keyboard Type
              <select name="keyboardType" value={form.keyboardType} onChange={updateField} disabled={!canWrite || !isEntitled}>
                {KEYBOARD_TYPES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Key Count
              <select name="keyCount" value={form.keyCount} onChange={updateField} disabled={!canWrite || !isEntitled}>
                {KEYBOARD_KEY_COUNTS.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Key Action
              <select name="keyAction" value={form.keyAction} onChange={updateField} disabled={!canWrite || !isEntitled}>
                {KEYBOARD_ACTIONS.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Sensor Technology
              <select name="sensorTechnology" value={form.sensorTechnology} onChange={updateField} disabled={!canWrite || !isEntitled}>
                {KEYBOARD_SENSOR_TECHNOLOGIES.map((value) => <option key={value}>{value}</option>)}
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
              Included Accessories
              <input name="includedAccessories" value={form.includedAccessories} onChange={updateField} disabled={!canWrite || !isEntitled} placeholder="Power adapter, pedal, case…" />
            </label>
            <label className="wide">
              Reported Symptoms / Customer Request
              <textarea name="reasonForVisit" value={form.reasonForVisit} onChange={updateField} rows="4" disabled={!canWrite || !isEntitled} />
            </label>
          </div>
          <button type="submit" disabled={!isEntitled || !canWrite || !isOnline || isSaving}>{isSaving ? 'Creating…' : 'Create Keyboard Work Order'}</button>
        </form>

        <section className="panel keyboard-queue amplifier-queue">
          <div className="panel-heading">
            <div>
              <h3>Keyboard Work Queue</h3>
              <p className="muted-text">Open a work order to record keybed, electronics, and functional-test findings.</p>
            </div>
          </div>
          <div className="keyboard-queue-filters amplifier-queue-filters">
            <label>
              Search
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Job, customer, make, model, key…" />
            </label>
            <label className="checkline">
              <input type="checkbox" checked={includeClosed} onChange={(event) => setIncludeClosed(event.target.checked)} />
              Show closed jobs
            </label>
          </div>
          <div className="keyboard-job-list amplifier-job-list">
            {visibleJobs.map((job) => (
              <button type="button" className="keyboard-job-card amplifier-job-card" key={job.id} onClick={() => onSelectJob?.(job.id)}>
                <span className="keyboard-job-card-heading amplifier-job-card-heading">
                  <strong>#{job.jobNumber || 'Pending number'}</strong>
                  <span>{job.status || 'Checked In'}</span>
                </span>
                <span>{job.guitarBrand || 'Unknown manufacturer'} {job.model || ''}</span>
                <span>{job.customerName || 'Unnamed customer'}</span>
                <small>{formatShopDate(job.dateReceived, dateOptions) || 'No received date'}</small>
              </button>
            ))}
            {!visibleJobs.length && <p className="empty-state">No keyboard work orders match these filters.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}
