import { formatShopDateTime } from '../../shared/utils/dateFormat';
import { getShopDateOptions } from '../shops/shopConfig';

const VISIBLE_EVENT_TYPES = new Set([
  'job_created',
  'job_updated',
  'status_changed',
  'image_uploaded',
  'image_deleted',
  'payment_added',
  'work_log_added'
]);

export default function ActivityTimeline({ events = [] }) {
  const visibleEvents = events.filter((event) => VISIBLE_EVENT_TYPES.has(event.eventType || event.event_type));
  const dateOptions = getShopDateOptions();

  return (
    <section className="activity-timeline no-print">
      <h3>Activity Timeline</h3>
      {visibleEvents.length === 0 ? (
        <p className="empty">No activity events recorded yet.</p>
      ) : (
        <ol className="timeline-list">
          {visibleEvents.map((event) => (
            <li key={event.id}>
              <time>{formatShopDateTime(event.createdAt || event.created_at, dateOptions)}</time>
              <strong>{event.eventLabel || event.event_label}</strong>
              {(event.eventNote || event.event_note) && <span>{event.eventNote || event.event_note}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
