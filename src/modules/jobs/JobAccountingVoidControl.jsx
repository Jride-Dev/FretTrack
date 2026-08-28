import { useEffect, useState } from 'react';

export default function JobAccountingVoidControl({
  job,
  canManage = false,
  onChange,
  onNotice
}) {
  const isVoided = Boolean(job.accountingVoidedAt);
  const [isEditing, setIsEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setReason('');
  }, [job.id, isVoided]);

  async function submit(event) {
    event.preventDefault();
    const cleanReason = reason.trim();
    if (cleanReason.length < 8) {
      onNotice?.({ type: 'error', message: 'Enter an audit reason of at least 8 characters.' });
      return;
    }

    setIsSaving(true);
    try {
      await onChange?.(job.id, !isVoided, cleanReason);
      setIsEditing(false);
      setReason('');
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to change accounting exclusion.' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={`accounting-void-control no-print${isVoided ? ' is-voided' : ''}`}>
      <div>
        <div className="accounting-void-heading">
          <strong>Accounting status</strong>
          <span className={`status-pill ${isVoided ? 'danger' : 'success'}`}>
            {isVoided ? 'Excluded' : 'Included'}
          </span>
        </div>
        <p>
          {isVoided
            ? 'This work order is preserved for audit history, but its totals and counts are excluded from accounting and operational reports.'
            : 'This work order is included in accounting totals and operational reports.'}
        </p>
        {isVoided && job.accountingVoidReason && <p><strong>Reason:</strong> {job.accountingVoidReason}</p>}
      </div>

      {canManage && !isEditing && (
        <button
          type="button"
          className={isVoided ? '' : 'danger-action'}
          onClick={() => setIsEditing(true)}
        >
          {isVoided ? 'Restore to Accounting' : 'Exclude / Void Work Order'}
        </button>
      )}

      {canManage && isEditing && (
        <form onSubmit={submit}>
          <label>
            Audit reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength="8"
              maxLength="500"
              rows="3"
              required
              autoFocus
              placeholder={isVoided ? 'Why is this work order being restored?' : 'Why should this work order be excluded?'}
              disabled={isSaving}
            />
          </label>
          <div className="accounting-void-actions">
            <button type="submit" className={isVoided ? '' : 'danger-action'} disabled={isSaving}>
              {isSaving ? 'Saving…' : isVoided ? 'Confirm Restore' : 'Confirm Exclusion'}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
