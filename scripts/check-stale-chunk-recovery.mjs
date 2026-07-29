import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import {
  VITE_PRELOAD_RELOAD_GUARD,
  clearVitePreloadReloadGuard,
  installVitePreloadRecovery
} from '../src/shared/pwa/preloadRecovery.js';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');

async function checkServiceWorkerAssetHandling() {
  const serviceWorker = read('public/sw.js');
  const handlers = new Map();
  const cacheState = {
    deleteCalls: 0,
    matchResponse: null,
    openCalls: 0,
    putCalls: 0
  };
  let fetchResponse = new Response(null, { status: 204 });
  let fetchCalls = 0;

  const cache = {
    async delete() {
      cacheState.deleteCalls += 1;
      cacheState.matchResponse = null;
      return true;
    },
    async match() {
      return cacheState.matchResponse;
    },
    async put() {
      cacheState.putCalls += 1;
    }
  };

  const context = vm.createContext({
    URL,
    Response,
    caches: {
      async keys() {
        return [];
      },
      async delete() {
        return true;
      },
      async open() {
        cacheState.openCalls += 1;
        return cache;
      }
    },
    console,
    fetch: async () => {
      fetchCalls += 1;
      return fetchResponse;
    },
    self: {
      clients: {
        claim: async () => undefined
      },
      location: {
        origin: 'https://app.frettrack-app.com'
      },
      addEventListener(type, handler) {
        handlers.set(type, handler);
      },
      skipWaiting() {}
    }
  });

  vm.runInContext(serviceWorker, context, { filename: 'public/sw.js' });
  const fetchHandler = handlers.get('fetch');
  assert.equal(typeof fetchHandler, 'function', 'Service worker fetch handler must remain registered.');

  fetchResponse = htmlResponse();
  const missingScript = await dispatchFetch(fetchHandler, requestFor('script', '/assets/App-oldhash.js'));
  assert.equal(missingScript.responded, true, 'Script requests must use the guarded network response.');
  assert.equal(missingScript.response.type, 'error', 'An HTML app shell must be rejected for a missing JavaScript asset.');
  assert.equal(cacheState.openCalls, 0, 'JavaScript requests must not open CacheStorage.');
  assert.equal(cacheState.putCalls, 0, 'JavaScript responses must never be written to CacheStorage.');

  fetchResponse = htmlResponse();
  const missingStyle = await dispatchFetch(fetchHandler, requestFor('style', '/assets/index-oldhash.css'));
  assert.equal(missingStyle.response.type, 'error', 'An HTML app shell must be rejected for a missing stylesheet.');
  assert.equal(cacheState.openCalls, 0, 'Stylesheet requests must not open CacheStorage.');
  assert.equal(cacheState.putCalls, 0, 'Stylesheet responses must never be written to CacheStorage.');

  fetchResponse = new Response('export default true;', {
    status: 200,
    headers: { 'Content-Type': 'text/javascript' }
  });
  const currentScript = await dispatchFetch(fetchHandler, requestFor('script', '/assets/App-currenthash.js'));
  assert.equal(currentScript.response.status, 200, 'Valid JavaScript must pass through unchanged.');
  assert.match(currentScript.response.headers.get('content-type'), /text\/javascript/i, 'Valid JavaScript must retain its content type.');
  assert.equal(cacheState.openCalls, 0, 'Valid JavaScript must rely on browser/CDN HTTP caching.');

  fetchResponse = new Response('image', {
    status: 200,
    headers: { 'Content-Type': 'image/png' }
  });
  const image = await dispatchFetch(fetchHandler, requestFor('image', '/frettrack-emblem.png'));
  assert.equal(image.response.status, 200, 'Safe static images must retain offline cache support.');
  assert.equal(cacheState.openCalls, 1, 'Safe static images may use CacheStorage.');
  assert.equal(cacheState.putCalls, 1, 'Successful safe static images should be cached.');

  cacheState.matchResponse = htmlResponse();
  fetchResponse = new Response('font', {
    status: 200,
    headers: { 'Content-Type': 'font/woff2' }
  });
  const font = await dispatchFetch(fetchHandler, requestFor('font', '/fonts/frettrack.woff2'));
  assert.equal(font.response.status, 200, 'A poisoned cached HTML response must be discarded before serving a safe asset.');
  assert.equal(cacheState.deleteCalls, 1, 'Poisoned HTML cache entries must be removed.');
  assert.equal(fetchCalls, 5, 'Each uncached or rejected test request must use the network exactly once.');
}

