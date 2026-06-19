import { formatShopDate } from '../../shared/utils/dateFormat';
import { money } from '../../shared/utils/money';
import { summarizeOfflineDraft } from './offlineDraftService';

export default function OfflineDraftQueue({
  drafts = [],
  selectedDraftId = '',
  onSelectDraft,
  onSyncDraft,
  onDiscardDraft,
  isOnline = true,
  isSyncingDraftId = '',
  canWrite = true,
  dateOptions,
  moneyOptions
}) {
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) || drafts[0] || null;
  const selectedSummary = selectedDraft ? summarizeOfflineDraft(selectedDraft) : null;

  return (
    <section className="customer-module offline-draft-module">
      <div className="customer-module-header">
        <div className="customer-module-titleblock">
          <h2>Local Drafts</h2>
          <p className="muted-text">
            {drafts.length} pending draft{drafts.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="customer-module-actions">
          <span className={`offline-status-pill ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? 'Online: sync manually when ready' : 'Offline: drafts stay local'}
          </span>
        </div>
      </div>

      <div className="customer-module-layout offline-draft-layout">
        <section className="panel customer-list-panel">
          {drafts.length ? (
            <div className="customer-list">
              {drafts.map((draft) => {
                const summary = summarizeOfflineDraft(draft);
                return (
                  <button
                    type="button"
                    key={draft.id}
                    className={`customer-card customer-card-button${draft.id === selectedDraft?.id ? ' selected' : ''}`}
                    onClick={() => onSelectDraft?.(draft.id)}
                  >
                    <div>
                      <strong>{summary.customerName}</strong>
                      <span>{summary.instrument}</span>
                      <span>
                        {summary.jobNumber ? `#${summary.jobNumber}` : 'No job number'}
                        {summary.dateReceived ? ` | ${formatShopDate(summary.dateReceived, dateOptions)}` : ''}
                      </span>
                      <span>{getDraftStatusText(draft)}</span>
                    </div>
                    <div>
                      <strong>{draft.status === 'synced' ? 'Synced' : 'Pending'}</strong>
                      <span>{formatShopDate(draft.updatedAt, dateOptions)} </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-state panel">
              <h2>No local drafts</h2>
              <p>Offline intake drafts will appear here if a new job save needs to stay local.</p>
            </div>
          )}
        </section>

        <section className="panel customer-detail">
          {selectedDraft ? (
            <>
              <div className="customer-detail-heading">
                <h2>{selectedSummary.customerName}</h2>
                <p className="muted-text">{selectedSummary.instrument}</p>
              </div>

              <div className="customer-summary-grid">
                <div className="summary-card">
                  <span>Status</span>
                  <strong>{getDraftStatusLabel(selectedDraft.status)}</strong>
                </div>
                <div className="summary-card">
                  <span>Job Number</span>
                  <strong>{selectedSummary.jobNumber || 'Pending'}</strong>
                </div>
                <div className="summary-card">
                  <span>Parts / Services</span>
                  <strong>{countLineItems(selectedDraft.jobData)}</strong>
                </div>
              </div>

              <div className="form-grid customer-contact-grid">
                <div className="summary-card">
                  <span>Phone</span>
                  <strong>{selectedSummary.phone || 'Not provided'}</strong>
                </div>
                <div className="summary-card">
                  <span>Email</span>
                  <strong>{selectedSummary.email || 'Not provided'}</strong>
                </div>
                <div className="summary-card">
                  <span>Received</span>
                  <strong>{selectedSummary.dateReceived ? formatShopDate(selectedSummary.dateReceived, dateOptions) : 'Not set'}</strong>
                </div>
                <div className="summary-card">
                  <span>Photos</span>
                  <strong>{selectedDraft.needsPhotoUpload ? 'Add after sync' : 'No queued photos'}</strong>
                </div>
              </div>

              <div className="document-email-summary">
                <div className="document-email-summary-row">
                  <span>Requested Work</span>
                  <strong>{selectedSummary.requestedWork || 'No intake notes recorded.'}</strong>
                </div>
                <div className="document-email-summary-row">
                  <span>Intake Type</span>
                  <strong>{selectedSummary.intakeType}</strong>
                </div>
                {selectedDraft.lastError && (
                  <div className="document-email-summary-row">
                    <span>Last Error</span>
                    <strong>{selectedDraft.lastError}</strong>
                  </div>
                )}
                {selectedDraft.jobData?.parts?.length > 0 && (
                  <div className="document-email-summary-row">
                    <span>Parts</span>
                    <strong>{summarizeParts(selectedDraft.jobData.parts, moneyOptions)}</strong>
                  </div>
                )}
                {selectedDraft.jobData?.services?.length > 0 && (
                  <div className="document-email-summary-row">
                    <span>Services</span>
                    <strong>{summarizeServices(selectedDraft.jobData.services, moneyOptions)}</strong>
                  </div>
                )}
              </div>

              <div className="mode-actions">
                <button
                  type="button"
                  className="primary-action"
                  disabled={!canWrite || !isOnline || isSyncingDraftId === selectedDraft.id}
                  onClick={() => onSyncDraft?.(selectedDraft)}
                >
                  {isSyncingDraftId === selectedDraft.id ? 'Syncing...' : 'Sync Draft'}
                </button>
                <button
                  type="button"
                  className="button-tertiary"
                  disabled={!canWrite || isSyncingDraftId === selectedDraft.id}
                  onClick={() => onDiscardDraft?.(selectedDraft)}
                >
                  Discard Draft
                </button>
              </div>

              <p className="muted-text">
                {!canWrite
                  ? 'Your current shop role can review local drafts but cannot sync or discard them.'
                  : 'Offline draft mode only queues new job intake. Existing job edits, photos, inventory, purchase orders, and receiving require an active connection.'}
              </p>
            </>
          ) : (
            <div className="empty-state">
              <h2>Select a draft</h2>
              <p>Choose a local draft to review, sync, or discard.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function getDraftStatusText(draft) {
  if (draft.lastError) {
    return `Last error: ${draft.lastError}`;
  }
  if (draft.status === 'failed') {
    return 'Sync failed. Review and retry when ready.';
  }
  if (draft.status === 'pending') {
    return 'Waiting for manual sync.';
  }
  return 'Saved locally on this device.';
}

function getDraftStatusLabel(status) {
  if (status === 'failed') {
    return 'Failed';
  }
  if (status === 'pending') {
    return 'Pending';
  }
  if (status === 'synced') {
    return 'Synced';
  }
  return 'Draft';
}

function countLineItems(jobData = {}) {
  const parts = Array.isArray(jobData.parts) ? jobData.parts.length : 0;
  const services = Array.isArray(jobData.services) ? jobData.services.length : 0;
  return `${parts} part${parts === 1 ? '' : 's'} / ${services} service${services === 1 ? '' : 's'}`;
}

function summarizeParts(parts = [], moneyOptions) {
  return parts.map((part) => `${part.name || 'Part'} x${Number(part.quantity || 1)} (${money(Number(part.retail || 0), moneyOptions)})`).join(', ');
}

function summarizeServices(services = [], moneyOptions) {
  return services.map((service) => `${service.description || 'Service'} x${Number(service.quantity || 1)} (${money(Number(service.retail || 0), moneyOptions)})`).join(', ');
}
