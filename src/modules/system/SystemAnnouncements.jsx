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
import {
  formatInfrastructureUptime,
  getCombinedInfrastructureHealth,
  getCombinedInfrastructureUptimeStart,
  getInfrastructureStatus
} from './infrastructureStatus';
import { getElapsedStatusText } from './systemStatus';

const ANNOUNCEMENT_REFRESH_INTERVAL_MS = 60000;
const INFRASTRUCTURE_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const CLOCK_INTERVAL_MS = 1000;

export default function SystemAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [infrastructureStatus, setInfrastructureStatus] = useState([]);
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
        if (nextSystemStatus) {
          void playImportantNoticeOnce(nextSystemStatus, { enabled: noticeSoundsEnabled });
        }
      }
    }

    loadAnnouncements();
    const intervalId = window.setInterval(loadAnnouncements, ANNOUNCEMENT_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [noticeSoundsEnabled]);

  useEffect(() => {
    let isMounted = true;

    async function loadInfrastructureStatus() {
      const nextInfrastructureStatus = await getInfrastructureStatus();
      if (isMounted) {
        setInfrastructureStatus(nextInfrastructureStatus);
        setClock(Date.now());
      }
    }

    loadInfrastructureStatus();
    const infrastructureIntervalId = window.setInterval(
      loadInfrastructureStatus,
      INFRASTRUCTURE_REFRESH_INTERVAL_MS
    );
    const clockIntervalId = window.setInterval(() => setClock(Date.now()), CLOCK_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(infrastructureIntervalId);
      window.clearInterval(clockIntervalId);
    };
  }, []);

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

  const infrastructureUptimeStart = getCombinedInfrastructureUptimeStart(infrastructureStatus);
  const infrastructureHealth = getCombinedInfrastructureHealth(infrastructureStatus);
  const hasFretTrackIncident = Boolean(systemStatus && systemStatus.status !== 'operational');
  const displayedStatus = hasFretTrackIncident ? systemStatus : infrastructureHealth;
  const isOperational = displayedStatus.status === 'operational';

  return (
    <section className="system-announcements no-print" aria-label="System announcements">
      {(systemStatus || infrastructureStatus.length > 0) && (
        <article className={`system-status-banner ${displayedStatus.status}`} role="status" aria-live="polite">
          <div className="system-status-heading">
            <span className="system-status-label">{displayedStatus.statusLabel}</span>
            {hasFretTrackIncident && (
              <strong>{systemStatus?.publicNoticeTitle || 'FretTrack status unavailable'}</strong>
            )}
            {hasFretTrackIncident && systemStatus?.publicNoticeMessage && (
              <span className="system-status-message">{systemStatus.publicNoticeMessage}</span>
            )}
            {isOperational && infrastructureUptimeStart && (
              <span
                className="frettrack-uptime"
                title="Continuous time since the latest resolved incident affecting FretTrack's monitored Supabase or Cloudflare services. Provider history refreshes every 30 minutes."
              >
                FretTrack uptime <strong>{formatInfrastructureUptime(infrastructureUptimeStart, clock)}</strong>
              </span>
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
                  <span className="infrastructure-status-dot" aria-hidden="true" />
                  <span>{provider.label}</span>
                  <span className="visually-hidden">{provider.statusLabel}</span>
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
