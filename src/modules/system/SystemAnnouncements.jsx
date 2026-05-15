import { useEffect, useState } from 'react';
import { dismissAnnouncement, getVisibleAnnouncements } from './systemService';

const REFRESH_INTERVAL_MS = 60000;

export default function SystemAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function loadAnnouncements() {
      const visibleAnnouncements = await getVisibleAnnouncements();
      if (isMounted) {
        setAnnouncements(visibleAnnouncements);
      }
    }

    loadAnnouncements();
    const intervalId = window.setInterval(loadAnnouncements, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function handleDismiss(announcementId) {
    setAnnouncements((current) => current.filter((announcement) => announcement.id !== announcementId));
    try {
      await dismissAnnouncement(announcementId);
    } catch (error) {
      console.error('Announcement dismiss failed.', error);
    }
  }

  if (!announcements.length) {
    return null;
  }

  return (
    <section className="system-announcements no-print" aria-label="System announcements">
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
