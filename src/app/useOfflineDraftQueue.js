import { useCallback, useEffect, useRef, useState } from 'react';
import { addJob, findRemoteJobByNumber, isDuplicateWorkOrderError } from '../modules/jobs/jobService';
import {
  deleteOfflineDraft,
  getOfflineDrafts,
  saveOfflineDraft,
  updateOfflineDraft
} from '../modules/jobs/offlineDraftService.js';
import { getSelectedShop } from '../modules/shops/shopConfig';
import { getErrorMessage, shouldQueueOfflineDraft } from './appRuntimeHelpers.js';

export default function useOfflineDraftQueue({
  onNotice,
  onOpenDrafts,
  refreshCustomers,
  refreshJobs,
  shopId
}) {
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);
  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [selectedOfflineDraftId, setSelectedOfflineDraftId] = useState('');
  const [syncingDraftId, setSyncingDraftId] = useState('');
  const requestIdRef = useRef(0);

  const resetOfflineDraftQueue = useCallback(() => {
    requestIdRef.current += 1;
    setOfflineDrafts([]);
    setSelectedOfflineDraftId('');
    setSyncingDraftId('');
  }, []);

  const refreshOfflineDraftQueue = useCallback(async (targetShopId = shopId || getSelectedShop().shopId) => {
    if (targetShopId && getSelectedShop().shopId !== targetShopId) {
      return null;
    }
    const requestId = ++requestIdRef.current;
    if (!targetShopId) {
      setOfflineDrafts([]);
      setSelectedOfflineDraftId('');
      return [];
    }

    const drafts = await getOfflineDrafts(targetShopId);
    if (requestId !== requestIdRef.current || getSelectedShop().shopId !== targetShopId) {
      return null;
    }
    setOfflineDrafts(drafts);
    setSelectedOfflineDraftId((currentDraftId) => {
      if (drafts.some((draft) => draft.id === currentDraftId)) {
        return currentDraftId;
      }
      return drafts[0]?.id || '';
    });
    return drafts;
  }, [shopId]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!shopId) {
      resetOfflineDraftQueue();
      return;
    }

    refreshOfflineDraftQueue(shopId).catch((error) => {
      console.error('Offline draft load failed.', error);
      onNotice({
        type: 'error',
        message: getErrorMessage(error, 'Unable to load local drafts.')
      });
    });
  }, [onNotice, refreshOfflineDraftQueue, resetOfflineDraftQueue, shopId]);

  async function handleOfflineDraftSaved(jobDraft, error) {
    if (!shouldQueueOfflineDraft(error)) {
      return false;
    }

    const targetShopId = shopId || getSelectedShop().shopId;
    const draft = await saveOfflineDraft(
      {
        ...jobDraft,
        shopId: targetShopId
      },
      {
        shopId: targetShopId,
        status: 'pending',
        lastError: getErrorMessage(error, 'Connection lost while saving the work order.'),
        needsPhotoUpload: false
      }
    );

    await refreshOfflineDraftQueue(draft.shopId);
    setSelectedOfflineDraftId(draft.id);
    onOpenDrafts();
    onNotice({
      type: 'success',
      message: 'Saved locally as a new-job intake draft. Sync when connection returns.'
    });
    return true;
  }

  async function handleSyncOfflineDraft(draft) {
    if (!draft) {
      return;
    }

    if (!isOnline) {
      onNotice({ type: 'error', message: 'You are offline. Reconnect before syncing local drafts.' });
      return;
    }

    setSyncingDraftId(draft.id);
    try {
      await updateOfflineDraft(draft.id, {
        status: 'pending',
        lastAttemptAt: new Date().toISOString(),
        lastError: ''
      });

      const savedJob = await addJob(draft.jobData);
      await deleteOfflineDraft(draft.id);
      const loadedJobs = await refreshJobs();
      await refreshCustomers(loadedJobs);
      await refreshOfflineDraftQueue(draft.shopId);
      onNotice({
        type: 'success',
        message: `Local draft synced as job ${savedJob?.jobNumber || draft.jobData?.jobNumber || ''}.`
      });
    } catch (error) {
      if (isDuplicateWorkOrderError(error)) {
        const existingJob = await findRemoteJobByNumber(draft.jobData?.jobNumber, draft.shopId);
        if (existingJob?.id) {
          await deleteOfflineDraft(draft.id);
          const loadedJobs = await refreshJobs();
          await refreshCustomers(loadedJobs);
          await refreshOfflineDraftQueue(draft.shopId);
          onNotice({
            type: 'success',
            message: `Draft already exists remotely as ${existingJob.job_number || draft.jobData?.jobNumber}. The local draft was cleared.`
          });
          return;
        }
      }

      await updateOfflineDraft(draft.id, {
        status: 'failed',
        lastAttemptAt: new Date().toISOString(),
        lastError: getErrorMessage(error, 'Draft sync failed.')
      });
      await refreshOfflineDraftQueue(draft.shopId);
      onNotice({
        type: 'error',
        message: getErrorMessage(error, 'Draft sync failed.')
      });
    } finally {
      setSyncingDraftId('');
    }
  }

  async function handleDiscardOfflineDraft(draft) {
    if (!draft) {
      return;
    }

    await deleteOfflineDraft(draft.id);
    await refreshOfflineDraftQueue(draft.shopId);
    onNotice({ type: 'success', message: 'Local draft discarded.' });
  }

  return {
    handleDiscardOfflineDraft,
    handleOfflineDraftSaved,
    handleSyncOfflineDraft,
    isOnline,
    offlineDraftCount: offlineDrafts.filter((draft) => draft.status !== 'synced').length,
    offlineDrafts,
    refreshOfflineDraftQueue,
    resetOfflineDraftQueue,
    selectedOfflineDraftId,
    setSelectedOfflineDraftId,
    syncingDraftId
  };
}
