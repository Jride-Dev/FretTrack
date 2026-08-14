import { formatShopDateTime } from '../../shared/utils/dateFormat';
import { getShopDateOptions } from '../shops/shopConfig';

export default function WorkLogSection({
  canWrite = true,
  appendWorkLog,
  discardWorkLogDraft,
  draftJob,
  hasPendingWorkLog = false,
  isSavingWorkLog = false,
  removeWorkLogEntry,
  saveWorkLogChanges,
  setWorkLogText,
  updateWorkLogEntry,
  workLogText
}) {
  const dateOptions = getShopDateOptions();

  return (
    <section>
      <h3>Work Log</h3>
      <form className="row-form" onSubmit={appendWorkLog}>
        <textarea
          aria-label="New Work Note"
          value={workLogText}
          onChange={(event) => setWorkLogText(event.target.value)}
          placeholder="Type the work performed, then choose Save Work Note."
          rows="3"
          disabled={!canWrite || isSavingWorkLog}
        />
        <div className="work-log-draft-actions">
          <button type="submit" disabled={!canWrite || !hasPendingWorkLog || isSavingWorkLog}>
            {isSavingWorkLog ? 'Saving Work Note…' : 'Save Work Note'}
          </button>
          {hasPendingWorkLog && (
            <button type="button" className="button-tertiary" onClick={discardWorkLogDraft} disabled={isSavingWorkLog}>Discard Draft</button>
          )}
        </div>
      </form>
      {hasPendingWorkLog && (
        <p className="work-log-draft-status" role="status">Unsaved Work Note — save or discard it before printing or leaving this job.</p>
      )}
      <div className="entries">
        {draftJob.workLog.map((entry) => (
          <div key={entry.id} className="entry">
            <time>{formatShopDateTime(entry.timestamp, dateOptions)}</time>
            <textarea
              value={entry.text}
              onChange={(event) => updateWorkLogEntry(entry.id, event.target.value)}
              onBlur={saveWorkLogChanges}
              rows="3"
              disabled={!canWrite}
            />
            <button type="button" className="entry-delete no-print" onClick={() => removeWorkLogEntry(entry.id)} disabled={!canWrite}>
              Delete Entry
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
