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
import { getInfrastructureStatus } from './infrastructureStatus';
import { getElapsedStatusText } from './systemStatus';

const REFRESH_INTERVAL_MS = 60000;

export default function SystemAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [infrastructureStatus, setInfrastructureStatus] = useState([]);
  const [noticeSoundsEnabled, setSoundsEnabled] = useState(() => getNoticeSoundsEnabled());

  useEffect(() => {
    let isMounted = true;

    async function loadAnnouncements() {
      const [visibleAnnouncements, nextSystemStatus, nextInfrastructureStatus] = await Promise.all([
        getVisibleAnnouncements(),
        getPublicSystemStatus(),
        getInfrastructureStatus()
      ]);
      if (isMounted) {
        setAnnouncements(visibleAnnouncements);
        setSystemStatus(nextSystemStatus);
        setInfrastructureStatus(nextInfrastructureStatus);
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

  if (!announcements.length && !systemStatus && !infrastructureStatus.length) {
    return null;
  }

  return (
    <section className="system-announcements no-print" aria-label="System announcements">
      {(systemStatus || infrastructureStatus.length > 0) && (
        <article className={`system-status-banner ${systemStatus?.status || 'unknown'}`} role="status" aria-live="polite">
          <div className="system-status-heading">
            <span className="system-status-label">{systemStatus?.statusLabel || 'Status unavailable'}</span>
            <strong>{systemStatus?.publicNoticeTitle || 'FretTrack status unavailable'}</strong>
            {systemStatus?.publicNoticeMessage && (
              <span className="system-status-message">{systemStatus.publicNoticeMessage}</span>
            )}
            <div className="infrastructure-status-list" aria-label="Infrastructure provider health">
              {infrastructureStatus.map((provider) => (
                <a
                  key={provider.key}
                  className={`infrastructure-status-chip ${provider.status}`}
                  href={provider.statusUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open ${provider.label} status page`}
                >
                  <span>{provider.label}</span>
                  <strong>{provider.statusLabel}</strong>
                </a>
              ))}
            </div>
            <label className="system-notice-sound-toggle">
              <input
                type="checkbox"
                checked={noticeSoundsEnabled}
                onChange={handleSoundsChange}
              />
              Sound
            </label>
          </div>
          {systemStatus?.incidentState && (
            <div className="system-incident-guidance">
              <span>{getElapsedStatusText(systemStatus)}</span>
              <span>Unexpected errors may be related to this incident.</span>
            </div>
          )}
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
