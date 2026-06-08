import { useEffect, useMemo, useState } from 'react';
import { formatShopDate, formatShopDateTime } from '../../shared/utils/dateFormat';
import { getCurrentShopId, getShopDateOptions } from '../shops/shopConfig';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import UnsavedChangesBadge from '../../shared/components/UnsavedChangesBadge.jsx';
import {
  cancelScheduleEvent,
  completeScheduleEvent,
  createScheduleEvent,
  deleteScheduleEvent,
  listScheduleEvents,
  scheduleEventTypes,
  scheduleStatuses,
  updateScheduleEvent
} from './schedulingService';

const emptyEventForm = {
  title: '',
  description: '',
  eventType: 'intake',
  startsAt: '',
  endsAt: '',
  allDay: false,
  status: 'scheduled',
  jobId: '',
  customerId: '',
  location: ''
};

function startOfWeek(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - day);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDatetimeLocal(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function defaultStartDateTime(date = new Date()) {
  const next = new Date(date);
  next.setHours(9, 0, 0, 0);
  return toDatetimeLocal(next);
}

function eventTypeLabel(value) {
  return scheduleEventTypes.find((type) => type.value === value)?.label || 'Other';
}

function statusLabel(value) {
  return scheduleStatuses.find((status) => status.value === value)?.label || value;
}

export default function SchedulingPage({
  canWrite = true,
  customers = [],
  jobs = [],
  onDirtyChange,
  onNotice,
  shopId = getCurrentShopId()
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({ eventType: '', status: '' });
  const [eventForm, setEventForm] = useState(() => ({ ...emptyEventForm, startsAt: defaultStartDateTime() }));
  const [editingEventId, setEditingEventId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { isDirty, markDirty, markClean, confirmIfDirty } = useUnsavedChanges();
  const [saveStatus, setSaveStatus] = useState('saved');
  const dateOptions = getShopDateOptions();
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  useEffect(() => {
    loadEvents().catch((error) => {
      console.error('Schedule load failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to load schedule.' });
    });
  }, [shopId, weekStart, filters.eventType, filters.status]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  async function loadEvents() {
    setIsLoading(true);
    try {
      const loadedEvents = await listScheduleEvents(shopId, weekStart, weekEnd, filters);
      setEvents(loadedEvents);
      return loadedEvents;
    } finally {
      setIsLoading(false);
    }
  }

  function updateForm(field, value) {
    setEventForm((current) => ({ ...current, [field]: value }));
    markDirty();
    setSaveStatus('unsaved');
  }

  function startNewEvent(date = new Date(), options = {}) {
    if (!options.skipDirtyGuard && !confirmIfDirty()) {
      return;
    }

    setEditingEventId('');
    setEventForm({ ...emptyEventForm, startsAt: defaultStartDateTime(date) });
    markClean();
    setSaveStatus('saved');
  }

  function editEvent(scheduleEvent, options = {}) {
    if (!options.skipDirtyGuard && !confirmIfDirty()) {
      return;
    }

    setEditingEventId(scheduleEvent.id);
    setEventForm({
      title: scheduleEvent.title || '',
      description: scheduleEvent.description || '',
      eventType: scheduleEvent.eventType || 'other',
      startsAt: toDatetimeLocal(scheduleEvent.startsAt),
      endsAt: toDatetimeLocal(scheduleEvent.endsAt),
      allDay: Boolean(scheduleEvent.allDay),
      status: scheduleEvent.status || 'scheduled',
      jobId: scheduleEvent.jobId || '',
      customerId: scheduleEvent.customerId || '',
      location: scheduleEvent.location || ''
    });
    markClean();
    setSaveStatus('saved');
  }

  async function saveEvent(event) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      if (editingEventId) {
        await updateScheduleEvent(editingEventId, eventForm);
        onNotice?.({ type: 'success', message: 'Schedule event updated.' });
      } else {
        await createScheduleEvent(shopId, eventForm);
        onNotice?.({ type: 'success', message: 'Schedule event created.' });
      }
      markClean();
      setSaveStatus('saved');
      startNewEvent(new Date(), { skipDirtyGuard: true });
      await loadEvents();
    } catch (error) {
      console.error('Schedule save failed.', error);
      markDirty();
      setSaveStatus('error');
      onNotice?.({ type: 'error', message: error.message || 'Unable to save schedule event.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function updateEventStatus(scheduleEvent, action) {
    if (!canWrite) {
      return;
    }
    setIsSaving(true);
    try {
      if (action === 'complete') {
        await completeScheduleEvent(scheduleEvent.id);
        onNotice?.({ type: 'success', message: 'Schedule event completed.' });
      } else {
        await cancelScheduleEvent(scheduleEvent.id);
        onNotice?.({ type: 'success', message: 'Schedule event cancelled.' });
      }
      await loadEvents();
    } catch (error) {
      console.error('Schedule status update failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to update schedule event.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function removeEvent(scheduleEvent) {
    if (!canWrite) {
      return;
    }
    const confirmed = window.confirm(`Delete ${scheduleEvent.title}?`);
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    try {
      await deleteScheduleEvent(scheduleEvent.id);
      onNotice?.({ type: 'success', message: 'Schedule event deleted.' });
      await loadEvents();
    } catch (error) {
      console.error('Schedule delete failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to delete schedule event.' });
    } finally {
      setIsSaving(false);
    }
  }

  function linkedJobLabel(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) {
      return '';
    }
    return [job.jobNumber, job.customerName, job.guitarBrand, job.model].filter(Boolean).join(' | ');
  }

  function linkedCustomerLabel(customerId) {
    const customer = customers.find((item) => item.id === customerId);
    return customer?.displayName || customer?.customerName || '';
  }

  function eventsForDay(day) {
    return events.filter((scheduleEvent) => {
      const eventDate = new Date(scheduleEvent.startsAt);
      return eventDate.toDateString() === day.toDateString();
    });
  }

  return (
    <section className="panel scheduling-page">
      <div className="section-header">
        <div>
          <h2>Scheduling</h2>
          <p className="muted-text">Week view for intake, pickup, due dates, follow-ups, and shop blocks.</p>
        </div>
        <div className="mode-actions">
          <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</button>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}>Previous Week</button>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next Week</button>
          {canWrite && <button type="button" className="primary-action" onClick={() => startNewEvent(new Date())}>Add Event</button>}
        </div>
      </div>

      <div className="schedule-toolbar">
        <strong>{formatShopDate(weekStart, dateOptions)} - {formatShopDate(addDays(weekEnd, -1), dateOptions)}</strong>
        <label>
          Type
          <select value={filters.eventType} onChange={(event) => setFilters((current) => ({ ...current, eventType: event.target.value }))}>
            <option value="">All types</option>
            {scheduleEventTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">All statuses</option>
            {scheduleStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </label>
        {isLoading && <span className="muted-text">Loading schedule...</span>}
      </div>

      <div className="schedule-layout">
        <div className="week-grid">
          {weekDays.map((day) => (
            <section key={day.toISOString()} className="schedule-day">
              <button type="button" className="schedule-day-heading" onClick={() => startNewEvent(day)} disabled={!canWrite}>
                <strong>{day.toLocaleDateString(undefined, { weekday: 'short' })}</strong>
                <span>{formatShopDate(day, dateOptions)}</span>
              </button>
              <div className="schedule-event-list">
                {eventsForDay(day).map((scheduleEvent) => (
                  <article key={scheduleEvent.id} className={`schedule-card ${scheduleEvent.status}`}>
                    <div>
                      <span className="status-pill">{eventTypeLabel(scheduleEvent.eventType)}</span>
                      <span className="muted-text">{scheduleEvent.allDay ? 'All day' : formatShopDateTime(scheduleEvent.startsAt, dateOptions)}</span>
                    </div>
                    <h3>{scheduleEvent.title}</h3>
                    <p>{linkedJobLabel(scheduleEvent.jobId) || linkedCustomerLabel(scheduleEvent.customerId) || scheduleEvent.location || 'No linked job/customer'}</p>
                    <p className="muted-text">{statusLabel(scheduleEvent.status)}</p>
                    <div className="mode-actions no-print">
                      <button type="button" onClick={() => editEvent(scheduleEvent)}>Edit</button>
                      {canWrite && scheduleEvent.status === 'scheduled' && (
                        <>
                          <button type="button" onClick={() => updateEventStatus(scheduleEvent, 'complete')} disabled={isSaving}>Complete</button>
                          <button type="button" onClick={() => updateEventStatus(scheduleEvent, 'cancel')} disabled={isSaving}>Cancel</button>
                        </>
                      )}
                      {canWrite && <button type="button" className="row-remove" onClick={() => removeEvent(scheduleEvent)} disabled={isSaving}>Delete</button>}
                    </div>
                  </article>
                ))}
                {!eventsForDay(day).length && <p className="muted-text">No events</p>}
              </div>
            </section>
          ))}
        </div>

        <form className="schedule-editor" onSubmit={saveEvent}>
          <div className="editor-heading">
            <h3>{editingEventId ? 'Edit Event' : 'Add Event'}</h3>
            {(isDirty || saveStatus === 'saving' || saveStatus === 'error') && (
              <UnsavedChangesBadge
                state={saveStatus}
                reminder={isDirty ? 'Remember to save before leaving.' : ''}
              />
            )}
          </div>
          {!canWrite && <p className="muted-text">Your shop role can view schedule events but cannot change them.</p>}
          <div className="form-grid">
            <label>Title<input value={eventForm.title} onChange={(event) => updateForm('title', event.target.value)} disabled={!canWrite} required /></label>
            <label>Type<select value={eventForm.eventType} onChange={(event) => updateForm('eventType', event.target.value)} disabled={!canWrite}>{scheduleEventTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <label>Start<input type="datetime-local" value={eventForm.startsAt} onChange={(event) => updateForm('startsAt', event.target.value)} disabled={!canWrite} required /></label>
            <label>End<input type="datetime-local" value={eventForm.endsAt} onChange={(event) => updateForm('endsAt', event.target.value)} disabled={!canWrite} /></label>
            <label>Status<select value={eventForm.status} onChange={(event) => updateForm('status', event.target.value)} disabled={!canWrite}>{scheduleStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
            <label>Linked Job<select value={eventForm.jobId} onChange={(event) => updateForm('jobId', event.target.value)} disabled={!canWrite}><option value="">No linked job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{linkedJobLabel(job.id)}</option>)}</select></label>
            <label>Linked Customer<select value={eventForm.customerId} onChange={(event) => updateForm('customerId', event.target.value)} disabled={!canWrite}><option value="">No linked customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName || customer.customerName || customer.email || customer.id}</option>)}</select></label>
            <label>Location<input value={eventForm.location} onChange={(event) => updateForm('location', event.target.value)} disabled={!canWrite} /></label>
          </div>
          <label className="table-checkbox">
            <input type="checkbox" checked={eventForm.allDay} onChange={(event) => updateForm('allDay', event.target.checked)} disabled={!canWrite} />
            All day
          </label>
          <label>Description<textarea value={eventForm.description} onChange={(event) => updateForm('description', event.target.value)} rows="4" disabled={!canWrite} /></label>
          {canWrite && (
            <div className="mode-actions">
              <button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Event'}</button>
              <button type="button" onClick={() => startNewEvent()}>Clear</button>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
