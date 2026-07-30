import { useEffect, useState } from 'react';
import {
  getNoticeSoundsEnabled,
  playImportantNoticeOnce,
  setNoticeSoundsEnabled
} from './noticeSound';
import {
  dismissAnnouncement,
  getPublicSystemStatus,
  getVisibleAnnouncements
} from './systemService';
import { formatStatusTimestamp, getElapsedStatusText } from './systemStatus';

const REFRESH_INTERVAL_MS = 60000;

export default function SystemAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [noticeSoundsEnabled, setSoundsEnabled] = useState(() => getNoticeSoundsEnabled());
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    let isMounted = true;

    async function loadAnnouncements() {
      const [visibleAnnouncements, nextSystemStatus] = await Promise.all([
        getVisibleAnnouncements(),
        getPublicSystemStatus()
      ]);
      if (isMounted) {
        setAnnouncements(visibleAnnouncements);
        setSystemStatus(nextSystemStatus);
        setClock(Date.now());
        if (nextSystemStatus) {
          void playImportantNoticeOnce(nextSystemStatus, { enabled: noticeSoundsEnabled });
        }
      }
    }

    loadAnnouncements();
    const intervalId = window.setInterval(loadAnnouncements, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [noticeSoundsEnabled]);

  function handleSoundsChange(event) {
    const enabled = event.target.checked;
    setSoundsEnabled(enabled);
    setNoticeSoundsEnabled(enabled);
  }

  async function handleDismiss(announcementId) {
    setAnnouncements((current) => current.filter((announcement) => announcement.id !== announcementId));
    try {
      await dismissAnnouncement(announcementId);
    } catch (error) {
      console.error('Announcement dismiss failed.', error);
    }
  }

  if (!announcements.length && !systemStatus) {
    return null;
  }

  return (
    <section className="system-announcements no-print" aria-label="System announcements">
      {systemStatus && (
        <article className={`system-status-banner ${systemStatus.status}`} role="status" aria-live="polite">
          <div className="system-status-heading">
            <div>
              <span className="system-status-label">{systemStatus.statusLabel}</span>
              <strong>{systemStatus.publicNoticeTitle}</strong>
            </div>
            <label className="system-notice-sound-toggle">
              <input
                type="checkbox"
                checked={noticeSoundsEnabled}
                onChange={handleSoundsChange}
              />
              Notice sounds
            </label>
          </div>
          <p>{systemStatus.publicNoticeMessage}</p>
          {systemStatus.incidentState && (
            <p className="system-incident-guidance">
              Unexpected errors may be related to this active incident.
            </p>
          )}
          <div className="system-status-meta">
            <span>{getElapsedStatusText(systemStatus, clock)}</span>
            <span>Updated {formatStatusTimestamp(systemStatus.lastUpdatedAt)}</span>
          </div>
        </article>
      )}
      {announcements.map((announcement) => (
        <article key={announcement.id} className={`system-announcement ${announcement.severity}`}>
          <div>
            <strong>{announcement.title}</strong>
            <p>{announcement.message}</p>
          </div>
          <button type="button" onClick={() => handleDismiss(announcement.id)} aria-label="Dismiss announcement">
            Dismiss
          </button>
        </article>
      ))}
    </section>
  );
}
