import { useEffect, useRef } from 'react';
import { listCustomerCorrespondence } from './customerCorrespondenceRepository.js';
import { getNoticeSoundsEnabled, playNoticeChime } from '../system/noticeSound.js';

const MESSAGE_REFRESH_INTERVAL_MS = 60000;

export default function CustomerMessageNotifications({ shopId = '' }) {
  const knownUnreadIdsRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    knownUnreadIdsRef.current = null;

    async function checkForNewMessages() {
      if (!shopId) {
        knownUnreadIdsRef.current = null;
        return;
      }

      try {
        const correspondence = await listCustomerCorrespondence({
          shopId,
          unassignedOnly: true,
          limit: 200
        });
        if (!isMounted) return;

        const unreadMessages = correspondence.filter(
          (message) => message.direction === 'inbound' && message.status === 'received' && !message.readAt
        );
        const nextUnreadIds = new Set(unreadMessages.map((message) => message.id));
        const previousUnreadIds = knownUnreadIdsRef.current;

        if (
          previousUnreadIds
          && unreadMessages.some((message) => !previousUnreadIds.has(message.id))
          && getNoticeSoundsEnabled()
        ) {
          void playNoticeChime('message');
        }

        knownUnreadIdsRef.current = nextUnreadIds;
      } catch {
        // The inbox remains the source of truth. A transient polling failure must stay quiet.
      }
    }

    void checkForNewMessages();
    const intervalId = window.setInterval(checkForNewMessages, MESSAGE_REFRESH_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void checkForNewMessages();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [shopId]);

  return null;
}
