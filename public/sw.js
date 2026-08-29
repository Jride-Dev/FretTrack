const SHELL_CACHE = 'frettrack-shell-v2';
const CORE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/frettrack-emblem.png',
  '/frettrack-wordmark.jpg',
  '/release-icons/frettrack-release-icon-2.png'
];

// Keep runtime caching narrow for authenticated production data:
// - cache the app shell and same-origin static assets only
// - do not cache Supabase API traffic (different origin)
// - do not cache authenticated customer/job payloads
// - do not cache email or messaging provider calls

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== SHELL_CACHE)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (['script', 'style'].includes(request.destination)) {
    event.respondWith(networkAsset(request));
    return;
  }

  if (['image', 'font'].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match('/'));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached && !isHtmlResponse(cached)) {
    return cached;
  }
  if (cached) {
    await cache.delete(request);
  }

  const response = await fetch(request);
  if (isHtmlResponse(response)) {
    return Response.error();
  }
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkAsset(request) {
  const response = await fetch(request);
  return isHtmlResponse(response) ? Response.error() : response;
}

function isHtmlResponse(response) {
  return String(response.headers.get('content-type') || '').toLowerCase().includes('text/html');
}
