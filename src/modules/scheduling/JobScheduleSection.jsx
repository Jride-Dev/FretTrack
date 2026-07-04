import { useEffect, useState } from 'react';
import { formatShopDateTime } from '../../shared/utils/dateFormat';
import { getShopDateOptions } from '../shops/shopConfig';
import {
  cancelScheduleEvent,
  completeScheduleEvent,
  createScheduleEvent,
  listJobScheduleEvents,
  scheduleEventTypes
} from './schedulingService';

function toDatetimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  date.setHours(date.getHours() || 9, date.getMinutes() || 0, 0, 0);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function defaultTitle(type, job) {
  const label = type === 'due'
    ? 'Due date'
    : type === 'pickup'
      ? 'Pickup appointment'
      : 'Follow-up reminder';
  return `${label}: ${job.jobNumber || job.customerName || 'Job'}`;
}

export default function JobScheduleSection({ canWrite = true, job, onNotice }) {
  const [events, setEvents] = useState([]);
  const [quickType, setQuickType] = useState('due');
  const [quickStart, setQuickStart] = useState(() => toDatetimeLocal(job.dueDate || job.promisedDate || job.techDetails?.dueDate));
  const [isLoading, setIsLoading] = useState(false);
  const dateOptions = getShopDateOptions(job.techDetails?.tax);

  useEffect(() => {
    loadEvents().catch((error) => {
      console.error('Job schedule load failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to load job schedule.' });
    });
  }, [job.id]);

  async function loadEvents() {
    setIsLoading(true);
    try {
      const linkedEvents = await listJobScheduleEvents(job.id);
      setEvents(linkedEvents);
      return linkedEvents;
    } finally {
      setIsLoading(false);
    }
  }

  async function addQuickEvent(event) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }
    try {
      await createScheduleEvent(job.shopId, {
        title: defaultTitle(quickType, job),
        eventType: quickType,
        startsAt: quickStart,
        status: 'scheduled',
        jobId: job.id,
        customerId: job.customerId || '',
        location: '',
        description: job.reasonForVisit || ''
      });
      onNotice?.({ type: 'success', message: 'Schedule event added to job.' });
      await loadEvents();
    } catch (error) {
      console.error('Job schedule create failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to add schedule event.' });
    }
  }

  async function setEventStatus(scheduleEvent, action) {
    if (!canWrite) {
      return;
    }
    try {
      if (action === 'complete') {
        await completeScheduleEvent(scheduleEvent.id);
      } else {
        await cancelScheduleEvent(scheduleEvent.id);
      }
      await loadEvents();
    } catch (error) {
      console.error('Job schedule status failed.', error);
      onNotice?.({ type: 'error', message: error.message || 'Unable to update schedule event.' });
    }
  }

  return (
    <section className="job-tab-panel job-schedule-section">
      <div className="section-header">
        <div>
          <h3>Scheduling</h3>
          <p className="muted-text">Shop due dates, pickup appointments, and follow-up reminders for this job.</p>
        </div>
      </div>

      {canWrite && (
        <form className="row-form schedule-quick-form" onSubmit={addQuickEvent}>
          <select value={quickType} onChange={(event) => setQuickType(event.target.value)}>
            {scheduleEventTypes
              .filter((type) => ['due', 'pickup', 'follow_up'].includes(type.value))
              .map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <input type="datetime-local" value={quickStart} onChange={(event) => setQuickStart(event.target.value)} required />
          <button type="submit">Add Schedule Event</button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Title</th>
            <th>Type</th>
            <th>Status</th>
            <th className="no-print">Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((scheduleEvent) => (
            <tr key={scheduleEvent.id}>
              <td>{scheduleEvent.allDay ? 'All day' : formatShopDateTime(scheduleEvent.startsAt, dateOptions)}</td>
              <td>{scheduleEvent.title}</td>
              <td>{scheduleEventTypes.find((type) => type.value === scheduleEvent.eventType)?.label || scheduleEvent.eventType}</td>
              <td>{scheduleEvent.status}</td>
              <td className="no-print">
                {canWrite && scheduleEvent.status === 'scheduled' ? (
                  <div className="mode-actions">
                    <button type="button" onClick={() => setEventStatus(scheduleEvent, 'complete')}>Complete</button>
                    <button type="button" onClick={() => setEventStatus(scheduleEvent, 'cancel')}>Cancel</button>
                  </div>
                ) : '-'}
              </td>
            </tr>
          ))}
          {!events.length && (
            <tr>
              <td colSpan="5">{isLoading ? 'Loading schedule...' : 'No linked schedule events yet.'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
