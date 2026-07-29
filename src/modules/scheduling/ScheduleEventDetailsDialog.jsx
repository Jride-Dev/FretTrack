import { useEffect } from 'react';

function DetailRow({ label, value, preserveWhitespace = false }) {
  if (!value) {
    return null;
  }

  return (
    <div className="schedule-event-detail-row">
      <dt>{label}</dt>
      <dd className={preserveWhitespace ? 'schedule-event-notes' : ''}>{value}</dd>
    </div>
  );
}

export default function ScheduleEventDetailsDialog({
  canWrite,
  customerName,
  dateLabel,
  event,
  eventTypeLabel,
  instrumentLabel,
  isSaving,
  jobNumber,
  onCancel,
  onClose,
  onComplete,
  onDelete,
  onEdit,
  onReopen,
  sourceLabel,
  statusLabel,
  timeLabel
}) {
  useEffect(() => {
    if (!event) {
      return undefined;
    }

    function handleKeyDown(keyEvent) {
      if (keyEvent.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [event, onClose]);

  if (!event) {
    return null;
  }

  const isShopBlock = event.eventType === 'shop_block';
  const canComplete = canWrite && event.status === 'scheduled';
  const canReopen = canWrite && event.status !== 'scheduled';

  function handleBackdropClick(clickEvent) {
    if (clickEvent.target === clickEvent.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="feedback-backdrop no-print" role="presentation" onClick={handleBackdropClick}>
      <section
        className="feedback-modal schedule-event-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-event-details-title"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="feedback-modal-heading">
          <div>
            <p>{eventTypeLabel}</p>
            <h2 id="schedule-event-details-title">{event.title || 'Schedule Event Details'}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} autoFocus>
            Close Detail
          </button>
        </div>

        <dl className="schedule-event-details">
          <DetailRow label="Event type" value={eventTypeLabel} />
          <DetailRow label="Date" value={dateLabel} />
          <DetailRow label="Time" value={timeLabel} />
          <DetailRow label="Status" value={statusLabel} />
          <DetailRow label="Source" value={sourceLabel} />
          <DetailRow label={isShopBlock ? 'Block title' : 'Title'} value={event.title} />
          {!isShopBlock && <DetailRow label="Linked job" value={jobNumber ? `#${jobNumber}` : ''} />}
          {!isShopBlock && <DetailRow label="Customer" value={customerName} />}
          {!isShopBlock && <DetailRow label="Instrument" value={instrumentLabel} />}
          <DetailRow label="Location" value={event.location} />
          <DetailRow label="Notes / details" value={event.description} preserveWhitespace />
        </dl>

        <div className="schedule-event-modal-actions">
          {canWrite && <button type="button" onClick={onEdit} disabled={isSaving}>Edit</button>}
          {canComplete && <button type="button" className="primary-action" onClick={onComplete} disabled={isSaving}>Complete</button>}
          {canReopen && <button type="button" onClick={onReopen} disabled={isSaving}>Reopen</button>}
          {canComplete && <button type="button" onClick={onCancel} disabled={isSaving}>Cancel Event</button>}
          {canWrite && <button type="button" className="row-remove" onClick={onDelete} disabled={isSaving}>Delete</button>}
          <button type="button" onClick={onClose}>Close Detail</button>
        </div>
      </section>
    </div>
  );
}