function checkPreloadReloadRecovery() {
  const eventTarget = new FakeEventTarget();
  const storage = new MemoryStorage();
  let reloadCount = 0;
  installVitePreloadRecovery({
    eventTarget,
    storage,
    reload: () => {
      reloadCount += 1;
    }
  });

  const firstError = createPreloadError();
  eventTarget.dispatch('vite:preloadError', firstError);
  assert.equal(reloadCount, 1, 'The first stale chunk failure must trigger one reload.');
  assert.equal(firstError.defaultPrevented, true, 'The handled first preload error must not also reach the application error boundary.');
  assert.equal(storage.getItem(VITE_PRELOAD_RELOAD_GUARD), '1', 'The reload attempt must be recorded in sessionStorage.');

  const repeatedError = createPreloadError();
  eventTarget.dispatch('vite:preloadError', repeatedError);
  assert.equal(reloadCount, 1, 'Repeated preload errors on the same page must not reload again.');
  assert.equal(repeatedError.defaultPrevented, false, 'A repeated preload error must remain visible to normal error handling.');

  const reloadedPageTarget = new FakeEventTarget();
  installVitePreloadRecovery({
    eventTarget: reloadedPageTarget,
    storage,
    reload: () => {
      reloadCount += 1;
    }
  });
  const errorAfterReload = createPreloadError();
  reloadedPageTarget.dispatch('vite:preloadError', errorAfterReload);
  assert.equal(reloadCount, 1, 'The session guard must prevent a reload loop across page loads.');
  assert.equal(errorAfterReload.defaultPrevented, false, 'An error after the guarded reload must propagate normally.');

  clearVitePreloadReloadGuard(storage);
  assert.equal(storage.getItem(VITE_PRELOAD_RELOAD_GUARD), null, 'Successful application startup must clear the reload guard.');

  const normalEvent = { preventDefault() { throw new Error('Unrelated events must not be handled.'); } };
  eventTarget.dispatch('error', normalEvent);
  assert.equal(reloadCount, 1, 'Normal application startup and unrelated errors must remain unchanged.');

  const blockedStorageTarget = new FakeEventTarget();
  installVitePreloadRecovery({
    eventTarget: blockedStorageTarget,
    windowObject: {
      get sessionStorage() {
        throw new Error('Storage blocked');
      }
    },
    reload: () => {
      reloadCount += 1;
    }
  });
  const blockedStorageError = createPreloadError();
  blockedStorageTarget.dispatch('vite:preloadError', blockedStorageError);
  assert.equal(reloadCount, 1, 'Blocked sessionStorage must not risk an unguarded reload loop.');
  assert.equal(blockedStorageError.defaultPrevented, false, 'Blocked storage must leave the preload error visible to normal error handling.');
}

function checkStartupWiring() {
  const main = read('src/main.jsx');
  const app = read('src/app/App.jsx');
  assert.match(main, /installVitePreloadRecovery\(\);\s*registerPwaServiceWorker\(\);\s*createRoot/s, 'Preload recovery must be installed before application bootstrap.');
  assert.match(app, /useEffect\(\(\) => \{\s*clearVitePreloadReloadGuard\(\);\s*\}, \[\]\);/s, 'The authenticated App must clear the guard only after it mounts.');
}

async function dispatchFetch(fetchHandler, request) {
  let responsePromise = null;
  fetchHandler({
    request,
    respondWith(value) {
      responsePromise = Promise.resolve(value);
    }
  });

  return {
    responded: Boolean(responsePromise),
    response: responsePromise ? await responsePromise : null
  };
}

function requestFor(destination, pathname) {
  return {
    destination,
    method: 'GET',
    mode: 'cors',
    url: `https://app.frettrack-app.com${pathname}`
  };
}

function htmlResponse() {
  return new Response('<!doctype html><html><body>FretTrack</body></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function createPreloadError() {
  return {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    }
  };
}

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) {
      this.listeners.delete(type);
    }
  }

  dispatch(type, event) {
    this.listeners.get(type)?.(event);
  }
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  removeItem(key) {
    this.values.delete(key);
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

await checkServiceWorkerAssetHandling();
checkPreloadReloadRecovery();
checkStartupWiring();

console.log('Stale chunk deployment recovery checks passed.');
