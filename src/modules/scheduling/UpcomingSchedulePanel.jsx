import { useEffect, useState } from 'react';
import { formatShopDateTime } from '../../shared/utils/dateFormat';
import { getCurrentShopId, getShopDateOptions } from '../shops/shopConfig';
import { listUpcomingEvents, scheduleEventTypes } from './schedulingService';

function eventTypeLabel(value) {
  return scheduleEventTypes.find((type) => type.value === value)?.label || 'Other';
}

export default function UpcomingSchedulePanel({ shopId = getCurrentShopId(), onOpenSchedule }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const dateOptions = getShopDateOptions();

  useEffect(() => {
    if (!shopId) {
      setEvents([]);
      return;
    }
    setIsLoading(true);
    listUpcomingEvents(shopId, 5)
      .then(setEvents)
      .catch((error) => {
        console.warn('Upcoming schedule load failed.', error);
        setEvents([]);
      })
      .finally(() => setIsLoading(false));
  }, [shopId]);

  return (
    <section className="panel upcoming-schedule no-print">
      <div className="section-header compact">
        <h2>Upcoming Schedule</h2>
        <button type="button" onClick={onOpenSchedule}>Open</button>
      </div>
      <div className="upcoming-list">
        {events.map((scheduleEvent) => (
          <article key={scheduleEvent.id}>
            <strong>{scheduleEvent.title}</strong>
            <span>{eventTypeLabel(scheduleEvent.eventType)} | {scheduleEvent.allDay ? 'All day' : formatShopDateTime(scheduleEvent.startsAt, dateOptions)}</span>
          </article>
        ))}
        {!events.length && <p className="muted-text">{isLoading ? 'Loading...' : 'No upcoming scheduled events.'}</p>}
      </div>
    </section>
  );
}
