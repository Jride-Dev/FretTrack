import { getJobSourceLabel } from './jobSources';

const DB_NAME = 'frettrack-offline-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'job-drafts';

function openDraftDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error || new Error('Unable to open local draft storage.'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_shop', 'shopId', { unique: false });
        store.createIndex('by_status', 'status', { unique: false });
        store.createIndex('by_updated_at', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function withStore(mode, callback) {
  return openDraftDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    let settled = false;

    transaction.oncomplete = () => {
      database.close();
      if (!settled) {
        resolve(undefined);
      }
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Local draft transaction failed.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Local draft transaction aborted.'));
    };

    callback(store, resolve, reject);
  }));
}

export async function getOfflineDrafts(shopId = '') {
  const drafts = [];
  await withStore('readonly', (store, resolve, reject) => {
    const request = store.openCursor();
    request.onerror = () => reject(request.error || new Error('Unable to read local drafts.'));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }

      const value = cursor.value;
      if (!shopId || value.shopId === shopId) {
        drafts.push(normalizeDraft(value));
      }
      cursor.continue();
    };
  });

  return drafts.sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
}

export async function saveOfflineDraft(jobData, options = {}) {
  const now = new Date().toISOString();
  const draftId = options.id || options.localDraftId || crypto.randomUUID();
  const draft = normalizeDraft({
    id: draftId,
    localDraftId: options.localDraftId || draftId,
    shopId: options.shopId || jobData.shopId || '',
    status: options.status || 'draft',
    createdAt: options.createdAt || now,
    updatedAt: now,
    lastAttemptAt: options.lastAttemptAt || '',
    lastError: options.lastError || '',
    needsPhotoUpload: Boolean(options.needsPhotoUpload),
    jobData
  });

  await withStore('readwrite', (store, resolve, reject) => {
    const request = store.put(draft);
    request.onerror = () => reject(request.error || new Error('Unable to save local draft.'));
    request.onsuccess = () => resolve(draft);
  });

  return draft;
}

export async function updateOfflineDraft(draftId, patch = {}) {
  const currentDraft = await getOfflineDraft(draftId);
  if (!currentDraft) {
    throw new Error('Draft not found.');
  }

  return saveOfflineDraft(
    patch.jobData || currentDraft.jobData,
    {
      ...currentDraft,
      ...patch,
      id: currentDraft.id,
      localDraftId: currentDraft.localDraftId,
      createdAt: currentDraft.createdAt
    }
  );
}

export async function getOfflineDraft(draftId) {
  let draft = null;
  await withStore('readonly', (store, resolve, reject) => {
    const request = store.get(draftId);
    request.onerror = () => reject(request.error || new Error('Unable to load local draft.'));
    request.onsuccess = () => {
      draft = request.result ? normalizeDraft(request.result) : null;
      resolve();
    };
  });
  return draft;
}

export async function deleteOfflineDraft(draftId) {
  await withStore('readwrite', (store, resolve, reject) => {
    const request = store.delete(draftId);
    request.onerror = () => reject(request.error || new Error('Unable to delete local draft.'));
    request.onsuccess = () => resolve();
  });
}

export function summarizeOfflineDraft(draft) {
  const job = draft?.jobData || {};
  return {
    customerName: job.customerName || [job.customerFirstName, job.customerLastName].filter(Boolean).join(' ') || 'Unnamed Customer',
    instrument: [job.guitarBrand, job.model].filter(Boolean).join(' ') || job.instrumentType || 'Instrument',
    intakeType: getJobSourceLabel(job.intakeType || job.techDetails?.intakeType),
    requestedWork: job.reasonForVisit || '',
    jobNumber: job.jobNumber || '',
    dateReceived: job.dateReceived || '',
    email: job.email || '',
    phone: job.phone || ''
  };
}

function normalizeDraft(draft = {}) {
  return {
    id: draft.id || draft.localDraftId || crypto.randomUUID(),
    localDraftId: draft.localDraftId || draft.id || crypto.randomUUID(),
    shopId: draft.shopId || draft.jobData?.shopId || '',
    status: normalizeDraftStatus(draft.status),
    createdAt: draft.createdAt || new Date().toISOString(),
    updatedAt: draft.updatedAt || draft.createdAt || new Date().toISOString(),
    lastAttemptAt: draft.lastAttemptAt || '',
    lastError: draft.lastError || '',
    needsPhotoUpload: Boolean(draft.needsPhotoUpload),
    jobData: draft.jobData || {}
  };
}

function normalizeDraftStatus(status) {
  if (status === 'pending' || status === 'synced' || status === 'failed') {
    return status;
  }
  return 'draft';
}
