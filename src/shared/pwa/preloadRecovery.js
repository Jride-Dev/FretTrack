export const VITE_PRELOAD_RELOAD_GUARD = 'frettrack_vite_preload_reload_attempted';

export function installVitePreloadRecovery(options = {}) {
  const browserWindow = options.windowObject || (typeof window === 'undefined' ? null : window);
  const eventTarget = options.eventTarget || browserWindow;
  const storage = options.storage || getSessionStorage(browserWindow);
  const reload = options.reload || (() => browserWindow?.location.reload());
  let attemptedOnThisPage = false;

  if (!eventTarget) {
    return () => undefined;
  }

  function handlePreloadError(event) {
    if (attemptedOnThisPage || !storage) {
      return;
    }

    try {
      if (storage.getItem(VITE_PRELOAD_RELOAD_GUARD) === '1') {
        return;
      }
      storage.setItem(VITE_PRELOAD_RELOAD_GUARD, '1');
    } catch {
      return;
    }

    attemptedOnThisPage = true;
    event.preventDefault();
    reload();
  }

  eventTarget.addEventListener('vite:preloadError', handlePreloadError);
  return () => eventTarget.removeEventListener('vite:preloadError', handlePreloadError);
}

export function clearVitePreloadReloadGuard(storage) {
  const selectedStorage = storage || getSessionStorage(typeof window === 'undefined' ? null : window);
  if (!selectedStorage) {
    return;
  }

  try {
    selectedStorage.removeItem(VITE_PRELOAD_RELOAD_GUARD);
  } catch {
    // A blocked sessionStorage should not interrupt successful app startup.
  }
}

function getSessionStorage(browserWindow) {
  try {
    return browserWindow?.sessionStorage || null;
  } catch {
    return null;
  }
}
