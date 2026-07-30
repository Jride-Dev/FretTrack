import { useEffect, useState } from 'react';
import { getPublicSystemStatus, updateSystemStatus } from '../system/systemService';
import { formatStatusTimestamp, getElapsedStatusText, SYSTEM_STATUS_LABELS } from '../system/systemStatus';

const DEFAULT_COPY = {
  operational: {
    title: 'All systems operational',
    message: 'FretTrack services are operating normally.'
  },
  maintenance: {
    title: 'Scheduled maintenance',
    message: 'FretTrack is undergoing scheduled maintenance. Some features may be temporarily unavailable.'
  },
  degraded: {
    title: 'Degraded service',
    message: 'Some FretTrack features are responding slowly or may be temporarily unavailable.'
  },
  outage: {
    title: 'Service outage',
    message: 'FretTrack is currently unavailable. We are working to restore service.'
  }
};

export default function SystemStatusOperatorPanel({ onNotice }) {
  const [currentStatus, setCurrentStatus] = useState(null);
  const [status, setStatus] = useState('operational');
  const [noticeType, setNoticeType] = useState('recovery');
  const [title, setTitle] = useState(DEFAULT_COPY.operational.title);
  const [message, setMessage] = useState(DEFAULT_COPY.operational.message);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    setIsLoading(true);
    const loadedStatus = await getPublicSystemStatus();
    setCurrentStatus(loadedStatus);
    if (loadedStatus) {
      setStatus(loadedStatus.status);
      setNoticeType(loadedStatus.noticeType === 'warning' ? 'warning' : 'recovery');
      setTitle(loadedStatus.publicNoticeTitle);
      setMessage(loadedStatus.publicNoticeMessage);
    }
    setIsLoading(false);
  }

  function handleStatusChange(event) {
    const nextStatus = event.target.value;
    setStatus(nextStatus);
    setTitle(DEFAULT_COPY[nextStatus].title);
    setMessage(DEFAULT_COPY[nextStatus].message);
    if (nextStatus !== 'operational') {
      setNoticeType(nextStatus);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const updated = await updateSystemStatus({
        status,
        noticeType: status === 'operational' ? noticeType : status,
        publicNoticeTitle: title.trim(),
        publicNoticeMessage: message.trim()
      });
      setCurrentStatus(updated);
      onNotice?.({ type: 'success', message: 'Public system status and notice published.' });
    } catch (error) {
      console.error('System status update failed.', error);
      onNotice?.({
        type: 'error',
        message: error instanceof Error ? error.message : 'System status update failed.'
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="operator-detail-panel system-status-operator">
      <div>
        <h3>System status and public notice</h3>
        <p className="muted-text">
          Publish one public-safe status shared by the app and frettrack-app.com. Do not include private infrastructure or customer details.
        </p>
      </div>

      {currentStatus && (
        <div className={`operator-current-status ${currentStatus.status}`}>
          <strong>{currentStatus.statusLabel}</strong>
          <span>{getElapsedStatusText(currentStatus)}</span>
          <span>Updated {formatStatusTimestamp(currentStatus.lastUpdatedAt)}</span>
        </div>
      )}

      <form className="system-status-operator-form" onSubmit={handleSubmit}>
        <label>
          Public status
          <select value={status} onChange={handleStatusChange} disabled={isLoading || isSaving}>
            {Object.entries(SYSTEM_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {status === 'operational' && (
          <label>
            Operational notice type
            <select value={noticeType} onChange={(event) => setNoticeType(event.target.value)} disabled={isSaving}>
              <option value="recovery">Recovery / operational update</option>
              <option value="warning">System warning</option>
            </select>
          </label>
        )}
        <label>
          Public notice title
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required disabled={isSaving} />
        </label>
        <label>
          Public notice message
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1200} required disabled={isSaving} />
        </label>
        <button type="submit" disabled={isLoading || isSaving || !title.trim() || !message.trim()}>
          {isSaving ? 'Publishing...' : 'Publish system status'}
        </button>
      </form>
    </section>
  );
}
